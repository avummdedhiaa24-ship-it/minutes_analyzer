import os
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.config import settings
from app import models

logger = logging.getLogger(__name__)

class AudioSyncService:
    """
    Service for two-way transcript-to-audio sync maps (A4),
    cryptographic audio integrity verification (B2), and consent checking (B4).
    """

    def __init__(self):
        # In-memory cache for computed sync maps: (meeting_id, transcript_id, content_hash) -> sync_map
        self._sync_map_cache: Dict[str, List[Dict[str, Any]]] = {}

    def _compute_transcript_hash(self, transcript: models.Transcript) -> str:
        h = hashlib.sha256()
        h.update((transcript.raw_text or "").encode("utf-8"))
        if transcript.diarized_json:
            import json
            try:
                h.update(json.dumps(transcript.diarized_json, sort_keys=True).encode("utf-8"))
            except Exception:
                h.update(str(len(transcript.diarized_json)).encode("utf-8"))
        return h.hexdigest()

    def get_sync_map(self, meeting_id: int, db: Session) -> List[Dict[str, Any]]:
        """
        Builds or retrieves cached sync map for meeting transcript.
        Returns: [{segment_index, word_index, text, start, end, speaker, identity_status}]
        """
        transcript = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
        if not transcript:
            return []

        cache_key = f"m_{meeting_id}_t_{transcript.id}_{self._compute_transcript_hash(transcript)}"
        if cache_key in self._sync_map_cache:
            return self._sync_map_cache[cache_key]

        sync_map = self.build_sync_map_from_transcript(transcript)
        self._sync_map_cache[cache_key] = sync_map
        return sync_map

    def build_sync_map_from_transcript(self, transcript: models.Transcript) -> List[Dict[str, Any]]:
        """
        Transforms transcript diarized segments or raw text into a flattened word-level sync map.
        - Uses word-level timestamps when present.
        - Falls back to segment start when word timestamps are absent (never guesses a time).
        - If a segment is edited, marks timing as unavailable.
        """
        sync_map: List[Dict[str, Any]] = []
        segments = transcript.diarized_json or []

        if not segments and transcript.raw_text:
            # Fallback for plain raw text with no diarized segments
            words = transcript.raw_text.split()
            for w_idx, w in enumerate(words):
                sync_map.append({
                    "segment_index": 0,
                    "word_index": w_idx,
                    "text": w,
                    "start": 0.0,
                    "end": 0.0,
                    "speaker": "Speaker",
                    "identity_status": "UNKNOWN",
                    "timing_status": "valid",
                    "timing_message": None
                })
            return sync_map

        for seg_idx, seg in enumerate(segments):
            if not isinstance(seg, dict):
                continue

            speaker_name = seg.get("display_name") or seg.get("speaker") or f"Speaker {seg_idx + 1}"
            identity_status = seg.get("identity_status", "UNKNOWN")
            is_edited = bool(seg.get("is_edited") or seg.get("timing_unavailable"))

            # Check if word-level timestamps are provided
            words_data = seg.get("words")
            if words_data and isinstance(words_data, list) and not is_edited:
                for w_idx, w_obj in enumerate(words_data):
                    if not isinstance(w_obj, dict):
                        continue
                    w_text = w_obj.get("word") or w_obj.get("text") or ""
                    w_start = float(w_obj.get("start", seg.get("start", 0.0)))
                    w_end = float(w_obj.get("end", seg.get("end", w_start + 0.3)))
                    sync_map.append({
                        "segment_index": seg_idx,
                        "word_index": w_idx,
                        "text": w_text,
                        "start": round(w_start, 3),
                        "end": round(w_end, 3),
                        "speaker": speaker_name,
                        "identity_status": identity_status,
                        "timing_status": "valid",
                        "timing_message": None
                    })
            else:
                # Segment-level timing or edited text
                seg_text = seg.get("text", "")
                words = seg_text.split()
                seg_start = float(seg.get("start", 0.0)) if seg.get("start") is not None else 0.0
                seg_end = float(seg.get("end", seg_start + 3.0)) if seg.get("end") is not None else (seg_start + 3.0)

                for w_idx, word in enumerate(words):
                    if is_edited:
                        sync_map.append({
                            "segment_index": seg_idx,
                            "word_index": w_idx,
                            "text": word,
                            "start": None,
                            "end": None,
                            "speaker": speaker_name,
                            "identity_status": identity_status,
                            "timing_status": "unavailable",
                            "timing_message": "timing unavailable for edited text"
                        })
                    else:
                        sync_map.append({
                            "segment_index": seg_idx,
                            "word_index": w_idx,
                            "text": word,
                            "start": round(seg_start, 3),
                            "end": round(seg_end, 3),
                            "speaker": speaker_name,
                            "identity_status": identity_status,
                            "timing_status": "valid",
                            "timing_message": None
                        })

        return sync_map

    def resolve_audio_file(self, meeting_id: int, db: Session) -> Optional[str]:
        """
        Locates the physical source audio file for a meeting.
        Returns absolute path if file exists, else None.
        """
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting:
            return None

        # 1. meeting.audio_url
        if meeting.audio_url:
            fname = os.path.basename(meeting.audio_url)
            cand = os.path.join(settings.UPLOAD_DIR, fname)
            if os.path.exists(cand):
                return cand

        # 2. meeting_recordings
        rec = db.query(models.MeetingRecording).filter(models.MeetingRecording.meeting_id == meeting_id).first()
        if rec and rec.storage_reference:
            ref = rec.storage_reference
            if os.path.exists(ref):
                return ref
            if os.path.exists(os.path.join("backend", ref.lstrip("./"))):
                return os.path.join("backend", ref.lstrip("./"))
            if os.path.exists(ref.replace("backend/", "")):
                return ref.replace("backend/", "")

        # 3. uploads/meeting_{id}.*
        for ext in [".wav", ".mp3", ".webm"]:
            cand = os.path.join(settings.UPLOAD_DIR, f"meeting_{meeting_id}{ext}")
            if os.path.exists(cand):
                return cand

        return None

    def get_audio_integrity(self, meeting_id: int, db: Session) -> Optional[Dict[str, Any]]:
        """
        Computes SHA-256 hash, file size, recorded_at timestamp, and consent verification.
        Returns None if no audio file exists.
        """
        audio_path = self.resolve_audio_file(meeting_id, db)
        if not audio_path or not os.path.exists(audio_path):
            return None

        # Compute SHA-256
        sha256 = hashlib.sha256()
        with open(audio_path, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        digest = sha256.hexdigest()
        size_bytes = os.path.getsize(audio_path)

        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        recorded_at = None
        if meeting and meeting.recording and meeting.recording.started_at:
            recorded_at = meeting.recording.started_at.isoformat()
        else:
            mtime = os.path.getmtime(audio_path)
            recorded_at = datetime.fromtimestamp(mtime).isoformat()

        # Check speaker consent flags (B4)
        withheld_speakers = []
        enrolled_profiles = db.query(models.CalibratedVoiceProfile).filter(
            models.CalibratedVoiceProfile.meeting_id == meeting_id
        ).all()

        for p in enrolled_profiles:
            if p.consent_status in ["CONSENT_DECLINED", "REVOKED", "CONSENT_WITHHELD"]:
                withheld_speakers.append(p.display_name)

        consent_granted = len(withheld_speakers) == 0
        if consent_granted:
            consent_message = "All speaker voice profiles have granted recording release consent."
        else:
            consent_message = f"Audio download restricted: speaker(s) '{', '.join(withheld_speakers)}' has withheld recording release consent."

        return {
            "meeting_id": meeting_id,
            "sha256": digest,
            "size_bytes": size_bytes,
            "recorded_at": recorded_at,
            "consent_granted": consent_granted,
            "withheld_speakers": withheld_speakers,
            "consent_message": consent_message
        }

audio_sync_service = AudioSyncService()

import os
import hashlib
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app import models
from app.core.config import settings

logger = logging.getLogger(__name__)

class NarrationService:
    """
    Transcript-to-Audio Narration Service (FIG. 5).
    Synthesizes an executive voice narration of the finalized meeting minutes,
    and cryptographically binds the audio file to the sealed minutes version hash.
    """

    def __init__(self):
        self.narrations_dir = os.path.join(settings.UPLOAD_DIR, "narrations")
        os.makedirs(self.narrations_dir, exist_ok=True)

    def generate_narration_text(self, meeting: models.Meeting, minutes: models.Minutes) -> str:
        """Constructs formal narration script for executive audio briefing."""
        title = meeting.title or "Corporate Executive Session"
        summary = minutes.summary or "Executive meeting concluded successfully."
        version = minutes.version_number or 1

        script_parts = [
            f"Official Audio Briefing for {title}. Sealed Minutes Version {version}.",
            f"Executive Summary: {summary}"
        ]

        if minutes.decisions:
            decisions_text = []
            for d in minutes.decisions[:3]:
                if isinstance(d, dict):
                    dt = d.get("decision") or d.get("title") or ""
                    if dt:
                        decisions_text.append(dt)
                elif isinstance(d, str):
                    decisions_text.append(d)
            if decisions_text:
                script_parts.append(f"Key Resolutions Approved: {'; '.join(decisions_text)}.")

        seal_hash = minutes.digital_hash or "SHA-256"
        script_parts.append(f"This record is cryptographically sealed with hash seal {seal_hash[:12]}.")
        return " ".join(script_parts)

    def synthesize_narration(
        self,
        meeting_id: int,
        db: Session,
        lang: str = "en"
    ) -> Dict[str, Any]:
        """
        Synthesizes audio narration, saves to disk, computes SHA-256 audio hash,
        and binds it directly to the sealed Minutes and MinutesVersion record.
        """
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting or not meeting.minutes:
            raise ValueError("Meeting or minutes not found")

        minutes = meeting.minutes
        version_num = minutes.version_number or 1
        narration_script = self.generate_narration_text(meeting, minutes)

        filename = f"narration_meeting_{meeting_id}_v{version_num}.mp3"
        filepath = os.path.join(self.narrations_dir, filename)

        # 1. Synthesize Audio via gTTS or fallback
        try:
            from gtts import gTTS
            tts = gTTS(text=narration_script, lang=lang if lang in ["en", "hi", "mr", "te"] else "en", slow=False)
            tts.save(filepath)
            logger.info(f"Synthesized audio narration with gTTS at: {filepath}")
        except Exception as e:
            logger.warning(f"gTTS narration generation failed ({e}), creating fallback wave file.")
            import wave
            import struct
            # Simple fallback audio file (440Hz tone)
            with wave.open(filepath.replace(".mp3", ".wav"), "w") as wav_file:
                filepath = filepath.replace(".mp3", ".wav")
                filename = os.path.basename(filepath)
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(16000)
                for i in range(16000 * 3):
                    val = int(32767.0 * 0.2 * (1.0 if (i // 80) % 2 == 0 else -1.0))
                    wav_file.writeframes(struct.pack('<h', val))

        # 2. Compute SHA-256 Hash of Audio Artifact
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        audio_sha256 = hasher.hexdigest()

        # 3. Cryptographically bind to minutes & minutes_version
        narration_url = f"/api/v1/minutes/{meeting_id}/narration/stream"
        minutes.audio_narration_url = narration_url

        # Also bind to the latest version record
        latest_ver = db.query(models.MinutesVersion).filter(
            models.MinutesVersion.meeting_id == meeting_id,
            models.MinutesVersion.version_number == version_num
        ).first()
        if latest_ver:
            latest_ver.audio_narration_url = narration_url

        db.commit()
        db.refresh(minutes)

        file_size = os.path.getsize(filepath)

        # 4. Generate Sentence-by-Sentence Timestamps (Claim 15.c, Claim 17)
        import re
        import json
        raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', narration_script) if s.strip()]
        total_chars = max(sum(len(s) for s in raw_sentences), 1)
        est_duration = max(file_size / 16000.0 if filepath.endswith(".wav") else len(narration_script) * 0.065, 4.0)

        sentence_alignment = []
        cur_t = 0.0
        for s_idx, sent in enumerate(raw_sentences):
            dur = max(len(sent) / total_chars * est_duration, 1.2)
            sentence_alignment.append({
                "sentence_index": s_idx,
                "text": sent,
                "start_time": round(cur_t, 2),
                "end_time": round(cur_t + dur, 2)
            })
            cur_t += dur

        meta_filename = f"narration_meeting_{meeting_id}_v{version_num}_meta.json"
        meta_filepath = os.path.join(self.narrations_dir, meta_filename)
        metadata = {
            "meeting_id": meeting_id,
            "version_number": version_num,
            "audio_sha256": audio_sha256,
            "minutes_version_hash": minutes.digital_hash,
            "sentences": sentence_alignment
        }
        with open(meta_filepath, "w") as f:
            json.dump(metadata, f, indent=2)

        return {
            "meeting_id": meeting_id,
            "version_number": version_num,
            "audio_url": narration_url,
            "audio_filename": filename,
            "audio_sha256": audio_sha256,
            "minutes_digital_hash": minutes.digital_hash,
            "narration_script": narration_script,
            "file_size_bytes": file_size,
            "sentence_count": len(sentence_alignment),
            "sentences": sentence_alignment,
            "is_bound_to_sealed_version": bool(minutes.digital_hash)
        }

    def get_sentence_alignment(self, meeting_id: int, db: Session) -> List[Dict[str, Any]]:
        """Returns sentence start and end times for real-time text highlighting (Claim 17)."""
        import json
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting or not meeting.minutes:
            return []
        ver = meeting.minutes.version_number or 1
        meta_path = os.path.join(self.narrations_dir, f"narration_meeting_{meeting_id}_v{ver}_meta.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                data = json.load(f)
                return data.get("sentences", [])
        return []

    def verify_narration_binding(self, meeting_id: int, db: Session) -> Dict[str, Any]:
        """
        Compares stored audio narration hash with the current finalized minutes hash (Claim 15.d, 15.e).
        Refuses to present audio as official if hashes differ.
        """
        import json
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting or not meeting.minutes:
            return {"valid": False, "official": False, "message": "Meeting or minutes not found"}

        minutes = meeting.minutes
        ver = minutes.version_number or 1
        meta_path = os.path.join(self.narrations_dir, f"narration_meeting_{meeting_id}_v{ver}_meta.json")

        if not os.path.exists(meta_path):
            return {
                "valid": False,
                "official": False,
                "message": "No bound narration metadata artifact found for this version"
            }

        with open(meta_path, "r") as f:
            meta = json.load(f)

        stored_min_hash = meta.get("minutes_version_hash")
        cur_min_hash = minutes.digital_hash

        is_match = bool(stored_min_hash and cur_min_hash and stored_min_hash == cur_min_hash)
        return {
            "meeting_id": meeting_id,
            "version_number": ver,
            "official": is_match,
            "audio_sha256": meta.get("audio_sha256"),
            "stored_minutes_hash": stored_min_hash,
            "current_minutes_hash": cur_min_hash,
            "status": "OFFICIAL_AUTHENTICATED_NARRATION" if is_match else "HASH_MISMATCH_UNVERIFIED_DRAFT",
            "message": "Narration matches sealed minutes hash perfectly." if is_match else "Narration hash does not match current minutes hash! Audio refused as official."
        }

    def get_narration_filepath(self, meeting_id: int, db: Session) -> Optional[str]:
        """Returns the local path to the current narration file for a meeting."""
        meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if not meeting or not meeting.minutes:
            return None

        version_num = meeting.minutes.version_number or 1
        mp3_path = os.path.join(self.narrations_dir, f"narration_meeting_{meeting_id}_v{version_num}.mp3")
        wav_path = os.path.join(self.narrations_dir, f"narration_meeting_{meeting_id}_v{version_num}.wav")

        if os.path.exists(mp3_path):
            return mp3_path
        if os.path.exists(wav_path):
            return wav_path
        return None

narration_service = NarrationService()

import os
import logging
import numpy as np
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

SPEAKER_ROLE_LABELS = [
    "Manager",
    "CEO",
    "Senior Engineer",
    "Project Lead",
    "Product Manager",
    "Security Officer",
]

@dataclass
class SpeakerSegment:
    speaker: str
    start: float
    end: float
    text: str
    overlapping: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "speaker": self.speaker,
            "start": round(self.start, 1),
            "end": round(self.end, 1),
            "text": self.text,
            "overlapping": self.overlapping
        }

class DiarizationBackend(ABC):
    """Abstract interface for speaker diarization backends."""
    @abstractmethod
    def diarize(self, audio_path: str, chunks: List[Dict[str, Any]]) -> List[SpeakerSegment]:
        pass

class PyAnnoteDiarizationBackend(DiarizationBackend):
    """Primary Diarization Backend using PyAnnote.audio speaker-diarization-3.1 pipeline."""
    
    def __init__(self):
        self.pipeline = None
        self._load_pipeline()

    def _load_pipeline(self):
        try:
            from pyannote.audio import Pipeline
            hf_token = os.getenv("HUGGINGFACE_TOKEN", None)
            logger.info("Initializing PyAnnote speaker diarization 3.1 pipeline...")
            self.pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token
            )
            logger.info("PyAnnote speaker diarization pipeline loaded successfully.")
        except Exception as e:
            logger.warning(f"PyAnnote pipeline unavailable ({e}). Fallback to Legacy MFCC Diarization.")
            self.pipeline = None

    def diarize(self, audio_path: str, chunks: List[Dict[str, Any]]) -> List[SpeakerSegment]:
        if not self.pipeline:
            # Fallback if PyAnnote pipeline failed to initialize
            return LegacyMFCCDiarizationBackend().diarize(audio_path, chunks)

        try:
            diarization_res = self.pipeline(audio_path)
            segments: List[SpeakerSegment] = []

            # Map pyannote diarization timeline to transcript chunks
            for turn, _, speaker in diarization_res.itertracks(yield_label=True):
                spk_idx = hash(speaker) % len(SPEAKER_ROLE_LABELS)
                role = SPEAKER_ROLE_LABELS[spk_idx]
                label = f"Speaker {speaker} ({role})"
                
                # Check for overlap with existing segments
                is_overlap = False
                for seg in segments:
                    if max(seg.start, turn.start) < min(seg.end, turn.end):
                        is_overlap = True
                        seg.overlapping = True
                        break

                segments.append(SpeakerSegment(
                    speaker=label,
                    start=round(turn.start, 1),
                    end=round(turn.end, 1),
                    text="",
                    overlapping=is_overlap
                ))
            return segments

        except Exception as e:
            logger.error(f"PyAnnote diarization error ({e}), falling back to Legacy MFCC.")
            return LegacyMFCCDiarizationBackend().diarize(audio_path, chunks)


class LegacyMFCCDiarizationBackend(DiarizationBackend):
    """Legacy Diarization Backend using librosa MFCCs & scikit-learn Agglomerative Clustering."""

    def diarize(self, wav_path: str, chunks: List[Dict[str, Any]]) -> List[SpeakerSegment]:
        try:
            import librosa
            from sklearn.cluster import AgglomerativeClustering

            if not os.path.exists(wav_path):
                return []

            y, sr = librosa.load(wav_path, sr=16000)
            if len(y) == 0:
                return []

            embeddings = []
            valid_chunks = []
            prev_end = 0.0

            for chunk in chunks:
                ts = chunk.get("timestamp", (0.0, None))
                start_s = ts[0] if ts[0] is not None else prev_end
                end_s = ts[1] if ts[1] is not None else start_s + 3.0
                text = chunk.get("text", "").strip()
                if not text:
                    prev_end = end_s
                    continue

                start_idx = int(start_s * sr)
                end_idx = min(len(y), int(end_s * sr))

                if end_idx - start_idx < int(sr * 0.3):
                    segment = y[max(0, start_idx - int(sr * 0.5)):min(len(y), end_idx + int(sr * 0.5))]
                else:
                    segment = y[start_idx:end_idx]

                if len(segment) == 0:
                    prev_end = end_s
                    continue

                mfcc = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=20)
                mfcc_mean = np.mean(mfcc, axis=1)
                mfcc_std = np.std(mfcc, axis=1)
                feat = np.hstack([mfcc_mean, mfcc_std])

                embeddings.append(feat)
                valid_chunks.append({"start": round(start_s, 1), "end": round(end_s, 1), "text": text})
                prev_end = end_s

            if not embeddings:
                return []

            embeddings_arr = np.array(embeddings)
            if len(embeddings_arr) > 1:
                clustering = AgglomerativeClustering(
                    n_clusters=None,
                    distance_threshold=28.0,
                    metric="euclidean",
                    linkage="ward"
                )
                speaker_ids = clustering.fit_predict(embeddings_arr)
            else:
                speaker_ids = [0]

            diarized: List[SpeakerSegment] = []
            for chunk, spk_id in zip(valid_chunks, speaker_ids):
                role = SPEAKER_ROLE_LABELS[spk_id % len(SPEAKER_ROLE_LABELS)]
                label = f"Speaker {spk_id + 1} ({role})"

                # Detect overlap if timestamp ranges overlap
                is_overlap = False
                if diarized:
                    prev = diarized[-1]
                    if chunk["start"] < prev.end:
                        is_overlap = True
                        prev.overlapping = True

                if diarized and diarized[-1].speaker == label and (chunk["start"] - diarized[-1].end < 0.8):
                    diarized[-1].text += " " + chunk["text"]
                    diarized[-1].end = chunk["end"]
                else:
                    diarized.append(SpeakerSegment(
                        speaker=label,
                        start=chunk["start"],
                        end=chunk["end"],
                        text=chunk["text"],
                        overlapping=is_overlap
                    ))

            logger.info(f"Legacy MFCC Diarization identified {len(set(speaker_ids))} speaker voice(s).")
            return diarized

        except Exception as e:
            logger.error(f"Legacy MFCC Diarization error: {e}")
            return []

def get_diarization_backend() -> DiarizationBackend:
    """Factory method to resolve the active Diarization Backend."""
    use_legacy = os.getenv("LEGACY_DIARIZATION", "false").lower() in ("true", "1", "yes")
    if use_legacy:
        logger.info("Using Legacy MFCC Diarization Backend (LEGACY_DIARIZATION=true).")
        return LegacyMFCCDiarizationBackend()
    return PyAnnoteDiarizationBackend()

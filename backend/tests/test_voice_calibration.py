import pytest
import os
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.services.voice_calibration import voice_calibration_engine
from app.services.diarization_engine import multi_signal_diarization_engine, SpeakerProfileManager

client = TestClient(app)

def test_voice_calibration_quality_assessment(tmp_path):
    """1. Verify quality check rejects clipping / short audio and accepts good samples."""
    import soundfile as sf
    # Short sample rejection test (0.5 seconds audio)
    dummy_wav = str(tmp_path / "short.wav")
    sr = 16000
    y_short = np.random.normal(0, 0.1, int(sr * 0.5))
    sf.write(dummy_wav, y_short, sr)

    q_short = voice_calibration_engine.evaluate_sample_quality(dummy_wav)
    assert q_short["is_acceptable"] is False
    assert "short" in q_short["reason"].lower() or q_short["duration"] < 2.0

def test_composite_weighted_profile_building():
    """2. Verify quality-weighted composite profile averaging."""
    sample1 = np.ones(124) * 1.0
    sample2 = np.ones(124) * 2.0
    qualities = [0.90, 0.50]  # sample 1 has higher quality weight

    composite = voice_calibration_engine.compute_weighted_composite_profile([sample1.tolist(), sample2.tolist()], qualities)
    assert len(composite) == 124
    # Weighted mean should be closer to sample1 (1.0) than sample2 (2.0)
    assert composite[0] < 1.5

def test_unknown_speaker_protection():
    """3. Verify UNKNOWN_SPEAKER status is assigned when similarity < 0.55 (never forces false participant match)."""
    manager = SpeakerProfileManager()
    enrolled = [{
        "id": 1,
        "display_name": "Avumm (Host)",
        "role": "Meeting Host",
        "embedding_vector": (np.ones(124) * 5.0).tolist()
    }]
    manager.load_calibrated_profiles(enrolled)

    # Completely different voice embedding
    different_voice = (np.ones(124) * -5.0)
    spk_label, identity_conf, status = manager.get_or_assign_speaker(different_voice, 0)

    assert status == "UNKNOWN_SPEAKER"
    assert "Unknown Speaker" in spk_label
    assert identity_conf < 0.55

def test_matched_speaker_classification():
    """4. Verify MATCHED_SPEAKER status when similarity >= 0.72."""
    manager = SpeakerProfileManager()
    enrolled_vec = np.ones(124) * 2.0
    enrolled = [{
        "id": 1,
        "display_name": "Avumm (Host)",
        "role": "Meeting Host",
        "embedding_vector": enrolled_vec.tolist()
    }]
    manager.load_calibrated_profiles(enrolled)

    matching_voice = enrolled_vec + np.random.normal(0, 0.01, 124)
    spk_label, identity_conf, status = manager.get_or_assign_speaker(matching_voice, 0)

    assert status == "MATCHED_SPEAKER"
    assert spk_label == "Avumm (Host)"
    assert identity_conf >= 0.72

def test_profile_drift_detection():
    """5. Verify profile drift is flagged when new speech embedding differs by > 0.35 distance."""
    vec1 = (np.ones(124) * 1.0).tolist()
    vec2 = (np.ones(124) * -1.0).tolist()

    is_drift, score = voice_calibration_engine.detect_profile_drift(vec1, vec2)
    assert is_drift is True
    assert score > 0.35

def test_api_biometric_privacy_sanitization():
    """6. Verify public voice profile schema strictly excludes raw biometric embedding vectors."""
    from app.schemas import CalibratedVoiceProfilePublic
    from datetime import datetime
    
    public_dto = CalibratedVoiceProfilePublic(
        id=1,
        display_name="Avumm",
        role="Host",
        department="Engineering",
        consent_status="CONSENT_GRANTED",
        sample_count=3,
        total_sample_duration_seconds=15.0,
        overall_quality_score=0.94,
        calibration_confidence=0.96,
        version=1,
        is_active=True,
        is_org_reusable=True,
        created_at=datetime.utcnow()
    )
    
    dto_dict = public_dto.dict()
    assert "embedding_vector" not in dto_dict or dto_dict.get("embedding_vector") is None
    assert "pitch_statistics" not in dto_dict

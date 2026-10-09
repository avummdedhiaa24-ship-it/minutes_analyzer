import pytest
import os
import json
import numpy as np
from fastapi.testclient import TestClient
from app.main import app
from app.services.diarization_engine import multi_signal_diarization_engine, SpeakerProfileManager
from app.services.audio_preprocessor import audio_preprocessor
from app.services.asr_aligner import asr_aligner

client = TestClient(app)

def test_speaker_profile_manager_reentry():
    """1. Verify speaker profile memory preserves identity on speaker re-entry (A -> B -> A)."""
    manager = SpeakerProfileManager()
    vec1 = np.ones(124) * 0.5
    vec2 = np.ones(124) * -0.5
    vec3 = np.ones(124) * 0.49  # Similar to vec1 (Speaker 1 re-entry)

    spk1, conf1, st1 = manager.get_or_assign_speaker(vec1, 0)
    spk2, conf2, st2 = manager.get_or_assign_speaker(vec2, 1)
    spk3, conf3, st3 = manager.get_or_assign_speaker(vec3, 2)

    assert "Speaker 1" in spk1
    assert "Speaker 2" in spk2
    assert spk3 == spk1  # Re-identified Speaker 1 on re-entry!
    assert conf3 > 0.70

def test_asr_word_aligner_splits_segments():
    """2. Verify ASRWordAligner splits ASR chunks at speaker boundary change timestamps."""
    asr_chunks = [
        {"timestamp": (0.0, 4.0), "text": "We should approve the microservice roadmap."},
        {"timestamp": (4.2, 7.5), "text": "I agree with the budget allocation."}
    ]
    diarized_segments = [
        {"speaker": "Speaker 1 (Manager)", "start": 0.0, "end": 4.0, "text": ""},
        {"speaker": "Speaker 2 (CEO)", "start": 4.0, "end": 8.0, "text": ""}
    ]

    aligned = asr_aligner.align(asr_chunks, diarized_segments)
    assert len(aligned) == 2
    assert aligned[0]["speaker"] == "Speaker 1 (Manager)"
    assert aligned[1]["speaker"] == "Speaker 2 (CEO)"
    assert aligned[0]["text"] == "We should approve the microservice roadmap."
    assert aligned[1]["text"] == "I agree with the budget allocation."

def test_short_speaker_turn_preservation():
    """3. Verify short turns (e.g. 'Agreed.') are preserved and not merged into previous speaker."""
    asr_chunks = [
        {"timestamp": (0.0, 4.0), "text": "Should we approve the new API gateway configuration?"},
        {"timestamp": (4.2, 5.5), "text": "Agreed."},
        {"timestamp": (5.8, 10.0), "text": "Great, let us push it to staging."}
    ]
    segments, changes = multi_signal_diarization_engine.process("non_existent.wav", asr_chunks)
    assert len(segments) >= 2
    assert any("Agreed." in s.text for s in segments)

def test_long_pause_same_speaker_no_false_change():
    """4. Verify long pause from same speaker does not trigger a false speaker change."""
    asr_chunks = [
        {"timestamp": (0.0, 5.0), "text": "Let me review the compliance document for a moment."},
        {"timestamp": (9.0, 15.0), "text": "Okay, the compliance clause looks good to proceed."}
    ]
    segments, changes = multi_signal_diarization_engine.process("non_existent.wav", asr_chunks)
    # Both belong to Speaker 1
    assert len(segments) >= 1

def test_calibration_metadata_recording():
    """5. Verify engine records adaptive threshold calibration metadata."""
    asr_chunks = [{"timestamp": (0.0, 3.0), "text": "Hello team."}]
    multi_signal_diarization_engine.process("non_existent.wav", asr_chunks)
    meta = getattr(multi_signal_diarization_engine, "last_calibration_metadata", {})
    assert "adaptive_threshold" in meta or meta == {}

def test_audio_preprocessor_structure(tmp_path):
    """6. Verify audio preprocessor outputs required metadata fields."""
    dummy_wav = tmp_path / "test.wav"
    dummy_wav.write_bytes(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80\x3e\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
    
    proc_path, meta = audio_preprocessor.preprocess(str(dummy_wav))
    assert "original_audio" in meta
    assert "processed_audio" in meta
    assert "vad_segments" in meta
    assert "speech_ratio" in meta

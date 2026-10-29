import os
import hashlib
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.core.config import settings
from app.core.database import Base, get_db, SessionLocal
from app import models
from app.routers.auth import create_access_token
from app.services.audio_sync import audio_sync_service

client = TestClient(app)

def get_test_db() -> Session:
    if get_db in app.dependency_overrides:
        gen = app.dependency_overrides[get_db]()
        db = next(gen)
    else:
        db = SessionLocal()
    Base.metadata.create_all(bind=db.get_bind())
    return db

def get_test_token(role: str = "Admin") -> str:
    return create_access_token(data={"sub": "testuser_audiosync", "role": role})

def setup_test_user_and_meeting(db: Session, has_audio: bool = False):
    Base.metadata.create_all(bind=db.get_bind())

    user = db.query(models.User).filter(models.User.username == "testuser_audiosync").first()
    if not user:
        user = models.User(
            username="testuser_audiosync",
            email="testuser_audiosync@example.com",
            hashed_password="hashed_pw_dummy",
            role="Admin",
            full_name="Test Audio Officer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    meeting = models.Meeting(
        title="Sync & Local Vault Test Meeting",
        status="completed",
        date=datetime.utcnow(),
        secretary_id=user.id
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    audio_file_path = None
    if has_audio:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        fname = f"meeting_{meeting.id}.wav"
        audio_file_path = os.path.join(settings.UPLOAD_DIR, fname)
        sample_pcm = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        with open(audio_file_path, "wb") as f:
            f.write(sample_pcm)
        meeting.audio_url = f"/api/v1/audio/stream/{fname}"
        db.commit()

    return user, meeting, audio_file_path

def test_sync_map_correctness_against_fixture_transcript():
    """
    Tests A4 sync-map generation against a fixture transcript with:
    1. Word-level timestamps provided
    2. Segment-level only (word timestamps missing, falls back to segment start, never guesses)
    3. Edited text (returns timing_status='unavailable')
    """
    db = get_test_db()
    try:
        user, meeting, _ = setup_test_user_and_meeting(db)

        diarized_fixture = [
            # Segment 1: Exact word timestamps available
            {
                "speaker": "Ramesh Patil",
                "start": 1.0,
                "end": 3.0,
                "text": "Meeting is called to order",
                "identity_status": "MATCHED",
                "words": [
                    {"word": "Meeting", "start": 1.0, "end": 1.4},
                    {"word": "is", "start": 1.45, "end": 1.6},
                    {"word": "called", "start": 1.65, "end": 2.1},
                    {"word": "to", "start": 2.15, "end": 2.3},
                    {"word": "order", "start": 2.35, "end": 2.8},
                ]
            },
            # Segment 2: Missing word timestamps (segment-level only fallback)
            {
                "speaker": "Sunita Deshmukh",
                "start": 4.5,
                "end": 7.5,
                "text": "Water pipeline resolution passes",
                "identity_status": "MATCHED"
                # No 'words' array
            },
            # Segment 3: Edited segment (timing unavailable)
            {
                "speaker": "Anand Shinde",
                "start": 8.0,
                "end": 11.0,
                "text": "Budget approved with amendments",
                "identity_status": "AMBIGUOUS",
                "is_edited": True
            }
        ]

        transcript = models.Transcript(
            meeting_id=meeting.id,
            raw_text="Meeting is called to order. Water pipeline resolution passes. Budget approved with amendments.",
            diarized_json=diarized_fixture,
            language="en",
            confidence=0.95
        )
        db.add(transcript)
        db.commit()

        sync_map = audio_sync_service.build_sync_map_from_transcript(transcript)

        # 1. Verify word timestamps for Segment 1
        seg1_words = [w for w in sync_map if w["segment_index"] == 0]
        assert len(seg1_words) == 5
        assert seg1_words[0]["text"] == "Meeting"
        assert seg1_words[0]["start"] == 1.0
        assert seg1_words[0]["end"] == 1.4
        assert seg1_words[0]["timing_status"] == "valid"

        # 2. Verify Segment 2 words fallback to segment start without guessing
        seg2_words = [w for w in sync_map if w["segment_index"] == 1]
        assert len(seg2_words) == 4
        for w in seg2_words:
            assert w["start"] == 4.5
            assert w["end"] == 7.5
            assert w["timing_status"] == "valid"

        # 3. Verify Segment 3 edited text returns timing_status='unavailable'
        seg3_words = [w for w in sync_map if w["segment_index"] == 2]
        assert len(seg3_words) == 4
        for w in seg3_words:
            assert w["start"] is None
            assert w["end"] is None
            assert w["timing_status"] == "unavailable"
            assert w["timing_message"] == "timing unavailable for edited text"
    finally:
        db.close()

def test_audio_meeting_requires_token_401():
    """
    Tests security fix: Audio endpoints return 401 Unauthorized without token.
    """
    db = get_test_db()
    try:
        user, meeting, _ = setup_test_user_and_meeting(db)

        # 1. stream meeting audio
        res1 = client.get(f"/api/v1/audio/meeting/{meeting.id}")
        assert res1.status_code == 401

        # 2. sync-map
        res2 = client.get(f"/api/v1/audio/{meeting.id}/sync-map")
        assert res2.status_code == 401

        # 3. integrity
        res3 = client.get(f"/api/v1/audio/{meeting.id}/integrity")
        assert res3.status_code == 401
    finally:
        db.close()

def test_audio_meeting_no_recording_returns_404():
    """
    Tests security fix: When no recording exists, return 404 (does NOT synthesize TTS fallback).
    """
    db = get_test_db()
    try:
        user, meeting, _ = setup_test_user_and_meeting(db, has_audio=False)
        token = get_test_token("Admin")
        headers = {"Authorization": f"Bearer {token}"}

        # Add a transcript to ensure it does not fallback to TTS
        t = models.Transcript(meeting_id=meeting.id, raw_text="Dummy transcript text")
        db.add(t)
        db.commit()

        # Audio endpoint must return 404
        res = client.get(f"/api/v1/audio/meeting/{meeting.id}", headers=headers)
        assert res.status_code == 404
        assert "No audio source available" in res.json()["detail"]

        # Integrity endpoint must return 404
        int_res = client.get(f"/api/v1/audio/{meeting.id}/integrity", headers=headers)
        assert int_res.status_code == 404
    finally:
        db.close()

def test_audio_integrity_hash_equals_real_file_hash():
    """
    Tests B2 & B4: Integrity SHA-256 equals real file hash, consent checking, and download logging.
    """
    db = get_test_db()
    try:
        user, meeting, audio_path = setup_test_user_and_meeting(db, has_audio=True)
        token = get_test_token("Admin")
        headers = {"Authorization": f"Bearer {token}"}

        # Calculate real file hash
        with open(audio_path, "rb") as f:
            file_bytes = f.read()
        expected_hash = hashlib.sha256(file_bytes).hexdigest()
        expected_size = len(file_bytes)

        # 1. Check integrity endpoint
        res = client.get(f"/api/v1/audio/{meeting.id}/integrity", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["sha256"] == expected_hash
        assert data["size_bytes"] == expected_size
        assert data["consent_granted"] is True

        # 2. Test download audit logging (B4)
        log_res = client.post(
            f"/api/v1/audio/{meeting.id}/log-download",
            json={"download_type": "device_file", "sha256": expected_hash, "file_name": "test.wav"},
            headers=headers
        )
        assert log_res.status_code == 200
        assert log_res.json()["status"] == "logged"

        # Verify entry in audit log
        audit_entry = db.query(models.AuditLog).filter(
            models.AuditLog.meeting_id == meeting.id,
            models.AuditLog.action == "AUDIO_LOCAL_DOWNLOAD"
        ).first()
        assert audit_entry is not None
        assert audit_entry.current_state["sha256"] == expected_hash

        # 3. Test privacy consent withholding (B4)
        vp = models.CalibratedVoiceProfile(
            meeting_id=meeting.id,
            display_name="Kavita Rao",
            consent_status="CONSENT_DECLINED"
        )
        db.add(vp)
        db.commit()

        consent_res = client.get(f"/api/v1/audio/{meeting.id}/integrity", headers=headers)
        assert consent_res.status_code == 200
        consent_data = consent_res.json()
        assert consent_data["consent_granted"] is False
        assert "Kavita Rao" in consent_data["withheld_speakers"]
        assert "withheld recording release consent" in consent_data["consent_message"]
    finally:
        db.close()

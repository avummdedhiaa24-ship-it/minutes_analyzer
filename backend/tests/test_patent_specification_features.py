import pytest
import os
import hashlib
from fastapi.testclient import TestClient
from datetime import datetime
from app.main import app
from app.core.database import SessionLocal, Base, get_db
from app import models
from app.core.encryption import encryption_service
from app.services.audit import audit_service
from app.services.narration import narration_service

client = TestClient(app)

def get_test_db():
    if get_db in app.dependency_overrides:
        gen = app.dependency_overrides[get_db]()
        db = next(gen)
    else:
        db = SessionLocal()
    Base.metadata.create_all(bind=db.get_bind())
    return db

def test_aes256_encryption_service(tmp_path):
    """Test Gap 2: AES-256-GCM authenticated encryption at rest for audio & profiles."""
    secret_text = b"Sensitive Biometric MFCC Vectors and Audio Transcript PCM"
    encrypted = encryption_service.encrypt_bytes(secret_text)
    assert encrypted != secret_text
    assert len(encrypted) >= len(secret_text) + 28  # 12-byte nonce + 16-byte GCM tag

    decrypted = encryption_service.decrypt_bytes(encrypted)
    assert decrypted == secret_text

    # Test file encryption
    sample_file = tmp_path / "voice_profile.bin"
    sample_file.write_bytes(secret_text)
    enc_path = encryption_service.encrypt_file(str(sample_file))
    assert os.path.exists(enc_path)

    dec_bytes = encryption_service.decrypt_file(enc_path)
    assert dec_bytes == secret_text

def test_audit_hash_chain_verification():
    """Test Gap 1 & Claims 11, 14: Hash-chained audit logs with previous-hash linkage."""
    db = get_test_db()
    try:
        # Create a test meeting
        meeting = models.Meeting(
            title="Gram Sabha Annual Audit Test",
            date=datetime.utcnow(),
            location="Panchayat Bhavan Hall",
            venue_lat=18.5204,
            venue_lng=73.8567,
            venue_radius_km=1.5
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        # Log change 1
        log1 = audit_service.log_change(
            db=db,
            meeting_id=meeting.id,
            modified_by_id=1,
            action="create_draft",
            previous_state=None,
            current_state={"summary": "Draft minutes initiated"}
        )
        assert log1.previous_hash == "GENESIS"
        assert log1.digital_hash is not None

        # Log change 2 (Speaker correction - Claim 11)
        log2 = audit_service.log_change(
            db=db,
            meeting_id=meeting.id,
            modified_by_id=1,
            action="speaker_correction",
            previous_state={"speaker": "Speaker_1"},
            current_state={"speaker": "Rajesh Sharma", "reason": "Sarpanch identified by voice"}
        )
        assert log2.previous_hash == log1.digital_hash
        assert log2.digital_hash is not None

        # Verify chain - should be valid
        res = audit_service.verify_chain(db, meeting.id)
        assert res["valid"] is True
        assert res["log_count"] >= 2
        assert res["latest_hash"] == log2.digital_hash

        # Tamper test: Alter log1 digital_hash directly
        original_hash = log1.digital_hash
        log1.digital_hash = "tampered_bad_hash_12345"
        db.commit()

        tamper_res = audit_service.verify_chain(db, meeting.id)
        assert tamper_res["valid"] is False
        assert "mismatch" in tamper_res["message"] or "broken" in tamper_res["message"]

        # Restore
        log1.digital_hash = original_hash
        db.commit()

    finally:
        db.close()

def test_configurable_venue_and_duplicate_checkin_rejection():
    """Test Gap 8 & Claim 4: Configurable meeting venue Haversine check and duplicate rejection."""
    db = get_test_db()
    try:
        # 1. Create meeting with specific venue (Pune Panchayat coordinates)
        meeting = models.Meeting(
            title="Gram Sabha Ward 4 Meeting",
            date=datetime.utcnow(),
            venue_lat=18.5204,
            venue_lng=73.8567,
            venue_radius_km=2.0
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        user = db.query(models.User).first()
        if not user:
            user = models.User(
                username="test_villager",
                email="villager@gram.in",
                hashed_password="dummy_hashed_password",
                role="Employee"
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 2. First checkin inside permitted radius (18.5210, 73.8570 -> ~100m away)
        res1 = client.post(f"/api/v1/attendance/{meeting.id}", json={
            "user_id": user.id,
            "method": "gps",
            "gps_lat": 18.5210,
            "gps_lng": 73.8570
        })
        assert res1.status_code == 200
        assert res1.json()["verified"] is True

        # 3. Duplicate checkin attempt by the same participant (Claim 4: must be rejected)
        res_dup = client.post(f"/api/v1/attendance/{meeting.id}", json={
            "user_id": user.id,
            "method": "gps",
            "gps_lat": 18.5210,
            "gps_lng": 73.8570
        })
        assert res_dup.status_code == 400
        assert "Duplicate check-in rejected" in res_dup.json()["detail"]

    finally:
        db.close()

def test_narration_sentence_alignment_and_hash_binding():
    """Test Claims 15, 17: Sentence timestamps and hash equality check."""
    db = get_test_db()
    try:
        meeting = models.Meeting(
            title="Gram Sabha Resolution Session",
            date=datetime.utcnow()
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)

        minutes = models.Minutes(
            meeting_id=meeting.id,
            version_number=1,
            summary="Approved water tank construction and road repair in Ward 2.",
            decisions=[{"decision": "Construct 50000L overhead water tank", "votes": 45}],
            status="approved",
            digital_hash="sha256_canonical_minutes_seal_987654321"
        )
        db.add(minutes)
        db.commit()

        # Synthesize narration
        res = narration_service.synthesize_narration(meeting.id, db, lang="en")
        assert res["meeting_id"] == meeting.id
        assert "sentences" in res
        assert len(res["sentences"]) > 0

        # Check sentence timestamps
        s0 = res["sentences"][0]
        assert "start_time" in s0
        assert "end_time" in s0
        assert s0["end_time"] >= s0["start_time"]

        # Verify hash binding (Claim 15.d, 15.e)
        ver_info = narration_service.verify_narration_binding(meeting.id, db)
        assert ver_info["official"] is True
        assert ver_info["status"] == "OFFICIAL_AUTHENTICATED_NARRATION"

    finally:
        db.close()

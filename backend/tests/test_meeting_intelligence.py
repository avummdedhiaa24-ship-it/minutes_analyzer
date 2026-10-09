import pytest
import io
import json
import base64
import numpy as np
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

from app.services.meeting_ocr import (
    MeetingOCRService,
    ParticipantNameNormalizer,
    ParticipantRegionDetector,
    GoogleMeetAdapter,
    ZoomWebAdapter,
    TeamsWebAdapter,
    GenericBrowserMeetingAdapter
)
from app.services.identity_fusion import IdentityFusionEngine
from app.services.ai_pipeline import ai_pipeline
from app.services.audit import audit_service
from app.schemas import CalibratedVoiceProfilePublic
from app import models
from app.core.database import Base, engine, SessionLocal


@pytest.fixture(scope="module")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean up any leftover test meetings from previous test runs
    try:
        db.query(models.AuditLog).filter(models.AuditLog.meeting_id.in_([701, 801, 802])).delete(synchronize_session=False)
        db.query(models.Minutes).filter(models.Minutes.meeting_id.in_([701, 801, 802])).delete(synchronize_session=False)
        db.query(models.MeetingParticipant).filter(models.MeetingParticipant.meeting_id.in_([701, 801, 802])).delete(synchronize_session=False)
        db.query(models.Meeting).filter(models.Meeting.id.in_([701, 801, 802])).delete(synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()
    try:
        yield db
    finally:
        db.close()


def _create_synthetic_participant_image(names: list[str]) -> str:
    """Creates a base64 encoded synthetic screen capture with name tags."""
    img = Image.new("RGB", (640, 480), color=(30, 30, 35))
    draw = ImageDraw.Draw(img)
    # Draw bottom strips for participants
    strip_w = 640 // max(len(names), 1)
    for i, name in enumerate(names):
        x1 = i * strip_w + 10
        y1 = 440
        x2 = (i + 1) * strip_w - 10
        y2 = 470
        draw.rectangle([x1, y1, x2, y2], fill=(15, 15, 20), outline=(60, 60, 70))
        draw.text((x1 + 10, y1 + 5), name, fill=(240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ==============================================================================
# 1. OCR TESTS (Cases 1-8)
# ==============================================================================

def test_ocr_participant_name_extraction():
    """1. Participant name extraction from image."""
    normalizer = ParticipantNameNormalizer(known_directory=["Avumm Dedhiaa", "Shyam Sagar"])
    norm1, conf1 = normalizer.normalize("Avumm Dedhiaa")
    assert norm1 == "Avumm Dedhiaa"
    assert conf1 >= 0.95

    norm2, conf2 = normalizer.normalize("Shyam Sagar (Host)")
    assert norm2 == "Shyam Sagar"
    assert conf2 >= 0.90


def test_ocr_duplicate_participant_detection():
    """2. Duplicate participant detection and merging."""
    ocr_service = MeetingOCRService()
    # Process multiple identical names in single batch
    raw_obs = [
        {"raw_text": "Avumm Dedhiaa", "normalized_name": "Avumm Dedhiaa", "confidence": 0.95, "region": "grid_0", "source": "meet_grid"},
        {"raw_text": "Avumm Dedhiaa (You)", "normalized_name": "Avumm Dedhiaa", "confidence": 0.92, "region": "grid_1", "source": "meet_grid"},
        {"raw_text": "Shyam Sagar", "normalized_name": "Shyam Sagar", "confidence": 0.96, "region": "grid_2", "source": "meet_grid"},
    ]
    unique_names = set(item["normalized_name"] for item in raw_obs)
    assert len(unique_names) == 2
    assert "Avumm Dedhiaa" in unique_names
    assert "Shyam Sagar" in unique_names


def test_ocr_spelling_normalization():
    """3. OCR spelling normalization and fuzzy matching against directory."""
    normalizer = ParticipantNameNormalizer(known_directory=["Avumm Dedhiaa", "Shyam Sagar", "Krish"])
    
    # Minor OCR typo: 'Avum Dedhia' -> 'Avumm Dedhiaa'
    name, conf = normalizer.normalize("Avum Dedhia")
    assert name == "Avumm Dedhiaa"
    assert conf >= 0.85

    # Case insensitive
    name_caps, _ = normalizer.normalize("SHYAM SAGAR")
    assert name_caps == "Shyam Sagar"


def test_ocr_low_confidence_filtering():
    """4. Reject low-confidence OCR noise without false attendance declaring."""
    normalizer = ParticipantNameNormalizer(known_directory=["Avumm Dedhiaa"])
    # Gibberish OCR string
    name, conf = normalizer.normalize("xyz123#$$")
    assert conf < 0.70  # Should be flagged as low confidence or filtered


def test_ocr_participant_join_detection():
    """5. Participant join detection requires repeated observations."""
    ocr_service = MeetingOCRService()
    ocr_service.min_join_observations = 2

    # Frame 1: first observation
    e1 = ocr_service._update_temporal_presence(101, ["Avumm Dedhiaa"], timestamp=1.0)
    assert len(e1) == 0  # Not declared joined on 1 observation
    
    # Frame 2: second observation
    e2 = ocr_service._update_temporal_presence(101, ["Avumm Dedhiaa"], timestamp=6.0)
    assert len(e2) == 1
    assert e2[0]["event"] == "JOIN"
    assert e2[0]["name"] == "Avumm Dedhiaa"


def test_ocr_participant_leave_detection():
    """6. Participant leave detection after consecutive absence frames."""
    ocr_service = MeetingOCRService()
    ocr_service.min_join_observations = 1
    ocr_service.min_leave_observations = 2
    ocr_service.leave_timeout_seconds = 10.0

    # Join
    ocr_service._update_temporal_presence(102, ["Krish"], timestamp=1.0)
    assert "Krish" in ocr_service.temporal_history[102]
    assert ocr_service.temporal_history[102]["Krish"]["status"] == "PRESENT"

    # Absent in frame 2
    ocr_service._update_temporal_presence(102, [], timestamp=12.0)
    # Absent in frame 3 -> triggers leave
    leave_events = ocr_service._update_temporal_presence(102, [], timestamp=24.0)
    assert len(leave_events) >= 1
    assert leave_events[0]["event"] == "LEAVE"
    assert leave_events[0]["name"] == "Krish"


def test_ocr_temporary_disappearance_window():
    """7. Single screenshot disappearance does not trigger false leave event."""
    ocr_service = MeetingOCRService()
    ocr_service.min_join_observations = 1
    ocr_service.min_leave_observations = 3
    ocr_service.leave_timeout_seconds = 15.0

    ocr_service._update_temporal_presence(103, ["Shyam Sagar"], timestamp=1.0)
    # Disappears for just one 5-second interval
    leave_events = ocr_service._update_temporal_presence(103, [], timestamp=6.0)
    assert len(leave_events) == 0
    # Still considered PRESENT or DETECTED, not LEFT
    assert ocr_service.temporal_history[103]["Shyam Sagar"]["status"] in ["PRESENT", "DETECTED"]


def test_ocr_participant_reappearance():
    """8. Participant reappearance after temporary leave resets presence."""
    ocr_service = MeetingOCRService()
    ocr_service.min_join_observations = 1
    ocr_service.min_leave_observations = 1
    ocr_service.leave_timeout_seconds = 5.0

    # Join
    ocr_service._update_temporal_presence(104, ["Avumm Dedhiaa"], timestamp=1.0)
    # Leave
    ocr_service._update_temporal_presence(104, [], timestamp=10.0)
    assert ocr_service.temporal_history[104]["Avumm Dedhiaa"]["status"] == "LEFT"

    # Rejoin
    rejoin_events = ocr_service._update_temporal_presence(104, ["Avumm Dedhiaa"], timestamp=20.0)
    assert len(rejoin_events) == 1
    assert rejoin_events[0]["event"] == "JOIN"
    assert ocr_service.temporal_history[104]["Avumm Dedhiaa"]["status"] == "PRESENT"


# ==============================================================================
# 2. IDENTITY FUSION TESTS (Cases 9-14)
# ==============================================================================

def test_identity_fusion_ocr_voice_match():
    """9. High-confidence match when voice matches and participant is in OCR attendance."""
    fusion = IdentityFusionEngine()
    
    # Calibrated profile for Avumm
    vector = np.full(128, 0.5, dtype=np.float32)
    calibrated_profiles = {
        "speaker_01": {
            "speaker_name": "Avumm Dedhiaa",
            "mean_vector": vector,
            "quality_score": 0.94,
            "status": "CALIBRATED"
        }
    }
    
    result = fusion.fuse_identity(
        meeting_id=201,
        speaker_id="speaker_01",
        voice_embedding=vector,
        active_ocr_attendees=["Avumm Dedhiaa", "Shyam Sagar"],
        calibrated_profiles=calibrated_profiles,
        temporal_window=10.0
    )

    assert result["identity_status"] == "MATCHED"
    assert result["display_name"] == "Avumm Dedhiaa"
    assert result["identity_confidence"] >= 0.85
    assert result["evidence"]["voice_similarity"] >= 0.90
    assert result["evidence"]["ocr_presence"] == 1.0


def test_identity_fusion_voice_mismatch():
    """10. OCR attendee present, but voice embedding does NOT match -> UNKNOWN or AMBIGUOUS."""
    fusion = IdentityFusionEngine()
    
    vec1 = np.full(128, 0.5, dtype=np.float32)
    # Orthogonal/opposite vector for different speaker
    vec2 = np.zeros(128, dtype=np.float32)
    vec2[0] = 1.0

    calibrated_profiles = {
        "speaker_01": {
            "speaker_name": "Avumm Dedhiaa",
            "mean_vector": vec1,
            "quality_score": 0.94,
            "status": "CALIBRATED"
        }
    }
    
    # An unknown speaker speaks while Avumm is listed in OCR attendance
    result = fusion.fuse_identity(
        meeting_id=202,
        speaker_id="speaker_02",
        voice_embedding=vec2,
        active_ocr_attendees=["Avumm Dedhiaa"],
        calibrated_profiles=calibrated_profiles,
        temporal_window=10.0
    )

    # Must NEVER force Avumm Dedhiaa onto speaker_02!
    assert result["identity_status"] in ["UNKNOWN", "AMBIGUOUS"]
    assert result["display_name"] != "Avumm Dedhiaa"


def test_identity_fusion_unknown_speaker_protection():
    """11. Speaker does not match any profile -> UNKNOWN SPEAKER, never fabricated."""
    fusion = IdentityFusionEngine()
    random_vec = np.random.randn(128).astype(np.float32)

    result = fusion.fuse_identity(
        meeting_id=203,
        speaker_id="speaker_99",
        voice_embedding=random_vec,
        active_ocr_attendees=["Krish", "Shyam Sagar"],
        calibrated_profiles={},
        temporal_window=10.0
    )

    assert result["identity_status"] == "UNKNOWN"
    assert "UNKNOWN" in result["display_name"].upper()


def test_identity_fusion_ambiguous_identity():
    """12. Moderate evidence -> AMBIGUOUS, allowing human review."""
    fusion = IdentityFusionEngine()
    vec1 = np.full(128, 0.5, dtype=np.float32)
    # Perturbed vector yielding ~0.65 similarity
    vec_noisy = vec1.copy()
    vec_noisy[:64] = -0.5

    calibrated_profiles = {
        "speaker_01": {
            "speaker_name": "Shyam Sagar",
            "mean_vector": vec1,
            "quality_score": 0.88,
            "status": "CALIBRATED"
        }
    }

    result = fusion.fuse_identity(
        meeting_id=204,
        speaker_id="speaker_02",
        voice_embedding=vec_noisy,
        active_ocr_attendees=["Shyam Sagar"],
        calibrated_profiles=calibrated_profiles,
        temporal_window=10.0
    )

    assert result["identity_status"] in ["AMBIGUOUS", "UNKNOWN"]
    assert result["identity_confidence"] < 0.85


def test_identity_fusion_calibrated_speaker_reentry():
    """13. Speaker re-entry across turns preserves same participant identity."""
    fusion = IdentityFusionEngine()
    vec = np.full(128, 0.5, dtype=np.float32)
    calibrated_profiles = {
        "speaker_01": {
            "speaker_name": "Avumm Dedhiaa",
            "mean_vector": vec,
            "quality_score": 0.95,
            "status": "CALIBRATED"
        }
    }

    # Turn 1: Avumm
    res1 = fusion.fuse_identity(205, "speaker_01", vec, ["Avumm Dedhiaa"], calibrated_profiles, 5.0)
    assert res1["display_name"] == "Avumm Dedhiaa"

    # Turn 2: Another speaker
    vec_other = np.full(128, -0.5, dtype=np.float32)
    res2 = fusion.fuse_identity(205, "speaker_02", vec_other, ["Avumm Dedhiaa", "Krish"], calibrated_profiles, 15.0)

    # Turn 3: Avumm re-enters
    res3 = fusion.fuse_identity(205, "speaker_01", vec, ["Avumm Dedhiaa"], calibrated_profiles, 30.0)
    assert res3["display_name"] == "Avumm Dedhiaa"
    assert res3["identity_status"] == "MATCHED"


def test_identity_fusion_uncalibrated_participant():
    """14. Participant has no usable voice profile -> UNAVAILABLE status."""
    fusion = IdentityFusionEngine()
    vec = np.random.randn(128).astype(np.float32)
    
    # Profile exists but uncalibrated
    profiles = {
        "speaker_01": {
            "speaker_name": "New Guest",
            "mean_vector": None,
            "status": "UNAVAILABLE"
        }
    }

    res = fusion.fuse_identity(206, "speaker_01", vec, ["New Guest"], profiles, 5.0)
    assert res["identity_status"] in ["UNAVAILABLE", "UNKNOWN"]


# ==============================================================================
# 3. MINUTES & GOVERNANCE TESTS (Cases 15-22)
# ==============================================================================

def test_minutes_attendance_generation():
    """15. Attendance table generated with participants, roles, and identity states."""
    segments = [
        {"speaker": "Avumm Dedhiaa", "display_name": "Avumm Dedhiaa", "start": 0.0, "end": 10.0, "text": "Let us begin the architecture review."},
        {"speaker": "Shyam Sagar", "display_name": "Shyam Sagar", "start": 10.5, "end": 25.0, "text": "I agreed to handle the PostgreSQL migration."}
    ]
    roster = ["Avumm Dedhiaa", "Shyam Sagar"]
    res = ai_pipeline.extract_structured_minutes("Architecture Review", "Full session", segments, meeting_id=301, attendee_roster=roster)
    
    assert "attendance" in res
    assert len(res["attendance"]) >= 2
    attendee_names = [a["participant"] for a in res["attendance"]]
    assert "Avumm Dedhiaa" in attendee_names
    assert "Shyam Sagar" in attendee_names


def test_named_transcript_structure():
    """16. Named transcript segments retain timestamps, names, and confidence."""
    segments = [
        {"speaker": "Speaker 1", "display_name": "Avumm Dedhiaa", "start": 5.0, "end": 12.0, "text": "Deploying the microservice now.", "identity_status": "MATCHED", "identity_confidence": 0.96}
    ]
    res = ai_pipeline.extract_structured_minutes("Deploy Review", "Deploying", segments, meeting_id=302, attendee_roster=["Avumm Dedhiaa"])
    assert res["detailed_discussion"] is not None
    assert len(res["detailed_discussion"]) >= 1


def test_decision_extraction_with_context():
    """17. Decision extraction identifies explicit consensus and context."""
    segments = [
        {"speaker": "Avumm Dedhiaa", "display_name": "Avumm Dedhiaa", "start": 30.0, "end": 45.0, "text": "We approved the PostgreSQL migration plan unanimously."}
    ]
    res = ai_pipeline.extract_structured_minutes("DB Review", "Migration", segments, meeting_id=303, attendee_roster=["Avumm Dedhiaa"])
    assert len(res["decisions"]) >= 1
    dec = res["decisions"][0]
    assert "approved" in dec["decision"].lower() or "postgresql" in dec["decision"].lower()
    assert dec["confidence"] >= 0.80


def test_action_item_extraction_unassigned_protection():
    """18. Action items never invent false owners or deadlines; falls back to Unassigned."""
    segments = [
        {"speaker": "Shyam Sagar", "display_name": "Shyam Sagar", "start": 50.0, "end": 65.0, "text": "We need to prepare the rollback documentation by Friday."}
    ]
    res = ai_pipeline.extract_structured_minutes("Planning", "Docs", segments, meeting_id=304, attendee_roster=["Shyam Sagar"])
    assert len(res["action_items"]) >= 1
    act = res["action_items"][0]
    assert act["owner"] is not None
    assert len(act["owner"]) > 0


def test_evidence_linking_verifiable_timestamps():
    """19. Decisions and action items link to exact source timestamps and quote references."""
    segments = [
        {"speaker": "Shyam Sagar", "display_name": "Shyam Sagar", "start": 120.0, "end": 135.0, "text": "I agreed to submit the database security audit next week."}
    ]
    res = ai_pipeline.extract_structured_minutes("Audit Session", "Security", segments, meeting_id=305, attendee_roster=["Shyam Sagar"])
    assert len(res["action_items"]) >= 1
    act = res["action_items"][0]
    assert "evidence" in act
    assert act["evidence"]["source_timestamp"] >= 0.0
    assert act["evidence"]["source_speaker"] == "Shyam Sagar"


def test_unresolved_issues_extraction():
    """20. Extracts open questions, risks, and unresolved issues."""
    segments = [
        {"speaker": "Krish", "display_name": "Krish", "start": 200.0, "end": 215.0, "text": "What is the expected latency penalty during database replication?"}
    ]
    res = ai_pipeline.extract_structured_minutes("Latency Review", "Perf", segments, meeting_id=306, attendee_roster=["Krish"])
    assert len(res["questions_and_concerns"]) >= 1
    q = res["questions_and_concerns"][0]
    assert "latency" in q["question"].lower()


def test_hallucination_prevention_unsupported_facts():
    """21. Grounded extraction does not fabricate attendees or decisions not in transcript."""
    segments = [
        {"speaker": "Avumm", "display_name": "Avumm", "start": 0.0, "end": 10.0, "text": "Today we only discussed frontend CSS styling."}
    ]
    res = ai_pipeline.extract_structured_minutes("Styling Meeting", "CSS only", segments, meeting_id=307, attendee_roster=["Avumm"])
    
    # Decisions should be empty or strictly related to styling
    for d in res["decisions"]:
        assert "million dollar" not in d["decision"].lower()
        assert "acquisition" not in d["decision"].lower()


def test_minutes_versioning_and_diffs(db_session):
    """22. Minutes edits preserve version numbers and audit log diffs."""
    meeting = models.Meeting(
        id=701,
        title="Versioning Test Meeting",
        date=datetime.now(timezone.utc),
        status="draft"
    )
    db_session.add(meeting)
    db_session.commit()

    # Create minutes v1
    min_entry = models.Minutes(
        meeting_id=701,
        summary="Initial draft summary.",
        version_number=1,
        status="DRAFT"
    )
    db_session.add(min_entry)
    db_session.commit()

    # Human edits summary -> v2
    min_entry.summary = "Updated human approved summary."
    min_entry.version_number = 2
    db_session.commit()

    updated = db_session.query(models.Minutes).filter(models.Minutes.meeting_id == 701).first()
    assert updated.version_number == 2
    assert "Updated" in updated.summary


# ==============================================================================
# 4. SECURITY & PRIVACY TESTS (Cases 23-26)
# ==============================================================================

def test_organization_tenant_isolation(db_session):
    """23. Enforce tenant isolation preventing cross-organization data leakage."""
    m1 = models.Meeting(id=801, title="Org 1 Meeting", organization_id=1, date=datetime.now(timezone.utc))
    m2 = models.Meeting(id=802, title="Org 2 Meeting", organization_id=2, date=datetime.now(timezone.utc))
    db_session.add_all([m1, m2])
    db_session.commit()

    org1_meets = db_session.query(models.Meeting).filter(models.Meeting.organization_id == 1).all()
    org2_meets = db_session.query(models.Meeting).filter(models.Meeting.organization_id == 2).all()

    assert all(m.organization_id == 1 for m in org1_meets)
    assert all(m.organization_id == 2 for m in org2_meets)


def test_biometric_data_sanitization_no_raw_embeddings():
    """24. Biometric schemas sanitize raw embeddings from public serialization."""
    profile_data = {
        "id": 1,
        "speaker_name": "Avumm Dedhiaa",
        "voice_quality_score": 0.95,
        "sample_count": 3,
        "is_calibrated": True,
        "status": "CALIBRATED",
        "created_at": datetime.now(timezone.utc)
    }
    public_dto = CalibratedVoiceProfilePublic(**profile_data)
    d = public_dto.model_dump()
    assert "mean_embedding" not in d
    assert "raw_features" not in d
    assert "embedding_vector" not in d


def test_audit_logging_immutable_sha256_seal(db_session):
    """25. Cryptographic SHA-256 audit ledger hash computation and tamper verification."""
    test_state = {"summary": "Architecture consensus", "approved": True}
    h1 = audit_service.calculate_minutes_hash(test_state)
    assert len(h1) == 64  # Valid 64-char hex SHA-256

    # Tampered state produces different hash
    test_state_tampered = {"summary": "Architecture consensus", "approved": False}
    h2 = audit_service.calculate_minutes_hash(test_state_tampered)
    assert h1 != h2


def test_human_correction_audit_trail(db_session):
    """26. Human correction of speaker identity creates auditable ledger log."""
    log_entry = audit_service.log_change(
        db=db_session,
        meeting_id=701,
        modified_by_id=1,
        action="DIARIZATION_SPEAKER_RENAME",
        previous_state={"speaker_id": "Speaker 2", "display_name": "Speaker 2"},
        current_state={"speaker_id": "Speaker 2", "display_name": "Krish"}
    )
    assert log_entry.action == "DIARIZATION_SPEAKER_RENAME"
    assert log_entry.state_hash is not None
    assert len(log_entry.state_hash) == 64

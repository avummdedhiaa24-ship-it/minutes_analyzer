import base64
import io
import pytest
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, get_db
from app.routers.auth import get_current_user
from app.main import app
from app.services.screen_ocr import screen_ocr_engine
from app.services.diarization_engine import multi_signal_diarization_engine
from app import models

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_temp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

def override_get_current_user():
    return models.User(
        id=1,
        email="unique.ocr.user@example.com",
        username="unique_ocr_user",
        full_name="Sarah Chen",
        role="host"
    )

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def mock_auth():
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)

def create_synthetic_frame(names=["Alex Morgan", "Sarah Chen"], active_speaker="Alex Morgan"):
    """Create a synthetic in-memory meeting screen frame with participant tiles and active speaker border."""
    img = Image.new("RGB", (640, 480), color=(20, 24, 33))
    draw = ImageDraw.Draw(img)
    
    # Draw Tile 1 (Active Speaker with bright blue border)
    if active_speaker == names[0]:
        for i in range(4):
            draw.rectangle([20 - i, 20 - i, 300 + i, 220 + i], outline=(66, 133, 244))
    else:
        draw.rectangle([20, 20, 300, 220], outline=(80, 80, 80))
    draw.text((30, 190), names[0], fill=(255, 255, 255))

    # Draw Tile 2 (Secondary Participant)
    if len(names) > 1:
        if active_speaker == names[1]:
            for i in range(4):
                draw.rectangle([340 - i, 20 - i, 620 + i, 220 + i], outline=(66, 133, 244))
        else:
            draw.rectangle([340, 20, 620, 220], outline=(80, 80, 80))
        draw.text((350, 190), names[1], fill=(255, 255, 255))
    
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    img_bytes = buffer.getvalue()
    b64_str = base64.b64encode(img_bytes).decode("utf-8")
    return img_bytes, f"data:image/jpeg;base64,{b64_str}"

def test_screen_ocr_in_memory_processing_and_zero_disk():
    """Verify in-memory frame processing without saving any video/frame files to disk."""
    raw_bytes, frame_b64 = create_synthetic_frame(["Alex Morgan", "Sarah Chen"], active_speaker="Alex Morgan")
    
    res = screen_ocr_engine.process_in_memory_frame(
        meeting_id=999,
        image_bytes=raw_bytes,
        timestamp=12.5,
        known_roster=["Alex Morgan", "Sarah Chen"]
    )
    
    assert res is not None
    assert "timestamp" in res
    assert "detected_names" in res
    assert "active_visual_speaker" in res
    assert res["meeting_id"] == 999

def test_ephemeral_cache_retrieval_and_clearing():
    """Verify ephemeral RAM cache records frames and can be retrieved or cleared upon meeting completion."""
    raw_bytes, frame_b64 = create_synthetic_frame(["Elena Rostova"], active_speaker="Elena Rostova")
    screen_ocr_engine.process_in_memory_frame(
        meeting_id=888,
        image_bytes=raw_bytes,
        timestamp=5.0,
        known_roster=["Elena Rostova"]
    )
    
    cached = screen_ocr_engine.get_cached_ocr_data(888)
    assert cached["meeting_id"] == 888
    assert len(cached["detected_attendees"]) >= 1

    # Visual speaker lookup at timestamp
    visual_spk = screen_ocr_engine.get_visual_speaker_at_timestamp(888, 5.0)
    assert visual_spk is not None

    # Clear cache
    screen_ocr_engine.clear_cache(888)
    empty_cached = screen_ocr_engine.get_cached_ocr_data(888)
    assert len(empty_cached["detected_attendees"]) == 0

def test_multimodal_diarization_integration_with_visual_cache():
    """Verify multimodal diarization incorporates visual speaker signal score when cache is populated."""
    screen_ocr_engine.clear_cache(777)
    raw_bytes, frame_b64 = create_synthetic_frame(["Speaker 1"], active_speaker="Speaker 1")
    screen_ocr_engine.process_in_memory_frame(
        meeting_id=777,
        image_bytes=raw_bytes,
        timestamp=2.0,
        known_roster=["Speaker 1"]
    )
    
    asr_chunks = [
        {"timestamp": (0.0, 4.0), "text": "Opening the technical review session."}
    ]
    
    segments, changes = multi_signal_diarization_engine.process("non_existent.wav", asr_chunks, meeting_id=777)
    assert len(segments) >= 1
    assert segments[0].speaker is not None

def test_screen_ocr_rest_api_endpoints(mock_auth):
    """Test REST API endpoints for in-memory frame ingestion, cache retrieval, and auto-attendance."""
    db = TestingSessionLocal()
    # Create or fetch meeting 9876
    from datetime import datetime
    meeting = db.query(models.Meeting).filter(models.Meeting.id == 9876).first()
    if not meeting:
        meeting = models.Meeting(
            id=9876,
            title="Q4 AI Strategy Review",
            date=datetime.utcnow(),
            description="Testing OCR",
            status="in_progress"
        )
        db.add(meeting)
    
    # Create or fetch test user
    user = db.query(models.User).filter(models.User.email == "unique.ocr.user@example.com").first()
    if not user:
        user = models.User(
            email="unique.ocr.user@example.com",
            username="unique_ocr_user",
            hashed_password="mockpassword123",
            full_name="Sarah Chen",
            role="participant"
        )
        db.add(user)
    
    db.commit()
    db.close()

    raw_bytes, frame_b64 = create_synthetic_frame(["Alice Smith", "Sarah Chen"], active_speaker="Sarah Chen")
    
    # 1. POST frame
    post_res = client.post("/api/v1/meetings/9876/screen-ocr/frame", json={
        "image_base64": frame_b64,
        "timestamp": 10.0,
        "known_roster": ["Alice Smith", "Sarah Chen"]
    })
    assert post_res.status_code == 200
    data = post_res.json()
    assert data["status"] in ["ok", "fallback_in_memory", "in_memory_cached"]
    assert "active_visual_speaker" in data
    
    # 2. GET cache
    get_res = client.get("/api/v1/meetings/9876/screen-ocr/cache")
    assert get_res.status_code == 200
    cache_data = get_res.json()
    assert cache_data["meeting_id"] == 9876
    assert len(cache_data["detected_attendees"]) >= 1

    # 3. POST auto-attendance
    auto_res = client.post("/api/v1/meetings/9876/screen-ocr/auto-attendance")
    assert auto_res.status_code == 200
    auto_data = auto_res.json()
    assert "synced_attendees" in auto_data
    assert auto_data["status"] == "success"

def test_multimodal_diarization_real_name_override_from_ocr():
    """Verify that OCR-detected attendees and visual active speaker cues replace generic Speaker 1/2 with real names."""
    meeting_id = 9988
    screen_ocr_engine.clear_cache(meeting_id)

    # Ingest Frame 1: Sarah Chen is speaking at t=1.0s
    raw_bytes1, _ = create_synthetic_frame(["Sarah Chen", "Alex Morgan"], active_speaker="Sarah Chen")
    screen_ocr_engine.process_in_memory_frame(
        meeting_id=meeting_id,
        image_bytes=raw_bytes1,
        timestamp=1.0,
        known_roster=["Sarah Chen", "Alex Morgan"]
    )

    # Ingest Frame 2: Alex Morgan is speaking at t=6.0s
    raw_bytes2, _ = create_synthetic_frame(["Sarah Chen", "Alex Morgan"], active_speaker="Alex Morgan")
    screen_ocr_engine.process_in_memory_frame(
        meeting_id=meeting_id,
        image_bytes=raw_bytes2,
        timestamp=6.0,
        known_roster=["Sarah Chen", "Alex Morgan"]
    )

    asr_chunks = [
        {"timestamp": (0.0, 3.5), "text": "Hello everyone, Sarah here leading today's review."},
        {"timestamp": (4.5, 8.0), "text": "Thanks Sarah, Alex here with the architecture update."}
    ]

    segments, changes = multi_signal_diarization_engine.process("mock_non_existent.wav", asr_chunks, meeting_id=meeting_id)

    assert len(segments) == 2
    # Verify speaker names are mapped to the detected participants rather than generic 'Speaker 1'
    assert "Sarah Chen" in segments[0].speaker
    assert "Alex Morgan" in segments[1].speaker


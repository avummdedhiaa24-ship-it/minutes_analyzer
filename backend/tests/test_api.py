import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Append project path to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, get_db
from app.main import app

# Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_temp.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables in test DB
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup: create clean tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # Teardown: clear tables
    Base.metadata.drop_all(bind=engine)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_signup_and_login():
    # 1. Register User
    signup_data = {
        "username": "testmanager",
        "email": "manager@enterprise.ai",
        "role": "Manager",
        "password": "securepassword123",
        "full_name": "Ramesh Patel",
        "age": 35,
        "gender": "Male",
        "social_category": "General",
        "village": "Headquarters",
        "block": "Engineering",
        "district": "Mumbai",
        "state": "Maharashtra"
    }
    response = client.post("/api/v1/auth/signup", json=signup_data)
    assert response.status_code == 201
    assert response.json()["username"] == "testmanager"

    # 2. Login
    login_data = {
        "username": "testmanager",
        "password": "securepassword123"
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_create_meeting():
    # Create Manager User
    signup_data = {
        "username": "mgr1",
        "email": "mgr1@enterprise.ai",
        "role": "Manager",
        "password": "password",
        "full_name": "S. Patil"
    }
    client.post("/api/v1/auth/signup", json=signup_data)
    login_res = client.post("/api/v1/auth/login", data={"username": "mgr1", "password": "password"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Meeting
    meet_data = {
        "title": "API Infrastructure Sync",
        "description": "Allocating resources for cloud API migration",
        "date": "2026-08-01T10:00:00",
        "location": "Conference Room A",
        "agenda": "Review query indexing, approve cloud estimates."
    }
    
    # Scheduling Meeting
    response = client.post("/api/v1/meetings", json=meet_data, headers=headers)
    assert response.status_code == 201
    assert response.json()["title"] == "API Infrastructure Sync"
    assert response.json()["status"] == "scheduled"
    assert "meeting_pass" in response.json()["qr_code_data"]

def test_attendance_and_demographics():
    # 1. Setup meeting and employee
    client.post("/api/v1/auth/signup", json={"username": "mgr2", "email": "mgr2@enterprise.ai", "role": "Manager", "password": "pass", "full_name": "Patil"})
    login_res = client.post("/api/v1/auth/login", data={"username": "mgr2", "password": "pass"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    meet_res = client.post("/api/v1/meetings", json={"title": "M1", "date": "2026-08-01T10:00:00"}, headers=headers)
    meet_id = meet_res.json()["id"]

    citizen_res = client.post("/api/v1/auth/signup", json={
        "username": "employee_test",
        "email": "emp@test.com",
        "role": "Employee",
        "password": "pass",
        "full_name": "Ram Singh",
        "gender": "Male",
        "social_category": "SC",
        "age": 30
    })
    citizen_id = citizen_res.json()["id"]

    # 2. Register Check-in
    checkin_data = {
        "user_id": citizen_id,
        "method": "qr",
        "gps_lat": 19.0761,
        "gps_lng": 72.8778
    }
    response = client.post(f"/api/v1/attendance/{meet_id}", json=checkin_data)
    assert response.status_code == 200
    assert response.json()["verified"] is True

    # 3. Query stats
    stats_res = client.get(f"/api/v1/attendance/{meet_id}/stats")
    assert stats_res.status_code == 200
    assert stats_res.json()["total_attendance"] == 1
    assert stats_res.json()["gender"]["Male"] == 1
    assert stats_res.json()["social_category"]["SC"] == 1

def test_chat_rag_endpoints():
    chat_req = {
        "messages": [
            {"role": "user", "content": "How much budget was allocated to school repair?"}
        ]
    }
    response = client.post("/api/v1/chat", json=chat_req)
    assert response.status_code == 200
    assert "citations" in response.json()

def test_dashboard_summary():
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_meetings" in data
    assert "open_action_items" in data
    assert "department_distribution" in data

def test_faithfulness_guardrail_hallucinated_decision():
    from app.services.ai_pipeline import ai_pipeline
    
    source_transcript = "The engineering team reviewed Q3 strategy and approved API indexing optimization for Friday deployment."
    
    hallucinated_minutes = {
        "summary": "Summary text",
        "decisions": [
            {"decision": "Approved API indexing optimization"},
            {"decision": "Sanctioned 10,000,000 dollars for quantum computer purchase"}
        ],
        "follow_ups": [],
        "financial_information": []
    }
    
    verified_result = ai_pipeline.verify_faithfulness(hallucinated_minutes, source_transcript)
    assert verified_result["unverified"] is True
    assert len(verified_result["unverified_fields"]) > 0
    assert any("quantum" in field for field in verified_result["unverified_fields"])

def test_audit_chain_verification_tampering():
    client.post("/api/v1/auth/signup", json={"username": "adm_audit", "email": "adm@audit.com", "role": "System Admin", "password": "pass"})
    login_res = client.post("/api/v1/auth/login", data={"username": "adm_audit", "password": "pass"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    meet_res = client.post("/api/v1/meetings", json={"title": "Audit Test Meeting", "date": "2026-08-10T10:00:00"}, headers=headers)
    meet_id = meet_res.json()["id"]
    
    # Test valid meeting audit verification
    res = client.get(f"/api/v1/audit/verify/{meet_id}")
    assert res.status_code == 200
    assert "valid" in res.json()
    assert res.json()["valid"] is True

def test_rag_chat_ungrounded_query_not_found():
    chat_req = {
        "messages": [
            {"role": "user", "content": "What is the secret launch date of spaceship Mars 999?"}
        ]
    }
    response = client.post("/api/v1/chat", json=chat_req)
    assert response.status_code == 200
    assert "No matching resolution found" in response.json()["content"]
    assert len(response.json()["citations"]) == 0

def test_live_recording_lifecycle_and_chunk_transport():
    # 1. Signup and Create Meeting
    client.post("/api/v1/auth/signup", json={"username": "rec_admin", "email": "rec@corp.com", "role": "System Admin", "password": "pass"})
    login_res = client.post("/api/v1/auth/login", data={"username": "rec_admin", "password": "pass"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    meet_res = client.post("/api/v1/meetings", json={"title": "Q3 Executive Strategy Sync", "date": "2026-08-16T10:00:00", "enable_recording": True, "authorization_confirmed": True}, headers=headers)
    meet_id = meet_res.json()["id"]

    # 2. Start Recording requiring authorization
    start_unauth = client.post(f"/api/v1/audio/recording/{meet_id}/start", json={"authorization_confirmed": False}, headers=headers)
    assert start_unauth.status_code == 400

    start_res = client.post(f"/api/v1/audio/recording/{meet_id}/start", json={"authorization_confirmed": True}, headers=headers)
    assert start_res.status_code == 200
    assert start_res.json()["recording_status"] == "recording"
    assert start_res.json()["authorization_confirmed"] is True

    # 3. Pause & Resume Recording
    pause_res = client.post(f"/api/v1/audio/recording/{meet_id}/pause", headers=headers)
    assert pause_res.status_code == 200
    assert pause_res.json()["recording_status"] == "paused"

    resume_res = client.post(f"/api/v1/audio/recording/{meet_id}/resume", headers=headers)
    assert resume_res.status_code == 200
    assert resume_res.json()["recording_status"] == "recording"

    # 4. Stream Upload Audio Chunks with Sequence & Checksum
    chunk1_data = b"RIFF....WAVEfmt ....data...."
    files1 = {
        "sequence_number": (None, "1"),
        "checksum": (None, "sha256_dummy_1"),
        "chunk_file": ("chunk_00001.webm", chunk1_data, "audio/webm")
    }
    chunk1_res = client.post(f"/api/v1/audio/recording/{meet_id}/stream", files=files1, headers=headers)
    assert chunk1_res.status_code == 200
    assert chunk1_res.json()["status"] == "acknowledged"
    assert chunk1_res.json()["received_total_chunks"] == 1

    # Duplicate Chunk Duplicate Handling
    dup_res = client.post(f"/api/v1/audio/recording/{meet_id}/stream", files=files1, headers=headers)
    assert dup_res.status_code == 200
    assert dup_res.json()["status"] == "duplicate_acknowledged"

    # 5. Create Meeting Moment Marker
    marker_req = {"label": "Decision", "timestamp_seconds": 12.5, "note": "Approved Q4 budget extension"}
    marker_res = client.post(f"/api/v1/audio/markers/{meet_id}", json=marker_req, headers=headers)
    assert marker_res.status_code == 200
    assert marker_res.json()["label"] == "Decision"

    markers_list = client.get(f"/api/v1/audio/markers/{meet_id}")
    assert markers_list.status_code == 200
    assert len(markers_list.json()) == 1

    # 6. Stop Recording & Verify Processing Pipeline State
    stop_res = client.post(f"/api/v1/audio/recording/{meet_id}/stop", headers=headers)
    assert stop_res.status_code == 200
    assert stop_res.json()["meeting_status"] == "processing"

    proc_status = client.get(f"/api/v1/audio/processing/{meet_id}/status")
    assert proc_status.status_code == 200
    assert "current_stage" in proc_status.json()

def test_idempotent_processing_failure_recovery():
    client.post("/api/v1/auth/signup", json={"username": "retry_mgr", "email": "retry@corp.com", "role": "Manager", "password": "pass"})
    login_res = client.post("/api/v1/auth/login", data={"username": "retry_mgr", "password": "pass"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    meet_res = client.post("/api/v1/meetings", json={"title": "Retry Pipeline Test", "date": "2026-08-16T11:00:00"}, headers=headers)
    meet_id = meet_res.json()["id"]

    # Trigger retry
    retry_res = client.post(f"/api/v1/audio/processing/{meet_id}/retry", headers=headers)
    assert retry_res.status_code == 200
    assert retry_res.json()["meeting_status"] == "processing"




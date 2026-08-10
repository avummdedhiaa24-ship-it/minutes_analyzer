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



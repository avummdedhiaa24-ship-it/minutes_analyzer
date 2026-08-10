from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user

router = APIRouter(prefix="/audit", tags=["Audit & Security"])

@router.get("/{meeting_id}", response_model=List[schemas.AuditLogResponse])
def get_meeting_audit_trail(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    logs = db.query(models.AuditLog).filter(
        models.AuditLog.meeting_id == meeting_id
    ).order_by(models.AuditLog.timestamp.desc()).all()
    
    return logs

@router.get("/verify/{meeting_id}")
def verify_audit_chain(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Public Audit Chain Verification Endpoint:
    Recomputes the cryptographic SHA256 hash chain for a meeting's audit logs.
    Returns valid=true if untampered, or valid=false with the index of the broken link.
    """
    import hashlib
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    logs = db.query(models.AuditLog).filter(
        models.AuditLog.meeting_id == meeting_id
    ).order_by(models.AuditLog.id.asc()).all()

    if not logs:
        return {"meeting_id": meeting_id, "valid": True, "log_count": 0, "message": "No audit entries to verify"}

    prev_hash = "GENESIS"
    for idx, log in enumerate(logs):
        raw_payload = f"{log.meeting_id}:{log.action}:{log.user_id}:{log.timestamp}:{prev_hash}"
        calc_hash = hashlib.sha256(raw_payload.encode()).hexdigest()

        if log.digital_hash and log.digital_hash != calc_hash:
            return {
                "meeting_id": meeting_id,
                "valid": False,
                "broken_index": idx,
                "broken_log_id": log.id,
                "expected_hash": calc_hash,
                "actual_hash": log.digital_hash,
                "message": f"Hash chain verification failed at audit index {idx}"
            }
        prev_hash = log.digital_hash or calc_hash

    return {
        "meeting_id": meeting_id,
        "valid": True,
        "log_count": len(logs),
        "latest_hash": prev_hash,
        "message": "Cryptographic SHA256 audit chain verified untampered"
    }

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

from app.services.audit import audit_service

@router.get("/verify/{meeting_id}")
def verify_audit_chain(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Public Audit Chain Verification Endpoint:
    Recomputes the cryptographic SHA-256 hash chain for a meeting's audit logs (Section 6.15, Claims 11, 14).
    Validates previous_hash links and digital_hash signatures.
    """
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    return audit_service.verify_chain(db, meeting_id)

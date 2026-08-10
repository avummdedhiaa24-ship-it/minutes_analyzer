from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/meetings", tags=["Meetings"])

# Only System Admins, CEOs, or Managers can schedule or update meetings
officer_roles = ["System Admin", "CEO", "Manager", "Admin", "Secretary", "Gram Sabha Moderator", "District Officer", "State Officer"]
is_officer = RoleChecker(officer_roles)

@router.post("", response_model=schemas.MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(
    meeting_in: schemas.MeetingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(is_officer)
):
    meeting = models.Meeting(
        title=meeting_in.title,
        description=meeting_in.description,
        date=meeting_in.date,
        location=meeting_in.location,
        scheduled_start=meeting_in.scheduled_start or meeting_in.date,
        agenda=meeting_in.agenda,
        agenda_pdf_url=meeting_in.agenda_pdf_url,
        secretary_id=current_user.id,
        status="scheduled"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    
    # Generate unique QR code payload for local checkin validation
    meeting.qr_code_data = f"meeting_pass:meeting_id={meeting.id}:date={meeting.date.strftime('%Y%m%d')}"
    db.commit()
    db.refresh(meeting)
    return meeting

@router.get("", response_model=List[schemas.MeetingResponse])
def list_meetings(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Meeting)
    if status:
        query = query.filter(models.Meeting.status == status)
    return query.order_by(models.Meeting.date.desc()).all()

@router.get("/{meeting_id}", response_model=schemas.MeetingDetailResponse)
def get_meeting_detail(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    return meeting

@router.put("/{meeting_id}/status", response_model=schemas.MeetingResponse)
def update_meeting_status(
    meeting_id: int,
    status_str: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(is_officer)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    meeting.status = status_str
    if status_str == "ongoing" and not meeting.actual_start:
        meeting.actual_start = datetime.now()
    elif status_str == "approved" and not meeting.actual_end:
        meeting.actual_end = datetime.now()
        
    db.commit()
    db.refresh(meeting)
    return meeting

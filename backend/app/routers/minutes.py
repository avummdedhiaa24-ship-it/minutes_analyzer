from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any, List
import json

from app.core.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker
from app.services.audit import audit_service
from app.services.ai_pipeline import ai_pipeline

router = APIRouter(prefix="/minutes", tags=["Minutes & Human Review"])

officer_roles = ["System Admin", "CEO", "Manager", "Admin", "Secretary", "Gram Sabha Moderator", "District Officer", "State Officer"]
is_officer = RoleChecker(officer_roles)

@router.get("/{meeting_id}", response_model=schemas.MinutesResponse)
def get_meeting_minutes(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    minutes = db.query(models.Minutes).filter(models.Minutes.meeting_id == meeting_id).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found/generated yet.")
    return minutes

@router.put("/{meeting_id}", response_model=schemas.MinutesResponse)
def update_minutes_draft(
    meeting_id: int,
    minutes_in: schemas.MinutesCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(is_officer)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    minutes = db.query(models.Minutes).filter(models.Minutes.meeting_id == meeting_id).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found")

    # Serialize states for audit logging
    prev_state = {
        "summary": minutes.summary,
        "topics": minutes.topics,
        "decisions": minutes.decisions,
        "issues_and_risks": minutes.issues_and_risks,
        "follow_ups": minutes.follow_ups,
        "financial_information": minutes.financial_information,
        "additional_notes": minutes.additional_notes
    }

    # Update fields
    minutes.summary = minutes_in.summary
    minutes.topics = minutes_in.topics
    minutes.decisions = minutes_in.decisions
    minutes.issues_and_risks = minutes_in.issues_and_risks
    minutes.follow_ups = minutes_in.follow_ups
    minutes.financial_information = minutes_in.financial_information
    minutes.additional_notes = minutes_in.additional_notes
    
    current_state = {
        "summary": minutes.summary,
        "topics": minutes.topics,
        "decisions": minutes.decisions,
        "issues_and_risks": minutes.issues_and_risks,
        "follow_ups": minutes.follow_ups,
        "financial_information": minutes.financial_information,
        "additional_notes": minutes.additional_notes
    }

    # Create audit log record
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="edit_minutes",
        previous_state=prev_state,
        current_state=current_state
    )

    db.commit()
    db.refresh(minutes)
    return minutes

@router.post("/{meeting_id}/finalize", response_model=schemas.MinutesResponse)
def finalize_minutes(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(is_officer)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    minutes = db.query(models.Minutes).filter(models.Minutes.meeting_id == meeting_id).first()
    if not minutes:
        raise HTTPException(status_code=404, detail="Minutes not found")

    current_state = {
        "summary": minutes.summary,
        "topics": minutes.topics,
        "decisions": minutes.decisions,
        "issues_and_risks": minutes.issues_and_risks,
        "follow_ups": minutes.follow_ups,
        "financial_information": minutes.financial_information,
        "additional_notes": minutes.additional_notes
    }

    # Compute secure hash
    digital_hash = audit_service.calculate_minutes_hash(current_state)

    minutes.digital_hash = digital_hash
    minutes.approved_by_id = current_user.id
    minutes.approved_at = datetime.utcnow()
    
    meeting.status = "approved"

    # Save final log record
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="finalize_minutes",
        previous_state=current_state,
        current_state={**current_state, "digital_hash": digital_hash, "approved_by_id": current_user.id}
    )

    db.commit()
    db.refresh(minutes)
    db.refresh(meeting)
    return minutes

@router.get("/{meeting_id}/export", response_class=Response)
def export_minutes(
    meeting_id: int,
    format: str = "text", # text, json
    lang: str = "original",
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting or not meeting.minutes:
        raise HTTPException(status_code=404, detail="Meeting or minutes not found")

    # Fetch/translate minutes details based on requested language
    summary = meeting.minutes.summary
    topics = meeting.minutes.topics or []
    decisions = meeting.minutes.decisions or []
    
    if lang != "original":
        # Check cached Translation table first
        trans = db.query(models.Translation).filter(
            models.Translation.meeting_id == meeting_id,
            models.Translation.language == lang
        ).first()
        if trans:
            summary = trans.minutes_summary
        else:
            summary = ai_pipeline.translate_text(summary, lang)

        # Translate dynamic lists
        topics = [ai_pipeline.translate_text(t, lang) for t in topics]
        schemes = [ai_pipeline.translate_text(s, lang) for s in schemes]

    # Map details to report dictionary
    minutes_dict = {
        "summary": summary,
        "topics": topics,
        "schemes": schemes,
        "budget_summary": meeting.minutes.budget_summary,
        "digital_hash": meeting.minutes.digital_hash,
        "action_items": [
            {
                "title": ai_pipeline.translate_text(a.title, lang) if lang != "original" else a.title,
                "department": ai_pipeline.translate_text(a.department, lang) if lang != "original" else a.department,
                "responsible_person": ai_pipeline.translate_text(a.responsible_person, lang) if lang != "original" else a.responsible_person,
                "deadline": str(a.deadline)
            }
            for a in meeting.action_items
        ],
        "votes": [
            {
                "proposal_title": ai_pipeline.translate_text(v.proposal_title, lang) if lang != "original" else v.proposal_title,
                "votes_for": v.votes_for,
                "votes_against": v.votes_against,
                "votes_abstain": v.votes_abstain
            }
            for v in meeting.votes
        ]
    }

    filename_prefix = f"minutes_meeting_{meeting_id}_{lang}" if lang != "original" else f"minutes_meeting_{meeting_id}"

    if format == "json":
        return Response(
            content=json.dumps(minutes_dict, indent=2, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename_prefix}.json"}
        )
    
    # Text Govt layout fallback with target language
    report_text = audit_service.export_to_text_report(meeting.title, minutes_dict, lang)
    return Response(
        content=report_text.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename_prefix}.txt"}
    )

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker
from app.services.ai_pipeline import ai_pipeline

router = APIRouter(prefix="/translation", tags=["Translation"])

officer_roles = ["System Admin", "CEO", "Manager", "Admin", "Secretary", "Department Lead", "Director"]
is_officer = RoleChecker(officer_roles)

def generate_translation_for_meeting(meeting_id: int, lang_code: str, db: Session) -> models.Translation:
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Purge existing stale translation row if present
    existing = db.query(models.Translation).filter(
        models.Translation.meeting_id == meeting_id,
        models.Translation.language == lang_code
    ).first()
    if existing:
        db.delete(existing)
        db.commit()

    summary_text = meeting.minutes.summary if meeting.minutes else (meeting.description or meeting.title)
    translated_summary = ai_pipeline.translate_text(summary_text, lang_code)
    translated_agenda = ai_pipeline.translate_text(meeting.agenda or "", lang_code)

    translated_segments = []
    if meeting.transcripts and meeting.transcripts.diarized_json:
        for seg in meeting.transcripts.diarized_json:
            translated_segments.append({
                "speaker": seg.get("speaker"),
                "start": seg.get("start"),
                "end": seg.get("end"),
                "text": ai_pipeline.translate_text(seg.get("text", ""), lang_code)
            })

    trans_rec = models.Translation(
        meeting_id=meeting_id,
        language=lang_code,
        minutes_summary=translated_summary,
        agenda=translated_agenda,
        transcript_translated_json=translated_segments
    )
    db.add(trans_rec)
    db.commit()
    db.refresh(trans_rec)
    return trans_rec

@router.post("/{meeting_id}/{lang_code}", response_model=schemas.TranslationResponse)
def trigger_translation(
    meeting_id: int,
    lang_code: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(is_officer)
):
    return generate_translation_for_meeting(meeting_id, lang_code, db)

@router.get("/{meeting_id}/{lang_code}", response_model=schemas.TranslationResponse)
def get_translation(
    meeting_id: int,
    lang_code: str,
    db: Session = Depends(get_db)
):
    trans = db.query(models.Translation).filter(
        models.Translation.meeting_id == meeting_id,
        models.Translation.language == lang_code
    ).first()

    # Check if trans exists and is not stale mock data
    if trans and trans.transcript_translated_json:
        first_seg_text = trans.transcript_translated_json[0].get("text", "") if len(trans.transcript_translated_json) > 0 else ""
        if "[Prod Translated" not in first_seg_text and "[MOCK" not in first_seg_text:
            return trans

    # If missing or stale mock data, generate clean translation on-the-fly
    return generate_translation_for_meeting(meeting_id, lang_code, db)

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.core.database import get_db
from app import models, schemas
from app.services.rag import rag_service

router = APIRouter(prefix="/search", tags=["Global Search"])

@router.get("", response_model=Dict[str, Any])
def global_enterprise_search(
    query: str,
    db: Session = Depends(get_db)
):
    if not query or len(query.strip()) == 0:
        raise HTTPException(status_code=400, detail="Search query must not be empty.")

    q = f"%{query.strip()}%"

    # 1. Search Decisions
    decisions = db.query(models.Decision).filter(
        (models.Decision.decision_text.ilike(q)) | 
        (models.Decision.rationale.ilike(q)) |
        (models.Decision.category.ilike(q))
    ).all()

    dec_results = [
        {
            "id": d.id,
            "meeting_id": d.meeting_id,
            "type": "decision",
            "title": d.decision_text,
            "subtitle": f"Rationale: {d.rationale or 'N/A'}",
            "category": d.category,
            "impact": d.impact_level,
            "timestamp": d.source_timestamp,
            "speaker": d.source_speaker or "Speaker",
            "url": f"/decisions"
        } for d in decisions
    ]

    # 2. Search Action Items
    actions = db.query(models.ActionItem).filter(
        (models.ActionItem.title.ilike(q)) |
        (models.ActionItem.description.ilike(q)) |
        (models.ActionItem.responsible_person.ilike(q))
    ).all()

    act_results = [
        {
            "id": a.id,
            "meeting_id": a.meeting_id,
            "type": "action_item",
            "title": a.title,
            "subtitle": f"Owner: {a.responsible_person or 'Unassigned'} • Status: {a.status}",
            "priority": a.priority,
            "status": a.status,
            "timestamp": a.source_timestamp,
            "speaker": a.source_speaker or "Speaker",
            "url": f"/action-items"
        } for a in actions
    ]

    # 3. Search Meetings
    meetings = db.query(models.Meeting).filter(
        (models.Meeting.title.ilike(q)) |
        (models.Meeting.agenda.ilike(q)) |
        (models.Meeting.department.ilike(q))
    ).all()

    meet_results = [
        {
            "id": m.id,
            "type": "meeting",
            "title": m.title,
            "subtitle": f"Department: {m.department} • Date: {m.date.strftime('%Y-%m-%d')}",
            "status": m.status,
            "url": f"/verify?meeting_id={m.id}"
        } for m in meetings
    ]

    # 4. Search Meeting Participants & Attendance
    participants = db.query(models.MeetingParticipant).filter(
        (models.MeetingParticipant.display_name.ilike(q)) |
        (models.MeetingParticipant.role.ilike(q)) |
        (models.MeetingParticipant.ocr_name.ilike(q))
    ).all()

    part_results = [
        {
            "id": p.id,
            "meeting_id": p.meeting_id,
            "type": "participant",
            "title": p.display_name,
            "subtitle": f"Role: {p.role or 'Participant'} • Status: {p.attendance_status} • Identity: {p.identity_status}",
            "status": p.attendance_status,
            "identity_status": p.identity_status,
            "url": f"/attendance?meeting_id={p.meeting_id}"
        } for p in participants
    ]

    # 5. Search Transcript Text
    transcripts = db.query(models.Transcript).filter(
        models.Transcript.raw_text.ilike(q)
    ).limit(5).all()

    trans_results = [
        {
            "id": t.id,
            "meeting_id": t.meeting_id,
            "type": "transcript",
            "title": f"Meeting #{t.meeting_id} Transcript Match",
            "subtitle": t.raw_text[:140] + ("..." if len(t.raw_text) > 140 else ""),
            "url": f"/transcript?meeting_id={t.meeting_id}"
        } for t in transcripts
    ]

    # 6. RAG Vector Semantic Matches
    semantic_matches = rag_service.search(query, limit=5)

    return {
        "query": query,
        "total_results": len(dec_results) + len(act_results) + len(meet_results) + len(part_results) + len(trans_results) + len(semantic_matches),
        "decisions": dec_results,
        "action_items": act_results,
        "meetings": meet_results,
        "participants": part_results,
        "transcripts": trans_results,
        "semantic_matches": semantic_matches
    }

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models import Decision
from app.schemas import DecisionCreate, DecisionUpdate, DecisionResponse

router = APIRouter(prefix="/decisions", tags=["decisions"])

@router.get("", response_model=List[DecisionResponse])
def list_decisions(
    category: Optional[str] = Query(None),
    impact_level: Optional[str] = Query(None),
    meeting_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Decision)
    if category:
        query = query.filter(Decision.category == category)
    if impact_level:
        query = query.filter(Decision.impact_level == impact_level)
    if meeting_id:
        query = query.filter(Decision.meeting_id == meeting_id)
    return query.order_by(Decision.id.desc()).all()

@router.post("", response_model=DecisionResponse)
def create_decision(
    decision: DecisionCreate,
    db: Session = Depends(get_db)
):
    db_dec = Decision(
        meeting_id=decision.meeting_id,
        decision_text=decision.decision_text,
        rationale=decision.rationale or "Consensus reached by architecture panel.",
        impact_level=decision.impact_level or "MEDIUM",
        category=decision.category or "Architecture",
        status=decision.status or "APPROVED",
        source_segment_id=decision.source_segment_id,
        source_timestamp=decision.source_timestamp,
        source_speaker=decision.source_speaker or "Rahul Sharma (Host)",
        evidence_text=decision.evidence_text,
        confidence=decision.confidence or 0.92,
        participants=decision.participants or ["Rahul Sharma", "Ananya Roy", "Vikram Malhotra"]
    )
    db.add(db_dec)
    db.commit()
    db.refresh(db_dec)
    return db_dec

@router.put("/{decision_id}", response_model=DecisionResponse)
def update_decision(
    decision_id: int,
    update_data: DecisionUpdate,
    db: Session = Depends(get_db)
):
    db_dec = db.query(Decision).filter(Decision.id == decision_id).first()
    if not db_dec:
        raise HTTPException(status_code=404, detail="Decision not found")

    if update_data.decision_text:
        db_dec.decision_text = update_data.decision_text
    if update_data.rationale:
        db_dec.rationale = update_data.rationale
    if update_data.impact_level:
        db_dec.impact_level = update_data.impact_level
    if update_data.status:
        db_dec.status = update_data.status

    db.commit()
    db.refresh(db_dec)
    return db_dec

@router.delete("/{decision_id}")
def delete_decision(decision_id: int, db: Session = Depends(get_db)):
    db_dec = db.query(Decision).filter(Decision.id == decision_id).first()
    if not db_dec:
        raise HTTPException(status_code=404, detail="Decision not found")
    db.delete(db_dec)
    db.commit()
    return {"message": "Decision deleted successfully"}

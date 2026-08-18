from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models import ActionItem, Meeting
from app.schemas import ActionItemCreate, ActionItemUpdate, ActionItemResponse

router = APIRouter(prefix="/action-items", tags=["action-items"])

@router.get("", response_model=List[ActionItemResponse])
def list_action_items(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    meeting_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ActionItem)
    if status:
        query = query.filter(ActionItem.status == status)
    if priority:
        query = query.filter(ActionItem.priority == priority)
    if meeting_id:
        query = query.filter(ActionItem.meeting_id == meeting_id)
    return query.order_by(ActionItem.id.desc()).all()

@router.post("", response_model=ActionItemResponse)
def create_action_item(
    item: ActionItemCreate,
    db: Session = Depends(get_db)
):
    if not item.meeting_id:
        # Default to latest meeting
        latest = db.query(Meeting).order_by(Meeting.id.desc()).first()
        meeting_id = latest.id if latest else 1
    else:
        meeting_id = item.meeting_id

    db_item = ActionItem(
        meeting_id=meeting_id,
        title=item.title,
        description=item.description,
        owner_user_id=item.owner_user_id,
        responsible_person=item.responsible_person or "Rahul Sharma",
        department=item.department or "Engineering",
        deadline=item.deadline,
        priority=item.priority or "MEDIUM",
        status=item.status or "TO_DO",
        source_segment_id=item.source_segment_id,
        source_timestamp=item.source_timestamp,
        source_speaker=item.source_speaker or "Rahul Sharma",
        evidence_text=item.evidence_text,
        confidence=item.confidence or 0.94,
        decision_id=item.decision_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{item_id}", response_model=ActionItemResponse)
def update_action_item(
    item_id: int,
    update_data: ActionItemUpdate,
    db: Session = Depends(get_db)
):
    db_item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Action item not found")

    if update_data.status:
        db_item.status = update_data.status
    if update_data.priority:
        db_item.priority = update_data.priority
    if update_data.responsible_person:
        db_item.responsible_person = update_data.responsible_person
    if update_data.title:
        db_item.title = update_data.title
    if update_data.deadline:
        db_item.deadline = update_data.deadline

    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{item_id}")
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Action item not found")
    db.delete(db_item)
    db.commit()
    return {"message": "Action item deleted successfully"}

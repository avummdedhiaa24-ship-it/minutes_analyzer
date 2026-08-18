from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Dict, Any, List

from app.core.database import get_db
from app import models, schemas

router = APIRouter(prefix="/analytics", tags=["Analytics Dashboard"])

@router.get("/dashboard", response_model=Dict[str, Any])
def get_dashboard_metrics(
    db: Session = Depends(get_db)
):
    # Conducted Meetings
    meetings_count = db.query(models.Meeting).count()
    approved_meetings = db.query(models.Meeting).filter(models.Meeting.status == "approved").count()

    # Total checkins count
    total_attendance = db.query(models.Attendance).count()

    # SC/ST and Gender Representation
    attendance_records = db.query(models.Attendance).join(models.User).all()
    
    women_count = 0
    sc_st_count = 0
    total_att_users = len(attendance_records)

    for rec in attendance_records:
        if rec.user.gender == "Female":
            women_count += 1
        if rec.user.social_category in ["SC", "ST"]:
            sc_st_count += 1

    women_participation_pct = round((women_count / total_att_users) * 100, 1) if total_att_users > 0 else 0.0
    sc_st_participation_pct = round((sc_st_count / total_att_users) * 100, 1) if total_att_users > 0 else 0.0

    # Action Items Completion
    total_actions = db.query(models.ActionItem).count()
    completed_actions = db.query(models.ActionItem).filter(models.ActionItem.status == "completed").count()
    action_completion_pct = round((completed_actions / total_actions) * 100, 1) if total_actions > 0 else 0.0

    # Top Schemes Discussed
    all_minutes = db.query(models.Minutes).all()
    scheme_counts = {}
    total_budget = 0.0
    budget_breakdown = {}

    for min_rec in all_minutes:
        if min_rec.schemes:
            for s in min_rec.schemes:
                scheme_counts[s] = scheme_counts.get(s, 0) + 1
        if min_rec.budget_summary:
            for title, amt in min_rec.budget_summary.items():
                try:
                    amt_float = float(amt)
                    total_budget += amt_float
                    budget_breakdown[title] = budget_breakdown.get(title, 0.0) + amt_float
                except:
                    pass

    top_schemes = [{"scheme_name": k, "count": v} for k, v in sorted(scheme_counts.items(), key=lambda x: x[1], reverse=True)[:5]]

    # Speaking time distributions (mock statistics)
    speaking_times = [
        {"name": "Meeting Host", "value": 30},
        {"name": "Chairperson (Moderator)", "value": 45},
        {"name": "Participants", "value": 25}
    ]

    return {
        "meetings_conducted": meetings_count,
        "finalized_minutes": approved_meetings,
        "total_attendance": total_attendance,
        "women_participation_pct": women_participation_pct,
        "sc_st_participation_pct": sc_st_participation_pct,
        "action_completion_pct": action_completion_pct,
        "total_budget_approved": total_budget,
        "top_schemes": top_schemes,
        "budget_allocation": [{"sector": k, "amount": v} for k, v in budget_breakdown.items()],
        "speaking_time": speaking_times
    }

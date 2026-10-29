import math
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any

from app.core.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/attendance", tags=["Attendance"])

# Corporate HQ Center GPS (Central Enterprise Office)
HQ_LAT = 19.0760
HQ_LNG = 72.8777
MAX_ALLOWED_DISTANCE_KM = 3.0  # Max 3km radius from Corporate HQ office

def haversine_distance(lat1, lon1, lat2, lon2):
    # Calculate distance between two coordinates in kilometers
    R = 6371.0 # Earth radius
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@router.post("/{meeting_id}", response_model=schemas.AttendanceResponse)
def checkin_attendance(
    meeting_id: int,
    checkin: schemas.AttendanceCreate,
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    user = db.query(models.User).filter(models.User.id == checkin.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if already checked in (Claim 4: second check-in of the same participant is rejected)
    existing = db.query(models.Attendance).filter(
        models.Attendance.meeting_id == meeting_id,
        models.Attendance.user_id == checkin.user_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate check-in rejected: participant is already checked in for this meeting."
        )

    # Perform GPS proximity check using configurable meeting venue (Claim 4, Gap 8)
    venue_lat = meeting.venue_lat if meeting.venue_lat is not None else HQ_LAT
    venue_lng = meeting.venue_lng if meeting.venue_lng is not None else HQ_LNG
    permitted_radius = meeting.venue_radius_km if meeting.venue_radius_km is not None else MAX_ALLOWED_DISTANCE_KM

    verified = True
    if checkin.gps_lat and checkin.gps_lng:
        distance = haversine_distance(venue_lat, venue_lng, checkin.gps_lat, checkin.gps_lng)
        if distance > permitted_radius:
            verified = False  # Flag check-in if outside permitted radius

    attendance = models.Attendance(
        meeting_id=meeting_id,
        user_id=checkin.user_id,
        method=checkin.method,
        gps_lat=checkin.gps_lat,
        gps_lng=checkin.gps_lng,
        verified=verified
    )
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance

@router.get("/{meeting_id}/stats", response_model=Dict[str, Any])
def get_attendance_stats(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    records = db.query(models.Attendance).join(models.User).filter(
        models.Attendance.meeting_id == meeting_id
    ).all()

    total = len(records)
    gender_stats = {"Male": 0, "Female": 0, "Other": 0}
    category_stats = {"General": 0, "OBC": 0, "SC": 0, "ST": 0}
    age_stats = {"Youth (<35)": 0, "Middle-aged (35-60)": 0, "Senior (>60)": 0}
    method_stats = {"qr": 0, "manual": 0, "biometric": 0}
    village_stats = {}

    for rec in records:
        user = rec.user
        # Gender
        gen = user.gender if user.gender in gender_stats else "Other"
        gender_stats[gen] += 1
        
        # Social Category
        cat = user.social_category if user.social_category in category_stats else "General"
        category_stats[cat] += 1
        
        # Age
        age = user.age or 30
        if age < 35:
            age_stats["Youth (<35)"] += 1
        elif age <= 60:
            age_stats["Middle-aged (35-60)"] += 1
        else:
            age_stats["Senior (>60)"] += 1

        # Checkin method
        method = rec.method if rec.method in method_stats else "manual"
        method_stats[method] += 1

        # Village
        vil = user.village or "Main Village"
        village_stats[vil] = village_stats.get(vil, 0) + 1

    return {
        "total_attendance": total,
        "gender": gender_stats,
        "social_category": category_stats,
        "age_groups": age_stats,
        "methods": method_stats,
        "villages": village_stats
    }

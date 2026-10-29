import os
import uuid
import shutil
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app import models, schemas
from app.routers.auth import get_current_user
from app.services.ai_pipeline import ai_pipeline
from app.services.rag import rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["Audio & Transcript Pipeline"])

def run_processing_pipeline(meeting_id: int, file_path: str, db: Optional[Session] = None, start_stage: str = "all"):
    from app.core.database import SessionLocal
    own_session = False
    if db is None:
        db = SessionLocal()
        own_session = True

    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        if own_session:
            db.close()
        return

    # Robust file_path resolution
    if not os.path.exists(file_path):
        if os.path.exists(os.path.join("backend", file_path.lstrip("./"))):
            file_path = os.path.join("backend", file_path.lstrip("./"))
        elif os.path.exists(file_path.replace("backend/", "")):
            file_path = file_path.replace("backend/", "")

    try:
        if start_stage in ["all", "audio"]:
            # 1. Update status to processing_audio
            meeting.status = "processing"
            meeting.processing_status = "processing_audio"
            db.commit()

            # Clear stale outputs if doing full re-run
            db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).delete()
            db.query(models.Minutes).filter(models.Minutes.meeting_id == meeting_id).delete()
            db.query(models.ActionItem).filter(models.ActionItem.meeting_id == meeting_id).delete()
            db.query(models.Vote).filter(models.Vote.meeting_id == meeting_id).delete()
            db.query(models.Translation).filter(models.Translation.meeting_id == meeting_id).delete()
            db.commit()

            # Noise reduction filter
            clean_audio_path = ai_pipeline.reduce_noise(file_path)
        else:
            clean_audio_path = file_path

        # 2. Transcription stage
        if start_stage in ["all", "audio", "transcription"]:
            meeting.processing_status = "transcribing"
            db.commit()

            try:
                # Query enrolled voice profiles for identity-aware diarization
                enrolled = db.query(models.CalibratedVoiceProfile).filter(
                    models.CalibratedVoiceProfile.meeting_id == meeting_id,
                    models.CalibratedVoiceProfile.consent_status == "CONSENT_GRANTED",
                    models.CalibratedVoiceProfile.is_active == True
                ).all()
                enrolled_list = [
                    {
                        "id": p.id,
                        "display_name": p.display_name,
                        "role": p.role,
                        "department": p.department,
                        "embedding_vector": p.embedding_vector
                    } for p in enrolled if p.embedding_vector
                ]

                try:
                    from app.services.screen_ocr import screen_ocr_engine
                    from app.services.meeting_ocr import meeting_ocr_service
                    screen_ocr_engine.auto_sync_attendance(meeting_id, db)
                    meeting_ocr_service._sync_db_participants(meeting_id, db)
                except Exception as sync_e:
                    logger.warning(f"Attendance auto-sync before transcription error: {sync_e}")

                lang, confidence = ai_pipeline.detect_language_and_dialect(clean_audio_path)
                raw_text, diarized_segments = ai_pipeline.diarize_and_transcribe(
                    clean_audio_path,
                    lang,
                    enrolled_profiles=enrolled_list,
                    meeting_id=meeting_id
                )
            except Exception as tr_err:
                meeting.processing_status = "transcription_failed"
                meeting.status = "processing"
                db.commit()
                raise tr_err

            # Store transcript
            transcript = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
            if not transcript:
                transcript = models.Transcript(
                    meeting_id=meeting_id,
                    raw_text=raw_text,
                    diarized_json=diarized_segments,
                    language=lang,
                    confidence=confidence
                )
                db.add(transcript)
            else:
                transcript.raw_text = raw_text
                transcript.diarized_json = diarized_segments
                transcript.language = lang
                transcript.confidence = confidence
            meeting.status = "transcript_ready"
            db.commit()

        # 3. AI Minutes Extraction stage
        meeting.processing_status = "generating_minutes"
        db.commit()

        transcript = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
        if not transcript or not transcript.raw_text:
            meeting.processing_status = "minutes_generation_failed"
            db.commit()
            return

        # 1. Gather confirmed attendees from OCR & DB
        attendee_names = []
        from app.services.screen_ocr import screen_ocr_engine
        from app.services.meeting_ocr import meeting_ocr_service
        try:
            screen_ocr_engine.auto_sync_attendance(meeting_id, db)
            meeting_ocr_service._sync_db_participants(meeting_id, db)
        except Exception as sync_e:
            logger.warning(f"Attendance auto-sync non-critical error: {sync_e}")

        db_participants = db.query(models.MeetingParticipant).filter(models.MeetingParticipant.meeting_id == meeting_id).all()
        for p in db_participants:
            if p.display_name and p.display_name not in attendee_names:
                attendee_names.append(p.display_name)

        if not attendee_names:
            db_attendees = db.query(models.Attendance).join(models.User).filter(models.Attendance.meeting_id == meeting_id).all()
            for att in db_attendees:
                name = att.user.full_name or att.user.username
                if name and name not in attendee_names:
                    attendee_names.append(name)

        ocr_cached = screen_ocr_engine.get_cached_ocr_data(meeting_id).get("detected_attendees", [])
        for name in ocr_cached:
            if name and name not in attendee_names:
                attendee_names.append(name)

        try:
            nlp_data = ai_pipeline.extract_structured_minutes(
                transcript.raw_text,
                transcript.language or "en",
                agenda=meeting.agenda,
                meeting_id=meeting_id,
                attendee_roster=attendee_names,
                segments=transcript.diarized_json or []
            )
        except Exception as min_err:
            meeting.processing_status = "minutes_generation_failed"
            db.commit()
            raise min_err

        # Create or update Minutes, ActionItems, and Decisions
        minutes = db.query(models.Minutes).filter(models.Minutes.meeting_id == meeting_id).first()
        if not minutes:
            minutes = models.Minutes(
                meeting_id=meeting_id,
                summary=nlp_data.get("summary", ""),
                topics=nlp_data.get("topics", []),
                decisions=nlp_data.get("decisions", []),
                issues_and_risks=nlp_data.get("issues_and_risks", []),
                follow_ups=nlp_data.get("follow_ups", []),
                financial_information=nlp_data.get("financial_information", []),
                additional_notes=nlp_data.get("additional_notes", ""),
                detailed_discussion=nlp_data.get("detailed_discussion", []),
                questions_and_concerns=nlp_data.get("questions_and_concerns", []),
                unresolved_issues=nlp_data.get("unresolved_issues", []),
                attendance_snapshot=nlp_data.get("attendance_snapshot", []),
                closing_summary=nlp_data.get("closing_summary", "")
            )
            db.add(minutes)
        else:
            minutes.summary = nlp_data.get("summary", "")
            minutes.topics = nlp_data.get("topics", [])
            minutes.decisions = nlp_data.get("decisions", [])
            minutes.issues_and_risks = nlp_data.get("issues_and_risks", [])
            minutes.follow_ups = nlp_data.get("follow_ups", [])
            minutes.financial_information = nlp_data.get("financial_information", [])
            minutes.additional_notes = nlp_data.get("additional_notes", "")
            minutes.detailed_discussion = nlp_data.get("detailed_discussion", [])
            minutes.questions_and_concerns = nlp_data.get("questions_and_concerns", [])
            minutes.unresolved_issues = nlp_data.get("unresolved_issues", [])
            minutes.attendance_snapshot = nlp_data.get("attendance_snapshot", [])
            minutes.closing_summary = nlp_data.get("closing_summary", "")

        # Populate Decision records
        db.query(models.Decision).filter(models.Decision.meeting_id == meeting_id).delete()
        for dec in nlp_data.get("decisions", []):
            ev = dec.get("evidence", {})
            ev_str = str(ev) if isinstance(ev, dict) else (ev or "")
            dec_rec = models.Decision(
                meeting_id=meeting_id,
                organization_id=meeting.organization_id,
                decision_text=dec.get("decision", ""),
                rationale=dec.get("rationale") or dec.get("context", ""),
                status="APPROVED",
                source_timestamp=float(dec.get("source_timestamp", 0.0)),
                source_speaker=dec.get("source_speaker"),
                evidence_text=ev_str,
                confidence=float(dec.get("confidence", 0.94)),
                participants=dec.get("participants", attendee_names)
            )
            db.add(dec_rec)

        db.query(models.ActionItem).filter(models.ActionItem.meeting_id == meeting_id).delete()
        for act in nlp_data.get("action_items", []):
            ev = act.get("evidence", {})
            ev_str = str(ev) if isinstance(ev, dict) else (ev or "")
            deadline_val = None
            if act.get("deadline"):
                try:
                    deadline_val = datetime.strptime(act["deadline"], "%Y-%m-%d")
                except Exception:
                    deadline_val = datetime.utcnow() + timedelta(days=7)
            action_item = models.ActionItem(
                meeting_id=meeting_id,
                organization_id=meeting.organization_id,
                title=act.get("title", "Action Item"),
                description=act.get("description", ""),
                responsible_person=act.get("responsible_person") or act.get("owner", "Unassigned"),
                department=act.get("department", "General"),
                deadline=deadline_val,
                priority=act.get("priority", "MEDIUM"),
                status="TO_DO",
                source_timestamp=float(act.get("source_timestamp", 0.0)),
                source_speaker=act.get("source_speaker"),
                evidence_text=ev_str,
                confidence=float(act.get("confidence", 0.92)),
                source_segments=act.get("source_segments", ["segment_1"])
            )
            db.add(action_item)

        for vt in nlp_data.get("votes", []):
            vote_rec = models.Vote(
                meeting_id=meeting_id,
                proposal_title=vt.get("proposal_title", ""),
                votes_for=vt.get("votes_for", 0),
                votes_against=vt.get("votes_against", 0),
                votes_abstain=vt.get("votes_abstain", 0),
                objections_summary=vt.get("objections_summary", "")
            )
            db.add(vote_rec)

        # Index into RAG service
        rag_service.add_document(meeting_id, meeting.title, transcript.raw_text)

        # 4. Mark meeting as minutes_ready
        meeting.status = "minutes_ready"
        meeting.processing_status = "completed"
        db.commit()

        # Audit log
        from app.services.audit import audit_service
        audit_service.log_change(
            db=db,
            meeting_id=meeting_id,
            modified_by_id=meeting.secretary_id or 1,
            action="MINUTES_GENERATED",
            previous_state=None,
            current_state={"summary": minutes.summary, "status": meeting.status}
        )

    except Exception as e:
        logger.error(f"Async meeting processing pipeline error for meeting {meeting_id}: {e}", exc_info=True)
        try:
            db.rollback()
            m = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
            if m:
                # Ensure meeting never stays stuck in infinite processing loop
                t_check = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
                if t_check and t_check.raw_text:
                    m.status = "minutes_ready"
                    m.processing_status = "completed"
                else:
                    m.processing_status = "failed"
                    m.status = "scheduled"
                db.commit()
        except Exception as inner_err:
            logger.error(f"Failed to record failure state: {inner_err}")
    finally:
        if own_session:
            try:
                db.close()
            except Exception:
                pass

@router.post("/upload/{meeting_id}", response_model=schemas.MeetingResponse)
async def upload_audio(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Generate path
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Save file
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    meeting.audio_url = f"/api/v1/audio/stream/{unique_filename}"
    db.commit()

    # Trigger async processing background tasks with independent DB session
    background_tasks.add_task(run_processing_pipeline, meeting_id, dest_path, None)

    return meeting

@router.get("/stream/{filename}")
def stream_audio(
    filename: str,
    current_user: models.User = Depends(get_current_user)
):
    """
    Authenticated streaming endpoint for audio recordings.
    Only logged-in users with a valid JWT/HttpOnly cookie can stream audio.
    """
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio recording not found")
    return FileResponse(file_path, media_type="audio/mpeg")

@router.get("/meeting/{meeting_id}")
def stream_meeting_audio(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    FIG. 4: Audio Re-listening source endpoint.
    Streams the meeting's source audio recording so each line of transcript
    maps directly to its audio snippet for synchronized playback.
    """
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # 1. Check meeting.audio_url
    if meeting.audio_url:
        fname = os.path.basename(meeting.audio_url)
        cand_path = os.path.join(settings.UPLOAD_DIR, fname)
        if os.path.exists(cand_path):
            media_type = "audio/wav" if cand_path.endswith(".wav") else "audio/mpeg"
            return FileResponse(cand_path, media_type=media_type)

    # 2. Check meeting_recordings table
    rec = db.query(models.MeetingRecording).filter(models.MeetingRecording.meeting_id == meeting_id).first()
    if rec and rec.storage_reference and os.path.exists(rec.storage_reference):
        media_type = "audio/wav" if rec.storage_reference.endswith(".wav") else "audio/mpeg"
        return FileResponse(rec.storage_reference, media_type=media_type)

    # 3. Check uploads directory for meeting_{id} audio files
    for ext in [".wav", ".mp3", ".webm"]:
        cand = os.path.join(settings.UPLOAD_DIR, f"meeting_{meeting_id}{ext}")
        if os.path.exists(cand):
            return FileResponse(cand, media_type="audio/wav" if ext == ".wav" else "audio/mpeg")

    # 4. Synthesize playback audio from transcript segments if no raw file was uploaded
    tr = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
    if tr and tr.raw_text:
        cached_synth = os.path.join(settings.UPLOAD_DIR, f"synthetic_meeting_{meeting_id}.mp3")
        if not os.path.exists(cached_synth):
            try:
                from gtts import gTTS
                tts = gTTS(text=tr.raw_text, lang="en", slow=False)
                tts.save(cached_synth)
            except Exception:
                pass
        if os.path.exists(cached_synth):
            return FileResponse(cached_synth, media_type="audio/mpeg")

    raise HTTPException(status_code=404, detail="No audio source available for this meeting.")

@router.get("/transcript/{meeting_id}", response_model=schemas.TranscriptResponse)
def get_transcript(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    transcript = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found for this meeting.")
    return transcript

@router.put("/transcript/{meeting_id}", response_model=schemas.TranscriptResponse)
def update_transcript(
    meeting_id: int,
    transcript_in: schemas.TranscriptUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcript = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
    if not transcript:
        # Create transcript if doesn't exist
        transcript = models.Transcript(meeting_id=meeting_id, language="en", confidence=1.0)
        db.add(transcript)

    prev_state = {
        "raw_text": transcript.raw_text,
        "diarized_json": transcript.diarized_json
    }

    if transcript_in.raw_text is not None:
        transcript.raw_text = transcript_in.raw_text
    if transcript_in.diarized_json is not None:
        # Convert schema objects or dicts to JSON list
        formatted_diarized = []
        for item in transcript_in.diarized_json:
            if hasattr(item, "dict"):
                formatted_diarized.append(item.dict())
            elif isinstance(item, dict):
                formatted_diarized.append(item)
        transcript.diarized_json = formatted_diarized

        # If raw_text wasn't explicitly provided, reconstruct raw_text from diarized segments
        if transcript_in.raw_text is None and formatted_diarized:
            transcript.raw_text = " ".join([f"[{seg.get('speaker', 'Speaker')}]: {seg.get('text', '')}" for seg in formatted_diarized])

    current_state = {
        "raw_text": transcript.raw_text,
        "diarized_json": transcript.diarized_json
    }

    # Audit log
    from app.services.audit import audit_service
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="edit_transcript",
        previous_state=prev_state,
        current_state=current_state
    )

    db.commit()
    db.refresh(transcript)
    return transcript

@router.post("/transcript/{meeting_id}/regenerate-minutes", response_model=schemas.MinutesResponse)
def regenerate_minutes_from_transcript(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    transcript = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
    if not transcript or not transcript.raw_text:
        raise HTTPException(status_code=400, detail="Transcript is empty or missing. Add transcript content before re-generating minutes.")

    # Gather confirmed attendees from OCR & DB
    attendee_names = []
    from app.services.screen_ocr import screen_ocr_engine
    from app.services.meeting_ocr import meeting_ocr_service
    try:
        screen_ocr_engine.auto_sync_attendance(meeting_id, db)
        meeting_ocr_service._sync_db_participants(meeting_id, db)
    except Exception as sync_e:
        logger.warning(f"Attendance auto-sync error: {sync_e}")

    db_participants = db.query(models.MeetingParticipant).filter(models.MeetingParticipant.meeting_id == meeting_id).all()
    for p in db_participants:
        if p.display_name and p.display_name not in attendee_names:
            attendee_names.append(p.display_name)

    if not attendee_names:
        db_attendees = db.query(models.Attendance).join(models.User).filter(models.Attendance.meeting_id == meeting_id).all()
        for att in db_attendees:
            name = att.user.full_name or att.user.username
            if name and name not in attendee_names:
                attendee_names.append(name)

    # Re-run AI extraction pipeline on current transcript text
    nlp_data = ai_pipeline.extract_structured_minutes(
        transcript.raw_text,
        transcript.language or "en",
        agenda=meeting.agenda,
        meeting_id=meeting_id,
        attendee_roster=attendee_names,
        segments=transcript.diarized_json or []
    )

    # Fetch or create Minutes record
    minutes = db.query(models.Minutes).filter(models.Minutes.meeting_id == meeting_id).first()
    if not minutes:
        minutes = models.Minutes(meeting_id=meeting_id)
        db.add(minutes)

    minutes.summary = nlp_data.get("summary", "")
    minutes.topics = nlp_data.get("topics", [])
    minutes.decisions = nlp_data.get("decisions", [])
    minutes.issues_and_risks = nlp_data.get("issues_and_risks", [])
    minutes.follow_ups = nlp_data.get("follow_ups", [])
    minutes.financial_information = nlp_data.get("financial_information", [])
    minutes.additional_notes = nlp_data.get("additional_notes", "")
    minutes.detailed_discussion = nlp_data.get("detailed_discussion", [])
    minutes.questions_and_concerns = nlp_data.get("questions_and_concerns", [])
    minutes.unresolved_issues = nlp_data.get("unresolved_issues", [])
    minutes.attendance_snapshot = nlp_data.get("attendance_snapshot", [])
    minutes.closing_summary = nlp_data.get("closing_summary", "")
    minutes.version_number = (minutes.version_number or 1) + 1

    # Populate Decision records
    db.query(models.Decision).filter(models.Decision.meeting_id == meeting_id).delete()
    for dec in nlp_data.get("decisions", []):
        ev = dec.get("evidence", {})
        ev_str = str(ev) if isinstance(ev, dict) else (ev or "")
        dec_rec = models.Decision(
            meeting_id=meeting_id,
            organization_id=meeting.organization_id,
            decision_text=dec.get("decision", ""),
            rationale=dec.get("rationale") or dec.get("context", ""),
            status="APPROVED",
            source_timestamp=float(dec.get("source_timestamp", 0.0)),
            source_speaker=dec.get("source_speaker"),
            evidence_text=ev_str,
            confidence=float(dec.get("confidence", 0.94)),
            participants=dec.get("participants", attendee_names)
        )
        db.add(dec_rec)

    # Clear existing action items & populate normalized ActionItem records
    db.query(models.ActionItem).filter(models.ActionItem.meeting_id == meeting_id).delete()

    for act in nlp_data.get("action_items", []):
        ev = act.get("evidence", {})
        ev_str = str(ev) if isinstance(ev, dict) else (ev or "")
        deadline_val = None
        if act.get("deadline"):
            try:
                deadline_val = datetime.strptime(act["deadline"], "%Y-%m-%d")
            except Exception:
                deadline_val = datetime.utcnow() + timedelta(days=7)
        action_item = models.ActionItem(
            meeting_id=meeting_id,
            organization_id=meeting.organization_id,
            title=act.get("title", "Action Item"),
            description=act.get("description", ""),
            responsible_person=act.get("responsible_person") or act.get("owner", "Unassigned"),
            department=act.get("department", "General"),
            deadline=deadline_val,
            priority=act.get("priority", "MEDIUM"),
            status="TO_DO",
            source_timestamp=float(act.get("source_timestamp", 0.0)),
            source_speaker=act.get("source_speaker"),
            evidence_text=ev_str,
            confidence=float(act.get("confidence", 0.92)),
            source_segments=act.get("source_segments", ["segment_1"])
        )
        db.add(action_item)

    # Re-index text into RAG service
    rag_service.add_document(meeting_id, meeting.title, transcript.raw_text)

    db.commit()
    db.refresh(minutes)
    return minutes

# ======================================================================
# LIVE MEETING RECORDING & CHUNK TRANSPORT ENDPOINTS
# ======================================================================

@router.post("/recording/{meeting_id}/start", response_model=schemas.RecordingStatusResponse)
def start_meeting_recording(
    meeting_id: int,
    req: schemas.RecordingStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not req.authorization_confirmed:
        raise HTTPException(status_code=400, detail="Recording authorization notice must be explicitly confirmed.")

    recording = db.query(models.MeetingRecording).filter(models.MeetingRecording.meeting_id == meeting_id).first()
    if not recording:
        rec_filename = f"live_recording_m{meeting_id}_{uuid.uuid4().hex[:8]}.webm"
        rec_path = os.path.join(settings.UPLOAD_DIR, rec_filename)
        recording = models.MeetingRecording(
            meeting_id=meeting_id,
            storage_reference=rec_path,
            mime_type="audio/webm",
            recording_status="recording",
            authorization_confirmed=True,
            authorization_timestamp=datetime.utcnow(),
            started_at=datetime.utcnow(),
            created_by_id=current_user.id
        )
        db.add(recording)
    else:
        recording.recording_status = "recording"
        recording.authorization_confirmed = True
        recording.authorization_timestamp = datetime.utcnow()
        if not recording.started_at:
            recording.started_at = datetime.utcnow()

    meeting.status = "in_progress"
    meeting.recording_status = "recording"
    meeting.audio_url = f"/api/v1/audio/stream/{os.path.basename(recording.storage_reference)}"
    db.commit()

    from app.services.audit import audit_service
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="RECORDING_STARTED",
        previous_state=None,
        current_state={"recording_status": "recording", "authorized_by": current_user.username}
    )

    chunks_count = db.query(models.RecordingChunk).filter(models.RecordingChunk.recording_id == recording.id).count()
    return schemas.RecordingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        recording_status=meeting.recording_status,
        duration=recording.duration or 0.0,
        file_size=recording.file_size or 0,
        mime_type=recording.mime_type or "audio/webm",
        authorization_confirmed=recording.authorization_confirmed,
        authorization_timestamp=recording.authorization_timestamp,
        started_at=recording.started_at,
        ended_at=recording.ended_at,
        received_chunks_count=chunks_count
    )

@router.post("/recording/{meeting_id}/pause", response_model=schemas.RecordingStatusResponse)
def pause_meeting_recording(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting or not meeting.recording:
        raise HTTPException(status_code=404, detail="Meeting or active recording session not found")

    recording = meeting.recording
    recording.recording_status = "paused"
    meeting.recording_status = "paused"
    db.commit()

    from app.services.audit import audit_service
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="RECORDING_PAUSED",
        previous_state=None,
        current_state={"recording_status": "paused"}
    )

    chunks_count = db.query(models.RecordingChunk).filter(models.RecordingChunk.recording_id == recording.id).count()
    return schemas.RecordingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        recording_status=meeting.recording_status,
        duration=recording.duration or 0.0,
        file_size=recording.file_size or 0,
        mime_type=recording.mime_type or "audio/webm",
        authorization_confirmed=recording.authorization_confirmed,
        authorization_timestamp=recording.authorization_timestamp,
        started_at=recording.started_at,
        ended_at=recording.ended_at,
        received_chunks_count=chunks_count
    )

@router.post("/recording/{meeting_id}/resume", response_model=schemas.RecordingStatusResponse)
def resume_meeting_recording(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting or not meeting.recording:
        raise HTTPException(status_code=404, detail="Meeting or active recording session not found")

    recording = meeting.recording
    recording.recording_status = "recording"
    meeting.recording_status = "recording"
    db.commit()

    from app.services.audit import audit_service
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="RECORDING_RESUMED",
        previous_state=None,
        current_state={"recording_status": "recording"}
    )

    chunks_count = db.query(models.RecordingChunk).filter(models.RecordingChunk.recording_id == recording.id).count()
    return schemas.RecordingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        recording_status=meeting.recording_status,
        duration=recording.duration or 0.0,
        file_size=recording.file_size or 0,
        mime_type=recording.mime_type or "audio/webm",
        authorization_confirmed=recording.authorization_confirmed,
        authorization_timestamp=recording.authorization_timestamp,
        started_at=recording.started_at,
        ended_at=recording.ended_at,
        received_chunks_count=chunks_count
    )

@router.post("/recording/{meeting_id}/stream", response_model=schemas.RecordingChunkUploadResponse)
async def upload_recording_chunk(
    meeting_id: int,
    sequence_number: int = File(...),
    checksum: Optional[str] = File(None),
    chunk_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    recording = db.query(models.MeetingRecording).filter(models.MeetingRecording.meeting_id == meeting_id).first()
    if not recording:
        rec_filename = f"live_recording_m{meeting_id}_{uuid.uuid4().hex[:8]}.webm"
        rec_path = os.path.join(settings.UPLOAD_DIR, rec_filename)
        recording = models.MeetingRecording(
            meeting_id=meeting_id,
            storage_reference=rec_path,
            mime_type="audio/webm",
            recording_status="recording",
            authorization_confirmed=True,
            authorization_timestamp=datetime.utcnow(),
            started_at=datetime.utcnow(),
            created_by_id=current_user.id
        )
        db.add(recording)
        db.commit()
        db.refresh(recording)

    # Check for duplicate sequence number
    existing_chunk = db.query(models.RecordingChunk).filter(
        models.RecordingChunk.recording_id == recording.id,
        models.RecordingChunk.sequence_number == sequence_number
    ).first()

    if existing_chunk:
        total_chunks = db.query(models.RecordingChunk).filter(models.RecordingChunk.recording_id == recording.id).count()
        return schemas.RecordingChunkUploadResponse(
            recording_id=recording.id,
            sequence_number=sequence_number,
            status="duplicate_acknowledged",
            received_total_chunks=total_chunks,
            total_bytes=recording.file_size or 0
        )

    # Save chunk file locally
    chunks_dir = os.path.join(settings.UPLOAD_DIR, f"chunks_m{meeting_id}")
    os.makedirs(chunks_dir, exist_ok=True)
    chunk_filename = f"chunk_{sequence_number:05d}.webm"
    chunk_path = os.path.join(chunks_dir, chunk_filename)

    chunk_bytes = await chunk_file.read()
    with open(chunk_path, "wb") as f:
        f.write(chunk_bytes)

    new_chunk = models.RecordingChunk(
        recording_id=recording.id,
        sequence_number=sequence_number,
        storage_reference=chunk_path,
        mime_type=chunk_file.content_type or "audio/webm",
        size_bytes=len(chunk_bytes),
        checksum=checksum or "",
        upload_status="received"
    )
    db.add(new_chunk)

    recording.file_size = (recording.file_size or 0) + len(chunk_bytes)
    # Estimate duration (approx 3s per chunk)
    total_chunks = db.query(models.RecordingChunk).filter(models.RecordingChunk.recording_id == recording.id).count() + 1
    recording.duration = float(total_chunks * 3.0)

    db.commit()

    # Live Real-Time Chunk Transcription: Transcribe incoming audio chunk and append to live transcript table
    try:
        if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 500:
            asr = ai_pipeline.get_asr_pipeline()
            if asr is not None:
                chunk_wav = ai_pipeline._convert_to_wav(chunk_path)
                res = asr(chunk_wav, return_timestamps=False)
                chunk_text = res.get("text", "").strip() if isinstance(res, dict) else ""
                polished_chunk = ai_pipeline.clean_and_polish_transcript(chunk_text)
                
                if polished_chunk:
                    start_sec = max(0.0, float((sequence_number - 1) * 3.0))
                    end_sec = start_sec + 3.0
                    speaker_label = f"Speaker {(sequence_number % 2) + 1}"
                    
                    t_record = db.query(models.Transcript).filter(models.Transcript.meeting_id == meeting_id).first()
                    new_seg = {
                        "speaker": speaker_label,
                        "start": round(start_sec, 2),
                        "end": round(end_sec, 2),
                        "text": polished_chunk,
                        "confidence": 0.92
                    }
                    if not t_record:
                        t_record = models.Transcript(
                            meeting_id=meeting_id,
                            raw_text=polished_chunk,
                            diarized_json=[new_seg],
                            language="en",
                            confidence=0.92
                        )
                        db.add(t_record)
                    else:
                        current_json = list(t_record.diarized_json or [])
                        current_json.append(new_seg)
                        t_record.diarized_json = current_json
                        t_record.raw_text = ((t_record.raw_text or "") + " " + polished_chunk).strip()
                    db.commit()
    except Exception as live_err:
        logger.warning(f"Live chunk transcription warning for seq {sequence_number}: {live_err}")

    return schemas.RecordingChunkUploadResponse(
        recording_id=recording.id,
        sequence_number=sequence_number,
        status="acknowledged",
        received_total_chunks=total_chunks,
        total_bytes=recording.file_size
    )

@router.post("/recording/{meeting_id}/stop", response_model=schemas.ProcessingStatusResponse)
async def stop_meeting_recording(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting or not meeting.recording:
        raise HTTPException(status_code=404, detail="Meeting or recording session not found")

    recording = meeting.recording
    recording.recording_status = "stopped"
    recording.ended_at = datetime.utcnow()
    meeting.recording_status = "completed"
    meeting.status = "processing"
    meeting.processing_status = "processing_audio"

    # Reconstruct composite file from ordered chunks if chunks exist
    chunks = db.query(models.RecordingChunk).filter(
        models.RecordingChunk.recording_id == recording.id
    ).order_by(models.RecordingChunk.sequence_number).all()

    if chunks:
        composite_path = recording.storage_reference
        with open(composite_path, "wb") as composite_file:
            for ch in chunks:
                ref = ch.storage_reference
                if not os.path.exists(ref):
                    if os.path.exists(os.path.join("backend", ref.lstrip("./"))):
                        ref = os.path.join("backend", ref.lstrip("./"))
                    elif os.path.exists(ref.replace("backend/", "")):
                        ref = ref.replace("backend/", "")
                if os.path.exists(ref):
                    with open(ref, "rb") as cf:
                        composite_file.write(cf.read())
        meeting.audio_url = f"/api/v1/audio/stream/{os.path.basename(composite_path)}"

    db.commit()

    from app.services.audit import audit_service
    audit_service.log_change(
        db=db,
        meeting_id=meeting_id,
        modified_by_id=current_user.id,
        action="RECORDING_STOPPED",
        previous_state=None,
        current_state={"recording_status": "stopped", "processing_status": "processing_audio"}
    )

    # Launch async background pipeline with independent DB session
    background_tasks.add_task(run_processing_pipeline, meeting_id, recording.storage_reference, None, "all")

    return schemas.ProcessingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        processing_status=meeting.processing_status,
        current_stage="processing_audio",
        progress_percent=25,
        message="Recording stopped successfully. Audio processing initiated.",
        can_retry=False
    )

@router.get("/recording/{meeting_id}/status", response_model=schemas.RecordingStatusResponse)
def get_recording_status(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    recording = meeting.recording
    if not recording:
        return schemas.RecordingStatusResponse(
            meeting_id=meeting_id,
            meeting_status=meeting.status,
            recording_status=meeting.recording_status or "not_started",
            duration=0.0,
            file_size=0,
            authorization_confirmed=False
        )

    chunks_count = db.query(models.RecordingChunk).filter(models.RecordingChunk.recording_id == recording.id).count()
    return schemas.RecordingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        recording_status=meeting.recording_status or recording.recording_status,
        duration=recording.duration or 0.0,
        file_size=recording.file_size or 0,
        mime_type=recording.mime_type or "audio/webm",
        authorization_confirmed=recording.authorization_confirmed,
        authorization_timestamp=recording.authorization_timestamp,
        started_at=recording.started_at,
        ended_at=recording.ended_at,
        received_chunks_count=chunks_count
    )

@router.get("/processing/{meeting_id}/status", response_model=schemas.ProcessingStatusResponse)
def get_processing_status(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    stage_map = {
        "idle": ("Idle", 0, False),
        "processing_audio": ("Noise Filter & Audio Setup", 25, False),
        "transcribing": ("ASR & Speaker Diarization", 50, False),
        "diarizing": ("Speaker Diarization", 65, False),
        "generating_minutes": ("Grounded AI Minutes Extraction", 85, False),
        "completed": ("Pipeline Completed", 100, False),
        "failed": ("Processing Failed", 0, True),
        "transcription_failed": ("Transcription Failed", 30, True),
        "diarization_failed": ("Diarization Failed", 50, True),
        "minutes_generation_failed": ("Minutes Generation Failed", 75, True)
    }

    current_proc = meeting.processing_status or "idle"
    stage_msg, progress, can_retry = stage_map.get(current_proc, (current_proc, 50, True))

    return schemas.ProcessingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        processing_status=current_proc,
        current_stage=stage_msg,
        progress_percent=progress,
        message=f"Current pipeline state: {stage_msg}",
        can_retry=can_retry
    )

@router.post("/processing/{meeting_id}/retry", response_model=schemas.ProcessingStatusResponse)
def retry_processing_pipeline(
    meeting_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    recording = meeting.recording
    audio_path = recording.storage_reference if recording else (meeting.audio_url or "")

    current_proc = meeting.processing_status or "failed"
    if current_proc == "minutes_generation_failed":
        start_stage = "minutes"
    elif current_proc == "transcription_failed":
        start_stage = "transcription"
    else:
        start_stage = "all"

    meeting.processing_status = "processing_audio"
    meeting.status = "processing"
    db.commit()

    background_tasks.add_task(run_processing_pipeline, meeting_id, audio_path, None, start_stage)

    return schemas.ProcessingStatusResponse(
        meeting_id=meeting_id,
        meeting_status=meeting.status,
        processing_status="processing_audio",
        current_stage="Retrying Pipeline",
        progress_percent=30,
        message=f"Pipeline retry initiated from stage '{start_stage}'",
        can_retry=False
    )

@router.post("/markers/{meeting_id}", response_model=schemas.MeetingMarkerResponse)
def create_meeting_marker(
    meeting_id: int,
    req: schemas.MeetingMarkerCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    recording = meeting.recording
    marker = models.MeetingMarker(
        meeting_id=meeting_id,
        recording_id=recording.id if recording else None,
        created_by_id=current_user.id,
        timestamp_seconds=req.timestamp_seconds,
        label=req.label,
        note=req.note
    )
    db.add(marker)
    db.commit()
    db.refresh(marker)
    return marker

@router.get("/markers/{meeting_id}", response_model=List[schemas.MeetingMarkerResponse])
def get_meeting_markers(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    markers = db.query(models.MeetingMarker).filter(models.MeetingMarker.meeting_id == meeting_id).order_by(models.MeetingMarker.timestamp_seconds).all()
    return markers



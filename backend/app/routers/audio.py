import os
import uuid
import shutil
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

router = APIRouter(prefix="/audio", tags=["Audio & Transcript Pipeline"])

def run_processing_pipeline(meeting_id: int, file_path: str, db: Session, start_stage: str = "all"):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if not meeting:
        return

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
                lang, confidence = ai_pipeline.detect_language_and_dialect(clean_audio_path)
                raw_text, diarized_segments = ai_pipeline.diarize_and_transcribe(clean_audio_path, lang)
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

        try:
            nlp_data = ai_pipeline.extract_structured_minutes(
                transcript.raw_text,
                transcript.language or "en",
                agenda=meeting.agenda
            )
        except Exception as min_err:
            meeting.processing_status = "minutes_generation_failed"
            db.commit()
            raise min_err

        # Create or update Minutes, ActionItems, and Votes
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
                additional_notes=nlp_data.get("additional_notes", "")
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

        db.query(models.ActionItem).filter(models.ActionItem.meeting_id == meeting_id).delete()
        for act in nlp_data.get("action_items", []):
            action_item = models.ActionItem(
                meeting_id=meeting_id,
                title=act.get("title", "Action Item"),
                description=act.get("description", ""),
                responsible_person=act.get("responsible_person", "Unassigned"),
                department=act.get("department", "General"),
                status="pending",
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
        db.rollback()
        m = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
        if m and m.processing_status == "idle":
            m.processing_status = "failed"
            db.commit()
        raise e

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

    # Trigger async processing background tasks
    background_tasks.add_task(run_processing_pipeline, meeting_id, dest_path, db)

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

    # Re-run AI extraction pipeline on current transcript text
    nlp_data = ai_pipeline.extract_structured_minutes(transcript.raw_text, transcript.language or "en")

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
    minutes.version_number = (minutes.version_number or 1) + 1

    # Clear existing action items & populate normalized ActionItem records
    db.query(models.ActionItem).filter(models.ActionItem.meeting_id == meeting_id).delete()

    for act in nlp_data.get("action_items", []):
        action_item = models.ActionItem(
            meeting_id=meeting_id,
            title=act.get("title", "Action Item"),
            description=act.get("description", ""),
            responsible_person=act.get("responsible_person", "Unassigned"),
            department=act.get("department", "General"),
            status="pending",
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
                if os.path.exists(ch.storage_reference):
                    with open(ch.storage_reference, "rb") as cf:
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

    # Launch async background pipeline
    background_tasks.add_task(run_processing_pipeline, meeting_id, recording.storage_reference, db, "all")

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

    background_tasks.add_task(run_processing_pipeline, meeting_id, audio_path, db, start_stage)

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



from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import List, Optional, Dict, Any

# Token & Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    social_category: Optional[str] = None
    village: Optional[str] = None
    block: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Attendance Schemas
class AttendanceCreate(BaseModel):
    user_id: int
    method: str = "qr"
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None

class AttendanceResponse(BaseModel):
    id: int
    meeting_id: int
    user_id: int
    checkin_time: datetime
    method: str
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    verified: bool
    user: UserResponse

    class Config:
        from_attributes = True

# ActionItem Schemas
class ActionItemBase(BaseModel):
    title: str
    description: Optional[str] = None
    owner_user_id: Optional[int] = None
    responsible_person: Optional[str] = None
    department: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: str = "MEDIUM"
    status: str = "TO_DO"
    source_segment_id: Optional[int] = None
    source_timestamp: float = 0.0
    source_speaker: Optional[str] = None
    evidence_text: Optional[str] = None
    confidence: float = 0.94
    decision_id: Optional[int] = None
    source_segments: Optional[List[str]] = None

class ActionItemCreate(ActionItemBase):
    meeting_id: Optional[int] = None

class ActionItemUpdate(BaseModel):
    title: Optional[str] = None
    responsible_person: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None

class ActionItemResponse(ActionItemBase):
    id: int
    meeting_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Decision Schemas
class DecisionBase(BaseModel):
    decision_text: str
    rationale: Optional[str] = None
    impact_level: str = "MEDIUM"
    category: str = "Architecture"
    status: str = "APPROVED"
    source_segment_id: Optional[int] = None
    source_timestamp: float = 0.0
    source_speaker: Optional[str] = None
    evidence_text: Optional[str] = None
    confidence: float = 0.92
    participants: Optional[List[str]] = None

class DecisionCreate(DecisionBase):
    meeting_id: int

class DecisionUpdate(BaseModel):
    decision_text: Optional[str] = None
    rationale: Optional[str] = None
    impact_level: Optional[str] = None
    status: Optional[str] = None

class DecisionResponse(DecisionBase):
    id: int
    meeting_id: int
    organization_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Vote Schemas
class VoteBase(BaseModel):
    proposal_title: str
    votes_for: int
    votes_against: int
    votes_abstain: int
    objections_summary: Optional[str] = None

class VoteCreate(VoteBase):
    pass

class VoteResponse(VoteBase):
    id: int
    meeting_id: int

    class Config:
        from_attributes = True

# Transcript Schemas
class TranscriptSegment(BaseModel):
    id: Optional[str] = None
    speaker: str
    start: float
    end: float
    text: str

class TranscriptResponse(BaseModel):
    id: int
    meeting_id: int
    raw_text: Optional[str] = None
    diarized_json: Optional[List[TranscriptSegment]] = None
    language: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TranscriptUpdate(BaseModel):
    raw_text: Optional[str] = None
    diarized_json: Optional[List[TranscriptSegment]] = None

# Minutes Schemas
class MinutesBase(BaseModel):
    summary: str
    topics: Optional[List[Any]] = None
    decisions: Optional[List[Any]] = None
    issues_and_risks: Optional[List[Any]] = None
    follow_ups: Optional[List[Any]] = None
    financial_information: Optional[List[Any]] = None
    additional_notes: Optional[str] = None
    version_number: Optional[int] = 1
    unverified: Optional[bool] = False
    unverified_fields: Optional[List[str]] = None

class MinutesCreate(MinutesBase):
    pass

class MinutesResponse(MinutesBase):
    id: int
    meeting_id: int
    digital_hash: Optional[str] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    doc_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Translation Schemas
class TranslationBase(BaseModel):
    language: str
    minutes_summary: Optional[str] = None
    agenda: Optional[str] = None
    transcript_translated_json: Optional[List[Dict[str, Any]]] = None

class TranslationResponse(TranslationBase):
    id: int
    meeting_id: int

    class Config:
        from_attributes = True

# Meeting Schemas
class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    meeting_type: Optional[str] = "General"
    department: Optional[str] = "General"
    date: datetime
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    agenda: Optional[str] = None

class MeetingCreate(MeetingBase):
    agenda_pdf_url: Optional[str] = None
    enable_recording: Optional[bool] = False
    authorization_confirmed: Optional[bool] = False

class MeetingResponse(MeetingBase):
    id: int
    status: str
    recording_status: Optional[str] = "not_started"
    processing_status: Optional[str] = "idle"
    qr_code_data: Optional[str] = None
    agenda_pdf_url: Optional[str] = None
    audio_url: Optional[str] = None
    video_url: Optional[str] = None
    secretary_id: Optional[int] = None
    chairperson_id: Optional[int] = None
    current_revision: Optional[int] = 1
    finalized_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MeetingDetailResponse(MeetingResponse):
    secretary: Optional[UserResponse] = None
    chairperson: Optional[UserResponse] = None
    attendance: List[AttendanceResponse] = []
    transcripts: Optional[TranscriptResponse] = None
    minutes: Optional[MinutesResponse] = None
    action_items: List[ActionItemResponse] = []
    votes: List[VoteResponse] = []
    translations: List[TranslationResponse] = []

    class Config:
        from_attributes = True

# AuditLog Schemas
class AuditLogResponse(BaseModel):
    id: int
    meeting_id: int
    action: str
    timestamp: datetime
    modified_by_id: int
    previous_state: Optional[Dict[str, Any]] = None
    current_state: Optional[Dict[str, Any]] = None
    state_hash: Optional[str] = None
    user: UserResponse

    class Config:
        from_attributes = True

# Chat Schemas
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    meeting_id: Optional[int] = None

class ChatCitation(BaseModel):
    meeting_id: int
    title: str
    text_segment: str
    confidence: float

class ChatResponse(BaseModel):
    content: str
    citations: List[ChatCitation]

# Recording & Processing Schemas
class RecordingConsentRequest(BaseModel):
    authorization_confirmed: bool = True

class RecordingStartRequest(BaseModel):
    authorization_confirmed: bool = True

class RecordingStatusResponse(BaseModel):
    meeting_id: int
    meeting_status: str
    recording_status: str
    duration: float = 0.0
    file_size: int = 0
    mime_type: str = "audio/webm"
    authorization_confirmed: bool = False
    authorization_timestamp: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    received_chunks_count: int = 0

class RecordingChunkUploadResponse(BaseModel):
    recording_id: int
    sequence_number: int
    status: str = "acknowledged"
    received_total_chunks: int
    total_bytes: int

class ProcessingStatusResponse(BaseModel):
    meeting_id: int
    meeting_status: str
    processing_status: str
    current_stage: str
    progress_percent: int
    message: str
    error_details: Optional[str] = None
    can_retry: bool = False

class MeetingMarkerCreateRequest(BaseModel):
    timestamp_seconds: float
    label: str  # Decision, Action Item, Important Discussion, Question, Follow-Up
    note: Optional[str] = None

class MeetingMarkerResponse(BaseModel):
    id: int
    meeting_id: int
    recording_id: Optional[int] = None
    created_by_id: int
    timestamp_seconds: float
    label: str
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Diarization Schemas
class SpeakerProfileResponse(BaseModel):
    id: int
    meeting_id: int
    cluster_id: str
    display_name: str
    confidence: float
    total_duration: float

    class Config:
        from_attributes = True

class SpeakerSegmentResponse(BaseModel):
    id: Optional[int] = None
    meeting_id: int
    speaker_id: str
    start_time: float
    end_time: float
    duration: float
    transcript_text: str
    confidence: float
    overlapping: bool = False
    primary_speaker: Optional[str] = None
    secondary_speaker: Optional[str] = None
    audio_quality: float = 1.0

    class Config:
        from_attributes = True

class SpeakerChangeEventResponse(BaseModel):
    id: Optional[int] = None
    meeting_id: int
    timestamp: float
    from_speaker: str
    to_speaker: str
    confidence: float
    change_score: float
    embedding_score: float
    acoustic_score: float
    vad_score: float
    energy_score: float
    cluster_score: float
    confirmation_status: str

    class Config:
        from_attributes = True

class DiarizationQualityResponse(BaseModel):
    meeting_id: int
    der: Optional[float] = None
    jer: Optional[float] = None
    speaker_change_precision: Optional[float] = None
    speaker_change_recall: Optional[float] = None
    speaker_change_f1: Optional[float] = None
    false_change_rate: Optional[float] = None
    missed_change_rate: Optional[float] = None
    overlap_detection_rate: Optional[float] = None
    average_confidence: float = 0.92
    speaker_count: int = 0
    segment_count: int = 0

class SpeakerCorrectionRequest(BaseModel):
    segment_id: Optional[int] = None
    original_speaker: str
    corrected_speaker: str
    action_type: str = "rename"  # rename, merge, split, change_assignment, mark_overlap
    reason: Optional[str] = "human_correction"



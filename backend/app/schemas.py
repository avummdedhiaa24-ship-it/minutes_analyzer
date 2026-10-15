from pydantic import BaseModel, Field, EmailStr, model_validator
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
    display_name: Optional[str] = None
    identity_status: Optional[str] = None
    identity_confidence: Optional[float] = None
    confidence: Optional[float] = None
    speaker_id: Optional[str] = None
    participant_id: Optional[int] = None
    evidence: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    overlapping: Optional[bool] = None
    primary_speaker: Optional[str] = None
    secondary_speaker: Optional[str] = None

    class Config:
        extra = "allow"

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


# ── VOICE CALIBRATION & BIOMETRIC PRIVACY SCHEMAS ──────────────────────────────
class ParticipantConsentRequest(BaseModel):
    participant_id: int
    consent_status: str = "CONSENT_GRANTED"  # CONSENT_GRANTED, CONSENT_DECLINED, REVOKED
    retention_days: Optional[int] = 90

class ParticipantConsentResponse(BaseModel):
    participant_id: int
    meeting_id: int
    consent_status: str
    consent_timestamp: datetime

class VoiceCalibrationSampleResponse(BaseModel):
    id: int
    sample_index: int
    duration_seconds: float
    quality_score: float
    snr_db: float
    clipping_percentage: float
    vad_ratio: float
    embedding_stability: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class CalibratedVoiceProfilePublic(BaseModel):
    """Public voice profile metadata — NEVER exposes raw embedding vectors for biometric privacy."""
    id: int
    participant_id: Optional[int] = None
    meeting_id: Optional[int] = None
    organization_id: Optional[int] = None
    display_name: Optional[str] = None
    speaker_name: Optional[str] = None
    role: str = "Participant"
    department: str = "General"
    consent_status: str = "CONSENT_GRANTED"
    sample_count: int = 0
    total_sample_duration_seconds: float = 0.0
    overall_quality_score: float = 0.90
    voice_quality_score: Optional[float] = None
    calibration_confidence: float = 0.92
    version: int = 1
    is_active: bool = True
    is_calibrated: Optional[bool] = None
    status: Optional[str] = None
    is_org_reusable: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any):
        if isinstance(data, dict):
            if not data.get("display_name") and data.get("speaker_name"):
                data["display_name"] = data["speaker_name"]
            if not data.get("speaker_name") and data.get("display_name"):
                data["speaker_name"] = data["display_name"]
            if data.get("voice_quality_score") is not None and "overall_quality_score" not in data:
                data["overall_quality_score"] = data["voice_quality_score"]
        return data

    class Config:
        from_attributes = True

class VoiceCalibrationStatusResponse(BaseModel):
    meeting_id: int
    total_participants: int
    enrolled_count: int
    declined_count: int
    calibration_progress_percent: float
    profiles: List[CalibratedVoiceProfilePublic]

class MeetingParticipantCreate(BaseModel):
    display_name: str
    role: Optional[str] = "Participant"
    user_id: Optional[int] = None
    voice_profile_id: Optional[int] = None

class MeetingParticipantResponse(BaseModel):
    id: int
    meeting_id: int
    organization_id: Optional[int] = None
    user_id: Optional[int] = None
    display_name: str
    normalized_name: str
    role: Optional[str] = "Participant"
    ocr_name: Optional[str] = None
    ocr_confidence: float = 0.0
    attendance_status: str = "DETECTED"
    first_seen_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None
    voice_profile_id: Optional[int] = None
    identity_status: str = "UNAVAILABLE"
    identity_confidence: float = 0.0
    evidence_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AttendanceObservationResponse(BaseModel):
    id: int
    meeting_id: int
    participant_id: Optional[int] = None
    raw_ocr_text: Optional[str] = None
    normalized_name: Optional[str] = None
    confidence: float = 0.85
    captured_at: datetime
    screen_region: Optional[str] = None
    source: str = "screen_ocr"

    class Config:
        from_attributes = True

class AttendanceEventResponse(BaseModel):
    type: str  # join, leave, detected
    participant: str
    participant_id: Optional[int] = None
    role: Optional[str] = "Participant"
    timestamp: str
    confidence: float

class IdentityEvidence(BaseModel):
    voice_similarity: float = 0.0
    ocr_presence: float = 0.0
    temporal_presence: float = 1.0
    profile_stability: float = 0.95
    pitch_compatibility: float = 0.90
    spectral_similarity: float = 0.92

class IdentityFusionResult(BaseModel):
    speaker_id: str
    participant_id: Optional[int] = None
    display_name: str
    identity_status: str  # MATCHED, AMBIGUOUS, UNKNOWN, UNAVAILABLE
    identity_confidence: float
    evidence: Dict[str, Any]
    reason: str
    speaker_reentry: bool = False
    previous_identity: Optional[str] = None

class NamedTranscriptSegment(BaseModel):
    speaker_id: str
    participant_id: Optional[int] = None
    display_name: str
    identity_status: str
    identity_confidence: float
    start_time: float
    end_time: float
    text: str
    source_audio_reference: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None

class NamedTranscriptResponse(BaseModel):
    meeting_id: int
    language: str
    total_segments: int
    segments: List[NamedTranscriptSegment]

class DetailedMinutesResponse(BaseModel):
    meeting_id: int
    title: str
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[str] = None
    organizer: Optional[str] = None
    platform: str = "Corporate Meet"
    attendance: List[Dict[str, Any]]
    executive_summary: str
    agenda: Optional[str] = None
    detailed_discussion: List[Dict[str, Any]]
    decisions: List[Dict[str, Any]]
    action_items: List[Dict[str, Any]]
    risks: List[Dict[str, Any]]
    questions_and_concerns: List[Dict[str, Any]]
    unresolved_issues: List[Dict[str, Any]]
    follow_up_items: List[Dict[str, Any]]
    closing_summary: str
    status: str
    digital_hash: Optional[str] = None
    version_number: int = 1

class MinutesReviewRequest(BaseModel):
    summary: Optional[str] = None
    decisions: Optional[List[Dict[str, Any]]] = None
    action_items: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    approve: bool = False





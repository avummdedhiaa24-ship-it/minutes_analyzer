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
    status: str = "pending"
    source_segments: Optional[List[str]] = None

class ActionItemCreate(ActionItemBase):
    pass

class ActionItemResponse(ActionItemBase):
    id: int
    meeting_id: int

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

class MeetingResponse(MeetingBase):
    id: int
    status: str
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

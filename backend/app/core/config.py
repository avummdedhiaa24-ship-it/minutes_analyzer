import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI General Meeting Minutes & Transcripts Platform"
    API_V1_STR: str = "/api/v1"
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-enterprise-key-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # DB
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./sql_app.db"
    )
    
    # Storage
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    
    # Vector Embeddings Model
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")
    
    # AI Settings
    AI_MOCK_MODE: bool = os.getenv("AI_MOCK_MODE", "False").lower() == "true"
    WHISPER_MODEL_NAME: str = os.getenv("WHISPER_MODEL_NAME", "openai/whisper-small")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    # Diarization & Speaker Change Detection Settings
    DIARIZATION_CONFIG: dict = {
        "window_seconds": 2.0,
        "stride_seconds": 0.5,
        "min_speech_seconds": 0.25,
        "min_turn_seconds": 0.35,
        "max_merge_gap_seconds": 1.0,
        "change_confirmation_windows": 2,
        "embedding_weight": 0.35,
        "acoustic_weight": 0.20,
        "vad_weight": 0.15,
        "energy_weight": 0.10,
        "cluster_weight": 0.10,
        "temporal_weight": 0.10,
        "adaptive_threshold_enabled": True,
        "overlap_detection_enabled": True,
        "max_speakers": 10,
    }

    # Bhashini Government Indic AI Settings
    BHASHINI_USER_ID: str = os.getenv("BHASHINI_USER_ID", "")
    BHASHINI_API_KEY: str = os.getenv("BHASHINI_API_KEY", "")
    BHASHINI_PIPELINE_ID: str = os.getenv("BHASHINI_PIPELINE_ID", "64392f08f9c26c60e7e39f94")

    class Config:
        case_sensitive = True

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

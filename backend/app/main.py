from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.core.config import settings
from app.core.database import engine, Base
from app.seed_data import seed_db
from app.routers import auth, meetings, attendance, audio, minutes, translation, chat, search, analytics, audit, action_items, decisions, voice_calibration, screen_ocr

# Initialize database schemas & seed initial corporate accounts
Base.metadata.create_all(bind=engine)
try:
    seed_db()
except Exception as e:
    print(f"Seed DB warning: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Automating documentation, corporate meeting minutes, translation, and RAG semantic search for corporate enterprise meetings.",
    version="1.0.0",
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; configure restrictive origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(meetings.router, prefix=settings.API_V1_STR)
app.include_router(attendance.router, prefix=settings.API_V1_STR)
app.include_router(audio.router, prefix=settings.API_V1_STR)
app.include_router(minutes.router, prefix=settings.API_V1_STR)
app.include_router(translation.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(action_items.router, prefix=settings.API_V1_STR)
app.include_router(decisions.router, prefix=settings.API_V1_STR)
app.include_router(voice_calibration.router, prefix=settings.API_V1_STR)
app.include_router(screen_ocr.router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System Health"])
def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "mock_mode": settings.AI_MOCK_MODE,
        "db_connected": True
    }

# Create local upload directories if missing
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

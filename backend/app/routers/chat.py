from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app import models, schemas
from app.services.rag import rag_service
from app.services.ai_pipeline import ai_pipeline

router = APIRouter(prefix="/chat", tags=["AI Chatbot (RAG)"])

@router.post("", response_model=schemas.ChatResponse)
def ask_chatbot(
    chat_req: schemas.ChatRequest,
    db: Session = Depends(get_db)
):
    if not chat_req.messages:
        raise HTTPException(status_code=400, detail="Empty messages list")

    messages = chat_req.messages
    latest_user_msg = ""
    for msg in reversed(messages):
        if msg.role == "user":
            latest_user_msg = msg.content
            break
            
    if not latest_user_msg:
        raise HTTPException(status_code=400, detail="No user message found in history")

    # Check if the last assistant message in history was a language selector prompt
    was_prompted_for_language = False
    original_question = ""
    
    if len(messages) >= 2:
        last_assistant_msg = messages[-2]
        if last_assistant_msg.role == "assistant" and "In which language would you like me to answer?" in last_assistant_msg.content:
            was_prompted_for_language = True
            # Find the user question asked right before this assistant message
            if len(messages) >= 3 and messages[-3].role == "user":
                original_question = messages[-3].content

    if was_prompted_for_language and original_question:
        # User is providing their language choice
        lang_map = {
            "hi": "hi", "hindi": "hi", "हिंदी": "hi",
            "mr": "mr", "marathi": "mr", "मराठी": "mr",
            "te": "te", "telugu": "te", "తెలుగు": "te",
            "en": "en", "english": "en"
        }
        target_lang = "en"
        clean_choice = latest_user_msg.strip().lower()
        for k, v in lang_map.items():
            if k in clean_choice:
                target_lang = v
                break
        
        # Search the database for the original question
        semantic_matches = rag_service.search(original_question, limit=3)
        if chat_req.meeting_id:
            semantic_matches = [m for m in semantic_matches if m["meeting_id"] == chat_req.meeting_id]

        # Filter matches: keep only matches with confidence >= 0.25 (25%)
        semantic_matches = [m for m in semantic_matches if m["confidence"] >= 0.25]

        citations_res = []
        for match in semantic_matches:
            citations_res.append(
                schemas.ChatCitation(
                    meeting_id=match["meeting_id"],
                    title=match["title"],
                    text_segment=match["text_segment"],
                    confidence=match["confidence"]
                )
            )

        if semantic_matches:
            # Translate individual segments first
            translated_segments = []
            for match in semantic_matches:
                translated_txt = ai_pipeline.translate_text(match["text_segment"].strip(), target_lang)
                # Strip any fallback wrappers if they were added
                for prefix in ["[ENGLISH TRANSLATION]:", "[HINDI TRANSLATION]:", "[MARATHI TRANSLATION]:", "[TELUGU TRANSLATION]:", "[MOCK-en]:", "[MOCK-hi]:", "[MOCK-mr]:", "[MOCK-te]:"]:
                    if translated_txt.startswith(prefix):
                        translated_txt = translated_txt[len(prefix):].strip()
                translated_segments.append(translated_txt)

            # Construct the final answer dynamically in the target language
            top_match = semantic_matches[0]
            top_text = translated_segments[0]
            
            # Map session templates to target languages
            session_prefix = {
                "en": f"Under the session '{top_match['title']}', it was documented that: '{top_text}'.",
                "hi": f"सत्र '{top_match['title']}' के तहत, यह प्रलेखित किया गया था: '{top_text}'.",
                "mr": f"'{top_match['title']}' या सत्रांतर्गत असे नमूद केले आहे: '{top_text}'."
            }
            response_text = session_prefix.get(target_lang, f"Under the session '{top_match['title']}', it was documented that: '{top_text}'.")
            
            if len(semantic_matches) > 1 and semantic_matches[1]['title'] != top_match['title']:
                sec_text = translated_segments[1]
                add_prefix = {
                    "en": f" Additionally, the meeting '{semantic_matches[1]['title']}' noted: '{sec_text}'.",
                    "hi": f" इसके अतिरिक्त, बैठक '{semantic_matches[1]['title']}' में उल्लेख किया गया था: '{sec_text}'.",
                    "mr": f" तसेच, '{semantic_matches[1]['title']}' बैठकीत असे नमूद केले आहे: '{sec_text}'."
                }
                response_text += add_prefix.get(target_lang, f" Additionally, the meeting '{semantic_matches[1]['title']}' noted: '{sec_text}'.")
        else:
            base_answer = "I could not find any explicit decisions or discussions about that topic."
            response_text = ai_pipeline.translate_text(base_answer, target_lang)

        return schemas.ChatResponse(
            content=response_text,
            citations=citations_res
        )

    else:
        # First question in a turn: prompt user for language selection
        # Search the database for citations so they appear immediately
        semantic_matches = rag_service.search(latest_user_msg, limit=3)
        if chat_req.meeting_id:
            semantic_matches = [m for m in semantic_matches if m["meeting_id"] == chat_req.meeting_id]

        # Filter matches: keep only matches with confidence >= 0.25 (25%)
        semantic_matches = [m for m in semantic_matches if m["confidence"] >= 0.25]

        citations_res = []
        for match in semantic_matches:
            citations_res.append(
                schemas.ChatCitation(
                    meeting_id=match["meeting_id"],
                    title=match["title"],
                    text_segment=match["text_segment"],
                    confidence=match["confidence"]
                )
            )

        if not semantic_matches:
            response_text = "No matching resolution found in historical meeting records."
        else:
            response_text = (
                "I have located the relevant corporate meeting files matching your query. "
                "In which language would you like me to answer? Please reply with: English, Hindi (हिंदी), or Marathi (मराठी)."
            )

        return schemas.ChatResponse(
            content=response_text,
            citations=citations_res
        )

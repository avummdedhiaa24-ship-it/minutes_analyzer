import hashlib
import json
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import AuditLog, Minutes

class AuditService:
    @staticmethod
    def calculate_minutes_hash(minutes: Dict[str, Any]) -> str:
        """
        Generate a unique SHA256 hash for a minutes dictionary to ensure immutability.
        """
        # Canonicalize JSON by sorting keys to guarantee same hash for identical content
        serialized = json.dumps(minutes, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @staticmethod
    def log_change(
        db: Session,
        meeting_id: int,
        modified_by_id: int,
        action: str,
        previous_state: Optional[Dict[str, Any]],
        current_state: Dict[str, Any]
    ) -> AuditLog:
        """
        Create a secure entry in the Corporate AuditLogs table.
        """
        state_hash = AuditService.calculate_minutes_hash(current_state)
        
        audit_entry = AuditLog(
            meeting_id=meeting_id,
            action=action,
            modified_by_id=modified_by_id,
            previous_state=previous_state,
            current_state=current_state,
            state_hash=state_hash
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry

    @staticmethod
    def export_to_text_report(meeting_title: str, minutes_data: Dict[str, Any], lang: str = "en") -> str:
        """
        Export meeting minutes into a structured corporate executive report format.
        """
        lang_key = lang if lang in ["en", "hi", "mr", "te"] else "en"

        headers_catalog = {
            "en": {
                "company": "ENTERPRISE AI MEETING PLATFORM",
                "title": "EXECUTIVE MEETING MINUTES REPORT",
                "exported": "Exported On",
                "hash": "Digital SHA-256 Seal",
                "summary": "EXECUTIVE SUMMARY",
                "topics": "KEY DISCUSSION TOPICS",
                "decisions": "STRATEGIC DECISIONS",
                "actions": "OPEN ACTION ITEMS & ASSIGNMENTS",
                "issues": "ISSUES & RISKS",
                "financial": "FINANCIAL & BUDGETALLOCATIONS",
                "signed": "[DIGITALLY SEALED VIA ENTERPRISE CRYPTOGRAPHIC PORTAL]"
            }
        }

        h = headers_catalog.get(lang_key, headers_catalog["en"])
        report = []
        report.append("=================================================================")
        report.append(f"                    {h['company']}")
        report.append(f"          {h['title']}: {meeting_title.upper()}")
        report.append("=================================================================")
        report.append(f"{h['exported']}: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"{h['hash']}: {minutes_data.get('digital_hash', 'N/A')}")
        
        report.append(f"\n--- {h['summary']} ---")
        report.append(minutes_data.get("summary", "No summary available."))
        
        report.append(f"\n--- {h['topics']} ---")
        topics = minutes_data.get("topics", [])
        if topics:
            for idx, t_obj in enumerate(topics, 1):
                if isinstance(t_obj, dict):
                    report.append(f"{idx}. {t_obj.get('topic')}: {t_obj.get('discussion')}")
                else:
                    report.append(f"{idx}. {t_obj}")
        else:
            report.append(" N/A")
            
        report.append(f"\n--- {h['decisions']} ---")
        decisions = minutes_data.get("decisions", [])
        if decisions:
            for idx, d_obj in enumerate(decisions, 1):
                if isinstance(d_obj, dict):
                    report.append(f"{idx}. {d_obj.get('decision')} ({d_obj.get('context', '')})")
                else:
                    report.append(f"{idx}. {d_obj}")
        else:
            report.append(" N/A")
            
        report.append(f"\n--- {h['actions']} ---")
        actions = minutes_data.get("action_items", [])
        if actions:
            for idx, action in enumerate(actions, 1):
                if isinstance(action, dict):
                    report.append(f"{idx}. Task: {action.get('title')}")
                    report.append(f"   Department: {action.get('department')} | Owner: {action.get('responsible_person')}")
                    report.append(f"   Deadline: {action.get('deadline')}")
                else:
                    report.append(f"{idx}. {action}")
        else:
            report.append(" No action items recorded.")
            
        report.append("\n=================================================================")
        report.append(f"   {h['signed']}")
        report.append("=================================================================")
        
        return "\n".join(report)

audit_service = AuditService()

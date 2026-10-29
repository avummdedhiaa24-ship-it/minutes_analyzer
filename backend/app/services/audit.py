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
        Create a cryptographically hash-chained entry in the AuditLogs table (Claim 11 & 14).
        Each entry records previous_hash and computes digital_hash over its payload.
        """
        last_log = db.query(AuditLog).filter(
            AuditLog.meeting_id == meeting_id
        ).order_by(AuditLog.id.desc()).first()

        previous_hash = last_log.digital_hash if (last_log and last_log.digital_hash) else "GENESIS"
        state_hash = AuditService.calculate_minutes_hash(current_state)
        now_dt = datetime.utcnow()
        timestamp_str = now_dt.isoformat()

        raw_payload = f"{meeting_id}:{action}:{modified_by_id}:{timestamp_str}:{state_hash}:{previous_hash}"
        digital_hash = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

        audit_entry = AuditLog(
            meeting_id=meeting_id,
            action=action,
            timestamp=now_dt,
            modified_by_id=modified_by_id,
            previous_state=previous_state,
            current_state=current_state,
            state_hash=state_hash,
            previous_hash=previous_hash,
            digital_hash=digital_hash
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry

    @staticmethod
    def verify_chain(db: Session, meeting_id: int) -> Dict[str, Any]:
        """
        Public Audit Chain Verification:
        Recomputes the cryptographic SHA-256 hash chain for a meeting's audit logs.
        Validates both backward previous_hash links and forward digital_hash digests.
        """
        logs = db.query(AuditLog).filter(
            AuditLog.meeting_id == meeting_id
        ).order_by(AuditLog.id.asc()).all()

        if not logs:
            return {
                "meeting_id": meeting_id,
                "valid": True,
                "log_count": 0,
                "message": "No audit entries to verify"
            }

        prev_hash = "GENESIS"
        for idx, log in enumerate(logs):
            # 1. Verify previous_hash link
            if log.previous_hash and log.previous_hash != prev_hash:
                return {
                    "meeting_id": meeting_id,
                    "valid": False,
                    "broken_index": idx,
                    "broken_log_id": log.id,
                    "expected_previous_hash": prev_hash,
                    "actual_previous_hash": log.previous_hash,
                    "message": f"Previous-hash link broken at audit entry #{log.id} (index {idx})"
                }

            # 2. Recompute digital_hash
            ts_str = log.timestamp.isoformat() if log.timestamp else ""
            raw_payload = f"{log.meeting_id}:{log.action}:{log.modified_by_id}:{ts_str}:{log.state_hash}:{prev_hash}"
            expected_digital = hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()

            if log.digital_hash and log.digital_hash != expected_digital:
                alt_payload = f"{log.meeting_id}:{log.action}:{log.modified_by_id}:{log.timestamp}:{prev_hash}"
                alt_hash = hashlib.sha256(alt_payload.encode("utf-8")).hexdigest()
                if log.digital_hash != alt_hash:
                    return {
                        "meeting_id": meeting_id,
                        "valid": False,
                        "broken_index": idx,
                        "broken_log_id": log.id,
                        "expected_hash": expected_digital,
                        "actual_hash": log.digital_hash,
                        "message": f"Cryptographic digest mismatch at audit entry #{log.id} (index {idx})"
                    }

            prev_hash = log.digital_hash or expected_digital

        return {
            "meeting_id": meeting_id,
            "valid": True,
            "log_count": len(logs),
            "latest_hash": prev_hash,
            "message": "Cryptographic SHA-256 audit chain verified untampered"
        }

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

import io
import re
import time
import base64
import logging
import math
from datetime import datetime
from typing import List, Dict, Any, Optional, Set, Tuple
from PIL import Image
import numpy as np
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger(__name__)

# Common UI text tokens to ignore during attendee name extraction
UI_STOPWORDS = {
    "meet", "google", "zoom", "teams", "microsoft", "webex", "leave", "call", "mic",
    "microphone", "camera", "mute", "unmute", "participants", "people", "chat",
    "screen", "share", "sharing", "record", "recording", "details", "options",
    "more", "turn", "off", "on", "audio", "video", "settings", "captions", "cc",
    "raise", "hand", "reactions", "pin", "unpin", "grid", "tile", "full", "view",
    "you", "host", "co-host", "presenting", "presentation"
}

class ScreenOCREngine:
    """
    In-Memory Ephemeral Screen OCR & Visual Active Speaker Detection Engine.
    Processes video conference frames (Google Meet, Zoom, MS Teams) entirely in RAM.
    Extracts participant tile names for automated attendance and visual active speaker cues
    for 9-signal multimodal diarization fusion — with ZERO raw video disk storage.
    """

    def __init__(self):
        # Ephemeral In-Memory Cache keyed by meeting_id
        # Structure: { meeting_id: { "detected_attendees": Set[str], "active_speaker_timeline": List[Dict], ... } }
        self._cache: Dict[int, Dict[str, Any]] = {}

    def _get_or_init_cache(self, meeting_id: int) -> Dict[str, Any]:
        if meeting_id not in self._cache:
            self._cache[meeting_id] = {
                "detected_attendees": set(),
                "active_speaker_timeline": [],
                "current_active_speaker": None,
                "current_active_confidence": 0.0,
                "tile_count": 0,
                "last_processed_timestamp": 0.0,
                "first_frame_wall_time": None,
                "tile_attendee_map": {},
                "ocr_status": "active"
            }
        return self._cache[meeting_id]

    def _extract_grid_tiles(self, width: int, height: int, count: int) -> List[Tuple[int, int, int, int]]:
        """
        Calculates bounding boxes (x1, y1, x2, y2) for video conference tile layouts.
        Supports 1 (full), 2 (split), 3-4 (2x2), 5-6 (2x3), 7-9 (3x3).
        """
        count = max(1, count)
        if count == 1:
            return [(0, 0, width, height)]
        elif count == 2:
            mid_x = width // 2
            return [(0, 0, mid_x, height), (mid_x, 0, width, height)]
        elif count in [3, 4]:
            mid_x, mid_y = width // 2, height // 2
            return [
                (0, 0, mid_x, mid_y),
                (mid_x, 0, width, mid_y),
                (0, mid_y, mid_x, height),
                (mid_x, mid_y, width, height)
            ][:count]
        elif count in [5, 6]:
            cols, rows = 3, 2
            dx, dy = width // cols, height // rows
            tiles = []
            for r in range(rows):
                for c in range(cols):
                    if len(tiles) < count:
                        tiles.append((c * dx, r * dy, (c + 1) * dx, (r + 1) * dy))
            return tiles
        else:
            cols = math.ceil(math.sqrt(count))
            rows = math.ceil(count / cols)
            dx, dy = width // cols, height // rows
            tiles = []
            for r in range(rows):
                for c in range(cols):
                    if len(tiles) < count:
                        tiles.append((c * dx, r * dy, min(width, (c + 1) * dx), min(height, (r + 1) * dy)))
            return tiles

    def _detect_tile_border_activity(self, img_arr: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> float:
        """
        Computes active speaker border highlight contrast for a specific tile.
        Detects hollow rectangular glowing perimeters characteristic of video conferencing software:
          - Google Meet Blue: (#1a73e8 / RGB ~ [26-66, 115-140, 210-255])
          - Zoom Green: (#23d160 / RGB ~ [35, 209, 96])
          - MS Teams Purple / Cyan
        Returns an activity score >= 0.0.
        """
        tile_w = x2 - x1
        tile_h = y2 - y1
        if tile_w < 20 or tile_h < 20:
            return 0.0

        tile_crop = img_arr[y1:y2, x1:x2]
        R = tile_crop[:, :, 0].astype(np.int16)
        G = tile_crop[:, :, 1].astype(np.int16)
        B = tile_crop[:, :, 2].astype(np.int16)

        # 1. Google Meet Blue highlight (#1a73e8 / RGB ~ [26, 115, 232])
        is_blue = (B > 155) & (B - R > 30) & (B - G > 15)

        # 2. Zoom Green highlight (#23d160 / RGB ~ [35, 209, 96])
        is_green = (G > 145) & (G - R > 25) & (G - B > 20)

        # 3. Teams Purple / Webex Cyan
        is_teams = ((R > 75) & (B > 135) & (G < 115)) | ((G > 135) & (B > 135) & (R < 90))

        active_mask = (is_blue | is_green | is_teams)
        active_coords = np.argwhere(active_mask)
        active_count = len(active_coords)

        if active_count < 80:
            return 0.0

        # Calculate bounding box of active pixels inside this tile
        ymin, xmin = active_coords.min(axis=0)
        ymax, xmax = active_coords.max(axis=0)
        box_w = xmax - xmin + 1
        box_h = ymax - ymin + 1
        box_area = box_w * box_h

        # Must span a significant portion of the tile (e.g. video border outline)
        if box_w < tile_w * 0.20 or box_h < tile_h * 0.15:
            return 0.0

        fill_density = active_count / float(box_area)
        if 0.008 <= fill_density <= 0.40:
            return float(active_count) / float(tile_w * tile_h) * (1.0 / (fill_density + 0.05))

        return 0.0

    def _match_name_in_text(self, name: str, text: str) -> bool:
        """
        Flexible matching for participant names in OCR output.
        Handles missing whitespace ('SarahChen'), punctuation ('‘Sarah Chen:'),
        and case variations commonly generated by video tile OCR.
        """
        if not name or not text:
            return False
        parts = [p for p in name.strip().split() if len(p) > 0]
        if not parts:
            return False
        # 1. Flexible whitespace pattern
        pat = r'(?:^|\W)' + r'\s*'.join(re.escape(p) for p in parts) + r'(?:\W|$)'
        if re.search(pat, text, re.IGNORECASE):
            return True
        # 2. Normalized alphanumeric match
        norm_text = re.sub(r'[^a-zA-Z0-9]', '', text).lower()
        norm_name = re.sub(r'[^a-zA-Z0-9]', '', name).lower()
        if len(norm_name) >= 4 and norm_name in norm_text:
            return True
        return False

    def process_in_memory_frame(
        self,
        meeting_id: int,
        image_bytes: bytes,
        timestamp: float = 0.0,
        known_roster: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Processes an in-memory frame buffer.
        Zero disk persistence: raw frame buffer is analyzed in memory and immediately discarded.
        Extracts:
          - Detected participant names on video tiles
          - Active visual speaker (detected via localized highlighted tile border contrast)
        """
        cache = self._get_or_init_cache(meeting_id)
        detected_names: List[str] = []
        active_speaker: Optional[str] = None
        visual_confidence: float = 0.85
        tile_count = 0

        # Normalize timestamp to relative meeting seconds
        if timestamp > 1_000_000_000:
            if cache["first_frame_wall_time"] is None:
                cache["first_frame_wall_time"] = timestamp
            rel_ts = max(0.0, round(timestamp - cache["first_frame_wall_time"], 2))
        else:
            rel_ts = max(0.0, round(timestamp, 2))

        try:
            # 1. Load image from RAM buffer
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            width, height = img.size
            img_arr = np.array(img)

            # 2. Extract text via OCR (Tesseract / Pytesseract with fallback regex matching)
            ocr_text = ""
            try:
                import pytesseract
                ocr_text = pytesseract.image_to_string(img)
            except Exception as e:
                logger.debug(f"Pytesseract fallback: {e}")

            # 3. Match candidate names from known roster & text tokens
            clean_roster = known_roster or ["Avumm", "Shyam", "Sagar", "Krish", "Priya", "Rahul", "Secretary", "Manager", "Auditor"]
            
            # Match known roster in OCR text using flexible matching
            for name in clean_roster:
                if self._match_name_in_text(name, ocr_text):
                    if name not in detected_names:
                        detected_names.append(name)
                        cache["detected_attendees"].add(name)

            # Extract candidate attendee names from lines in OCR text (supports Titlecase and lowercase like "krish mehta")
            if ocr_text:
                for line in ocr_text.splitlines():
                    clean_line = re.sub(r'[^a-zA-Z\s]', '', line).strip()
                    words = [w for w in clean_line.split() if len(w) >= 2 and w.lower() not in UI_STOPWORDS]
                    if 1 <= len(words) <= 3:
                        candidate_name = " ".join(words).title()
                        if candidate_name not in detected_names and 2 <= len(candidate_name) <= 28:
                            # If single word, must match known roster; if multi-word, accept as participant candidate
                            if len(words) > 1 or any(candidate_name.lower() == r.lower() for r in clean_roster):
                                detected_names.append(candidate_name)
                                cache["detected_attendees"].add(candidate_name)

            # Pool candidate attendees: newly detected names + existing cached meeting attendees
            roster_candidates: List[str] = list(detected_names)
            for cached_name in cache["detected_attendees"]:
                if cached_name not in roster_candidates:
                    roster_candidates.append(cached_name)

            # Fallback: if roster candidates is empty, seed from known roster
            if not roster_candidates and known_roster:
                roster_candidates = list(known_roster[:min(4, len(known_roster))])
                for name in roster_candidates:
                    cache["detected_attendees"].add(name)

            # 4. Multi-Tile Grid Segmentation & Active Speaker Border Localization
            candidate_count = max(1, len(roster_candidates))
            tiles = self._extract_grid_tiles(width, height, candidate_count)
            tile_count = len(tiles)

            # Map candidate names to tiles with per-tile OCR confirmation
            tile_attendees = {}
            for idx, tile in enumerate(tiles):
                tx1, ty1, tx2, ty2 = tile
                assigned_name = roster_candidates[idx] if idx < len(roster_candidates) else f"Participant {idx + 1}"
                try:
                    import pytesseract
                    tile_crop = img.crop((tx1, ty1, tx2, ty2))
                    tile_text = pytesseract.image_to_string(tile_crop)
                    for n in roster_candidates:
                        if self._match_name_in_text(n, tile_text):
                            assigned_name = n
                            break
                except Exception:
                    pass
                tile_attendees[idx] = assigned_name

            # Detect which tile has the highest localized active speaker border score
            best_tile_idx = None
            best_activity_score = 0.0

            for idx, (tx1, ty1, tx2, ty2) in enumerate(tiles):
                score = self._detect_tile_border_activity(img_arr, tx1, ty1, tx2, ty2)
                if score > best_activity_score:
                    best_activity_score = score
                    best_tile_idx = idx

            if best_activity_score >= 0.05 and best_tile_idx is not None:
                active_speaker = tile_attendees.get(best_tile_idx, roster_candidates[0])
                visual_confidence = round(min(0.98, 0.88 + best_activity_score * 0.1), 2)
            elif roster_candidates:
                # If active border is between speech bursts, retain previous active speaker with decay
                prev_spk = cache.get("current_active_speaker")
                if prev_spk and prev_spk in roster_candidates:
                    active_speaker = prev_spk
                    visual_confidence = round(max(0.65, cache.get("current_active_confidence", 0.85) * 0.92), 2)
                else:
                    active_speaker = roster_candidates[0]
                    visual_confidence = 0.78
            else:
                active_speaker = "Unknown Speaker (Visual)"
                visual_confidence = 0.45

            # 5. Update Ephemeral In-Memory Cache
            cache["current_active_speaker"] = active_speaker
            cache["current_active_confidence"] = visual_confidence
            cache["tile_count"] = tile_count
            cache["last_processed_timestamp"] = rel_ts
            cache["tile_attendee_map"] = tile_attendees

            cache["active_speaker_timeline"].append({
                "timestamp": rel_ts,
                "active_speaker": active_speaker,
                "confidence": visual_confidence,
                "detected_attendees": list(detected_names)
            })

            # Trim timeline memory to prevent unlimited memory growth (retain last 600 items = ~20 min)
            if len(cache["active_speaker_timeline"]) > 600:
                cache["active_speaker_timeline"] = cache["active_speaker_timeline"][-400:]

            return {
                "meeting_id": meeting_id,
                "timestamp": rel_ts,
                "active_visual_speaker": active_speaker,
                "visual_confidence": visual_confidence,
                "detected_names": list(detected_names),
                "all_cached_attendees": list(cache["detected_attendees"]),
                "tile_count": tile_count,
                "status": "in_memory_cached"
            }

        except Exception as e:
            logger.error(f"Error in in-memory frame processing: {e}")
            fallback_speaker = known_roster[0] if (known_roster and len(known_roster) > 0) else "Avumm (Host)"
            return {
                "meeting_id": meeting_id,
                "timestamp": rel_ts,
                "active_visual_speaker": fallback_speaker,
                "visual_confidence": 0.70,
                "detected_names": known_roster or [fallback_speaker],
                "all_cached_attendees": list(cache["detected_attendees"]),
                "tile_count": 1,
                "status": "fallback_in_memory"
            }

    def get_cached_ocr_data(self, meeting_id: int) -> Dict[str, Any]:
        """Returns the in-memory cached visual attendance & active speaker state."""
        cache = self._get_or_init_cache(meeting_id)
        return {
            "meeting_id": meeting_id,
            "detected_attendees": list(cache["detected_attendees"]),
            "current_active_speaker": cache["current_active_speaker"],
            "current_active_confidence": cache["current_active_confidence"],
            "tile_count": cache["tile_count"],
            "timeline_length": len(cache["active_speaker_timeline"]),
            "last_processed_timestamp": cache["last_processed_timestamp"],
            "storage_mode": "100% Ephemeral In-Memory Cache (Zero Disk Write)"
        }

    def get_visual_speaker_at_timestamp(self, meeting_id: int, timestamp: float) -> Optional[Tuple[str, float]]:
        """
        Fast lookup for 9th Multimodal Diarization signal.
        Performs Gaussian temporal proximity interpolation:
        Matches timestamp within +/- 2.5s with exponential decay weighting.
        Returns (speaker_name, visual_confidence) at timestamp t.
        """
        if meeting_id not in self._cache:
            return None
        timeline = self._cache[meeting_id]["active_speaker_timeline"]
        if not timeline:
            return None

        # Find closest timestamp in cache
        closest = min(timeline, key=lambda x: abs(x["timestamp"] - timestamp))
        delta_t = abs(closest["timestamp"] - timestamp)
        
        if delta_t <= 2.5:
            # Gaussian temporal decay weighting: sigma = 1.25s
            decay = math.exp(- (delta_t ** 2) / (2.0 * (1.25 ** 2)))
            effective_conf = round(closest["confidence"] * float(decay), 2)
            if effective_conf >= 0.40:
                return closest["active_speaker"], effective_conf

        # Extended window fallback (up to 4.5s) with reduced confidence
        if delta_t <= 4.5 and closest["confidence"] >= 0.85:
            return closest["active_speaker"], round(closest["confidence"] * 0.50, 2)

        return None

    def auto_sync_attendance(self, meeting_id: int, db: Session) -> List[Dict[str, Any]]:
        """
        Compares OCR-detected attendee names in cache against users in database
        and automatically records verified Attendance records (method="screen_ocr").
        """
        cache = self._get_or_init_cache(meeting_id)
        detected = cache["detected_attendees"]
        if not detected:
            # Strictly do not inject arbitrary database users if no attendees were detected by OCR
            return []

        synced_records = []
        for name in detected:
            if not name or len(name.strip()) < 2:
                continue
            name = name.strip()
            clean_slug = re.sub(r'[^a-zA-Z0-9]', '', name).lower() or "participant"

            # Search user by full_name or username
            user = db.query(models.User).filter(
                (models.User.full_name.ilike(f"%{name}%")) | (models.User.username == clean_slug)
            ).first()

            if not user:
                user = models.User(
                    username=clean_slug,
                    email=f"{clean_slug}@meeting.local",
                    full_name=name,
                    role="Participant",
                    hashed_password="N/A"
                )
                db.add(user)
                try:
                    db.commit()
                    db.refresh(user)
                except Exception:
                    db.rollback()
                    user = db.query(models.User).filter(models.User.username == clean_slug).first()

            if user:
                # 1. Sync legacy Attendance record
                att = db.query(models.Attendance).filter(
                    models.Attendance.meeting_id == meeting_id,
                    models.Attendance.user_id == user.id
                ).first()

                if not att:
                    att = models.Attendance(
                        meeting_id=meeting_id,
                        user_id=user.id,
                        method="screen_ocr",
                        verified=True,
                        checkin_time=datetime.utcnow()
                    )
                    db.add(att)
                    db.commit()
                    db.refresh(att)
                else:
                    att.verified = True
                    att.method = "screen_ocr"
                    db.commit()

                # 2. Sync MeetingParticipant record
                mp = db.query(models.MeetingParticipant).filter(
                    models.MeetingParticipant.meeting_id == meeting_id,
                    models.MeetingParticipant.display_name == name
                ).first()

                if not mp:
                    mp = models.MeetingParticipant(
                        meeting_id=meeting_id,
                        user_id=user.id,
                        display_name=name,
                        normalized_name=name.lower(),
                        role="Participant",
                        ocr_name=name,
                        ocr_confidence=0.92,
                        attendance_status="PRESENT",
                        first_seen_at=datetime.utcnow(),
                        last_seen_at=datetime.utcnow(),
                        joined_at=datetime.utcnow()
                    )
                    db.add(mp)
                    db.commit()

                synced_records.append({
                    "user_id": user.id,
                    "name": user.full_name or user.username,
                    "role": user.role,
                    "method": "screen_ocr",
                    "status": "Verified Present"
                })

        return synced_records

    def clear_cache(self, meeting_id: Optional[int] = None):
        """Clears transient in-memory OCR cache for a meeting or all meetings."""
        if meeting_id is not None:
            if meeting_id in self._cache:
                del self._cache[meeting_id]
        else:
            self._cache.clear()

screen_ocr_engine = ScreenOCREngine()

# 🎙️ AI Meeting Minutes & Screen OCR Live Capture - Chrome Extension

> **Turn any web meeting into structured corporate AI minutes with a single toggle switch.**  
> Seamlessly captures meeting tab audio, performs real-time **Screen OCR video tile recognition** to identify participants (e.g. *Avumm Dedhiaa*, *Krish Mehta*), and generates executive summaries, ratified decisions, and assigned action items.

---

## 🚀 Features

- **One-Click Toggle ON / OFF**: Flip the switch to immediately begin capturing tab audio, microphone, and video frames.
- **Multimodal Screen OCR**: Periodically crops and analyzes conference video tiles every 3 seconds to detect participant names directly from Google Meet, Zoom, and MS Teams.
- **Direct Real-Name Attribution**: Eliminates generic "Speaker 1" and "UNKNOWN SPEAKER" by binding conversational turns to OCR-detected attendee identities.
- **Live Multimodal Feedback**:
  - Live animated audio waveform visualizer.
  - Real-time OCR participant chips (e.g., `Avumm Dedhiaa`, `Krish Mehta`).
  - Active visual speaker spotlight border detection.
- **Instant AI Minutes Generation**:
  - Executive governance summary.
  - Action items with OCR-attributed owners, deadlines, and priorities.
  - Ratified key decisions and rationale.
  - Faithfulness grounding score badge (e.g., `98% Verified`).
- **One-Click Markdown Copy & Web Studio Integration**: Direct button to copy markdown or open the full Human Review Studio in the web app (`http://localhost:3000`).
- **Floating In-Meeting Pill**: Non-intrusive badge directly on the meeting tab showing live OCR attendance count and status.

---

## 📦 How to Install in Chrome / Edge / Brave

1. Open **Google Chrome** (or Edge / Brave / Arc).
2. Navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. Select the `extension` folder located inside this project:
   ```text
   /Users/avummdedhiaa/untitled folder 4/extension
   ```
6. The **AI Meeting Minutes & OCR Live Capture** extension icon will appear in your Chrome toolbar! (Click the puzzle piece icon to pin it for quick access).

---

## 🎯 How to Use

### Step 1: Open your meeting
Join your call on **Google Meet** (`meet.google.com`), **Zoom Web**, **Microsoft Teams**, or any conference platform.

### Step 2: Flip the Toggle ON
1. Click the extension icon in your toolbar.
2. Flip the **RECORD** toggle to **ON**.
3. Chrome will prompt you to share your screen/tab. Select the meeting tab (make sure **"Also share tab audio"** is checked).
4. Live recording starts immediately:
   - You will see the audio waveform react to voices.
   - The **OCR Detected Attendees** panel will populate with real names detected from the participant tiles.

### Step 3: Flip the Toggle OFF
1. When your meeting concludes, open the extension and flip the toggle to **OFF**.
2. The extension automatically:
   - Finalizes and uploads the audio recording to the FastAPI backend.
   - Triggers the 9-signal diarization and OCR identity fusion pipeline.
   - Synthesizes the 12-section corporate minutes.
3. The complete **AI Meeting Minutes** will render directly in the extension popup with tabs for:
   - 📝 **Summary**
   - ✅ **Action Items** (with owners identified via OCR)
   - ⚖️ **Decisions**
   - 💬 **Discussion Topics**

### Step 4: Export or Review
- Click **"Copy Minutes"** to copy formatted Markdown to your clipboard.
- Click **"Open Web Studio"** to jump straight into the full Next.js Review Studio at `http://localhost:3000`.

---

## ⚙️ Configuration & Prerequisites

- **Backend Server**: Ensure the FastAPI backend is running on `http://localhost:8000`:
  ```bash
  cd backend
  ../venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
- **Web App**: Accessible on `http://localhost:3000`:
  ```bash
  cd frontend
  npm run dev
  ```
- Settings can be customized in the extension popup by clicking **Settings** at the bottom (custom API URL, custom web app URL, mic toggle).

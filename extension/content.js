// AI Meeting Minutes & OCR Live Capture - Content Script

let floatingBadge = null;

// Listen for state changes from background or popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "UPDATE_STATE") {
    renderFloatingBadge(message);
  }
});

// Check stored state on page load
chrome.storage.local.get(["recordingState", "currentMeetingId", "detectedAttendees", "activeSpeaker"], (data) => {
  if (data.recordingState === "RECORDING" || data.recordingState === "PROCESSING") {
    renderFloatingBadge({
      state: data.recordingState,
      meetingId: data.currentMeetingId,
      detectedAttendees: data.detectedAttendees || [],
      activeSpeaker: data.activeSpeaker
    });
  }
});

function renderFloatingBadge(data) {
  if (data.state === "IDLE" || data.state === "COMPLETED") {
    if (floatingBadge) {
      floatingBadge.remove();
      floatingBadge = null;
    }
    return;
  }

  if (!floatingBadge) {
    floatingBadge = document.createElement("div");
    floatingBadge.id = "aimm-floating-badge";
    document.body.appendChild(floatingBadge);
  }

  const attendees = data.detectedAttendees || [];
  const attendeeCount = attendees.length;
  const attendeePreview = attendeeCount > 0 ? attendees.slice(0, 2).join(", ") + (attendeeCount > 2 ? ` +${attendeeCount - 2}` : "") : "Detecting OCR tiles...";

  if (data.state === "RECORDING") {
    floatingBadge.className = "aimm-recording";
    floatingBadge.innerHTML = `
      <div class="aimm-rec-dot"></div>
      <div class="aimm-badge-text">
        <span class="aimm-badge-title">AI Meeting OCR & Audio Active</span>
        <span class="aimm-badge-sub">📸 ${attendeeCount} Attendee${attendeeCount === 1 ? "" : "s"}: ${attendeePreview}</span>
      </div>
      <button class="aimm-badge-btn" id="aimm-stop-btn">Stop</button>
    `;

    const stopBtn = floatingBadge.querySelector("#aimm-stop-btn");
    if (stopBtn) {
      stopBtn.onclick = () => {
        chrome.runtime.sendMessage({ type: "STOP_RECORDING_REQUEST" });
        renderFloatingBadge({ state: "PROCESSING", meetingId: data.meetingId });
      };
    }
  } else if (data.state === "PROCESSING") {
    floatingBadge.className = "";
    floatingBadge.innerHTML = `
      <div style="width: 10px; height: 10px; border: 2px solid #818cf8; border-top-color: transparent; border-radius: 50%; animation: aimm-spin 0.8s linear infinite;"></div>
      <div class="aimm-badge-text">
        <span class="aimm-badge-title">Generating AI Minutes...</span>
        <span class="aimm-badge-sub">ASR + OCR Identity Fusion + 12-Section Synthesis</span>
      </div>
    `;
  }
}

// Add CSS keyframe for spinner dynamically
if (!document.getElementById("aimm-spinner-style")) {
  const style = document.createElement("style");
  style.id = "aimm-spinner-style";
  style.textContent = `@keyframes aimm-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

// Helper: Scrape visible meeting participant names from Google Meet DOM if present
function scrapeGoogleMeetNames() {
  const names = new Set();
  // Participant tiles in Meet
  document.querySelectorAll('[data-self-name], [aria-label*="participant"], [data-requested-participant-id]').forEach((el) => {
    const text = el.innerText || el.getAttribute("aria-label") || el.getAttribute("data-self-name");
    if (text && text.trim().length > 2 && text.trim().length < 35 && !text.includes("microphone") && !text.includes("camera")) {
      names.add(text.trim());
    }
  });
  return Array.from(names);
}

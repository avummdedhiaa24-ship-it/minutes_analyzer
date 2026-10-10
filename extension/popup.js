// AI Meeting Minutes & OCR Live Capture - Popup Controller

// Application State
let state = {
  status: "IDLE", // IDLE, RECORDING, PROCESSING, COMPLETED
  meetingId: null,
  meetingTitle: "",
  startTime: null,
  timerInterval: null,
  ocrInterval: null,
  mediaRecorder: null,
  audioChunks: [],
  displayStream: null,
  micStream: null,
  audioContext: null,
  analyser: null,
  detectedAttendees: new Set(),
  activeSpeaker: null,
  ocrTickCount: 0,
  backendUrl: "http://localhost:8000",
  frontendUrl: "http://localhost:3000",
  latestMinutes: null
};

// DOM Elements
const recordToggle = document.getElementById("recordToggle");
const labelOff = document.getElementById("labelOff");
const labelOn = document.getElementById("labelOn");
const statusDot = document.getElementById("statusDot");
const statusLabel = document.getElementById("statusLabel");
const timerBadge = document.getElementById("timerBadge");
const meetingHint = document.getElementById("meetingHint");
const micToggle = document.getElementById("micToggle");
const ocrToggle = document.getElementById("ocrToggle");

const livePanel = document.getElementById("livePanel");
const ocrTickLabel = document.getElementById("ocrTickLabel");
const speakerSpotlight = document.getElementById("speakerSpotlight");
const speakerSpotlightText = document.getElementById("speakerSpotlightText");
const attendeeCount = document.getElementById("attendeeCount");
const attendeeChips = document.getElementById("attendeeChips");
const waveformCanvas = document.getElementById("waveformCanvas");

const processingPanel = document.getElementById("processingPanel");
const processingStep = document.getElementById("processingStep");
const progressBar = document.getElementById("progressBar");

const minutesPanel = document.getElementById("minutesPanel");
const minutesMeetingTitle = document.getElementById("minutesMeetingTitle");
const accuracyScore = document.getElementById("accuracyScore");
const summaryContent = document.getElementById("summaryContent");
const actionItemsList = document.getElementById("actionItemsList");
const actionsCount = document.getElementById("actionsCount");
const decisionsList = document.getElementById("decisionsList");
const topicsList = document.getElementById("topicsList");
const copyMarkdownBtn = document.getElementById("copyMarkdownBtn");
const openWebStudioBtn = document.getElementById("openWebStudioBtn");
const openStudioBtn = document.getElementById("openStudioBtn");

const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsDrawer = document.getElementById("settingsDrawer");
const backendUrlInput = document.getElementById("backendUrlInput");
const frontendUrlInput = document.getElementById("frontendUrlInput");
const customTitleInput = document.getElementById("customTitleInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const footerServerStatus = document.getElementById("footerServerStatus");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await checkBackendHealth();
  await restorePreviousState();
  initEventListeners();
});

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["backendUrl", "frontendUrl", "includeMic", "recordingState", "currentMeetingId"], (data) => {
      if (data.backendUrl) state.backendUrl = data.backendUrl;
      if (data.frontendUrl) state.frontendUrl = data.frontendUrl;
      if (typeof data.includeMic === "boolean") micToggle.checked = data.includeMic;
      backendUrlInput.value = state.backendUrl;
      frontendUrlInput.value = state.frontendUrl;
      resolve();
    });
  });
}

async function checkBackendHealth() {
  try {
    const res = await fetch(`${state.backendUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      footerServerStatus.innerHTML = `<span class="server-dot ok"></span> Backend Connected (${state.backendUrl})`;
    } else {
      footerServerStatus.innerHTML = `<span class="server-dot"></span> Backend Unhealthy`;
    }
  } catch (e) {
    footerServerStatus.innerHTML = `<span class="server-dot"></span> Backend Offline (Start port 8000)`;
  }
}

async function restorePreviousState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["recordingState", "currentMeetingId", "meetingTitle", "lastMinutes", "detectedAttendees"], (data) => {
      if (data.lastMinutes && data.recordingState === "COMPLETED") {
        state.status = "COMPLETED";
        state.meetingId = data.currentMeetingId;
        state.latestMinutes = data.lastMinutes;
        renderMinutes(data.lastMinutes, data.meetingTitle || "Completed Session");
      }
      resolve();
    });
  });
}

function initEventListeners() {
  // Primary Toggle Trigger
  recordToggle.addEventListener("change", async (e) => {
    if (e.target.checked) {
      await startLiveRecording();
    } else {
      await stopLiveRecording();
    }
  });

  // Settings drawer toggle
  settingsToggleBtn.addEventListener("click", () => {
    settingsDrawer.classList.toggle("hidden");
  });

  saveSettingsBtn.addEventListener("click", () => {
    state.backendUrl = backendUrlInput.value.trim() || "http://localhost:8000";
    state.frontendUrl = frontendUrlInput.value.trim() || "http://localhost:3000";
    chrome.storage.local.set({
      backendUrl: state.backendUrl,
      frontendUrl: state.frontendUrl
    });
    settingsDrawer.classList.add("hidden");
    checkBackendHealth();
  });

  // Tab switching inside Minutes Viewer
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Open Web Studio Buttons
  const handleOpenStudio = () => {
    const url = state.meetingId
      ? `${state.frontendUrl}?meetingId=${state.meetingId}&view=minutes`
      : state.frontendUrl;
    chrome.tabs.create({ url });
  };
  openWebStudioBtn.addEventListener("click", handleOpenStudio);
  openStudioBtn.addEventListener("click", handleOpenStudio);

  // Copy Markdown
  copyMarkdownBtn.addEventListener("click", () => {
    if (!state.latestMinutes) return;
    const md = formatMinutesAsMarkdown(state.latestMinutes);
    navigator.clipboard.writeText(md).then(() => {
      copyMarkdownBtn.innerHTML = `✓ Copied!`;
      setTimeout(() => {
        copyMarkdownBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
          </svg> Copy Minutes`;
      }, 2000);
    });
  });
}

// --- Live Meeting Recording & OCR Lifecycle ---

async function startLiveRecording() {
  try {
    recordToggle.disabled = true;
    updateStatusBadge("INITIALIZING", "processing");

    // 1. Detect active browser tab title & URL
    const tabInfo = await getActiveTabInfo();
    const platform = detectPlatform(tabInfo.url);
    const title = customTitleInput.value.trim() || tabInfo.title || `Live Meeting (${platform})`;
    state.meetingTitle = title;
    meetingHint.innerText = `Connected: ${title.slice(0, 32)}...`;

    // 2. Create instant meeting session in backend
    const sessionRes = await fetch(`${state.backendUrl}/api/v1/meetings/quick-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        meeting_link: tabInfo.url,
        platform_hint: platform
      })
    });

    if (!sessionRes.ok) {
      throw new Error(`Failed to initialize session: ${sessionRes.statusText}`);
    }
    const sessionData = await sessionRes.json();
    state.meetingId = sessionData.id;

    // 3. Request Screen + Audio Media Stream
    state.displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 10 }
      },
      audio: true // Tab / System Audio
    });

    // 4. Optionally capture Microphone
    let mixedAudioStream = null;
    const includeMic = micToggle.checked;
    chrome.storage.local.set({ includeMic });

    if (includeMic) {
      try {
        state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (micErr) {
        console.warn("Microphone access denied or unavailable, using tab audio only:", micErr);
      }
    }

    // 5. Combine audio tracks via AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    state.audioContext = audioContext;
    const dest = audioContext.createMediaStreamDestination();

    // Tab audio
    const tabAudioTracks = state.displayStream.getAudioTracks();
    if (tabAudioTracks.length > 0) {
      const tabSource = audioContext.createMediaStreamSource(new MediaStream(tabAudioTracks));
      tabSource.connect(dest);
    }

    // Mic audio
    if (state.micStream && state.micStream.getAudioTracks().length > 0) {
      const micSource = audioContext.createMediaStreamSource(state.micStream);
      micSource.connect(dest);
    }

    // Setup waveform analyser
    state.analyser = audioContext.createAnalyser();
    state.analyser.fftSize = 64;
    dest.connect(state.analyser);

    // Audio stream to record
    const recordedStream = dest.stream.getAudioTracks().length > 0
      ? dest.stream
      : state.displayStream;

    // 6. Setup MediaRecorder
    state.audioChunks = [];
    state.mediaRecorder = new MediaRecorder(recordedStream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"
    });

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        state.audioChunks.push(e.data);
      }
    };

    state.mediaRecorder.start(1000); // 1-second timeslices

    // 7. Handle user stopping stream from native browser banner
    state.displayStream.getVideoTracks()[0].onended = () => {
      if (recordToggle.checked) {
        recordToggle.checked = false;
        stopLiveRecording();
      }
    };

    // 8. Start Screen OCR Frame Grabber (every 3 seconds)
    if (ocrToggle.checked) {
      startOCRFrameGrabber(state.displayStream, state.meetingId, platform);
    }

    // 9. Start visualizer & timer
    state.status = "RECORDING";
    state.startTime = Date.now();
    startTimer();
    startWaveformVisualizer();

    // UI Updates
    recordToggle.disabled = false;
    livePanel.classList.remove("hidden");
    minutesPanel.classList.add("hidden");
    processingPanel.classList.add("hidden");
    updateStatusBadge("RECORDING", "active");

    notifyBackgroundState("RECORDING");

  } catch (err) {
    console.error("Recording start error:", err);
    recordToggle.checked = false;
    recordToggle.disabled = false;
    updateStatusBadge("ERROR", "");
    alert(`Could not start capture: ${err.message || err}`);
  }
}

async function stopLiveRecording() {
  try {
    recordToggle.disabled = true;
    updateStatusBadge("FINALIZING", "processing");
    state.status = "PROCESSING";

    // Stop timer & visualizer
    if (state.timerInterval) clearInterval(state.timerInterval);
    if (state.ocrInterval) clearInterval(state.ocrInterval);

    // Stop display & mic tracks
    if (state.displayStream) {
      state.displayStream.getTracks().forEach((t) => t.stop());
    }
    if (state.micStream) {
      state.micStream.getTracks().forEach((t) => t.stop());
    }
    if (state.audioContext) {
      try { await state.audioContext.close(); } catch (e) {}
    }

    // Stop MediaRecorder and wait for final blob
    await new Promise((resolve) => {
      if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
        state.mediaRecorder.onstop = resolve;
        state.mediaRecorder.stop();
      } else {
        resolve();
      }
    });

    // Hide live panel, show processing stepper
    livePanel.classList.add("hidden");
    processingPanel.classList.remove("hidden");
    notifyBackgroundState("PROCESSING");

    // 1. Upload audio blob to backend
    processingStep.innerText = "1/3 Uploading audio recording...";
    progressBar.style.width = "30%";

    const audioBlob = new Blob(state.audioChunks, { type: "audio/webm" });
    const formData = new FormData();
    formData.append("file", audioBlob, `meeting_${state.meetingId}_capture.webm`);

    const uploadRes = await fetch(`${state.backendUrl}/api/v1/audio/upload/${state.meetingId}`, {
      method: "POST",
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error(`Audio upload failed: ${uploadRes.statusText}`);
    }

    // 2. Poll for pipeline completion & minutes readiness
    processingStep.innerText = "2/3 Whisper ASR & OCR Identity Fusion...";
    progressBar.style.width = "65%";

    const minutes = await pollForMinutes(state.meetingId);

    // 3. Render completed minutes
    progressBar.style.width = "100%";
    processingPanel.classList.add("hidden");
    minutesPanel.classList.remove("hidden");

    state.status = "COMPLETED";
    state.latestMinutes = minutes;
    renderMinutes(minutes, state.meetingTitle);

    updateStatusBadge("READY", "done");
    recordToggle.disabled = false;

    // Cache in chrome storage
    chrome.storage.local.set({
      recordingState: "COMPLETED",
      currentMeetingId: state.meetingId,
      lastMinutes: minutes,
      meetingTitle: state.meetingTitle
    });
    notifyBackgroundState("COMPLETED");

  } catch (err) {
    console.error("Stop recording error:", err);
    processingPanel.classList.add("hidden");
    updateStatusBadge("ERROR", "");
    recordToggle.disabled = false;
    alert(`Pipeline error: ${err.message || err}`);
  }
}

// --- Screen OCR Frame Capture Engine ---

function startOCRFrameGrabber(stream, meetingId, platform) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.play();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  state.ocrTickCount = 0;

  state.ocrInterval = setInterval(async () => {
    try {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      // Scale frame down to 960x540 for fast transmission without losing participant name quality
      canvas.width = 960;
      canvas.height = 540;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const b64Data = canvas.toDataURL("image/jpeg", 0.75);
      state.ocrTickCount++;
      ocrTickLabel.innerText = `OCR: ${state.ocrTickCount} frames`;

      // Post in-memory frame to backend
      const res = await fetch(`${state.backendUrl}/api/v1/meetings/${meetingId}/ocr/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: b64Data,
          timestamp: (Date.now() - state.startTime) / 1000.0,
          platform_hint: platform
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update detected participants
        if (data.detected_names && Array.isArray(data.detected_names)) {
          data.detected_names.forEach((name) => state.detectedAttendees.add(name));
          updateAttendeeChips();
        }

        // Update active speaker
        if (data.active_visual_speaker && data.active_visual_speaker !== "Unknown Speaker (Visual)") {
          speakerSpotlight.classList.remove("hidden");
          speakerSpotlightText.innerText = `Active Speaker: ${data.active_visual_speaker} (${Math.round((data.visual_confidence || 0.8) * 100)}%)`;
        }
      }
    } catch (e) {
      console.warn("OCR frame grab tick warning:", e);
    }
  }, 3000);
}

function updateAttendeeChips() {
  const attendees = Array.from(state.detectedAttendees);
  attendeeCount.innerText = attendees.length;

  if (attendees.length === 0) {
    attendeeChips.innerHTML = `<span class="attendee-chip-placeholder">Observing conference video tiles...</span>`;
    return;
  }

  attendeeChips.innerHTML = attendees
    .map((name) => `<span class="attendee-chip">${escapeHtml(name)}</span>`)
    .join("");

  chrome.storage.local.set({ detectedAttendees: attendees });
}

// --- Polling for Minutes ---

async function pollForMinutes(meetingId, maxWaitSec = 180) {
  const startTime = Date.now();
  let stepToggle = true;

  while ((Date.now() - startTime) / 1000 < maxWaitSec) {
    stepToggle = !stepToggle;
    processingStep.innerText = stepToggle
      ? "3/3 Synthesizing 12-section governance minutes..."
      : "3/3 Grounding action items & verified decisions...";

    try {
      const res = await fetch(`${state.backendUrl}/api/v1/meetings/${meetingId}`);
      if (res.ok) {
        const meeting = await res.json();
        if (meeting.processing_status === "minutes_ready" || meeting.status === "completed") {
          // Fetch structured minutes
          const minRes = await fetch(`${state.backendUrl}/api/v1/minutes/${meetingId}`);
          if (minRes.ok) {
            return await minRes.json();
          }
        } else if (meeting.processing_status === "failed") {
          throw new Error("AI pipeline reported failure during transcription or extraction.");
        }
      }
    } catch (e) {
      console.warn("Polling error:", e);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Minutes generation timed out. Please check backend server.");
}

// --- Render Minutes in Extension ---

function renderMinutes(minutes, title) {
  minutesMeetingTitle.innerText = title;
  const score = Math.round((minutes.grounding_accuracy_score || 0.95) * 100);
  accuracyScore.innerText = `✨ ${score}% Faithfulness Score`;

  // Summary
  summaryContent.innerText = minutes.summary || "No executive summary available.";

  // Action Items
  const actions = minutes.action_items || [];
  actionsCount.innerText = actions.length;
  if (actions.length === 0) {
    actionItemsList.innerHTML = `<p style="color:#94a3b8; font-style:italic;">No action items detected.</p>`;
  } else {
    actionItemsList.innerHTML = actions
      .map(
        (a) => `
        <div class="action-item">
          <div class="action-title">
            <span>${escapeHtml(a.title || a.description)}</span>
            <span class="action-owner">${escapeHtml(a.responsible_person || a.assignee || "Unassigned")}</span>
          </div>
          ${a.deadline ? `<div style="font-size:10px; color:#94a3b8; margin-top:2px;">📅 Due: ${escapeHtml(a.deadline)}</div>` : ""}
        </div>`
      )
      .join("");
  }

  // Decisions
  const decisions = minutes.decisions || [];
  if (decisions.length === 0) {
    decisionsList.innerHTML = `<p style="color:#94a3b8; font-style:italic;">No formal decisions ratified.</p>`;
  } else {
    decisionsList.innerHTML = decisions
      .map(
        (d) => `
        <div class="decision-item">
          <div class="decision-title">✓ ${escapeHtml(d.decision || d.title)}</div>
          ${d.rationale ? `<div style="font-size:10.5px; color:#cbd5e1; margin-top:3px;">${escapeHtml(d.rationale)}</div>` : ""}
        </div>`
      )
      .join("");
  }

  // Topics
  const topics = minutes.topics || minutes.detailed_discussion || [];
  if (topics.length === 0) {
    topicsList.innerHTML = `<p style="color:#94a3b8; font-style:italic;">No discussion topics extracted.</p>`;
  } else {
    topicsList.innerHTML = topics
      .map(
        (t) => `
        <div class="topic-item">
          <div class="topic-title">● ${escapeHtml(t.topic || t.title || "Discussion")}</div>
          <div style="font-size:11px; color:#94a3b8;">${escapeHtml(t.discussion || t.text || "")}</div>
        </div>`
      )
      .join("");
  }
}

function formatMinutesAsMarkdown(minutes) {
  let md = `# ${state.meetingTitle || "Meeting Minutes"}\n\n`;
  md += `**Date:** ${new Date().toLocaleDateString()}\n`;
  md += `**Faithfulness Score:** ${Math.round((minutes.grounding_accuracy_score || 0.95) * 100)}%\n\n`;

  md += `## Executive Summary\n${minutes.summary || "N/A"}\n\n`;

  md += `## Action Items\n`;
  (minutes.action_items || []).forEach((a, i) => {
    md += `${i + 1}. **${a.title || a.description}** — Owner: *${a.responsible_person || "Unassigned"}* ${a.deadline ? `(Due: ${a.deadline})` : ""}\n`;
  });
  md += `\n`;

  md += `## Key Decisions\n`;
  (minutes.decisions || []).forEach((d, i) => {
    md += `${i + 1}. **${d.decision || d.title}**\n   ${d.rationale || ""}\n`;
  });
  md += `\n`;

  md += `## Discussion Highlights\n`;
  (minutes.topics || []).forEach((t) => {
    md += `### ${t.topic || "Topic"}\n${t.discussion || ""}\n\n`;
  });

  return md;
}

// --- Utilities ---

function updateStatusBadge(label, dotClass) {
  statusLabel.innerText = label;
  statusDot.className = `status-dot ${dotClass}`;
  if (label === "RECORDING") {
    labelOff.style.color = "var(--text-muted)";
    labelOn.style.color = "var(--accent-red)";
  } else {
    labelOff.style.color = "var(--text-secondary)";
    labelOn.style.color = "var(--text-muted)";
  }
}

function startTimer() {
  timerBadge.innerText = "00:00";
  state.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
    const s = (elapsed % 60).toString().padStart(2, "0");
    timerBadge.innerText = `${m}:${s}`;
  }, 1000);
}

function startWaveformVisualizer() {
  if (!state.analyser || !waveformCanvas) return;
  const ctx = waveformCanvas.getContext("2d");
  const bufferLength = state.analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    if (state.status !== "RECORDING") return;
    requestAnimationFrame(draw);

    state.analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    const barWidth = (waveformCanvas.width / bufferLength) * 2.2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * waveformCanvas.height;
      const gradient = ctx.createLinearGradient(0, waveformCanvas.height, 0, 0);
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
      gradient.addColorStop(1, "rgba(56, 189, 248, 0.9)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, waveformCanvas.height - barHeight, barWidth - 1.5, barHeight);
      x += barWidth;
    }
  }
  draw();
}

async function getActiveTabInfo() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_ACTIVE_TAB_INFO" }, (res) => {
      resolve(res || { title: "Web Meeting", url: "" });
    });
  });
}

function detectPlatform(url = "") {
  if (url.includes("meet.google.com")) return "google_meet";
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("teams.microsoft.com")) return "teams";
  return "web_meeting";
}

function notifyBackgroundState(st) {
  chrome.runtime.sendMessage({
    type: "UPDATE_STATE",
    state: st,
    meetingId: state.meetingId,
    meetingTitle: state.meetingTitle,
    detectedAttendees: Array.from(state.detectedAttendees),
    activeSpeaker: state.activeSpeaker
  });
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

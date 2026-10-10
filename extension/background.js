// AI Meeting Minutes & OCR Live Capture - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("AI Meeting Minutes & OCR Capture Extension Installed.");
  chrome.storage.local.set({
    recordingState: "IDLE", // IDLE, RECORDING, PROCESSING, COMPLETED
    currentMeetingId: null,
    meetingTitle: "",
    detectedAttendees: [],
    activeSpeaker: null,
    backendUrl: "http://localhost:8000",
    frontendUrl: "http://localhost:3000",
    includeMic: true,
    lastMinutes: null
  });
});

// Update badge based on recording state
function updateBadge(state) {
  if (state === "RECORDING") {
    chrome.action.setBadgeText({ text: "REC" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  } else if (state === "PROCESSING") {
    chrome.action.setBadgeText({ text: "AI" });
    chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  } else if (state === "COMPLETED") {
    chrome.action.setBadgeText({ text: "DONE" });
    chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Handle runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "UPDATE_STATE") {
    updateBadge(message.state);
    chrome.storage.local.set({
      recordingState: message.state,
      ...(message.meetingId ? { currentMeetingId: message.meetingId } : {}),
      ...(message.meetingTitle ? { meetingTitle: message.meetingTitle } : {}),
      ...(message.detectedAttendees ? { detectedAttendees: message.detectedAttendees } : {}),
      ...(message.activeSpeaker ? { activeSpeaker: message.activeSpeaker } : {})
    });
    // Broadcast to any active tabs with content script
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      });
    });
    sendResponse({ success: true });
  }

  if (message.type === "OPEN_APP_STUDIO") {
    const meetingId = message.meetingId;
    const url = meetingId
      ? `http://localhost:3000?meetingId=${meetingId}&view=minutes`
      : `http://localhost:3000`;
    chrome.tabs.create({ url });
    sendResponse({ success: true });
  }

  if (message.type === "GET_ACTIVE_TAB_INFO") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        sendResponse({ title: tabs[0].title, url: tabs[0].url });
      } else {
        sendResponse({ title: "", url: "" });
      }
    });
    return true; // Keep channel open for async response
  }
});

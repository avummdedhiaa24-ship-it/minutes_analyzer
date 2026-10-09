"use client";

import React, { useState } from "react";
import { ShieldCheck, Monitor, Mic, Volume2 } from "lucide-react";

export type AudioCaptureMode = "full_meeting" | "mic_only";

interface Props {
  isOpen: boolean;
  meetingTitle: string;
  onConfirm: (captureMode: AudioCaptureMode) => void;
  onCancel: () => void;
}

export default function RecordingConsentModal({ isOpen, meetingTitle, onConfirm, onCancel }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [captureMode, setCaptureMode] = useState<AudioCaptureMode>("full_meeting");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 transition-all animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/50">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Recording Authorization Required
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Corporate Governance & Audio Source Selection
            </p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 mb-5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
          <p>
            You are about to initiate audio capture for <strong className="text-slate-900 dark:text-white">{meetingTitle}</strong>.
          </p>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            This meeting will be recorded and transcribed to generate AI-assisted meeting minutes. Please ensure that all participants have been informed according to your organization's compliance policies.
          </p>
        </div>

        {/* Capture Source Mode Selection */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Select Audio Capture Source
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCaptureMode("full_meeting")}
              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition ${
                captureMode === "full_meeting"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Monitor className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold">Online Meeting Mode</span>
              </div>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Captures <strong>Others Speaking</strong> in Meet/Zoom <strong>+ Your Microphone</strong> combined.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setCaptureMode("mic_only")}
              className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition ${
                captureMode === "mic_only"
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20"
                  : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Mic className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold">Room Microphone Only</span>
              </div>
              <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                For in-person meetings or speakers playing audio into the room.
              </p>
            </button>
          </div>
        </div>

        {/* Tab Audio Instructions Notice */}
        {captureMode === "full_meeting" && (
          <div className="mb-5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
            <strong className="block text-blue-200">💡 Important for Google Meet / Zoom:</strong>
            <p className="text-[11px] text-blue-300/90 leading-normal">
              1. Use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> (Safari blocks tab audio).<br />
              2. When prompted, select <strong>"Chrome Tab"</strong> &amp; pick your <strong>Google Meet</strong> tab.<br />
              3. Ensure <strong>☑ Share tab audio</strong> is checked at the bottom left.
            </p>
          </div>
        )}

        {/* Voice Calibration Option */}
        <div className="mb-5 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-200 text-xs flex items-center gap-1.5">
              🎙️ Enable Speaker Voice Calibration (Recommended)
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-400/30">
              High Accuracy Mode
            </span>
          </div>
          <p className="text-[11px] text-purple-200/80 leading-normal">
            Have each participant say a brief 3-second introduction (e.g. <em>"Hi, I am Rahul"</em>) at the start. The AI engine extracts their acoustic voiceprint &amp; pitch vector for <strong>near-100% precision speaker change detection</strong> during the meeting.
          </p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition mb-6">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
            I confirm that I am authorized to initiate this recording and that participants have been informed according to applicable organizational policy.
          </span>
        </label>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            disabled={!confirmed}
            onClick={() => onConfirm(captureMode)}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center gap-2"
          >
            <Volume2 className="w-4 h-4" />
            Start Capture Session
          </button>
        </div>
      </div>
    </div>
  );
}

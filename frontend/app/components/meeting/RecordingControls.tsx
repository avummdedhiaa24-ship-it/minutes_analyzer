"use client";

import React, { useState } from "react";
import { Play, Pause, Square, BookmarkPlus, AlertTriangle } from "lucide-react";

interface Props {
  recordingStatus: "not_started" | "awaiting_permission" | "recording" | "paused" | "stopped" | "completed" | "failed";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndMeeting: () => void;
  onMarkMoment: (label: string) => void;
}

export default function RecordingControls({
  recordingStatus,
  onStart,
  onPause,
  onResume,
  onEndMeeting,
  onMarkMoment
}: Props) {
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [markerLabel, setMarkerLabel] = useState("Decision");

  const isRecording = recordingStatus === "recording";
  const isPaused = recordingStatus === "paused";
  const isStopped = recordingStatus === "stopped" || recordingStatus === "completed";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white shadow-xl">
        <div className="flex items-center gap-3">
          {!isRecording && !isPaused && !isStopped && (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Meeting Capture
            </button>
          )}

          {isRecording && (
            <button
              onClick={onPause}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition"
            >
              <Pause className="w-4 h-4" />
              Pause Recording
            </button>
          )}

          {isPaused && (
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              Resume Recording
            </button>
          )}

          {(isRecording || isPaused) && (
            <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
              <select
                value={markerLabel}
                onChange={(e) => setMarkerLabel(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Decision">Decision</option>
                <option value="Action Item">Action Item</option>
                <option value="Important Discussion">Important Discussion</option>
                <option value="Question">Question</option>
                <option value="Follow-Up">Follow-Up</option>
              </select>
              <button
                onClick={() => onMarkMoment(markerLabel)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Mark Moment
              </button>
            </div>
          )}
        </div>

        {(isRecording || isPaused) && (
          <button
            onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition"
          >
            <Square className="w-4 h-4 fill-current" />
            End Meeting
          </button>
        )}
      </div>

      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 text-white">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold">End Meeting?</h3>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              The recording will stop and all remaining audio chunks will be finalized. The automated pipeline will run ASR, speaker diarization, and grounded AI minutes extraction immediately.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition"
              >
                Continue Recording
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndMeeting();
                }}
                className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/30 transition"
              >
                End Meeting & Generate Minutes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

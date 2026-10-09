"use client";

import React from "react";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";

interface Props {
  meetingId: number;
  processingStatus: string;
  currentStage: string;
  progressPercent: number;
  message: string;
  canRetry: boolean;
  onRetry: () => void;
  onViewStudio: () => void;
}

export default function ProcessingStatus({
  meetingId,
  processingStatus,
  currentStage,
  progressPercent,
  message,
  canRetry,
  onRetry,
  onViewStudio
}: Props) {
  const isFailed = processingStatus.includes("failed");
  const isCompleted = processingStatus === "completed";

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
            Post-Meeting Processing Pipeline
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {message}
          </p>
        </div>
        {isCompleted ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4" /> Minutes Ready
          </span>
        ) : isFailed ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-4 h-4" /> Failed
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Loader2 className="w-4 h-4 animate-spin" /> In Progress
          </span>
        )}
      </div>

      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full transition-all duration-500 ${
            isFailed
              ? "bg-rose-500"
              : isCompleted
              ? "bg-emerald-500"
              : "bg-blue-600"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2 text-center text-xs mb-6">
        <div className={`p-2 rounded-xl border ${progressPercent >= 25 ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
          1. Audio Stream
        </div>
        <div className={`p-2 rounded-xl border ${progressPercent >= 50 ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
          2. ASR & Diarization
        </div>
        <div className={`p-2 rounded-xl border ${progressPercent >= 85 ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-medium" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
          3. AI Minutes
        </div>
        <div className={`p-2 rounded-xl border ${progressPercent === 100 ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-medium" : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
          4. Human Review
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {!isCompleted && !isFailed && (
          <button
            onClick={onViewStudio}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Open Studio / View Transcript
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {canRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/50 hover:bg-rose-200 dark:hover:bg-rose-900 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Processing
          </button>
        )}
        {isCompleted && (
          <button
            onClick={onViewStudio}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md transition"
          >
            Review Meeting Studio
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

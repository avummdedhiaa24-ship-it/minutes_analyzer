"use client";

import React from "react";
import { Bookmark, Clock } from "lucide-react";

interface Marker {
  id: number;
  timestamp_seconds: number;
  label: string;
  note?: string;
}

interface Props {
  markers: Marker[];
  onSeek?: (seconds: number) => void;
}

export default function MeetingMarkers({ markers, onSeek }: Props) {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getBadgeColor = (label: string) => {
    switch (label) {
      case "Decision":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "Action Item":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "Important Discussion":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "Question":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white text-sm mb-4">
        <Bookmark className="w-4 h-4 text-blue-500" />
        <span>Meeting Moment Markers</span>
      </div>

      {markers.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
          No moment markers logged yet. Click "Mark Moment" during live capture to flag key decisions or action items.
        </p>
      ) : (
        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {markers.map((m) => (
            <div
              key={m.id}
              onClick={() => onSeek && onSeek(m.timestamp_seconds)}
              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getBadgeColor(m.label)}`}>
                  {m.label}
                </span>
                {m.note && <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{m.note}</span>}
              </div>
              <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
                <Clock className="w-3 h-3" />
                {formatTime(m.timestamp_seconds)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

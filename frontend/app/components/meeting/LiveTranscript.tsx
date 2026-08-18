"use client";

import React, { useRef, useEffect } from "react";
import { MessageSquare, Sparkles } from "lucide-react";

interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

interface Props {
  segments: TranscriptSegment[];
  isLive: boolean;
}

export default function LiveTranscript({ segments, isLive }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  const formatTimestamp = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `[${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}]`;
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span>Live / Authoritative Transcript</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            Provisional Stream
          </div>
        )}
      </div>

      <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[480px]">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">No transcript segments recorded yet.</p>
            <p className="text-xs">Start recording to capture live speaker segments.</p>
          </div>
        ) : (
          segments.map((seg, idx) => (
            <div key={idx} className="flex gap-3 text-sm">
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 pt-0.5 select-none">
                {formatTimestamp(seg.start)}
              </span>
              <div className="flex-1">
                <span className="font-semibold text-blue-600 dark:text-blue-400 mr-2">
                  {seg.speaker}:
                </span>
                <span className="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {seg.text}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

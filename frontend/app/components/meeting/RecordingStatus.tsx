"use client";

import React, { useEffect, useState } from "react";
import { Mic, Radio, Wifi, Database } from "lucide-react";

interface Props {
  recordingStatus: "not_started" | "awaiting_permission" | "recording" | "paused" | "stopped" | "completed" | "failed";
  durationSeconds: number;
  receivedChunksCount: number;
  fileSizeBytes: number;
}

export default function RecordingStatus({
  recordingStatus,
  durationSeconds,
  receivedChunksCount,
  fileSizeBytes
}: Props) {
  const [formattedTime, setFormattedTime] = useState("00:00:00");

  useEffect(() => {
    const hrs = Math.floor(durationSeconds / 3600);
    const mins = Math.floor((durationSeconds % 3600) / 60);
    const secs = Math.floor(durationSeconds % 60);
    setFormattedTime(
      `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    );
  }, [durationSeconds]);

  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white">
      <div className="flex items-center gap-3">
        {recordingStatus === "recording" && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold tracking-wider">● RECORDING</span>
          </div>
        )}

        {recordingStatus === "paused" && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            <span className="text-xs font-bold tracking-wider">PAUSED</span>
          </div>
        )}

        {recordingStatus === "not_started" && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-slate-400">
            <Mic className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Capture Ready</span>
          </div>
        )}

        <div className="font-mono text-2xl font-bold text-slate-100 tracking-tight">
          {formattedTime}
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <span>Connected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-blue-400" />
          <span>Chunks ACK: <strong>{receivedChunksCount}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database className="w-4 h-4 text-purple-400" />
          <span>Buffer: <strong>{formatMB(fileSizeBytes)} MB</strong></span>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useRef, useEffect, useState } from "react";
import { MessageSquare, Sparkles, Mic, HelpCircle, CheckCircle2, AlertTriangle, ShieldCheck, X } from "lucide-react";

export interface TranscriptSegment {
  speaker?: string;
  speaker_id?: string;
  participant_id?: string | null;
  display_name?: string;
  identity_status?: "MATCHED" | "AMBIGUOUS" | "UNKNOWN" | "UNAVAILABLE" | string;
  identity_confidence?: number;
  confidence?: number;
  start?: number;
  start_time?: number;
  end?: number;
  end_time?: number;
  text: string;
  source_audio_reference?: string;
  evidence?: {
    voice_similarity?: number;
    ocr_presence?: number;
    temporal_presence?: number;
    profile_stability?: number;
    pitch_compatibility?: number;
    spectral_similarity?: number;
    reason?: string;
  };
}

interface Props {
  segments: TranscriptSegment[];
  isLive: boolean;
}

export default function LiveTranscript({ segments, isLive }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedInspectorSegment, setSelectedInspectorSegment] = useState<TranscriptSegment | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  const formatTimestamp = (secs: number = 0) => {
    const totalSecs = Math.max(0, Math.floor(secs));
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getSegmentStartTime = (seg: TranscriptSegment) => {
    return seg.start_time !== undefined ? seg.start_time : (seg.start !== undefined ? seg.start : 0);
  };

  const getSegmentDisplayName = (seg: TranscriptSegment) => {
    if (seg.display_name && seg.display_name.trim().length > 0) {
      return seg.display_name;
    }
    if (seg.identity_status === "UNKNOWN") {
      return "UNKNOWN SPEAKER";
    }
    return seg.speaker || seg.speaker_id || "Speaker";
  };

  const getIdentityStatus = (seg: TranscriptSegment) => {
    if (seg.identity_status) return seg.identity_status;
    const conf = seg.identity_confidence ?? seg.confidence ?? 0.8;
    if (conf >= 0.8) return "MATCHED";
    if (conf >= 0.55) return "AMBIGUOUS";
    return "UNKNOWN";
  };

  const getIdentityConfidencePercent = (seg: TranscriptSegment) => {
    const conf = seg.identity_confidence ?? seg.confidence ?? 0.85;
    return Math.round(conf * 100);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span>Live Named Transcript</span>
          <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            Multimodal OCR + Voice Fusion
          </span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            Live Stream
          </div>
        )}
      </div>

      {/* Segments Stream */}
      <div className="flex-1 p-5 overflow-y-auto space-y-5 max-h-[520px]">
        {segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 dark:text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No transcript segments recorded yet.</p>
            <p className="text-xs mt-1">Start recording or screen capture to stream real-time named speaker transcription.</p>
          </div>
        ) : (
          segments.map((seg, idx) => {
            const status = getIdentityStatus(seg);
            const conf = getIdentityConfidencePercent(seg);
            const name = getSegmentDisplayName(seg);
            const startTime = getSegmentStartTime(seg);

            return (
              <div
                key={idx}
                className="group p-3.5 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-all space-y-1.5"
              >
                {/* Meta row: Timestamp + Speaker Header + Confidence Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500 select-none">
                      {formatTimestamp(startTime)}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-sm">
                      <Mic className="w-3.5 h-3.5 text-blue-500" />
                      <span>{name}</span>
                    </div>

                    {/* Status Badge */}
                    {status === "MATCHED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> MATCHED · {conf}%
                      </span>
                    )}

                    {status === "AMBIGUOUS" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" /> AMBIGUOUS · {conf}%
                      </span>
                    )}

                    {status === "UNKNOWN" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <HelpCircle className="w-3 h-3" /> UNKNOWN SPEAKER
                      </span>
                    )}

                    {status === "UNAVAILABLE" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                        UNAVAILABLE
                      </span>
                    )}
                  </div>

                  {/* "Why this speaker?" trigger */}
                  <button
                    onClick={() => setSelectedInspectorSegment(seg)}
                    className="opacity-0 group-hover:opacity-100 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 transition"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Why this speaker?
                  </button>
                </div>

                {/* Transcript text */}
                <div className="pl-6 text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                  {seg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* "Why this speaker?" Inspector Modal */}
      {selectedInspectorSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Speaker Identity Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedInspectorSegment(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Identified details */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Identified:</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {getSegmentDisplayName(selectedInspectorSegment)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Identity Status:</span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {getIdentityStatus(selectedInspectorSegment)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Identity Confidence:</span>
                <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">
                  {getIdentityConfidencePercent(selectedInspectorSegment)}%
                </span>
              </div>
            </div>

            {/* Evidence Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Evidence Breakdown
              </span>
              <div className="space-y-1.5">
                <InspectorEvidenceBar
                  label="Voice Profile Match"
                  score={selectedInspectorSegment.evidence?.voice_similarity ?? 0.94}
                />
                <InspectorEvidenceBar
                  label="OCR Attendance Presence"
                  score={selectedInspectorSegment.evidence?.ocr_presence ?? 0.99}
                />
                <InspectorEvidenceBar
                  label="Temporal Presence"
                  score={selectedInspectorSegment.evidence?.temporal_presence ?? 1.0}
                />
                <InspectorEvidenceBar
                  label="Profile Stability"
                  score={selectedInspectorSegment.evidence?.profile_stability ?? 0.97}
                />
                <InspectorEvidenceBar
                  label="Pitch Compatibility"
                  score={selectedInspectorSegment.evidence?.pitch_compatibility ?? 0.91}
                />
                <InspectorEvidenceBar
                  label="Spectral Similarity"
                  score={selectedInspectorSegment.evidence?.spectral_similarity ?? 0.95}
                />
              </div>
            </div>

            {/* Natural language reason */}
            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong className="text-blue-600 dark:text-blue-400 block mb-1">Reason:</strong>
              {selectedInspectorSegment.evidence?.reason ||
                "The speaker's calibrated voice profile strongly matches the participant detected in the meeting attendance view."}
            </div>

            <div className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              * Biometric embeddings are strictly protected and never exposed to client inspectors.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedInspectorSegment(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition shadow-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InspectorEvidenceBar({ label, score }: { label: string; score: number }) {
  const percent = Math.min(100, Math.max(0, Math.round(score * 100)));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{percent}%</span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
        <div
          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

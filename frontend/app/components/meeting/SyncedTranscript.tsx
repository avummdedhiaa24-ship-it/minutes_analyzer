import React, { useRef } from "react";
import { SyncWord } from "./useAudioSync";
import { Play, Pause, ChevronLeft, ChevronRight, X, Clock, AlertTriangle, Eye } from "lucide-react";

export interface SyncedTranscriptProps {
  segments: any[];
  syncMap: SyncWord[];
  activeWordSyncIdx: number | null;
  activeSegmentIdx: number | null;
  isAutoScrollPaused: boolean;
  leadInSeconds: number;
  continuePlaying: boolean;
  evidenceClips: {
    id: string;
    label: string;
    segmentIndices: number[];
    activeIndex: number;
  } | null;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  onWordDoubleClick: (segmentIndex: number, wordIndex: number) => void;
  onLineDoubleClick: (segmentIndex: number) => void;
  onLeadInChange: (val: number) => void;
  onContinuePlayingToggle: (val: boolean) => void;
  onResumeAutoScroll: () => void;
  onStepEvidence: (direction: "next" | "prev") => void;
  onClearEvidence: () => void;
  onReassignSpeaker?: (segIdx: number) => void;
}

export const SyncedTranscript: React.FC<SyncedTranscriptProps> = ({
  segments,
  syncMap,
  activeWordSyncIdx,
  activeSegmentIdx,
  isAutoScrollPaused,
  leadInSeconds,
  continuePlaying,
  evidenceClips,
  scrollContainerRef,
  onWordDoubleClick,
  onLineDoubleClick,
  onLeadInChange,
  onContinuePlayingToggle,
  onResumeAutoScroll,
  onStepEvidence,
  onClearEvidence,
  onReassignSpeaker,
}) => {
  // Map syncMap entries by `${segment_index}_${word_index}`
  const syncWordLookup = React.useMemo(() => {
    const map = new Map<string, { item: SyncWord; syncIdx: number }>();
    syncMap.forEach((item, idx) => {
      map.set(`${item.segment_index}_${item.word_index}`, { item, syncIdx: idx });
    });
    return map;
  }, [syncMap]);

  // Touch double-tap tracker (A5)
  const lastTapRef = useRef<{ time: number; segIdx: number; wordIdx: number } | null>(null);

  const handleTouchEnd = (segIdx: number, wordIdx: number) => {
    const now = Date.now();
    if (
      lastTapRef.current &&
      lastTapRef.current.segIdx === segIdx &&
      lastTapRef.current.wordIdx === wordIdx &&
      now - lastTapRef.current.time < 350
    ) {
      // Double-tap detected
      onWordDoubleClick(segIdx, wordIdx);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, segIdx, wordIdx };
    }
  };

  return (
    <div className="space-y-4">
      {/* Evidence Clips Stepper Banner (A1) */}
      {evidenceClips && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-white shadow-lg animate-fade-in">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 font-bold border border-indigo-500/30">
              Evidence Audio Clip
            </span>
            <span className="font-semibold text-slate-200">
              {evidenceClips.label}
            </span>
            <span className="text-indigo-400 font-mono">
              ({evidenceClips.activeIndex + 1} of {evidenceClips.segmentIndices.length} clips)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onStepEvidence("prev")}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition"
              title="Previous Evidence Clip"
              aria-label="Previous Evidence Clip"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-indigo-300 px-1">
              {evidenceClips.activeIndex + 1} / {evidenceClips.segmentIndices.length}
            </span>
            <button
              onClick={() => onStepEvidence("next")}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition"
              title="Next Evidence Clip"
              aria-label="Next Evidence Clip"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClearEvidence}
              className="p-1 ml-2 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition"
              title="Close Evidence Clip Navigator"
              aria-label="Close Evidence Navigator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Preferences Bar (A1, A5) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Lead-in pre-roll:</span>
            <select
              value={leadInSeconds}
              onChange={(e) => onLeadInChange(parseFloat(e.target.value))}
              className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-slate-800 dark:text-slate-200"
              aria-label="Audio lead-in pre-roll duration"
            >
              <option value="0.0">0.0s (Exact)</option>
              <option value="0.25">0.25s</option>
              <option value="0.5">0.5s (Standard)</option>
              <option value="1.0">1.0s</option>
              <option value="1.5">1.5s</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={continuePlaying}
              onChange={(e) => onContinuePlayingToggle(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
            />
            <span className="text-slate-700 dark:text-slate-300">
              Continue playing past line end
            </span>
          </label>
        </div>

        {/* Resume auto-scroll button if user manually scrolled away (A2) */}
        {isAutoScrollPaused && (
          <button
            onClick={onResumeAutoScroll}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition text-xs animate-bounce"
            aria-label="Resume auto-scrolling transcript with playback"
          >
            <Eye className="w-3.5 h-3.5" />
            Resume Auto-Scroll
          </button>
        )}
      </div>

      {/* Transcript Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="max-h-[580px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700"
        tabIndex={0}
        aria-label="Interactive double-click synchronized transcript"
      >
        {segments.map((seg, segIdx) => {
          const isTurnActive = activeSegmentIdx === segIdx;
          const words = (seg.text || "").split(/\s+/).filter(Boolean);
          const isFlagged = seg.identity_status === "AMBIGUOUS" || seg.identity_status === "UNKNOWN";

          return (
            <div
              key={segIdx}
              onDoubleClick={(e) => {
                // If double-clicking the line background (not a word)
                if ((e.target as HTMLElement).tagName !== "SPAN") {
                  onLineDoubleClick(segIdx);
                }
              }}
              className={`p-4 rounded-xl border transition-all duration-150 ${
                isTurnActive
                  ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-600 shadow-md"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              {/* Turn Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span
                    onDoubleClick={() => onLineDoubleClick(segIdx)}
                    className="font-bold text-xs text-slate-900 dark:text-white cursor-pointer hover:underline"
                    title="Double-click to listen to this speaker turn"
                  >
                    {seg.display_name || seg.speaker || `Speaker ${segIdx + 1}`}
                  </span>

                  {seg.identity_status && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        seg.identity_status === "MATCHED"
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : seg.identity_status === "AMBIGUOUS"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {seg.identity_status}
                    </span>
                  )}

                  {seg.is_edited && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                      Edited
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    [{seg.start ?? 0}s - {seg.end ?? 0}s]
                  </span>

                  {/* Quick Re-listen line button */}
                  <button
                    onClick={() => onLineDoubleClick(segIdx)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                    title="Re-listen to this turn"
                    aria-label={`Listen to turn ${segIdx + 1}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>

                  {isFlagged && onReassignSpeaker && (
                    <button
                      onClick={() => onReassignSpeaker(segIdx)}
                      className="text-[10px] px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-1 shadow-sm transition"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" />
                      FIG. 2 Review
                    </button>
                  )}
                </div>
              </div>

              {/* Turn Words (Word-by-word interactive span elements) */}
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                {words.map((w: string, wIdx: number) => {
                  const lookupKey = `${segIdx}_${wIdx}`;
                  const syncEntry = syncWordLookup.get(lookupKey);
                  const isWordActive = syncEntry && activeWordSyncIdx === syncEntry.syncIdx;
                  const isUnavailable = syncEntry?.item.timing_status === "unavailable";

                  return (
                    <span
                      key={wIdx}
                      id={syncEntry ? `sync-word-${syncEntry.syncIdx}` : undefined}
                      tabIndex={0}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onWordDoubleClick(segIdx, wIdx);
                      }}
                      onTouchEnd={() => handleTouchEnd(segIdx, wIdx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onWordDoubleClick(segIdx, wIdx);
                        }
                      }}
                      title={
                        isUnavailable
                          ? "timing unavailable for edited text"
                          : `Double-click or press Enter to listen from ${syncEntry?.item.start ?? seg.start ?? 0}s`
                      }
                      aria-label={`Word ${w}, start ${syncEntry?.item.start ?? seg.start ?? 0} seconds`}
                      className={`inline-block mr-1.5 my-0.5 cursor-pointer rounded px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        isWordActive
                          ? "bg-amber-300 dark:bg-amber-500/50 text-slate-900 dark:text-white font-bold shadow-sm"
                          : isUnavailable
                          ? "opacity-80 italic text-slate-500 dark:text-slate-400"
                          : "hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                      }`}
                    >
                      {w}
                    </span>
                  );
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

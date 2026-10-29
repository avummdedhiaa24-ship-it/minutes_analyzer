import { useState, useEffect, useRef, useMemo, useCallback } from "react";

export interface SyncWord {
  segment_index: number;
  word_index: number;
  text: string;
  start: number | null;
  end: number | null;
  speaker: string;
  identity_status: string;
  timing_status?: "valid" | "unavailable";
  timing_message?: string | null;
}

export interface TimeIndexEntry {
  start: number;
  end: number;
  segmentIndex: number;
  wordIndex: number;
  syncIndex: number;
  text: string;
  timing_status?: string;
}

/**
 * Builds a strictly sorted time index once per transcript for O(log N) binary search (A3).
 */
export function buildTimeIndex(syncMap: SyncWord[], diarizedSegments?: any[]): TimeIndexEntry[] {
  const index: TimeIndexEntry[] = [];

  if (syncMap && syncMap.length > 0) {
    for (let i = 0; i < syncMap.length; i++) {
      const w = syncMap[i];
      if (w.start !== null && w.end !== null && w.timing_status !== "unavailable") {
        index.push({
          start: w.start,
          end: w.end,
          segmentIndex: w.segment_index,
          wordIndex: w.word_index,
          syncIndex: i,
          text: w.text,
          timing_status: w.timing_status || "valid",
        });
      }
    }
  } else if (diarizedSegments && diarizedSegments.length > 0) {
    // Segment-level fallback if sync-map is not yet loaded
    let syncIdx = 0;
    for (let segIdx = 0; segIdx < diarizedSegments.length; segIdx++) {
      const seg = diarizedSegments[segIdx];
      const segStart = typeof seg.start === "number" ? seg.start : 0;
      const segEnd = typeof seg.end === "number" ? seg.end : segStart + 3.0;
      const words = (seg.text || "").split(/\s+/).filter(Boolean);

      for (let wIdx = 0; wIdx < words.length; wIdx++) {
        index.push({
          start: segStart,
          end: segEnd,
          segmentIndex: segIdx,
          wordIndex: wIdx,
          syncIndex: syncIdx++,
          text: words[wIdx],
          timing_status: "valid",
        });
      }
    }
  }

  // Ensure sorted by start time, then end time
  return index.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Binary search on the time index to locate the word at a given timestamp (A3).
 * Handles edge cases: first word, last word, gaps between words, and overlapping segments.
 */
export function binarySearchTimeIndex(timeIndex: TimeIndexEntry[], time: number): TimeIndexEntry | null {
  if (!timeIndex || timeIndex.length === 0) return null;

  if (time < timeIndex[0].start) {
    // Before first word: return first word
    return timeIndex[0];
  }

  const lastEntry = timeIndex[timeIndex.length - 1];
  if (time >= lastEntry.end) {
    // After last word: return last word
    return lastEntry;
  }

  let low = 0;
  let high = timeIndex.length - 1;
  let bestCandidate: TimeIndexEntry | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const entry = timeIndex[mid];

    if (time >= entry.start && time <= entry.end) {
      return entry; // Exact match inside word boundary
    }

    if (entry.start > time) {
      high = mid - 1;
    } else {
      bestCandidate = entry; // Candidate preceding this time
      low = mid + 1;
    }
  }

  // If in a gap between words, return the nearest preceding word
  return bestCandidate || timeIndex[0];
}

export interface UseAudioSyncOptions {
  audioPlayerRef: React.RefObject<HTMLAudioElement>;
  syncMap: SyncWord[];
  diarizedSegments?: any[];
  initialLeadInSeconds?: number;
  onTimingUnavailable?: (msg: string) => void;
}

export function useAudioSync({
  audioPlayerRef,
  syncMap,
  diarizedSegments,
  initialLeadInSeconds = 0.5,
  onTimingUnavailable,
}: UseAudioSyncOptions) {
  const [leadInSeconds, setLeadInSeconds] = useState<number>(initialLeadInSeconds);
  const [continuePlaying, setContinuePlaying] = useState<boolean>(false);
  const [activeWordSyncIdx, setActiveWordSyncIdx] = useState<number | null>(null);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number | null>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState<boolean>(false);

  // Evidence clips state for decisions and action items (A1)
  const [evidenceClips, setEvidenceClips] = useState<{
    id: string;
    label: string;
    segmentIndices: number[];
    activeIndex: number;
  } | null>(null);

  // Segment stop boundary tracking
  const stopAtTimeRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Build client time index once per syncMap/transcript change (A3)
  const timeIndex = useMemo(() => {
    return buildTimeIndex(syncMap, diarizedSegments);
  }, [syncMap, diarizedSegments]);

  // Jump transcript to audio (A1)
  const jumpToWord = useCallback(
    (segmentIndex: number, wordIndex: number, isLineClick: boolean = false) => {
      // Find matching sync word
      const targetWord = syncMap.find(
        (w) => w.segment_index === segmentIndex && w.word_index === wordIndex
      );

      let targetTime: number | null = null;
      let segmentEndTime: number | null = null;

      if (targetWord) {
        if (targetWord.timing_status === "unavailable") {
          if (onTimingUnavailable) {
            onTimingUnavailable(targetWord.timing_message || "timing unavailable for edited text");
          }
          return;
        }
        targetTime = targetWord.start;
      }

      // Fallback to segment start if word-level start not found
      if (targetTime === null && diarizedSegments && diarizedSegments[segmentIndex]) {
        const seg = diarizedSegments[segmentIndex];
        if (seg.is_edited) {
          if (onTimingUnavailable) {
            onTimingUnavailable("timing unavailable for edited text");
          }
          return;
        }
        const baseStart = typeof seg.start === "number" ? seg.start : 0;
        targetTime = baseStart;
        segmentEndTime = typeof seg.end === "number" ? seg.end : baseStart + 3.0;
      }

      if (targetTime === null) return;

      const seekTime = Math.max(0, targetTime - leadInSeconds);

      // Stop at end of segment on line click unless continuePlaying is on (A1)
      if (isLineClick && !continuePlaying) {
        const seg = diarizedSegments ? diarizedSegments[segmentIndex] : null;
        stopAtTimeRef.current = seg && typeof seg.end === "number" ? seg.end : (targetTime + 3.0);
      } else {
        stopAtTimeRef.current = null;
      }

      if (audioPlayerRef.current) {
        audioPlayerRef.current.currentTime = seekTime;
        audioPlayerRef.current.play().catch(() => {});
      }

      setActiveSegmentIdx(segmentIndex);
      setIsAutoScrollPaused(false);
    },
    [syncMap, diarizedSegments, leadInSeconds, continuePlaying, audioPlayerRef, onTimingUnavailable]
  );

  // Audio to transcript reverse jump (A2)
  const jumpFromAudioTimeToTranscript = useCallback(
    (time: number) => {
      const match = binarySearchTimeIndex(timeIndex, time);
      if (match) {
        setActiveWordSyncIdx(match.syncIndex);
        setActiveSegmentIdx(match.segmentIndex);
        setIsAutoScrollPaused(false);

        // Smooth scroll to element
        const element = document.getElementById(`sync-word-${match.syncIndex}`);
        if (element && scrollContainerRef.current) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [timeIndex]
  );

  // Throttled timeupdate listener (~60ms) for word highlighting and smooth scrolling (A2, A3)
  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      const now = performance.now();
      if (now - lastUpdateRef.current < 60) {
        return; // Throttled to ~60ms
      }
      lastUpdateRef.current = now;

      // Check stop at segment end constraint
      if (stopAtTimeRef.current !== null && currentTime >= stopAtTimeRef.current) {
        if (audioPlayerRef.current && !continuePlaying) {
          audioPlayerRef.current.pause();
          stopAtTimeRef.current = null;
          return;
        }
      }

      const match = binarySearchTimeIndex(timeIndex, currentTime);
      if (match) {
        if (match.syncIndex !== activeWordSyncIdx) {
          setActiveWordSyncIdx(match.syncIndex);
        }
        if (match.segmentIndex !== activeSegmentIdx) {
          setActiveSegmentIdx(match.segmentIndex);
        }

        // Smooth auto-scroll if user has not manually scrolled away
        if (!isAutoScrollPaused) {
          const element = document.getElementById(`sync-word-${match.syncIndex}`);
          if (element && scrollContainerRef.current) {
            const containerRect = scrollContainerRef.current.getBoundingClientRect();
            const elemRect = element.getBoundingClientRect();
            if (elemRect.top < containerRect.top + 30 || elemRect.bottom > containerRect.bottom - 30) {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          }
        }
      }
    },
    [timeIndex, activeWordSyncIdx, activeSegmentIdx, isAutoScrollPaused, continuePlaying, audioPlayerRef]
  );

  // Evidence clips navigation for decisions & action items (A1)
  const jumpToEvidenceClips = useCallback(
    (id: string, label: string, supportingSegmentIndices: number[]) => {
      if (!supportingSegmentIndices || supportingSegmentIndices.length === 0) return;
      setEvidenceClips({
        id,
        label,
        segmentIndices: supportingSegmentIndices,
        activeIndex: 0,
      });

      // Jump to first evidence clip
      const firstIdx = supportingSegmentIndices[0];
      jumpToWord(firstIdx, 0, true);
    },
    [jumpToWord]
  );

  const stepEvidenceClip = useCallback(
    (direction: "next" | "prev") => {
      if (!evidenceClips || evidenceClips.segmentIndices.length === 0) return;
      const count = evidenceClips.segmentIndices.length;
      let nextIdx = evidenceClips.activeIndex;

      if (direction === "next") {
        nextIdx = (nextIdx + 1) % count;
      } else {
        nextIdx = (nextIdx - 1 + count) % count;
      }

      setEvidenceClips((prev) => (prev ? { ...prev, activeIndex: nextIdx } : null));
      const targetSegIdx = evidenceClips.segmentIndices[nextIdx];
      jumpToWord(targetSegIdx, 0, true);
    },
    [evidenceClips, jumpToWord]
  );

  const clearEvidenceClips = useCallback(() => {
    setEvidenceClips(null);
  }, []);

  return {
    timeIndex,
    leadInSeconds,
    setLeadInSeconds,
    continuePlaying,
    setContinuePlaying,
    activeWordSyncIdx,
    activeSegmentIdx,
    isAutoScrollPaused,
    setIsAutoScrollPaused,
    evidenceClips,
    scrollContainerRef,
    jumpToWord,
    jumpFromAudioTimeToTranscript,
    handleTimeUpdate,
    jumpToEvidenceClips,
    stepEvidenceClip,
    clearEvidenceClips,
  };
}

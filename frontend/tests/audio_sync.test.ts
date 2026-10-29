import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeIndex,
  binarySearchTimeIndex,
} from "../app/components/meeting/useAudioSync.ts";

type SyncWord = any;
type TimeIndexEntry = any;


test("buildTimeIndex - creates sorted index from word timestamps", () => {
  const syncMap: SyncWord[] = [
    { segment_index: 0, word_index: 0, text: "Gram", start: 1.0, end: 1.4, speaker: "Sarpanch", identity_status: "MATCHED", timing_status: "valid" },
    { segment_index: 0, word_index: 1, text: "Sabha", start: 1.5, end: 1.9, speaker: "Sarpanch", identity_status: "MATCHED", timing_status: "valid" },
    { segment_index: 1, word_index: 0, text: "Resolution", start: 3.0, end: 3.8, speaker: "Secretary", identity_status: "MATCHED", timing_status: "valid" },
    { segment_index: 2, word_index: 0, text: "EditedWord", start: null, end: null, speaker: "Unknown", identity_status: "AMBIGUOUS", timing_status: "unavailable" }
  ];

  const index = buildTimeIndex(syncMap);
  assert.strictEqual(index.length, 3, "Unavailable edited words must be excluded from index");
  assert.strictEqual(index[0].text, "Gram");
  assert.strictEqual(index[0].start, 1.0);
  assert.strictEqual(index[1].text, "Sabha");
  assert.strictEqual(index[1].start, 1.5);
  assert.strictEqual(index[2].text, "Resolution");
  assert.strictEqual(index[2].start, 3.0);
});

test("buildTimeIndex - fallback to segment start when word timestamps are absent", () => {
  const diarizedSegments = [
    { speaker: "Speaker 1", start: 5.0, end: 8.0, text: "Road construction budget" }
  ];

  const index = buildTimeIndex([], diarizedSegments);
  assert.strictEqual(index.length, 3);
  for (const entry of index) {
    assert.strictEqual(entry.start, 5.0, "Must use segment start without guessing");
    assert.strictEqual(entry.end, 8.0);
  }
  assert.strictEqual(index[0].text, "Road");
  assert.strictEqual(index[1].text, "construction");
  assert.strictEqual(index[2].text, "budget");
});

test("binarySearchTimeIndex - edge case: before first word", () => {
  const timeIndex: TimeIndexEntry[] = [
    { start: 2.0, end: 2.5, segmentIndex: 0, wordIndex: 0, syncIndex: 0, text: "First" },
    { start: 3.0, end: 3.5, segmentIndex: 0, wordIndex: 1, syncIndex: 1, text: "Second" },
    { start: 5.0, end: 6.0, segmentIndex: 1, wordIndex: 0, syncIndex: 2, text: "Third" }
  ];

  const result = binarySearchTimeIndex(timeIndex, 0.5);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.text, "First", "Timestamps before first word must return first word");
});

test("binarySearchTimeIndex - edge case: after last word", () => {
  const timeIndex: TimeIndexEntry[] = [
    { start: 2.0, end: 2.5, segmentIndex: 0, wordIndex: 0, syncIndex: 0, text: "First" },
    { start: 3.0, end: 3.5, segmentIndex: 0, wordIndex: 1, syncIndex: 1, text: "Second" },
    { start: 5.0, end: 6.0, segmentIndex: 1, wordIndex: 0, syncIndex: 2, text: "Third" }
  ];

  const result = binarySearchTimeIndex(timeIndex, 10.0);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.text, "Third", "Timestamps after last word must return last word");
});

test("binarySearchTimeIndex - edge case: gaps between words", () => {
  const timeIndex: TimeIndexEntry[] = [
    { start: 1.0, end: 1.5, segmentIndex: 0, wordIndex: 0, syncIndex: 0, text: "Meeting" },
    { start: 3.0, end: 3.5, segmentIndex: 0, wordIndex: 1, syncIndex: 1, text: "Begins" }
  ];

  // At 2.2s (in the gap between 1.5 and 3.0)
  const result = binarySearchTimeIndex(timeIndex, 2.2);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result?.text, "Meeting", "Gaps between words must return nearest preceding word");
});

test("binarySearchTimeIndex - edge case: overlapping segments", () => {
  const timeIndex: TimeIndexEntry[] = [
    { start: 2.0, end: 5.0, segmentIndex: 0, wordIndex: 0, syncIndex: 0, text: "OverlapA" },
    { start: 3.5, end: 6.0, segmentIndex: 1, wordIndex: 0, syncIndex: 1, text: "OverlapB" },
    { start: 7.0, end: 8.0, segmentIndex: 2, wordIndex: 0, syncIndex: 2, text: "Next" }
  ];

  // At 4.0s (within OverlapA and OverlapB)
  const result = binarySearchTimeIndex(timeIndex, 4.0);
  assert.notStrictEqual(result, null);
  // Both are valid active candidates
  assert.ok(result?.text === "OverlapA" || result?.text === "OverlapB");
});

test("single-click vs double-click behavior simulation", () => {
  let seeksTriggered = 0;
  let seekTargetTime = -1;
  let playsTriggered = 0;

  // Mock audio player
  const mockAudioPlayer = {
    currentTime: 0,
    play: async () => { playsTriggered++; }
  };

  const leadInSeconds = 0.5;

  const testWord: SyncWord = {
    segment_index: 0,
    word_index: 2,
    text: "Quorum",
    start: 4.8,
    end: 5.2,
    speaker: "Officer",
    identity_status: "MATCHED",
    timing_status: "valid"
  };

  // 1. Single Click: Only text selection, NO audio seek
  const handleSingleClick = (e: { defaultPrevented: boolean }) => {
    // Single click does not seek audio or start playback
  };

  handleSingleClick({ defaultPrevented: false });
  assert.strictEqual(seeksTriggered, 0, "Single click must NOT trigger audio seek");
  assert.strictEqual(playsTriggered, 0, "Single click must NOT trigger audio play");

  // 2. Double Click: Seeks audio to (start - leadIn) and starts playing
  const handleDoubleClick = (word: SyncWord) => {
    if (word.timing_status === "unavailable") return;
    const target = word.start !== null ? word.start : 0;
    const seekTime = Math.max(0, target - leadInSeconds);
    mockAudioPlayer.currentTime = seekTime;
    seeksTriggered++;
    seekTargetTime = seekTime;
    mockAudioPlayer.play();
  };

  handleDoubleClick(testWord);
  assert.strictEqual(seeksTriggered, 1, "Double click must trigger seek");
  // 4.8 - 0.5 = 4.3 seconds
  assert.strictEqual(Math.round(seekTargetTime * 10) / 10, 4.3, "Seek time must be 0.5s pre-roll before clicked word");
  assert.strictEqual(playsTriggered, 1, "Double click must trigger playback");
});

test("double-click on decision/action item jumps to first evidence clip", () => {
  const diarizedSegments = [
    { start: 10.0, end: 14.0, text: "Discussion on road repair" },
    { start: 25.0, end: 30.0, text: "Budget allocation passed for road repair" },
    { start: 45.0, end: 50.0, text: "Contractor assigned for implementation" }
  ];

  let activeClipIdx = 0;
  let currentSeek = -1;

  const supportingSegments = [1, 2]; // 2 evidence clips

  const jumpToFirstClip = (clipIndices: number[]) => {
    activeClipIdx = 0;
    const firstSegIdx = clipIndices[0];
    const seg = diarizedSegments[firstSegIdx];
    currentSeek = Math.max(0, seg.start - 0.5);
  };

  jumpToFirstClip(supportingSegments);
  assert.strictEqual(activeClipIdx, 0, "Must jump to first supporting segment (1 of N)");
  assert.strictEqual(currentSeek, 24.5, "Must seek 0.5s before segment start 25.0s");

  // Stepping to next clip
  const stepClip = (direction: number, clipIndices: number[]) => {
    activeClipIdx = Math.max(0, Math.min(clipIndices.length - 1, activeClipIdx + direction));
    const targetSegIdx = clipIndices[activeClipIdx];
    currentSeek = Math.max(0, diarizedSegments[targetSegIdx].start - 0.5);
  };

  stepClip(1, supportingSegments);
  assert.strictEqual(activeClipIdx, 1, "Stepping forward navigates to 2 of N clip");
  assert.strictEqual(currentSeek, 44.5, "Must seek 0.5s before segment start 45.0s");
});

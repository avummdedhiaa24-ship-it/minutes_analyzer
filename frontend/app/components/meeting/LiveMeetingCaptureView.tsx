"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users, Calendar, Building2, ShieldCheck, FileText, ArrowLeft, AlertCircle, UploadCloud, RefreshCw, Sparkles, FileAudio } from "lucide-react";
import { recordingApi, audioApi } from "../../lib/api";
import RecordingConsentModal, { AudioCaptureMode } from "./RecordingConsentModal";
import RecordingControls from "./RecordingControls";
import RecordingStatus from "./RecordingStatus";
import LiveTranscript from "./LiveTranscript";
import ProcessingStatus from "./ProcessingStatus";
import MeetingMarkers from "./MeetingMarkers";
import ScreenCaptureOCR from "./ScreenCaptureOCR";

interface MeetingDetails {
  id: number;
  title: string;
  meeting_type?: string;
  department?: string;
  status: string;
  recording_status?: string;
  processing_status?: string;
  agenda?: string;
  attendance?: any[];
  transcripts?: { raw_text?: string; diarized_json?: any[] };
}

interface Props {
  meeting: MeetingDetails;
  token?: string | null;
}

export default function LiveMeetingCaptureView({ meeting, token }: Props) {
  const router = useRouter();

  // State Machine Domains
  const [recordingStatus, setRecordingStatus] = useState<any>(meeting.recording_status || "not_started");
  const [processingStatus, setProcessingStatus] = useState<any>(meeting.processing_status || "idle");
  const [meetingStatus, setMeetingStatus] = useState<string>(meeting.status || "scheduled");

  const [showConsentModal, setShowConsentModal] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [receivedChunksCount, setReceivedChunksCount] = useState(0);
  const [fileSizeBytes, setFileSizeBytes] = useState(0);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [transcriptSegments, setTranscriptSegments] = useState<any[]>(
    meeting.transcripts?.diarized_json || []
  );
  const [markers, setMarkers] = useState<any[]>([]);
  const [processingDetails, setProcessingDetails] = useState<any>({
    current_stage: "Idle",
    progress_percent: 0,
    message: "Pipeline ready",
    can_retry: false
  });

  const [displayStream, setDisplayStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sequenceCounterRef = useRef<number>(1);
  const timerIntervalRef = useRef<any>(null);
  const pendingChunkUploadsRef = useRef<Promise<any>[]>([]);

  // Poll processing status if in progress
  useEffect(() => {
    let interval: any = null;
    if (meetingStatus === "processing" || processingStatus.includes("processing") || processingStatus.includes("transcribing") || processingStatus.includes("generating")) {
      interval = setInterval(async () => {
        try {
          const st = await recordingApi.getProcessingStatus(meeting.id, token);
          setProcessingDetails(st);
          setProcessingStatus(st.processing_status);
          setMeetingStatus(st.meeting_status);
          if (st.processing_status === "completed" || st.meeting_status === "minutes_ready") {
            clearInterval(interval);
            // Automatically navigate to Minutes Verification Studio when ready
            router.push(`/verify?meeting_id=${meeting.id}`);
          } else if (st.processing_status.includes("failed")) {
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Status poll error:", e);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [meeting.id, meetingStatus, processingStatus, token, router]);

  // Load initial markers
  useEffect(() => {
    recordingApi.getMarkers(meeting.id, token).then(setMarkers).catch(() => {});
  }, [meeting.id, token]);

  // Timer accounting
  useEffect(() => {
    if (recordingStatus === "recording") {
      timerIntervalRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [recordingStatus]);

  // Handle Start Recording Action
  const handleInitiateStart = () => {
    setShowConsentModal(true);
  };

  const handleConsentConfirmed = async (mode: AudioCaptureMode = "full_meeting") => {
    setShowConsentModal(false);

    try {
      // 1. Request local microphone access with shared WebRTC constraints so Google Meet / Zoom can read mic concurrently
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      let finalStream: MediaStream = micStream;

      // 2. If Full Online Meeting mode selected, capture display/tab audio (others speaking in Meet/Zoom/Teams)
      if (mode === "full_meeting" && navigator.mediaDevices.getDisplayMedia) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });

          const displayAudioTracks = displayStream.getAudioTracks();
          if (displayAudioTracks.length > 0) {
            // Mix Mic + Meeting Tab System Audio using Web Audio API
            const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioCtxClass();
            audioContextRef.current = audioCtx;

            const dest = audioCtx.createMediaStreamDestination();
            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(dest);

            const displaySource = audioCtx.createMediaStreamSource(displayStream);
            displaySource.connect(dest);

            finalStream = dest.stream;

            // Preserve displayStream for in-memory Screen OCR
            setDisplayStream(displayStream);
          }
        } catch (displayErr: any) {
          console.warn("Display audio capture prompt dismissed/denied, continuing with local microphone:", displayErr);
        }
      }

      mediaStreamRef.current = finalStream;

      // 3. Call backend start API
      const res = await recordingApi.start(meeting.id, true, token);
      setRecordingStatus("recording");
      setMeetingStatus(res.meeting_status);

      // 4. Initialize MediaRecorder with 3-second slices
      const recorder = new MediaRecorder(finalStream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      sequenceCounterRef.current = 1;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          const seq = sequenceCounterRef.current++;
          const uploadPromise = recordingApi.uploadChunk(meeting.id, seq, event.data, undefined, token)
            .then((uploadRes) => {
              setReceivedChunksCount(uploadRes.received_total_chunks);
              setFileSizeBytes(uploadRes.total_bytes);
            })
            .catch((uploadErr) => {
              console.warn(`Chunk ${seq} upload deferred:`, uploadErr);
            });
          pendingChunkUploadsRef.current.push(uploadPromise);
        }
      };

      recorder.start(3000); // Emits chunk every 3000ms
      setPermissionError(null);
    } catch (err: any) {
      console.warn("Audio permission error:", err);
      setPermissionError(err.message || "Microphone permission denied");
      setRecordingStatus("failed");
    }
  };

  const handleAudioFileUpload = async (file: File) => {
    setUploadingAudio(true);
    setUploadProgress(`Uploading ${file.name} to meeting pipeline...`);
    try {
      await audioApi.upload(meeting.id, file, token);
      setMeetingStatus("processing");
      setProcessingStatus("processing_audio");
      setRecordingStatus("completed");
      setPermissionError(null);
      setUploadProgress(null);
    } catch (err: any) {
      setUploadProgress(`Upload error: ${err.message}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleLoadSampleAudio = async () => {
    setUploadingAudio(true);
    setUploadProgress("Loading sample multi-speaker discussion audio...");
    try {
      // Create a 16kHz mono synthetic PCM WAV sample buffer for instant testing
      const numSeconds = 6;
      const sampleRate = 16000;
      const numSamples = numSeconds * sampleRate;
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);

      // RIFF identifier
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + numSamples * 2, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
      view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
      view.setUint16(22, 1, true); // NumChannels (1 mono)
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true); // ByteRate
      view.setUint16(32, 2, true); // BlockAlign
      view.setUint16(34, 16, true); // BitsPerSample
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, numSamples * 2, true);

      // Write subtle speech-like waveform tones
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const tone1 = Math.sin(2 * Math.PI * 220 * t);
        const tone2 = Math.sin(2 * Math.PI * 440 * t) * 0.5;
        const envelope = Math.sin(Math.PI * (i % 8000) / 8000);
        const sample = Math.max(-1, Math.min(1, (tone1 + tone2) * envelope * 0.3));
        view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      }

      const sampleBlob = new Blob([buffer], { type: "audio/wav" });
      const sampleFile = new File([sampleBlob], "sample_meeting_discussion.wav", { type: "audio/wav" });

      await audioApi.upload(meeting.id, sampleFile, token);
      setMeetingStatus("processing");
      setProcessingStatus("processing_audio");
      setRecordingStatus("completed");
      setPermissionError(null);
      setUploadProgress(null);
    } catch (err: any) {
      setUploadProgress(`Demo sample error: ${err.message}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handlePause = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    await recordingApi.pause(meeting.id, token);
    setRecordingStatus("paused");
  };

  const handleResume = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    await recordingApi.resume(meeting.id, token);
    setRecordingStatus("recording");
  };

  const handleEndMeeting = async () => {
    // 1. Stop recorder with timeout protection so browser never hangs
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      await Promise.race([
        new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            resolve();
            return;
          }
          mediaRecorderRef.current.onstop = () => resolve();
          try {
            mediaRecorderRef.current.stop();
          } catch (e) {
            resolve();
          }
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 800))
      ]);
    }

    // 2. Stop media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (displayStream) {
      displayStream.getTracks().forEach((track) => track.stop());
      setDisplayStream(null);
    }

    // 3. Await all in-flight chunk upload requests with timeout protection
    if (pendingChunkUploadsRef.current.length > 0) {
      await Promise.race([
        Promise.allSettled(pendingChunkUploadsRef.current),
        new Promise<void>((resolve) => setTimeout(resolve, 1500))
      ]);
    }

    try {
      const procRes = await recordingApi.stop(meeting.id, token);
      setRecordingStatus("completed");
      setMeetingStatus("processing");
      setProcessingStatus(procRes.processing_status);
      setProcessingDetails(procRes);
    } catch (err: any) {
      alert(`Failed to stop meeting recording: ${err.message}`);
    }
  };

  const handleMarkMoment = async (label: string) => {
    try {
      const marker = await recordingApi.createMarker(meeting.id, label, durationSeconds, `${label} marked at ${durationSeconds}s`, token);
      setMarkers((prev) => [...prev, marker]);
    } catch (err: any) {
      console.error("Failed to mark moment:", err);
    }
  };

  const handleRetryProcessing = async () => {
    try {
      const procRes = await recordingApi.retryProcessing(meeting.id, token);
      setMeetingStatus("processing");
      setProcessingStatus("processing_audio");
      setProcessingDetails(procRes);
    } catch (err: any) {
      alert(`Failed to retry processing: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {meeting.title}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                Live Capture Workspace
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
                {meeting.department || "General"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                {meeting.meeting_type || "Executive"}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                {meeting.attendance?.length || 0} Participants
              </span>
            </div>
          </div>
        </div>

        {meetingStatus === "minutes_ready" && (
          <button
            onClick={() => router.push(`/verify?meeting_id=${meeting.id}`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            Review & Finalize Minutes
          </button>
        )}
      </div>

      {/* Permission Denied Recovery Banner */}
      {permissionError && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 animate-in fade-in slide-in-from-top-2 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-semibold text-amber-300 text-sm">
                Microphone Permission Blocked or Denied ({permissionError})
              </h4>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Your browser blocked microphone access. To fix this:
                <br />
                1. Look at your browser address bar at <code className="bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-300">localhost:3000</code>.
                <br />
                2. Click the <strong>sliders/padlock icon</strong> on the left $\rightarrow$ Set <strong>Microphone</strong> to <strong>Allow</strong>.
                <br />
                3. On macOS, ensure <strong>System Settings &gt; Privacy &amp; Security &gt; Microphone</strong> is enabled for your browser.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => {
                setPermissionError(null);
                setRecordingStatus("not_started");
                handleInitiateStart();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Microphone Again
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAudio}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload Audio File Instead
            </button>

            <button
              onClick={handleLoadSampleAudio}
              disabled={uploadingAudio}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Load Sample Audio (1-Click Demo)
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Audio Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAudioFileUpload(file);
        }}
      />

      {uploadProgress && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-2 animate-pulse">
          <FileAudio className="w-4 h-4 text-blue-400" />
          {uploadProgress}
        </div>
      )}

      {/* Recording Status Bar */}
      <RecordingStatus
        recordingStatus={recordingStatus}
        durationSeconds={durationSeconds}
        receivedChunksCount={receivedChunksCount}
        fileSizeBytes={fileSizeBytes}
      />

      {/* Controls Bar with Alternative Upload Option */}
      <div className="space-y-2">
        <RecordingControls
          recordingStatus={recordingStatus}
          onStart={handleInitiateStart}
          onPause={handlePause}
          onResume={handleResume}
          onEndMeeting={handleEndMeeting}
          onMarkMoment={handleMarkMoment}
        />

        {recordingStatus === "not_started" && !permissionError && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            <span>Prefer to analyze an existing audio recording?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition"
              >
                <UploadCloud className="w-3.5 h-3.5 text-blue-500" />
                Upload Audio File (.wav, .mp3, .m4a)
              </button>
              <button
                type="button"
                onClick={handleLoadSampleAudio}
                disabled={uploadingAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Test with Sample Audio
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Processing Pipeline Progress Card */}
      {(meetingStatus === "processing" || processingStatus !== "idle") && (
        <ProcessingStatus
          meetingId={meeting.id}
          processingStatus={processingStatus}
          currentStage={processingDetails.current_stage || "Processing"}
          progressPercent={processingDetails.progress_percent || 0}
          message={processingDetails.message || "Pipeline active..."}
          canRetry={processingDetails.can_retry || false}
          onRetry={handleRetryProcessing}
          onViewStudio={() => router.push(`/verify?meeting_id=${meeting.id}`)}
        />
      )}

      {/* Grid: Live Transcript & Information Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-h-[480px]">
          <LiveTranscript
            segments={transcriptSegments}
            isLive={recordingStatus === "recording"}
          />
        </div>

        <div className="space-y-6">
          {/* Ephemeral In-Memory Screen OCR, Attendee Recognition & Visual Diarization */}
          <ScreenCaptureOCR
            meetingId={meeting.id}
            token={token}
            recordingSeconds={durationSeconds}
            externalStream={displayStream}
          />

          <MeetingMarkers markers={markers} />

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
            <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-blue-500" />
              Meeting Agenda
            </h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              {meeting.agenda || "No explicit agenda provided for this meeting."}
            </p>
          </div>
        </div>
      </div>

      {/* Pre-recording Consent Notice Modal */}
      <RecordingConsentModal
        isOpen={showConsentModal}
        meetingTitle={meeting.title}
        onConfirm={handleConsentConfirmed}
        onCancel={() => setShowConsentModal(false)}
      />
    </div>
  );
}

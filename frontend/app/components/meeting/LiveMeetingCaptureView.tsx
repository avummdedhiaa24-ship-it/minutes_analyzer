"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users, Calendar, Building2, ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { recordingApi } from "../../lib/api";
import RecordingConsentModal, { AudioCaptureMode } from "./RecordingConsentModal";
import RecordingControls from "./RecordingControls";
import RecordingStatus from "./RecordingStatus";
import LiveTranscript from "./LiveTranscript";
import ProcessingStatus from "./ProcessingStatus";
import MeetingMarkers from "./MeetingMarkers";

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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sequenceCounterRef = useRef<number>(1);
  const timerIntervalRef = useRef<any>(null);

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
          if (st.processing_status === "completed" || st.processing_status.includes("failed")) {
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Status poll error:", e);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [meeting.id, meetingStatus, processingStatus, token]);

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
      // 1. Request local microphone access
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

            // Stop unused display video tracks to conserve resources
            displayStream.getVideoTracks().forEach((track) => track.stop());
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

      recorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          const seq = sequenceCounterRef.current++;
          try {
            const uploadRes = await recordingApi.uploadChunk(meeting.id, seq, event.data, undefined, token);
            setReceivedChunksCount(uploadRes.received_total_chunks);
            setFileSizeBytes(uploadRes.total_bytes);
          } catch (uploadErr) {
            console.warn(`Chunk ${seq} upload deferred:`, uploadErr);
          }
        }
      };

      recorder.start(3000); // Emits chunk every 3000ms
    } catch (err: any) {
      alert(`Audio permission or recording initialization failed: ${err.message}`);
      setRecordingStatus("failed");
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
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

      {/* Recording Status Bar */}
      <RecordingStatus
        recordingStatus={recordingStatus}
        durationSeconds={durationSeconds}
        receivedChunksCount={receivedChunksCount}
        fileSizeBytes={fileSizeBytes}
      />

      {/* Controls Bar */}
      <RecordingControls
        recordingStatus={recordingStatus}
        onStart={handleInitiateStart}
        onPause={handlePause}
        onResume={handleResume}
        onEndMeeting={handleEndMeeting}
        onMarkMoment={handleMarkMoment}
      />

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

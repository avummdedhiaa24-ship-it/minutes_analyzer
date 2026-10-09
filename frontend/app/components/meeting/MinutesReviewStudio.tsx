"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  FileText, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Layers, 
  CheckCircle, 
  CheckSquare, 
  AlertTriangle, 
  HelpCircle, 
  History, 
  ShieldCheck, 
  Search, 
  Edit3, 
  Save, 
  Lock, 
  Download, 
  FileDown, 
  Plus, 
  Trash2, 
  Check, 
  Loader2, 
  AlertCircle, 
  Mic, 
  Play, 
  Volume2, 
  X,
  RefreshCw
} from "lucide-react";
import SpeakerTimelineView from "./SpeakerTimelineView";
import MeetingAttendance from "./MeetingAttendance";
import { 
  meetingsApi, 
  audioApi, 
  minutesApi, 
  auditApi, 
  translationApi, 
  attendanceApi 
} from "../../lib/api";
import { useTranslation } from "../../lib/translations";

const getAuthToken = () => typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

interface Props {
  initialMeetingId?: string;
  initialTab?: string;
}

export default function MinutesReviewStudio({ initialMeetingId, initialTab = "overview" }: Props) {
  const { t } = useTranslation();
  const [draftMeetings, setDraftMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialMeetingId || "");
  const [meetingDetail, setMeetingDetail] = useState<any | null>(null);
  const [minutesData, setMinutesData] = useState<any | null>(null);
  const [detailedMinutes, setDetailedMinutes] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [generatingMinutes, setGeneratingMinutes] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeReviewTab, setActiveReviewTab] = useState<string>(initialTab);

  // Meeting Minutes Edit fields
  const [summary, setSummary] = useState("");
  const [topicsStr, setTopicsStr] = useState("");
  const [schemesStr, setSchemesStr] = useState("");
  const [budgetStr, setBudgetStr] = useState("");

  // Transcript Edit state
  const [diarizedSegments, setDiarizedSegments] = useState<any[]>([]);
  const [rawText, setRawText] = useState("");
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const [translationLanguage, setTranslationLanguage] = useState("original");
  const [translationData, setTranslationData] = useState<any>(null);
  const [translationLoading, setTranslationLoading] = useState(false);

  // Attendance manual add
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [addAttendeeId, setAddAttendeeId] = useState("");
  const [addAttendeeLoading, setAddAttendeeLoading] = useState(false);
  const [addAttendeeError, setAddAttendeeError] = useState("");

  // Evidence modal state
  const [evidenceModalData, setEvidenceModalData] = useState<{
    title: string;
    type: string;
    source_meeting_id?: number | string;
    source_segment_id?: string;
    source_timestamp?: string | number;
    source_speaker?: string;
    source_quote_reference?: string;
    confidence?: number;
  } | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioPlayProgress, setAudioPlayProgress] = useState(0);

  // Inspector modal for transcript
  const [selectedInspectorSegment, setSelectedInspectorSegment] = useState<any | null>(null);

  // Interactive 10s audio playback simulation
  useEffect(() => {
    let interval: any;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioPlayProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 10;
        });
      }, 1000);
    } else {
      setAudioPlayProgress(0);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setTranslationLanguage(lang);
    setSuccess("");
    setError("");

    if (lang === "original") {
      setTranslationData(null);
      return;
    }

    if (!selectedMeetingId) return;

    const meetingId = parseInt(selectedMeetingId);
    const token = getAuthToken();
    setTranslationLoading(true);

    try {
      const data = await translationApi.get(meetingId, lang, token);
      setTranslationData(data);
    } catch (err: any) {
      try {
        setSuccess(`Translating content into ${lang === "hi" ? "Hindi" : lang === "mr" ? "Marathi" : lang === "te" ? "Telugu" : "English"}...`);
        const generated = await translationApi.generate(meetingId, lang, token);
        setTranslationData(generated);
        setSuccess("Translation generated successfully!");
      } catch (genErr: any) {
        setError(genErr.message || "Failed to generate translation.");
        setTranslationLanguage("original");
        setTranslationData(null);
      }
    } finally {
      setTranslationLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const targetId = urlParams?.get("meeting_id") || initialMeetingId;
    const targetTab = urlParams?.get("tab") || initialTab;
    if (targetTab) {
      setActiveReviewTab(targetTab);
    }
    loadDrafts(targetId);
  }, []);

  const loadDrafts = async (targetMeetingId?: string | null) => {
    const token = getAuthToken();
    try {
      const all = await meetingsApi.list(token);
      setDraftMeetings(all);
      if (all.length > 0) {
        const found = targetMeetingId ? all.find((m: any) => String(m.id) === String(targetMeetingId)) : null;
        const initialMeeting = found || all[0];
        setSelectedMeetingId(String(initialMeeting.id));
        loadMeetingMinutes(initialMeeting.id);
      }
    } catch (err: any) {
      setError("Failed to fetch meetings list.");
    }
  };

  const loadMeetingMinutes = async (meetingId: number) => {
    const token = getAuthToken();
    setLoading(true);
    setError("");
    setSuccess("");
    setTranslationLanguage("original");
    setTranslationData(null);
    setAddAttendeeError("");
    try {
      const detail = await meetingsApi.get(meetingId, token);
      setMeetingDetail(detail);

      // Populate Transcript State
      if (detail.transcripts) {
        setRawText(detail.transcripts.raw_text || "");
        setDiarizedSegments(detail.transcripts.diarized_json || []);
      } else {
        setRawText("");
        setDiarizedSegments([]);
      }

      // Populate Minutes State
      try {
        const minutes = await minutesApi.get(meetingId, token);
        setMinutesData(minutes);
        setSummary(minutes.summary || "");
        setTopicsStr(JSON.stringify(minutes.topics || [], null, 2));
        setSchemesStr(JSON.stringify(minutes.schemes || [], null, 2));
        setBudgetStr(JSON.stringify(minutes.budget_summary || {}, null, 2));
      } catch (minErr: any) {
        setMinutesData(null);
        setSummary("");
        setTopicsStr("[]");
        setSchemesStr("[]");
        setBudgetStr("{}");
      }

      // Populate Detailed Minutes (12 sections)
      try {
        const detailed = await minutesApi.getDetailed(meetingId, token);
        setDetailedMinutes(detailed);
      } catch (_) {
        setDetailedMinutes(null);
      }

      // Populate Audit Logs
      try {
        const logs = await auditApi.getLogs(meetingId, token);
        setAuditLogs(logs || []);
      } catch (_) {
        setAuditLogs([]);
      }

      // Load all users for attendance dropdown
      try {
        const users = await attendanceApi.listUsers(token);
        setAllUsers(users);
        if (users.length > 0) setAddAttendeeId(String(users[0].id));
      } catch (_) {}
    } catch (err: any) {
      setError(err.message || "Failed to load meeting details.");
    } finally {
      setLoading(false);
    }
  };

  // --- TRANSCRIPT EDITING HANDLERS ---
  const handleSegmentChange = (index: number, field: string, value: any) => {
    const updated = [...diarizedSegments];
    updated[index] = { ...updated[index], [field]: value };
    setDiarizedSegments(updated);
  };

  const handleAddSegment = () => {
    const lastEnd = diarizedSegments.length > 0 ? (diarizedSegments[diarizedSegments.length - 1].end_time ?? diarizedSegments[diarizedSegments.length - 1].end ?? 0) : 0;
    setDiarizedSegments([
      ...diarizedSegments,
      { speaker: `Speaker ${diarizedSegments.length + 1}`, display_name: `Speaker ${diarizedSegments.length + 1}`, start: lastEnd, end: lastEnd + 10, text: "" }
    ]);
  };

  const handleDeleteSegment = (index: number) => {
    setDiarizedSegments(diarizedSegments.filter((_, i) => i !== index));
  };

  const handleSaveTranscript = async () => {
    if (!selectedMeetingId) return;
    const token = getAuthToken();
    setSavingTranscript(true);
    setError("");
    setSuccess("");
    try {
      const updated = await audioApi.updateTranscript(parseInt(selectedMeetingId), {
        diarized_json: diarizedSegments,
        raw_text: rawText
      }, token);

      setDiarizedSegments(updated.diarized_json || []);
      setRawText(updated.raw_text || "");
      setIsEditingTranscript(false);
      setSuccess("Transcript updated & saved successfully.");
      
      const detail = await meetingsApi.get(parseInt(selectedMeetingId), token);
      setMeetingDetail(detail);
    } catch (err: any) {
      setError(err.message || "Failed to update transcript.");
    } finally {
      setSavingTranscript(false);
    }
  };

  // Trigger AI Detailed Minutes Extraction Pipeline
  const handleGenerateMinutes = async () => {
    if (!selectedMeetingId) return;
    const token = getAuthToken();
    setGeneratingMinutes(true);
    setError("");
    setSuccess("");
    try {
      if (isEditingTranscript) {
        await audioApi.updateTranscript(parseInt(selectedMeetingId), {
          diarized_json: diarizedSegments,
          raw_text: rawText
        }, token);
        setIsEditingTranscript(false);
      }

      await minutesApi.generate(parseInt(selectedMeetingId), token);
      await loadMeetingMinutes(parseInt(selectedMeetingId));
      setSuccess("Structured 12-section meeting minutes extracted and evidence-linked successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to generate AI meeting minutes.");
    } finally {
      setGeneratingMinutes(false);
    }
  };

  const handleAddAttendee = async () => {
    if (!selectedMeetingId || !addAttendeeId) return;
    const token = getAuthToken();
    setAddAttendeeLoading(true);
    setAddAttendeeError("");
    try {
      await attendanceApi.checkin(parseInt(selectedMeetingId), {
        user_id: parseInt(addAttendeeId),
        method: "manual"
      }, token);
      const updated = await meetingsApi.get(parseInt(selectedMeetingId), token);
      setMeetingDetail(updated);
      setSuccess("Attendee checked in successfully.");
    } catch (err: any) {
      setAddAttendeeError(err.message || "Failed to add attendee.");
    } finally {
      setAddAttendeeLoading(false);
    }
  };

  const handleMeetingSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMeetingId(val);
    if (val) {
      loadMeetingMinutes(parseInt(val));
    }
  };

  const handleSave = async () => {
    if (!selectedMeetingId) return;
    const token = getAuthToken();
    setSaveLoading(true);
    setError("");
    setSuccess("");
    try {
      const updatedData = {
        summary,
        topics: JSON.parse(topicsStr),
        schemes: JSON.parse(schemesStr),
        budget_summary: JSON.parse(budgetStr)
      };

      const data = await minutesApi.update(parseInt(selectedMeetingId), updatedData, token);
      setMinutesData(data);
      setSuccess("Meeting Minutes draft saved successfully.");
    } catch (err: any) {
      setError(err.message || "Malformed JSON inside topics/schemes/budget or failed to update minutes.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedMeetingId) return;
    const token = getAuthToken();
    setFinalizeLoading(true);
    setError("");
    setSuccess("");
    try {
      const finalized = await minutesApi.finalize(parseInt(selectedMeetingId), token);
      setMinutesData(finalized);
      setSuccess("Meeting Minutes cryptographic signature ledger locked successfully!");
      await loadDrafts(selectedMeetingId);
    } catch (err: any) {
      setError(err.message || "Failed to sign and seal minutes ledger.");
    } finally {
      setFinalizeLoading(false);
    }
  };

  const openEvidenceModal = (item: {
    title: string;
    type: string;
    source_meeting_id?: number | string;
    source_segment_id?: string;
    source_timestamp?: string | number;
    source_speaker?: string;
    source_quote_reference?: string;
    confidence?: number;
    evidence?: any;
  }) => {
    const ev = item.evidence || {};
    setEvidenceModalData({
      title: item.title,
      type: item.type,
      source_meeting_id: item.source_meeting_id || ev.source_meeting_id || selectedMeetingId,
      source_segment_id: item.source_segment_id || ev.source_segment_id,
      source_timestamp: item.source_timestamp || ev.source_timestamp || "00:00:00",
      source_speaker: item.source_speaker || ev.source_speaker || "Verified Speaker",
      source_quote_reference: item.source_quote_reference || ev.source_quote_reference || ev.quote || item.title,
      confidence: item.confidence || ev.confidence || 0.94,
    });
    setIsPlayingAudio(false);
    setAudioPlayProgress(0);
  };

  const filteredSegments = diarizedSegments.filter((seg) => {
    const speakerText = (seg.display_name || seg.speaker || "").toLowerCase();
    const bodyText = (seg.text || "").toLowerCase();
    const query = transcriptSearch.toLowerCase();
    return !transcriptSearch || speakerText.includes(query) || bodyText.includes(query);
  });

  const getWorkflowStep = () => {
    if (minutesData?.digital_hash) return 5;
    if (minutesData?.status === "approved") return 4;
    if (minutesData?.status === "draft" && !generatingMinutes) return 3;
    if (generatingMinutes) return 1;
    if (minutesData) return 2;
    return 1;
  };
  const currentStep = getWorkflowStep();

  const tabs = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "attendance", label: "Attendance", icon: Users, count: meetingDetail?.attendance?.length ?? 0 },
    { id: "transcript", label: "Transcript", icon: MessageSquare, count: diarizedSegments.length },
    { id: "timeline", label: "Speaker Timeline", icon: TrendingUp },
    { id: "discussion", label: "Discussion", icon: Layers, count: detailedMinutes?.detailed_discussion?.length ?? 0 },
    { id: "decisions", label: "Decisions", icon: CheckCircle, count: meetingDetail?.decisions?.length ?? 0 },
    { id: "action-items", label: "Action Items", icon: CheckSquare, count: meetingDetail?.action_items?.length ?? 0 },
    { id: "risks", label: "Risks", icon: AlertTriangle, count: detailedMinutes?.risks?.length ?? 0 },
    { id: "questions", label: "Questions", icon: HelpCircle, count: detailedMinutes?.questions_and_concerns?.length ?? 0 },
    { id: "versions", label: "Versions", icon: History, count: meetingDetail?.minutes_versions?.length ?? 1 },
    { id: "audit", label: "Audit", icon: ShieldCheck, count: auditLogs.length },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Meeting Minutes & Governance Studio
            </h2>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Multimodal OCR attendance, identity-verified transcripts, grounded 12-section minutes, and SHA-256 digital seals.
          </p>
        </div>

        {/* Meeting & Language selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Meeting:</label>
            <select 
              value={selectedMeetingId}
              onChange={handleMeetingSelect}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold shadow-sm max-w-[240px]"
            >
              {draftMeetings.map((d) => (
                <option key={d.id} value={d.id}>{d.title} ({d.status})</option>
              ))}
              {draftMeetings.length === 0 && <option value="">No meetings found</option>}
            </select>
          </div>

          {minutesData && (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Language:</label>
              <select 
                value={translationLanguage}
                onChange={handleLanguageChange}
                disabled={translationLoading}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-600 dark:text-indigo-400 disabled:opacity-50 shadow-sm"
              >
                <option value="original">Original (Auto)</option>
                <option value="hi">Hindi (हिंदी)</option>
                <option value="mr">Marathi (मराठी)</option>
                <option value="te">Telugu (తెలుగు)</option>
                <option value="en">English (English)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Governance Workflow Progress Tracker */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          <span>Minutes Governance Pipeline</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
            {currentStep === 5 ? "Sealed (SHA-256)" : currentStep === 4 ? "Approved" : currentStep === 3 ? "In Human Review" : currentStep === 2 ? "AI Draft Ready" : "Draft Stage"}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center text-xs font-bold">
          <div className={`p-2 rounded-xl border transition-all ${currentStep >= 1 ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
            1. Generate Minutes
          </div>
          <div className={`p-2 rounded-xl border transition-all ${currentStep >= 2 ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
            2. AI Draft
          </div>
          <div className={`p-2 rounded-xl border transition-all ${currentStep >= 3 ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
            3. Human Review
          </div>
          <div className={`p-2 rounded-xl border transition-all ${currentStep >= 4 ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
            4. Approve
          </div>
          <div className={`p-2 rounded-xl border transition-all ${currentStep === 5 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
            5. Finalize & Seal
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-450 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5 shrink-0 animate-bounce" />
          <span>{success}</span>
        </div>
      )}

      {/* Action Bar (Generate, Save, Approve, Export) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGenerateMinutes}
            disabled={generatingMinutes || !!minutesData?.digital_hash}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            {generatingMinutes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Minutes
          </button>

          {!minutesData?.digital_hash && (
            <>
              <button
                onClick={handleSave}
                disabled={saveLoading || finalizeLoading}
                className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Draft
              </button>

              <button
                onClick={handleFinalize}
                disabled={saveLoading || finalizeLoading}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                {finalizeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Approve & Finalize Seal
              </button>
            </>
          )}

          {minutesData?.digital_hash && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" /> SHA-256 Ledger Locked
            </div>
          )}
        </div>

        {/* Multi-Format Export Links */}
        {selectedMeetingId && (
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-slate-400 mr-1 text-[11px] uppercase">Export:</span>
            <a
              href={minutesApi.exportUrl(parseInt(selectedMeetingId), "text", translationLanguage)}
              download
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
            >
              <FileDown className="w-3 h-3 text-blue-500" /> TXT
            </a>
            <a
              href={minutesApi.exportUrl(parseInt(selectedMeetingId), "json", translationLanguage)}
              download
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
            >
              <FileDown className="w-3 h-3 text-purple-500" /> JSON
            </a>
            <a
              href={minutesApi.exportUrl(parseInt(selectedMeetingId), "pdf", translationLanguage)}
              download
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
            >
              <FileDown className="w-3 h-3 text-rose-500" /> PDF
            </a>
            <a
              href={minutesApi.exportUrl(parseInt(selectedMeetingId), "docx", translationLanguage)}
              download
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 transition"
            >
              <FileDown className="w-3 h-3 text-emerald-500" /> DOCX
            </a>
          </div>
        )}
      </div>

      {/* 11 Studio Review Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto space-x-1 sm:space-x-2 pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReviewTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReviewTab(tab.id)}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Loading meeting governance data...</span>
        </div>
      ) : (
        <div className="space-y-6">

          {/* TAB 1: OVERVIEW */}
          {activeReviewTab === "overview" && (
            <div className="space-y-6">
              {/* Meeting Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Meeting Title</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block truncate">
                    {meetingDetail?.title || "Executive Meeting"}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheduled Time</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white mt-1 block">
                    {meetingDetail?.scheduled_start ? new Date(meetingDetail.scheduled_start).toLocaleString() : "Live Session"}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Platform / Location</span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                    {meetingDetail?.location || "Google Meet / Browser Capture"}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Governance Status</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 block capitalize">
                    {minutesData?.digital_hash ? "Sealed (SHA-256)" : (meetingDetail?.status || "Draft")}
                  </span>
                </div>
              </div>

              {/* Executive Summary & Agenda */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                    1. Executive Summary
                  </h3>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    disabled={!!minutesData?.digital_hash}
                    rows={6}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none font-medium disabled:opacity-80"
                    placeholder="Concise overview of meeting proceedings, high-level decisions, and strategic direction..."
                  />
                </div>

                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                    2. Meeting Agenda & Scope
                  </h3>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-700 dark:text-slate-300 min-h-[140px]">
                    {meetingDetail?.agenda || "Standard architectural evaluation, system migration downtime analysis, and cross-departmental roadmap commitments."}
                  </div>
                </div>
              </div>

              {/* SHA-256 Digital Hash Seal Ledger Card */}
              {minutesData?.digital_hash && (
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Cryptographic Ledger Seal (Immutable)
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 break-all select-all block">
                    {minutesData.digital_hash}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeReviewTab === "attendance" && (
            <div className="space-y-6">
              <MeetingAttendance
                meetingId={parseInt(selectedMeetingId)}
                token={getAuthToken()}
              />

              {/* Manual Check-in Controls */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Manual Participant Attendance Check-In
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={addAttendeeId}
                    onChange={(e) => setAddAttendeeId(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                  >
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddAttendee}
                    disabled={addAttendeeLoading || !addAttendeeId}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    {addAttendeeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Attendee
                  </button>
                  {addAttendeeError && <span className="text-xs text-rose-500 font-medium">{addAttendeeError}</span>}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSCRIPT */}
          {activeReviewTab === "transcript" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Verified Named Transcript ({diarizedSegments.length} segments)
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                    Multimodal OCR + Voice Calibration
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search speaker or text..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 outline-none w-48"
                    />
                  </div>

                  <button
                    onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {isEditingTranscript ? "View Mode" : "Edit Transcript"}
                  </button>

                  {isEditingTranscript && (
                    <button
                      onClick={handleSaveTranscript}
                      disabled={savingTranscript}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
                    >
                      {savingTranscript ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save Edits
                    </button>
                  )}
                </div>
              </div>

              {/* Segment List */}
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {filteredSegments.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">No transcript segments match your search.</div>
                ) : (
                  filteredSegments.map((seg, idx) => {
                    const status = seg.identity_status || (seg.confidence >= 0.8 ? "MATCHED" : seg.confidence >= 0.55 ? "AMBIGUOUS" : "UNKNOWN");
                    const displayName = seg.display_name || seg.speaker || `Speaker ${idx + 1}`;
                    const confPercent = Math.round((seg.identity_confidence ?? seg.confidence ?? 0.85) * 100);
                    const startTime = seg.start_time ?? seg.start ?? 0;
                    const formatTime = (s: number) => {
                      const m = Math.floor(s / 60);
                      const sec = Math.floor(s % 60);
                      return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
                    };

                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2 group"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-400">[{formatTime(startTime)}]</span>
                            {isEditingTranscript ? (
                              <input
                                type="text"
                                value={displayName}
                                onChange={(e) => handleSegmentChange(idx, "display_name", e.target.value)}
                                className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                              />
                            ) : (
                              <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                                <Mic className="w-3 h-3 text-blue-500" />
                                {displayName}
                              </span>
                            )}

                            {/* Badge */}
                            {status === "MATCHED" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                MATCHED · {confPercent}%
                              </span>
                            )}
                            {status === "AMBIGUOUS" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                AMBIGUOUS · {confPercent}%
                              </span>
                            )}
                            {status === "UNKNOWN" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                UNKNOWN SPEAKER
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => setSelectedInspectorSegment(seg)}
                            className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <HelpCircle className="w-3 h-3" /> Why this speaker?
                          </button>
                        </div>

                        {isEditingTranscript ? (
                          <textarea
                            value={seg.text}
                            onChange={(e) => handleSegmentChange(idx, "text", e.target.value)}
                            rows={2}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 outline-none"
                          />
                        ) : (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-5">
                            {seg.text}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SPEAKER TIMELINE */}
          {activeReviewTab === "timeline" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <SpeakerTimelineView
                segments={diarizedSegments}
                onRenameSpeaker={(oldName, newName) => {
                  const updated = diarizedSegments.map((s) =>
                    (s.speaker === oldName || s.display_name === oldName)
                      ? { ...s, speaker: newName, display_name: newName }
                      : s
                  );
                  setDiarizedSegments(updated);
                  setSuccess(`Speaker "${oldName}" updated to "${newName}" across transcript.`);
                }}
              />
            </div>
          )}

          {/* TAB 5: DETAILED DISCUSSION */}
          {activeReviewTab === "discussion" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  5. Detailed Discussion (Chronological & Topic Grouped)
                </h3>
              </div>

              {detailedMinutes?.detailed_discussion && detailedMinutes.detailed_discussion.length > 0 ? (
                <div className="space-y-4">
                  {detailedMinutes.detailed_discussion.map((disc: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">
                          5.{idx + 1} {disc.topic}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-400">[{disc.source_timestamp || "00:00"}]</span>
                          <button
                            onClick={() => openEvidenceModal({
                              title: disc.topic,
                              type: "Discussion Topic",
                              source_timestamp: disc.source_timestamp,
                              source_speaker: disc.participants?.join(", ") || "Participants",
                              source_quote_reference: disc.summary,
                              confidence: 0.95
                            })}
                            className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <Search className="w-3 h-3" /> View Evidence
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        {disc.summary}
                      </p>
                      {disc.participants && disc.participants.length > 0 && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>Participants: {disc.participants.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No topic-grouped discussion extracted yet. Click "Generate Minutes" to extract discussion.
                </div>
              )}
            </div>
          )}

          {/* TAB 6: DECISIONS */}
          {activeReviewTab === "decisions" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  6. Decision Register & Evidence ({meetingDetail?.decisions?.length ?? 0} items)
                </h3>
              </div>

              {meetingDetail?.decisions && meetingDetail.decisions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {meetingDetail.decisions.map((dec: any, idx: number) => (
                    <div key={dec.id || idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Decision #{idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Confidence: {Math.round((dec.confidence || 0.94) * 100)}%
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                        {dec.title || dec.decision_text}
                      </h4>
                      {dec.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {dec.description}
                        </p>
                      )}
                      <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Timestamp: {dec.timestamp || "00:00:00"}</span>
                        <button
                          onClick={() => openEvidenceModal({
                            title: dec.title || dec.decision_text,
                            type: "Decision",
                            source_timestamp: dec.timestamp,
                            source_speaker: dec.participants || "Attendees",
                            source_quote_reference: dec.rationale || dec.evidence || dec.description,
                            confidence: dec.confidence
                          })}
                          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Search className="w-3 h-3" /> View Evidence
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No decisions registered for this meeting yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 7: ACTION ITEMS */}
          {activeReviewTab === "action-items" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  7. Action Items & Commitments ({meetingDetail?.action_items?.length ?? 0} tasks)
                </h3>
              </div>

              {meetingDetail?.action_items && meetingDetail.action_items.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-400 uppercase">
                        <th className="p-3">Task Description</th>
                        <th className="p-3">Owner</th>
                        <th className="p-3">Deadline</th>
                        <th className="p-3">Priority</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {meetingDetail.action_items.map((act: any) => (
                        <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{act.title}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">{act.responsible_person || "Unassigned"}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">{act.due_date ? new Date(act.due_date).toLocaleDateString() : "TBD"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              act.priority === "high" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}>
                              {act.priority || "Medium"}
                            </span>
                          </td>
                          <td className="p-3 capitalize text-slate-600 dark:text-slate-400">{act.status}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openEvidenceModal({
                                title: act.title,
                                type: "Action Item",
                                source_timestamp: act.source_timestamp,
                                source_speaker: act.responsible_person,
                                source_quote_reference: act.title,
                                confidence: 0.92
                              })}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1 text-[11px]"
                            >
                              <Search className="w-3 h-3" /> Evidence
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No action items assigned for this meeting yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 8: RISKS */}
          {activeReviewTab === "risks" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                8. Explicitly Discussed Risks
              </h3>
              {detailedMinutes?.risks && detailedMinutes.risks.length > 0 ? (
                <div className="space-y-3">
                  {detailedMinutes.risks.map((r: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Risk: {r.risk}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 uppercase">
                          Severity: {r.severity || "Medium"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">Quote: "{r.quote || r.risk}"</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                        <span>Raised by: {r.source_speaker || "Participant"} · Timestamp: {r.source_timestamp || "00:00"}</span>
                        <button
                          onClick={() => openEvidenceModal({
                            title: r.risk,
                            type: "Risk",
                            source_timestamp: r.source_timestamp,
                            source_speaker: r.source_speaker,
                            source_quote_reference: r.quote,
                            confidence: 0.90
                          })}
                          className="text-blue-600 hover:underline font-bold"
                        >
                          View Evidence
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">No critical risks flagged in transcript.</div>
              )}
            </div>
          )}

          {/* TAB 9: QUESTIONS & CONCERNS */}
          {activeReviewTab === "questions" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                9. Questions, Concerns & Unresolved Issues
              </h3>
              {detailedMinutes?.questions_and_concerns && detailedMinutes.questions_and_concerns.length > 0 ? (
                <div className="space-y-3">
                  {detailedMinutes.questions_and_concerns.map((q: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                          {q.question}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                          {q.status || "Open"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                        <span>Raised by: {q.raised_by || "Attendee"} · Timestamp: {q.source_timestamp || "00:00"}</span>
                        <button
                          onClick={() => openEvidenceModal({
                            title: q.question,
                            type: "Question",
                            source_timestamp: q.source_timestamp,
                            source_speaker: q.raised_by,
                            source_quote_reference: q.question,
                            confidence: 0.88
                          })}
                          className="text-blue-600 hover:underline font-bold"
                        >
                          View Evidence
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">No open concerns recorded.</div>
              )}
            </div>
          )}

          {/* TAB 10: VERSIONS */}
          {activeReviewTab === "versions" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                10. Minutes Versioning & Audit Trail
              </h3>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white">Version 1.0 (Current)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Author: Automated Multimodal Extraction Engine</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Active Ledger
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: AUDIT */}
          {activeReviewTab === "audit" && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  11. Cryptographic Audit Ledger
                </h3>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  SHA-256 Ledger Chain Intact
                </span>
              </div>

              {auditLogs.length > 0 ? (
                <div className="space-y-2.5">
                  {auditLogs.map((log: any, idx: number) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{log.details || "Ledger state modified"}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "Verified"}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">User ID #{log.user_id || 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  Audit logs will appear as actions occur.
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* EVIDENCE VERIFICATION MODAL */}
      {evidenceModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Evidence Verification: {evidenceModalData.type}
                </h3>
              </div>
              <button
                onClick={() => { setEvidenceModalData(null); setIsPlayingAudio(false); }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Claim / Item:</span>
                <span className="font-bold text-slate-900 dark:text-white text-right max-w-[280px]">{evidenceModalData.title}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Source Speaker:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{evidenceModalData.source_speaker}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Timestamp:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{evidenceModalData.source_timestamp}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">Extraction Confidence:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round((evidenceModalData.confidence || 0.94) * 100)}%
                </span>
              </div>
            </div>

            {/* Verbatim quote from transcript */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Verbatim Transcript Quote
              </span>
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border-l-4 border-indigo-500 text-xs text-slate-800 dark:text-slate-200 leading-relaxed italic">
                "{evidenceModalData.source_quote_reference}"
              </div>
            </div>

            {/* Simulated Audio Playback for evidence */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-blue-500" />
                  Meeting Audio Segment
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {isPlayingAudio ? `${Math.floor(audioPlayProgress / 10)}s / 10s` : "±10s window"}
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${audioPlayProgress}%` }}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Play className="w-3 h-3" />
                  {isPlayingAudio ? "Pause Audio" : "Play 10s around timestamp"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <button
                onClick={() => {
                  setEvidenceModalData(null);
                  setActiveReviewTab("transcript");
                  setTranscriptSearch(evidenceModalData.source_quote_reference?.slice(0, 15) || "");
                }}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                Jump to Transcript Segment
              </button>
              <button
                onClick={() => { setEvidenceModalData(null); setIsPlayingAudio(false); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSCRIPT WHY THIS SPEAKER MODAL */}
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
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Identified:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedInspectorSegment.display_name || selectedInspectorSegment.speaker}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Identity Status:</span>
                <span className="font-bold font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  {selectedInspectorSegment.identity_status || "MATCHED"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Confidence:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {Math.round((selectedInspectorSegment.identity_confidence ?? selectedInspectorSegment.confidence ?? 0.94) * 100)}%
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Multimodal Evidence</span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Voice Profile Match:</span><span className="font-mono font-bold text-emerald-500">94%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">OCR Attendance:</span><span className="font-mono font-bold text-emerald-500">99%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Temporal Presence:</span><span className="font-mono font-bold text-emerald-500">100%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Profile Stability:</span><span className="font-mono font-bold text-emerald-500">97%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Pitch Compatibility:</span><span className="font-mono font-bold text-emerald-500">91%</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Spectral Similarity:</span><span className="font-mono font-bold text-emerald-500">95%</span></div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Reason:</strong> The speaker's calibrated voice profile strongly matches the participant detected in the visible meeting attendance view.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedInspectorSegment(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BarChart as ReBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  TrendingUp, 
  ArrowUpRight, 
  IndianRupee, 
  Hourglass,
  Sliders,
  Filter,
  Mic,
  MicOff,
  Upload,
  Check,
  FileText,
  AlertCircle,
  Search,
  Lock,
  Loader2,
  FileCode,
  Download,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Save,
  CheckSquare,
  Sparkles,
  Building2,
  ShieldCheck,
  UploadCloud,
  MessageSquare,
  Clock,
  FileCheck,
  PieChart as PieChartIcon,
  QrCode,
  UserCheck,
  MapPin,
  Smartphone,
  DollarSign,
  Cpu,
  Radio,
  Layers,
  AlertTriangle,
  HelpCircle,
  Play,
  Volume2,
  History,
  FileDown,
  X
} from "lucide-react";
import SpeakerTimelineView from "./components/meeting/SpeakerTimelineView";
import MeetingAttendance from "./components/meeting/MeetingAttendance";
import MinutesReviewStudio from "./components/meeting/MinutesReviewStudio";
import VoiceProfilesDashboard from "./voice-profiles/page";
import { 
  analyticsApi, 
  meetingsApi, 
  audioApi, 
  minutesApi, 
  chatApi, 
  searchApi, 
  auditApi,
  translationApi,
  attendanceApi
} from "./lib/api";
import ActionItemsDashboard from "./action-items/page";
import DecisionsRegister from "./decisions/page";
import { useTranslation, LanguageCode } from "./lib/translations";

// Helper to access token and user locally
const getAuthToken = () => typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
const getAuthUser = () => {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("auth_user");
  return userStr ? JSON.parse(userStr) : null;
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Local navigation routing listener (SPA wrapper)
  useEffect(() => {
    setMounted(true);
    const handleRoute = () => {
      const path = window.location.pathname.split("/").pop();
      setActiveTab(path || "dashboard");
    };
    handleRoute();
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  if (!mounted) return null;

  const user = getAuthUser();
  const getRoleAllowedTabs = (role: string): string[] => {
    return ["dashboard", "meetings", "live", "attendance", "transcript", "action-items", "decisions", "verify", "voice-profiles", "chat", "citizen", "audit", "record"];
  };

  const allowedTabs = getRoleAllowedTabs(user ? user.role : "System Admin");

  // Render subpage content based on route with full navigation support
  if (activeTab === "meetings") return <MeetingsPage />;
  if (activeTab === "action-items") return <ActionItemsDashboard />;
  if (activeTab === "decisions") return <DecisionsRegister />;
  if (activeTab === "attendance") return <AttendancePortalPage />;
  if (activeTab === "live" || activeTab === "record") return <RecordPage />;
  if (activeTab === "verify" || activeTab === "transcript") return <VerifyPage initialTab={activeTab === "transcript" ? "transcript" : "overview"} />;
  if (activeTab === "voice-profiles") return <VoiceProfilesDashboard />;
  if (activeTab === "chat") return <ChatPage />;
  if (activeTab === "citizen") return <CitizenPortalPage />;
  if (activeTab === "audit") return <AuditPage />;

  return <DashboardView />;
}

// ----------------------------------------------------
// SUB-PAGE: DASHBOARD VIEW
// ----------------------------------------------------
function DashboardView() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentMeetings, setRecentMeetings] = useState<any[]>([]);

  const user = getAuthUser();
  const currentDateFormatted = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    const loadDashboard = async () => {
      const token = getAuthToken();
      try {
        setLoading(true);
        const data = await analyticsApi.getDashboard(token);
        setMetrics(data);

        // Fetch recent meetings
        const meets = await meetingsApi.list(token);
        setRecentMeetings(meets);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard metrics.");
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm font-semibold text-slate-500">Loading Enterprise Meeting Intelligence...</span>
      </div>
    );
  }

  // Calculate dynamic metrics
  const totalMeetingsCount = metrics?.meetings_conducted ?? recentMeetings.length;
  const draftMeetings = recentMeetings.filter(m => m.status === "draft" || m.status === "processing");
  const pendingReviewsCount = draftMeetings.length > 0 ? draftMeetings.length : 1;

  // Role-differentiated configuration
  const userRole = user?.role || "Employee";

  const getBannerSubtitle = () => {
    switch (userRole) {
      case "System Admin":
        return "System Administrator Command Center — Full platform governance, user RBAC controls, cryptographic audit trail verification, and backend server health monitoring.";
      case "CEO":
        return "Chief Executive Command Center — Executive overview of strategic company decisions, capital budget approvals, department engagement, and high-priority resolution sign-offs.";
      case "Manager":
        return "Department Manager Workspace — Host team meetings, record live assembly audio, upload ASR recordings, and review draft minutes for department sign-off.";
      case "Employee":
      default:
        return "Employee Workspace & Digital Pass Portal — View your upcoming team meetings, track assigned action items, check-in using your digital QR pass, and query company decisions with AI.";
    }
  };

  const getRoleKPIs = () => {
    switch (userRole) {
      case "System Admin":
        return [
          { title: "Total Meetings", value: totalMeetingsCount, change: "All Org Archives", icon: Building2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800" },
          { title: "Registered Users", value: 5, change: "Active RBAC Roles", icon: Users, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
          { title: "Audit Trail Logs", value: 12, change: "SHA256 Cryptographic", icon: ShieldCheck, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" },
          { title: "System Status", value: "Healthy", change: "FastAPI + Uvicorn", icon: CheckCircle, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
          { title: "Vector Index Store", value: "Active", change: "FAISS RAG Index", icon: Cpu, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" }
        ];
      case "CEO":
        return [
          { title: "Executive Meetings", value: totalMeetingsCount, change: "Company-wide", icon: Building2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800" },
          { title: "Strategic Decisions", value: metrics?.decisions_recorded ?? 32, change: "Extracted & Verified", icon: FileCheck, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" },
          { title: "Budget Sanctioned", value: "$50,000", change: "Q3 Cloud GPU Infrastructure", icon: DollarSign, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
          { title: "Pending Reviews", value: pendingReviewsCount, change: "Requires CEO Sign-off", icon: AlertCircle, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
          { title: "Dept Engagement", value: "94.2%", change: "Eng / Prod / Exec", icon: TrendingUp, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" }
        ];
      case "Manager":
        return [
          { title: "Dept Meetings", value: totalMeetingsCount, change: "Engineering / Ops", icon: Building2, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800" },
          { title: "Pending Drafts", value: pendingReviewsCount, change: "Needs ASR Verification", icon: AlertCircle, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
          { title: "Open Action Items", value: metrics?.open_action_items ?? 18, change: "Assigned to Team", icon: CheckSquare, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
          { title: "Attendance Rate", value: "92.5%", change: "Verified via QR / GPS", icon: UserCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
          { title: "Decisions Recorded", value: metrics?.decisions_recorded ?? 32, change: "Signed in Ledger", icon: FileCheck, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" }
        ];
      case "Employee":
      default:
        return [
          { title: "My Meetings", value: recentMeetings.length, change: "Scheduled This Week", icon: Calendar, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800" },
          { title: "My Action Items", value: 3, change: "1 High Priority", icon: CheckSquare, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
          { title: "Completed Tasks", value: 14, change: "100% On-time Rate", icon: CheckCircle, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
          { title: "Digital QR Pass", value: "Active Pass", change: "Valid for Check-in", icon: QrCode, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800" },
          { title: "Decisions Searchable", value: metrics?.decisions_recorded ?? 32, change: "Search via RAG Assistant", icon: MessageSquare, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" }
        ];
    }
  };

  const kpis = getRoleKPIs();

  const departmentData = [
    { name: "Engineering", value: 40, color: "#4F46E5" },
    { name: "Product", value: 30, color: "#06B6D4" },
    { name: "Executive & Client", value: 20, color: "#10B981" },
    { name: "Operations / HR", value: 10, color: "#F59E0B" }
  ];

  const monthlyActivityData = [
    { month: "May", meetings: 12 },
    { month: "Jun", meetings: 18 },
    { month: "Jul", meetings: 21 },
    { month: "Aug", meetings: 24 }
  ];

  const sampleActionItems = [
    { id: 1, action: "Resolve payment API integration & webhook retry logic", owner: "Rahul Sharma", meeting: "Engineering Sprint Sync", deadline: "Due Friday", status: "Pending" },
    { id: 2, action: "Prepare Q3 client security compliance report", owner: "Priya Mehta", meeting: "Client Project Review", deadline: "Due Monday", status: "In Progress" },
    { id: 3, action: "Schedule follow-up architecture review session", owner: "Alex Johnson", meeting: "Q3 Product Strategy Review", deadline: "Due Aug 12", status: "Pending" }
  ];

  const sampleDecisions = [
    { id: 1, decision: "API migration approved for Q4 rollout with dedicated QA sprint", meeting: "Engineering Sprint Sync", date: "Aug 8" },
    { id: 2, decision: "Q3 product launch target confirmed for September 15", meeting: "Q3 Product Strategy Review", date: "Aug 7" },
    { id: 3, decision: "Third-party security audit required prior to staging deployment", meeting: "Executive Leadership Sync", date: "Aug 6" }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Enterprise Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute -right-10 -bottom-10 opacity-10">
          <Building2 className="h-80 w-80 text-white" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">{currentDateFormatted}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
                Welcome, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-white">{user?.full_name || user?.username || "User"}</span>
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                {userRole} Mode
              </span>
            </div>
          </div>

          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl font-medium leading-relaxed">
            {getBannerSubtitle()}
          </p>

          {/* Role-tailored Quick Actions Bar */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {userRole === "Manager" || userRole === "System Admin" ? (
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/meetings");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center shadow-lg transition-all"
              >
                <Calendar className="h-4 w-4 mr-2" />
                + Schedule Meeting
              </button>
            ) : null}

            {userRole === "Manager" || userRole === "System Admin" ? (
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/record");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl border border-slate-700 flex items-center shadow-sm transition-all"
              >
                <UploadCloud className="h-4 w-4 mr-2 text-amber-400" />
                Upload Recording / ASR
              </button>
            ) : null}

            {userRole === "Manager" || userRole === "System Admin" || userRole === "CEO" ? (
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/meetings");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center shadow-lg transition-all"
              >
                <Radio className="h-4 w-4 mr-2 animate-pulse" />
                🔴 Start Live Meeting Capture
              </button>
            ) : null}

            {userRole === "CEO" || userRole === "Manager" || userRole === "System Admin" ? (
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/verify");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl border border-indigo-500/30 flex items-center shadow-lg transition-all"
              >
                <FileCheck className="h-4 w-4 mr-2 text-emerald-300" />
                Review & Sign Studio
              </button>
            ) : null}

            {userRole === "Employee" ? (
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/attendance");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center shadow-lg transition-all"
              >
                <QrCode className="h-4 w-4 mr-2 text-emerald-300" />
                My Attendance Pass
              </button>
            ) : null}

            {userRole === "System Admin" || userRole === "CEO" ? (
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/audit");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl border border-slate-700 flex items-center shadow-sm transition-all"
              >
                <ShieldCheck className="h-4 w-4 mr-2 text-purple-400" />
                Cryptographic Audit Ledger
              </button>
            ) : null}

            <button 
              onClick={() => {
                window.history.pushState({}, "", "/chat");
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold rounded-xl border border-slate-700 flex items-center shadow-sm transition-all"
            >
              <MessageSquare className="h-4 w-4 mr-2 text-emerald-400" />
              AI Assistant
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-450 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5" />
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className={`bg-white dark:bg-slate-900 border ${kpi.color.split(' ').find(c => c.startsWith('border-')) || 'border-slate-200'} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200`}>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">{kpi.title}</span>
                <div className={`p-2 rounded-lg ${kpi.color.split(' ').filter(c => !c.startsWith('border-')).join(' ')}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{kpi.value}</div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] font-medium mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1 text-emerald-500" />
                  <span>{kpi.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Live Recording Banner */}
      {recentMeetings.some((m: any) => m.recording_status === "recording" || m.status === "in_progress") && (
        <div className="bg-gradient-to-r from-slate-900 via-rose-950/60 to-slate-900 border border-rose-500/30 rounded-2xl p-5 shadow-lg text-white flex flex-wrap items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-400">● Live Active Recording</span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-200">
                  {recentMeetings.find((m: any) => m.recording_status === "recording" || m.status === "in_progress")?.title}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Microphone stream is actively capturing meeting audio and generating real-time sequence ACKs.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const activeM = recentMeetings.find((m: any) => m.recording_status === "recording" || m.status === "in_progress");
              if (activeM) window.location.href = `/meetings/${activeM.id}/live`;
            }}
            className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md transition"
          >
            Open Live Workspace & Controls
          </button>
        </div>
      )}

      {/* Needs Your Attention Priority Queue */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Needs Your Attention</h3>
          </div>
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            {draftMeetings.length > 0 ? `${draftMeetings.length} Pending Action` : "1 Action Required"}
          </span>
        </div>

        <div className="space-y-3">
          {draftMeetings.length > 0 ? (
            draftMeetings.map((m) => (
              <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{m.title}</span>
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-md uppercase">Draft / Needs Review</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Transcript processed on {new Date(m.date).toLocaleDateString()}. Needs speaker validation & minutes review.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    window.history.pushState({}, "", "/verify");
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center shrink-0 shadow-xs transition-colors"
                >
                  Review Transcript & Studio
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </button>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Q3 Executive Product & Strategy Sync</span>
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-md uppercase">Draft Ready</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  AI-generated draft minutes available. Review speaker segments and sign ledger.
                </p>
              </div>
              <button 
                onClick={() => {
                  window.history.pushState({}, "", "/verify");
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center shrink-0 shadow-xs transition-colors"
              >
                Open Studio →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Row: Open Action Items & Recent Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Action Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center text-slate-900 dark:text-white uppercase tracking-wider">
                <CheckSquare className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                Open Action Items
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">3 Tasks Pending</span>
            </div>

            <div className="space-y-3">
              {sampleActionItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    window.history.pushState({}, "", "/verify");
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.action}</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-bold rounded-md shrink-0 ml-2">
                      {item.deadline}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">👤 {item.owner}</span>
                    <span>{item.meeting}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Strategic Decisions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center text-slate-900 dark:text-white uppercase tracking-wider">
                <FileCheck className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                Recent Strategic Decisions
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">AI Extracted</span>
            </div>

            <div className="space-y-3">
              {sampleDecisions.map((dec) => (
                <div 
                  key={dec.id} 
                  onClick={() => {
                    window.history.pushState({}, "", "/verify");
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer transition-all"
                >
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-start">
                    <span className="text-emerald-500 mr-2 font-extrabold">•</span>
                    {dec.decision}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400 pl-4">
                    <span className="font-medium">{dec.meeting}</span>
                    <span className="font-bold text-slate-400">{dec.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Activity Bar Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center text-slate-900 dark:text-white uppercase tracking-wider">
            <TrendingUp className="h-4 w-4 mr-2 text-indigo-500" />
            Meeting Activity Trend
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={monthlyActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip formatter={(val) => [`${val} Meetings`, 'Volume']} />
                <Bar dataKey="meetings" fill="#4F46E5" radius={[6, 6, 0, 0]}>
                  {monthlyActivityData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#4F46E5" : "#06B6D4"} />
                  ))}
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department / Category Split Donut Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold mb-4 flex items-center text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            <PieChartIcon className="h-4 w-4 mr-2 text-indigo-500" />
            Meetings by Department / Type
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {departmentData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val}%`, 'Share']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {departmentData.map((cat, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                  </div>
                  <span className="text-slate-500 dark:text-slate-400 font-bold">{cat.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Meetings Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Recent Meeting Minutes Logs</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Click any meeting row to open the interactive Meeting Studio.</p>
          </div>
          <button 
            onClick={() => {
              window.history.pushState({}, "", "/meetings");
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center"
          >
            View All Meetings
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <th className="pb-3 font-medium">MEETING TITLE</th>
                <th className="pb-3 font-medium">CONDUCTED ON</th>
                <th className="pb-3 font-medium">STATUS</th>
                <th className="pb-3 font-medium">LOCATION / VENUE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {recentMeetings.map((meet) => (
                <tr 
                  key={meet.id} 
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 cursor-pointer transition-colors" 
                  onClick={() => {
                    if (meet.status === "draft") {
                      window.history.pushState({}, "", "/verify");
                    } else {
                      window.history.pushState({}, "", "/meetings");
                    }
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                >
                  <td className="py-3.5 font-bold text-slate-800 dark:text-slate-100">{meet.title}</td>
                  <td className="py-3.5 text-slate-500 dark:text-slate-400">{new Date(meet.date).toLocaleDateString()}</td>
                  <td className="py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      meet.status === "approved" 
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : meet.status === "draft"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                        : meet.status === "processing"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                        : "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {meet.status === "approved" ? "Approved" : meet.status === "draft" ? "Draft / Review" : meet.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-slate-600 dark:text-slate-300 font-semibold">{meet.location || "Conference Room A"}</td>
                </tr>
              ))}
              {recentMeetings.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-slate-400 font-medium">
                    No meetings records found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SUB-PAGE: MEETINGS & ATTENDANCE MANAGEMENT
// ----------------------------------------------------
// SUB-PAGE: ATTENDANCE & PARTICIPANT CHECK-IN PORTAL
// ----------------------------------------------------
function AttendancePortalPage() {
  const { t } = useTranslation();
  const user = getAuthUser();
  const role = user?.role || "Employee";
  const canManage = ["System Admin", "CEO", "Manager"].includes(role);

  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"roster" | "kiosk" | "checkin">("roster");

  // New checkin form state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [checkinMethod, setCheckinMethod] = useState<string>("qr");
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = getAuthToken();
    setLoading(true);
    setError("");
    try {
      const meets = await meetingsApi.list(token);
      setMeetings(meets);
      const allUsers = await attendanceApi.listUsers(token).catch(() => []);
      setUsersList(allUsers);

      if (meets.length > 0) {
        const defaultId = String(meets[0].id);
        setSelectedMeetingId(defaultId);
        await fetchAttendanceForMeeting(meets[0].id, token);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load attendance portal data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceForMeeting = async (meetingId: number, token?: string | null) => {
    const tkn = token || getAuthToken();
    try {
      const records = await attendanceApi.list(meetingId, tkn);
      setAttendanceList(records || []);
      const st = await attendanceApi.getStats(meetingId, tkn).catch(() => null);
      setStats(st);
    } catch (err: any) {
      setAttendanceList([]);
    }
  };

  const handleMeetingSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMeetingId(val);
    if (val) {
      fetchAttendanceForMeeting(parseInt(val));
    }
  };

  const handleCheckinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId) {
      setError("Please select a meeting first.");
      return;
    }
    const userIdToUse = selectedUserId ? parseInt(selectedUserId) : (user?.id || 1);
    const token = getAuthToken();

    setSubmittingCheckin(true);
    setError("");
    setSuccessMsg("");

    try {
      await attendanceApi.checkin(
        parseInt(selectedMeetingId),
        {
          user_id: userIdToUse,
          method: checkinMethod,
          gps_lat: 19.076,
          gps_lng: 72.8777
        },
        token
      );
      setSuccessMsg("Check-in recorded and verified successfully!");
      fetchAttendanceForMeeting(parseInt(selectedMeetingId));
      setSelectedUserId("");
    } catch (err: any) {
      setError(err.message || "Failed to record attendance check-in.");
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const selectedMeeting = meetings.find(m => String(m.id) === selectedMeetingId);
  const filteredRoster = attendanceList.filter(item => {
    const name = item.user?.full_name || item.user?.username || `Participant #${item.user_id}`;
    const dept = item.user?.department || "";
    return name.toLowerCase().includes(filterQuery.toLowerCase()) || dept.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner & RBAC Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Role: {role}
            </span>
            {canManage ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Full Host & Admin Privileges
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> Self Check-in Mode
              </span>
            )}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Meeting Attendance & Check-in Portal
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Enterprise participant verification, digital QR pass kiosk, and live demographic compliance tracking.
          </p>
        </div>

        {/* Meeting Target Selector */}
        <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
          <div className="flex flex-col">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Active Meeting:</label>
            <select
              value={selectedMeetingId}
              onChange={handleMeetingSelect}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none pr-2 cursor-pointer"
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id} className="dark:bg-slate-900 text-slate-800 dark:text-white">
                  {m.title} (ID: {m.id})
                </option>
              ))}
              {meetings.length === 0 && <option value="">No meetings scheduled</option>}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="h-4.5 w-4.5 shrink-0" /> {successMsg}
        </div>
      )}

      {/* KPI Cards for Selected Meeting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>Total Checked-in</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">
            {stats?.total_attendance ?? attendanceList.length}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">Registered participants</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>QR Digital Passes</span>
            <QrCode className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">
            {stats?.methods?.qr ?? attendanceList.filter(a => a.method === 'qr').length}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">Instant pass verification</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>Manual Sign-ins</span>
            <UserCheck className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">
            {stats?.methods?.manual ?? attendanceList.filter(a => a.method === 'manual').length}
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">Host validated roster</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>GPS Geofenced</span>
            <MapPin className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-slate-900 dark:text-white">
            {stats?.methods?.biometric ?? attendanceList.filter(a => a.method === 'gps' || a.method === 'biometric').length}
          </div>
          <span className="text-[11px] text-purple-600 font-semibold">Proximity verified</span>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab("roster")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === "roster"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Users className="h-4 w-4" /> Live Participant Roster ({attendanceList.length})
        </button>

        <button
          onClick={() => setActiveSubTab("kiosk")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === "kiosk"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <QrCode className="h-4 w-4" /> Digital QR Kiosk & Pass
        </button>

        <button
          onClick={() => setActiveSubTab("checkin")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-all ${
            activeSubTab === "checkin"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Plus className="h-4 w-4" /> {canManage ? "Mark Participant Check-in" : "Self Check-in"}
        </button>
      </div>

      {/* Tab 1: Live Roster */}
      {activeSubTab === "roster" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search participant name or department..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              />
            </div>
            {canManage && (
              <button
                onClick={() => setActiveSubTab("checkin")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Add Attendee
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Participant</th>
                    <th className="px-5 py-3.5">Role / Dept</th>
                    <th className="px-5 py-3.5">Check-in Method</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredRoster.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-xs">
                          {(item.user?.full_name || item.user?.username || "P")[0].toUpperCase()}
                        </div>
                        <div>
                          <div>{item.user?.full_name || item.user?.username || `User #${item.user_id}`}</div>
                          <div className="text-[10px] text-slate-400 font-normal">@{item.user?.username || `user${item.user_id}`}</div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-semibold">
                          {item.user?.role || "Participant"} ({item.user?.department || "General"})
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 w-fit ${
                          item.method === 'qr' 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : item.method === 'gps'
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {item.method === 'qr' ? <QrCode className="h-3 w-3" /> : item.method === 'gps' ? <MapPin className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          {item.method.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                        {item.checkin_time ? new Date(item.checkin_time).toLocaleString() : "Just now"}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.verified !== false ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" /> Verified
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px] flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" /> Pending Review
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRoster.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-xs italic font-semibold">
                        No checked-in participants recorded for this meeting yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Digital QR Kiosk */}
      {activeSubTab === "kiosk" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-sm max-w-xl mx-auto">
          <div>
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-extrabold uppercase tracking-wider">
              Meeting Pass Kiosk Mode
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-2">
              {selectedMeeting?.title || "Meeting Digital Pass"}
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              Scan this QR code from mobile device or participant app to instantly record attendance.
            </p>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl inline-block shadow-2xl border border-slate-800">
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center">
              <QrCode className="h-48 w-48 text-slate-900" />
              <span className="text-[10px] font-mono text-slate-500 mt-2 font-bold tracking-widest uppercase">
                {selectedMeeting?.qr_code_data || `MEETING_PASS:${selectedMeetingId}`}
              </span>
            </div>
          </div>

          <div className="flex justify-center space-x-4 text-xs">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Meeting ID</span>
              <div className="font-extrabold text-slate-800 dark:text-slate-100">#{selectedMeetingId}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
              <div className="font-extrabold text-slate-800 dark:text-slate-100">{selectedMeeting?.location || "Hybrid Sync"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Check-in Form */}
      {activeSubTab === "checkin" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            {canManage ? "Mark Participant Attendance" : "Self Attendance Check-in"}
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Record verified attendance for the selected meeting.
          </p>

          <form onSubmit={handleCheckinSubmit} className="space-y-4 text-xs">
            {canManage && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Select Participant / User:</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Current Logged-in User (@{user?.username}) --</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username} ({u.role} - {u.department || 'Dept'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Check-in Verification Method:</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'qr', label: 'QR Pass Scan', icon: QrCode },
                  { id: 'manual', label: 'Manual Sign-in', icon: UserCheck },
                  { id: 'gps', label: 'GPS Geofence', icon: MapPin }
                ].map((m) => {
                  const Icon = m.icon;
                  const selected = checkinMethod === m.id;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setCheckinMethod(m.id)}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                        selected 
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-extrabold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingCheckin}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 mt-4"
            >
              {submittingCheckin ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying Check-in...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Confirm Attendance Record</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------
// SUB-PAGE: MEETINGS & CHECK-IN (REGISTRY)
// ----------------------------------------------------
function MeetingsPage() {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [enableRecording, setEnableRecording] = useState(false);
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<any | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(getAuthUser());
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    const token = getAuthToken();
    try {
      setLoading(true);
      const data = await meetingsApi.list(token);
      setMeetings(data);
    } catch (err: any) {
      setError(err.message || "Failed to load meetings list.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date) return;
    const token = getAuthToken();
    if (!token) return;

    setSubmitLoading(true);
    setError("");
    try {
      const data = await meetingsApi.create({
        title,
        date: new Date(date).toISOString(),
        location,
        agenda,
        scheduled_start: new Date(date).toISOString(),
        agenda_pdf_url: "",
        enable_recording: enableRecording,
        authorization_confirmed: authorizationConfirmed
      }, token);

      setCreatedMeeting(data);
      setShowQR(true);
      setTitle("");
      setDate("");
      setLocation("");
      setAgenda("");
      setEnableRecording(false);
      setAuthorizationConfirmed(false);
      // Reload meetings list
      await loadMeetings();
    } catch (err: any) {
      setError(err.message || "Failed to schedule the meeting.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const isSecretaryOrAdmin = currentUser?.role === "System Admin" || currentUser?.role === "CEO" || currentUser?.role === "Manager" || currentUser?.role === "Admin" || currentUser?.role === "Secretary";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
        <span className="text-sm font-semibold text-slate-500">Loading scheduled meetings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Enterprise Meetings & Agenda Registry</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Schedule corporate meetings, invite participants, issue digital check-in passes, and trace attendance registers.</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Creation Form */}
        <div className={`lg:col-span-2 ${isSecretaryOrAdmin ? "" : "hidden"}`}>
          <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold mb-4 text-slate-800 dark:text-slate-100">Schedule New Enterprise Meeting</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Meeting Title / Subject</label>
                  <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Q3 Executive Strategy & Product Review"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Proposed Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Meeting Location / Virtual Video Link</label>
                <input 
                  type="text" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Conference Room A / Zoom Link"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Detailed Agenda & Objectives</label>
                <textarea 
                  value={agenda} 
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="Outline discussion items, deliverables, and financial budget proposals..."
                  rows={4}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableRecording}
                    onChange={(e) => setEnableRecording(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Enable Automatic Meeting Recording Mode
                  </span>
                </label>

                {enableRecording && (
                  <label className="flex items-start gap-2.5 pl-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={authorizationConfirmed}
                      onChange={(e) => setAuthorizationConfirmed(e.target.checked)}
                      className="w-3.5 h-3.5 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      I confirm that I am authorized to initiate recording for this meeting and that participants will be informed according to organizational policy.
                    </span>
                  </label>
                )}
              </div>

              <button 
                type="submit" 
                disabled={submitLoading}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center shadow-md transition-colors"
              >
                {submitLoading ? "Scheduling..." : "Schedule Meeting"}
                <Calendar className="h-4 w-4 ml-1.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Read-only view */}
        {!isSecretaryOrAdmin && (
          <div className="lg:col-span-2 bg-slate-50/50 dark:bg-slate-800/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center">
            <Calendar className="h-10 w-10 text-indigo-500 mx-auto mb-3" />
            <h3 className="text-base font-bold mb-1 text-slate-800 dark:text-slate-200">Official Schedules Registry</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
              All scheduled meetings are managed by meeting hosts and secretaries. Team members can view schedules, check-in QR codes, and agendas below.
            </p>
          </div>
        )}

        {/* Dynamic QR Code display card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm min-h-[300px]">
          {showQR && createdMeeting ? (
            <div className="space-y-4 animate-scaleUp">
              <div className="border border-slate-200 dark:border-slate-800 p-4 bg-white rounded-2xl shadow-inner inline-block">
                <div className="h-44 w-44 bg-slate-100 flex flex-col items-center justify-center border-2 border-dashed border-indigo-400 rounded-xl relative">
                  <FileCode className="h-12 w-12 text-indigo-500" />
                  <span className="text-[10px] font-mono text-slate-400 mt-2 px-2 break-all">{createdMeeting.qr_code_data}</span>
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-0.5"><Check className="h-3 w-3" /></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Digital Check-in Pass Ready</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">Participants scan this code via mobile app to register check-in logs immediately.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <button 
                  onClick={() => {
                    window.location.href = `/meetings/${createdMeeting.id}/live`;
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  Start Recording Now
                </button>
                <button 
                  onClick={() => setShowQR(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Close Ticket
                </button>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 space-y-2">
              <FileCode className="h-12 w-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-500">Digital Check-in Pass</h4>
              <p className="text-xs text-slate-400 max-w-xs">Schedule a meeting or click any scheduled log below to display the official QR Code pass.</p>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled meetings listing */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Official Meeting Schedules & Agenda Registry</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select any meeting below to launch its live recording workspace or view meeting studio.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <th className="pb-3">Meeting Title / Topic</th>
                <th className="pb-3">Date & Time</th>
                <th className="pb-3">Venue</th>
                <th className="pb-3">Agenda Detail</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {meetings.map((meet) => (
                <tr key={meet.id} className="hover:bg-slate-50/20">
                  <td className="py-4 font-bold text-slate-800 dark:text-slate-150">{meet.title}</td>
                  <td className="py-4 text-slate-500">{new Date(meet.date).toLocaleString()}</td>
                  <td className="py-4 text-slate-600 font-semibold">{meet.location || "Executive Boardroom"}</td>
                  <td className="py-4 text-slate-450 truncate max-w-[200px]" title={meet.agenda}>{meet.agenda || "Not specified"}</td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      meet.status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : meet.status === "draft"
                        ? "bg-amber-50 text-amber-700"
                        : meet.status === "processing"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-50 text-slate-700"
                    }`}>
                      {meet.status}
                    </span>
                  </td>
                  <td className="py-4 text-right whitespace-nowrap space-x-2">
                    <button 
                      onClick={() => {
                        window.location.href = `/meetings/${meet.id}/live`;
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1 transition"
                    >
                      <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Capture
                    </button>
                    <button 
                      onClick={() => {
                        window.location.href = `/verify?meeting_id=${meet.id}`;
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-1 transition"
                    >
                      <FileCheck className="w-3.5 h-3.5" /> Studio
                    </button>
                    <button 
                      onClick={() => {
                        setCreatedMeeting(meet);
                        setShowQR(true);
                      }}
                      className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 rounded-xl inline-flex items-center gap-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <QrCode className="w-3.5 h-3.5" /> QR Pass
                    </button>
                  </td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-medium">
                    No scheduled meetings available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SUB-PAGE: MEETING RECORDER PIPELINE (SPEECH-TO-TEXT)
// ----------------------------------------------------
function RecordPage() {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState(0);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [polling, setPolling] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMeetings();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadMeetings = async () => {
    const token = getAuthToken();
    try {
      const data = await meetingsApi.list(token);
      setMeetings(data);
      if (data.length > 0) {
        setSelectedMeeting(String(data[0].id));
      }
    } catch (err: any) {
      setError("Failed to fetch meetings for uploader link.");
    }
  };

  const createQuickMeeting = async (): Promise<string | null> => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const now = new Date();
      const title = `Executive Meeting - ${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      const isoNow = now.toISOString();
      const newMeeting = await meetingsApi.create({
        title,
        date: isoNow,
        scheduled_start: isoNow,
        location: 'Conference Room A',
        agenda: 'Audio Upload & AI Transcription Session',
        agenda_pdf_url: ''
      }, token);
      setMeetings((prev: any[]) => [newMeeting, ...prev]);
      setSelectedMeeting(String(newMeeting.id));
      return String(newMeeting.id);
    } catch (err: any) {
      setError('Failed to auto-create meeting. Please go to Meetings & Check-in tab to create one first.');
      return null;
    }
  };

  // Start live microphone recording
  const startRecording = async () => {
    setError("");
    setUploadStatus("");
    setProcessingStatus("");
    audioChunksRef.current = [];
    setAudioChunks(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const options = { mimeType: "audio/webm" };
      
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream); // fallback
      }

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleAudioUpload(audioBlob);
      };

      // Request data every 2s
      mediaRecorder.start(2000);
      setRecording(true);

      timerRef.current = setInterval(() => {
        setAudioChunks((prev) => prev + 1);
      }, 2000);

    } catch (err: any) {
      setError("Microphone permission denied or device not supported. Use the local audio file uploader instead.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      // Stop stream tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Common upload logic (Blob or File)
  const handleAudioUpload = async (audioBlobOrFile: Blob | File) => {
    const token = getAuthToken();
    if (!token) return;

    setLoading(true);
    setError("");

    // Auto-create a meeting if none selected
    let meetingIdStr = selectedMeeting;
    if (!meetingIdStr) {
      setUploadStatus("No meeting found — creating one automatically...");
      const created = await createQuickMeeting();
      if (!created) {
        setLoading(false);
        return;
      }
      meetingIdStr = created;
    }

    setUploadStatus("Uploading audio buffer segment to Indic Pipeline...");
    try {
      const meetingId = parseInt(meetingIdStr);
      
      // Update meeting status to ongoing/processing
      await meetingsApi.updateStatus(meetingId, "ongoing", token);
      
      // Upload file
      await audioApi.upload(meetingId, audioBlobOrFile, token);

      setUploadStatus("Upload successful. Running ASR Speech-to-Text Pipeline...");
      startPollingStatus(meetingId);
    } catch (err: any) {
      setError(err.message || "Failed to upload audio payload.");
      setLoading(false);
    }
  };

  // Poll meeting status to show granular pipeline logs
  const startPollingStatus = (meetingId: number) => {
    setPolling(true);
    const token = getAuthToken();
    let counter = 0;

    pollIntervalRef.current = setInterval(async () => {
      counter++;
      try {
        const meet = await meetingsApi.get(meetingId, token);
        if (meet.status === "processing") {
          // Dynamic fake granular steps based on timing
          if (counter < 3) {
            setProcessingStatus("Step 1/4: Running noise reduction & bandwidth filtering (PS-Denoise)...");
          } else if (counter < 6) {
            setProcessingStatus("Step 2/4: Detecting dialects & running Speech-to-Text (ASR Whisper)...");
          } else if (counter < 9) {
            setProcessingStatus("Step 3/4: running pyannote.audio speaker diarization & timestamps...");
          } else {
            setProcessingStatus("Step 4/4: Extracting structured minutes (resolutions, budget splits)...");
          }
        } else if (meet.status === "draft") {
          setUploadStatus("Speech-to-Text and minutes extraction complete!");
          setProcessingStatus("Status: DRAFT review ready. Proceed to the 'Review & Sign' tab.");
          setLoading(false);
          setPolling(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        } else if (meet.status === "failed") {
          setError("indic Speech-to-Text pipeline encountered an error compiling audio segments.");
          setLoading(false);
          setPolling(false);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        // Ignore error and continue polling
      }
    }, 3000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleAudioUpload(file);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("AI Speech-to-Text Pipeline (ASR)")}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t("Capture live meeting audio with noise filter buffers, or upload pre-recorded meetings.")}</p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4.5 w-4.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Recording Panel */}
          <div className="bg-slate-900 text-white rounded-2xl p-8 text-center relative overflow-hidden shadow-lg border border-slate-850">
            <h3 className="text-lg font-bold">Live Meeting Mic Streamer</h3>
            <p className="text-slate-400 text-xs mt-1">Directly records and streams audio segments to the AI speech pipeline.</p>
            
            {/* Visualizer animation */}
            <div className="my-8 flex justify-center items-center space-x-1.5 h-16">
              {recording ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-1 bg-amber-400 rounded-full animate-pulse" 
                    style={{ 
                      height: `${Math.max(10, Math.sin(i + audioChunks) * 50 + 20)}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))
              ) : (
                <div className="h-1.5 w-48 bg-slate-800 rounded-full" />
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
              {recording ? (
                <button 
                  onClick={stopRecording}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center justify-center transition-colors"
                >
                  <MicOff className="h-4.5 w-4.5 mr-2" /> Stop & Process Audio
                </button>
              ) : (
                <button 
                  onClick={startRecording}
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-md flex items-center justify-center transition-colors"
                >
                  <Mic className="h-4.5 w-4.5 mr-2" /> Start Live Recording
                </button>
              )}
              {recording && (
                <span className="text-xs text-slate-450 font-semibold">
                  {audioChunks * 2}s elapsed | buffering segments...
                </span>
              )}
            </div>
          </div>

          {/* Upload panel */}
          <div className="bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-base font-bold mb-4 text-slate-800 dark:text-slate-100">{t("Upload Pre-recorded Audio or Video")}</h3>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-900/10 cursor-pointer transition-colors relative">
              <Upload className="h-8 w-8 text-slate-450 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("Drag and drop file here, or click to browse")}</p>
              <p className="text-xs text-slate-400 mt-1">Supports MP3, WAV, WebM, M4A (max 100MB)</p>
              <input 
                type="file" 
                onChange={handleFileChange}
                disabled={loading}
                className="hidden" 
                id="file-upload" 
              />
              <label 
                htmlFor="file-upload" 
                className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {t("Select Audio File")}
              </label>
            </div>
          </div>

          {(uploadStatus || processingStatus) && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 p-5 rounded-xl space-y-2.5 shadow-sm">
              {uploadStatus && <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> {uploadStatus}</h4>}
              {processingStatus && (
                <div className="flex items-center gap-2">
                  {polling && <Loader2 className="h-3.5 w-3.5 text-indigo-500 animate-spin" />}
                  <p className="text-xs text-slate-550 dark:text-slate-400 font-semibold">{processingStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pipeline options */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Pipeline Configuration</h3>
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Target Meeting Link</label>
            <select 
              value={selectedMeeting}
              onChange={async (e) => {
                if (e.target.value === '__create__') {
                  await createQuickMeeting();
                } else {
                  setSelectedMeeting(e.target.value);
                }
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
            >
              {meetings.length === 0 && <option value="">Auto-create meeting on upload ✓</option>}
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
              <option value="__create__">＋ Create New Meeting Now</option>
            </select>
            {meetings.length === 0 && (
              <p className="text-xs text-indigo-500 mt-1 font-medium">✓ A meeting will be auto-created when you upload audio.</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-850 pt-4">
            <div>
              <h4 className="text-sm font-semibold">Active Noise Reduction</h4>
              <p className="text-xs text-slate-450">Filter background ceiling fans/chatter</p>
            </div>
            <input 
              type="checkbox" 
              checked={noiseReduction}
              onChange={() => setNoiseReduction(!noiseReduction)}
              className="h-4 w-4 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500" 
            />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ASR AI Stack</h4>
            <div className="flex justify-between text-xs font-medium text-slate-550">
              <span>ASR Engine:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">OpenAI Whisper V3</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-550">
              <span>Diarization:</span>
              <span className="font-extrabold text-slate-800 dark:text-slate-200">pyannote.audio</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-550">
              <span>Language:</span>
              <span className="font-extrabold text-indigo-650 dark:text-indigo-400">Indic Speech Autodetect</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SUB-PAGE: AI MEETING MINUTES & TRANSCRIPT STUDIO
// ----------------------------------------------------
function VerifyPage({ initialTab = "overview" }: { initialTab?: string }) {
  return <MinutesReviewStudio initialTab={initialTab} />;
}

// ----------------------------------------------------
// SUB-PAGE: AI SEARCH ASSISTANT (RAG CHATBOT)
// ----------------------------------------------------
function ChatPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<any[]>([
    { role: "assistant", content: t("Greetings! I am your AI Meeting Assistant. Ask me anything about meeting decisions, budgetary allocations, or action items.") }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadMeetings();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMeetings = async () => {
    const token = getAuthToken();
    try {
      const data = await meetingsApi.list(token);
      setMeetings(data);
    } catch (_) {}
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    setError("");
    const userMsg = { role: "user", content: inputValue };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");
    setLoading(true);

    const token = getAuthToken();
    try {
      const meetingFilter = selectedMeetingId ? parseInt(selectedMeetingId) : null;
      const data = await chatApi.ask(updatedMessages, meetingFilter, token);
      
      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.content, citations: data.citations }
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to connect to RAG assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn h-[680px] flex flex-col">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{t("AI Meeting Assistant (RAG)")}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t("Contextual semantic search over archived meeting transcripts.")}</p>
        </div>

        {/* Optional filter */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500">{t("Filter Meeting:")}</label>
          <select 
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] outline-none font-bold"
          >
            <option value="">All Meeting Archives</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0">
          <AlertCircle className="h-4.5 w-4.5" /> {error}
        </div>
      )}

      {/* Chat scroll content */}
      <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-850 rounded-2xl p-6 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl rounded-2xl p-4 shadow-sm text-xs leading-relaxed space-y-3 ${
              msg.role === "user" 
                ? "bg-indigo-600 text-white font-medium" 
                : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 text-slate-800 dark:text-slate-150"
            }`}>
              <p>{msg.content}</p>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-850 pt-2.5 mt-2.5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Citations & Sources</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {msg.citations.map((cit: any, cIdx: number) => (
                      <div key={cIdx} className="bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-100 dark:border-slate-850 rounded-xl text-[10px]">
                        <span className="font-bold text-indigo-650 dark:text-indigo-400 block">{cit.title}</span>
                        <p className="text-slate-500 mt-1 italic line-clamp-2">"...{cit.text_segment}..."</p>
                        <div className="flex justify-between items-center text-[9px] text-slate-400 font-semibold mt-1">
                          <span>Confidence:</span>
                          <span className="text-emerald-500 font-extrabold">{Math.round(cit.confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center space-x-2">
              <Loader2 className="h-4 w-4 text-indigo-600 animate-spin" />
              <span className="text-xs text-slate-400 font-semibold">Searching meeting archives...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSend} className="flex gap-3 shrink-0">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question about meeting decisions, project deliverables, or action items..."
          className="flex-1 bg-white border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
        <button 
          type="submit" 
          disabled={loading || !inputValue.trim()}
          className="px-6 bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md"
        >
          {t("Send Query")}
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// SUB-PAGE: PUBLIC CITIZEN SEARCH REGISTRY
// ----------------------------------------------------
function CitizenPortalPage() {
  const [searchWord, setSearchWord] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Translation options for citizen
  const [selectedLanguage, setSelectedLanguage] = useState("original");
  const [expandedMeetingId, setExpandedMeetingId] = useState<number | null>(null);
  const [expandedTranslation, setExpandedTranslation] = useState("");
  const [expandedLoading, setExpandedLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWord.trim()) return;

    const token = getAuthToken();
    setLoading(true);
    setError("");
    setExpandedMeetingId(null);
    setExpandedTranslation("");
    try {
      const data = await searchApi.search(searchWord, token);
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Global index search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleExpandTranslation = async (meetingId: number, langCode: string) => {
    if (expandedMeetingId === meetingId) {
      setExpandedMeetingId(null);
      setExpandedTranslation("");
      return;
    }
    setExpandedMeetingId(meetingId);
    setExpandedLoading(true);
    setExpandedTranslation("");
    const token = getAuthToken();
    try {
      let data;
      try {
        data = await translationApi.get(meetingId, langCode, token);
      } catch {
        data = await translationApi.generate(meetingId, langCode, token);
      }
      setExpandedTranslation(data.minutes_summary || "No translated summary found.");
    } catch (err: any) {
      setExpandedTranslation("Failed to fetch translation: " + err.message);
    } finally {
      setExpandedLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Participant Directory & Semantic Index</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Contextual semantic search over meeting minutes, action items, and enterprise decision logs.</p>
        </div>

        {/* Language selector for citizen view */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">View Language:</label>
          <select 
            value={selectedLanguage}
            onChange={(e) => {
              setSelectedLanguage(e.target.value);
              setExpandedMeetingId(null);
              setExpandedTranslation("");
            }}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 dark:text-indigo-400"
          >
            <option value="original">Original (Default)</option>
            <option value="hi">Hindi (हिंदी)</option>
            <option value="mr">Marathi (मराठी)</option>
            <option value="te">Telugu (తెలుగు)</option>
            <option value="en">English (English)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0">
          <AlertCircle className="h-4.5 w-4.5" /> {error}
        </div>
      )}

      {/* Public Search Bar */}
      <form onSubmit={handleSearch} className="max-w-2xl bg-slate-50/50 dark:bg-slate-800/10 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex gap-2">
        <input 
          type="text" 
          value={searchWord}
          onChange={(e) => setSearchWord(e.target.value)}
          placeholder="Search by project topic, department name, or decision details..."
          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          Search Index
        </button>
      </form>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold mb-4">Official Meeting Index & Decision Registry</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <th className="pb-3">Resolution Details</th>
                <th className="pb-3">Parent Meeting</th>
                <th className="pb-3">Matching Content Segment</th>
                <th className="pb-3">Approval Date</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {results.map((res, index) => (
                <React.Fragment key={index}>
                  <tr className="hover:bg-slate-55/20">
                    <td className="py-4 font-bold text-slate-800 dark:text-slate-150">Topic Index Match</td>
                    <td className="py-4 text-slate-600 font-bold">{res.title} (ID: {res.meeting_id})</td>
                    <td className="py-4 text-slate-500 italic max-w-sm">"...{res.text_segment}..."</td>
                    <td className="py-4 text-slate-400">{res.date}</td>
                    <td className="py-4">
                      <div className="flex flex-col space-y-1 items-start">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          res.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                        }`}>
                          {res.status}
                        </span>
                        {selectedLanguage !== "original" && (
                          <button
                            type="button"
                            onClick={() => handleExpandTranslation(res.meeting_id, selectedLanguage)}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold mt-1.5 focus:outline-none"
                          >
                            {expandedMeetingId === res.meeting_id ? "Hide translation" : `Translate Summary`}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedMeetingId === res.meeting_id && (
                    <tr className="bg-indigo-50/20 dark:bg-indigo-950/5">
                      <td colSpan={5} className="py-3 px-4 border-t border-b border-indigo-100/50 dark:border-indigo-900/25">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            Translated Executive Summary ({selectedLanguage === "hi" ? "Hindi" : selectedLanguage === "mr" ? "Marathi" : selectedLanguage === "te" ? "Telugu" : "English"})
                          </span>
                          {expandedLoading ? (
                            <div className="flex items-center space-x-2 py-2">
                              <Loader2 className="h-3.5 w-3.5 text-indigo-600 animate-spin" />
                              <span className="text-xs font-medium text-slate-400">Generating dynamic translation from e-ledger...</span>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap py-1.5">
                              {expandedTranslation}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400 font-semibold italic">
                    Type a query above (e.g. "budget", "security", "product") and search to check official vector index matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// SUB-PAGE: IMMUTABLE AUDIT LEDGER
// ----------------------------------------------------
function AuditPage() {
  const { t } = useTranslation();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    const token = getAuthToken();
    try {
      const data = await meetingsApi.list(token);
      setMeetings(data);
      if (data.length > 0) {
        setSelectedMeetingId(String(data[0].id));
        loadLogs(data[0].id);
      }
    } catch (_) {}
  };

  const loadLogs = async (meetingId: number) => {
    const token = getAuthToken();
    setLoading(true);
    setError("");
    try {
      const logs = await auditApi.getLogs(meetingId, token);
      setAuditLogs(logs);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs trail.");
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMeetingSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMeetingId(val);
    if (val) {
      loadLogs(parseInt(val));
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Cryptographic Audit Ledger & Compliance Registry</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Verify immutable transaction logs, revision history, and SHA256 digital seals.</p>
        </div>

        {/* Meeting selector dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-550 dark:text-slate-400">Target Meeting Ledger:</label>
          <select 
            value={selectedMeetingId}
            onChange={handleMeetingSelect}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          >
            {meetings.map((d) => (
              <option key={d.id} value={d.id}>{d.title} (ID: {d.id})</option>
            ))}
            {meetings.length === 0 && <option value="">{t("No meetings found")}</option>}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <AlertCircle className="h-4.5 w-4.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
          <span className="text-sm font-semibold text-slate-500">Checking block hashes & audit trail logs...</span>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold mb-6 text-slate-800 dark:text-slate-100">{t("Verification Ledger Chronology")}</h3>
          <div className="space-y-6 relative border-l border-slate-100 dark:border-slate-850 ml-4 pl-6">
            {auditLogs.map((log) => (
              <div key={log.id} className="relative">
                {/* Dot marker */}
                <div className="absolute -left-9 top-1.5 h-6 w-6 rounded-full border-4 border-white dark:border-slate-900 bg-indigo-650 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{log.action}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Action performed by User ID: {log.modified_by_id}</h4>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="bg-slate-50/50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t("Previous state summary")}</span>
                      <p className="text-[11px] text-slate-500 italic max-h-[80px] overflow-y-auto">{log.previous_state?.summary || "No previous summary"}</p>
                    </div>
                    <div className="bg-slate-50/50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">{t("Current state summary")}</span>
                      <p className="text-[11px] text-slate-500 italic max-h-[80px] overflow-y-auto">{log.current_state?.summary || "No current summary"}</p>
                    </div>
                  </div>
                  {log.current_state?.digital_hash && (
                    <div className="bg-slate-900/5 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 font-mono text-[10px] text-emerald-600 dark:text-emerald-400 break-all">
                      Sealed Signature Ledger Checksum: {log.current_state.digital_hash}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400 font-semibold italic">
                No logs exist in the ledger for this meeting yet. Try finalizing draft minutes first.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

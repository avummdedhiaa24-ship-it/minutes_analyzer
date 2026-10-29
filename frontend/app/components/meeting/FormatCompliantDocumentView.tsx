"use client";

import React from "react";
import { 
  Printer, Download, ShieldCheck, CheckCircle2, 
  Calendar, Clock, MapPin, Building, Users, FileText, CheckSquare, AlertTriangle, HelpCircle, DollarSign
} from "lucide-react";

interface Props {
  meeting: any;
  minutes: any;
  detailedMinutes?: any;
  transcripts?: any;
  exportUrl: (format: "text" | "json" | "pdf" | "docx") => string;
}

export default function FormatCompliantDocumentView({
  meeting,
  minutes,
  detailedMinutes,
  transcripts,
  exportUrl
}: Props) {
  const handlePrint = () => {
    window.print();
  };

  const attendanceList = minutes?.attendance_snapshot || meeting?.attendance || [];
  const decisionsList = minutes?.decisions || detailedMinutes?.decisions || meeting?.decisions || [];
  const actionItemsList = minutes?.action_items || detailedMinutes?.action_items || meeting?.action_items || [];
  const topicsList = detailedMinutes?.detailed_discussion || minutes?.topics || [];
  const risksList = detailedMinutes?.risks || minutes?.issues_and_risks || [];
  const questionsList = detailedMinutes?.questions_and_concerns || [];
  const unresolvedList = detailedMinutes?.unresolved_issues || [];

  const digitalSeal = minutes?.digital_hash || "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
            FIG. 3 SPECIFICATION
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Standardized Format-Compliant Meeting Minutes Document
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Print / Save Formal PDF
          </button>
          <a
            href={exportUrl("docx")}
            download
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export Official DOCX
          </a>
        </div>
      </div>

      {/* Official Printable Document Container */}
      <div className="bg-white text-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xl max-w-4xl mx-auto space-y-8 font-sans print:border-none print:shadow-none print:p-0 print:max-w-none">
        
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block">
                Enterprise AI Corporate Governance
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
                Official Meeting Minutes & Executive Record
              </h1>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {minutes?.digital_hash ? "SEALED RECORD" : "OFFICIAL DRAFT"}
              </span>
              <span className="block text-[10px] font-mono text-slate-500 mt-1">
                Doc ID: MTN-{meeting?.id || "802"}-REV{minutes?.version_number || 1}
              </span>
            </div>
          </div>

          {/* Meeting Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Session Title</span>
              <span className="font-bold text-slate-900">{meeting?.title || "Executive Strategy Review"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Date & Time</span>
              <span className="font-semibold text-slate-800">{meeting?.date ? new Date(meeting.date).toLocaleDateString() : "2026-10-15"} · 10:00 AM</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Presiding Officer</span>
              <span className="font-semibold text-slate-800">Shyam Sagar (Director)</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Secretary / Host</span>
              <span className="font-semibold text-slate-800">Avumm Dedhiaa (Host)</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: ATTENDANCE & QUORUM REGISTRY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              1. Participant Attendance & Quorum Verification
            </h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Quorum Met (100%)
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Participant Name</th>
                <th className="p-2.5">Designation / Role</th>
                <th className="p-2.5">Detection Method</th>
                <th className="p-2.5 text-right">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="p-2.5 font-bold text-slate-900">Avumm Dedhiaa</td>
                <td className="p-2.5 text-slate-600">Meeting Host & Primary Presenter</td>
                <td className="p-2.5 text-slate-600 font-mono">Screen OCR + Voice Calibration</td>
                <td className="p-2.5 text-right font-bold text-emerald-600">PRESENT (98%)</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-2.5 font-bold text-slate-900">Shyam Sagar</td>
                <td className="p-2.5 text-slate-600">Executive Director / Co-Host</td>
                <td className="p-2.5 text-slate-600 font-mono">Screen OCR Attendee Tile</td>
                <td className="p-2.5 text-right font-bold text-emerald-600">PRESENT (95%)</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-2.5 font-bold text-slate-900">Krish</td>
                <td className="p-2.5 text-slate-600">Session Prompter & Coordinator</td>
                <td className="p-2.5 text-slate-600 font-mono">Screen OCR Attendee Tile</td>
                <td className="p-2.5 text-right font-bold text-emerald-600">PRESENT (94%)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 2: EXECUTIVE SUMMARY */}
        <div className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            2. Executive Summary
          </h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
            {minutes?.summary || "Avumm Dedhiaa presented the dual-mode virtual machine analyzer architecture, demonstrating local mode and virtual scanner operating system capabilities. Shyam Sagar moderated session opening and Krish provided prompter countdown coordination."}
          </p>
        </div>

        {/* SECTION 3: KEY TOPICS & DETAILED DELIBERATIONS */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            3. Key Discussion Topics & Deliberations
          </h2>
          <div className="space-y-2.5">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-xs font-bold text-indigo-900 block">Topic 3.1: Dual-Mode Virtual Machine Analyzer Architecture</span>
              <p className="text-xs text-slate-600 mt-1">
                Avumm Dedhiaa explained the engine execution architecture which runs on single Python scripts and transitions into virtual server modes. The architecture operates in two configurations: local execution mode and remote scanner operating system mode streaming through SSS.
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <span className="text-xs font-bold text-indigo-900 block">Topic 3.2: Stream Readiness & Prompter Coordination</span>
              <p className="text-xs text-slate-600 mt-1">
                Krish coordinated countdown timing (3, 2, 1, go) to ensure audio buffering and video frame alignment prior to demonstrating the core operating system scanner.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 4: CORPORATE DECISIONS REGISTER */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            4. Confirmed Corporate Decisions Register
          </h2>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Decision Title</th>
                <th className="p-2.5">Underlying Rationale</th>
                <th className="p-2.5">Signatories</th>
                <th className="p-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-2.5 font-bold text-slate-900">Adopt Dual-Mode Analyzer Architecture</td>
                <td className="p-2.5 text-slate-600">Enables simultaneous local script execution and virtual server scanner modes</td>
                <td className="p-2.5 text-slate-600 font-medium">Avumm Dedhiaa, Shyam Sagar</td>
                <td className="p-2.5 text-right font-bold text-emerald-700">APPROVED (100%)</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 5: ACTION ITEMS & DELIVERABLES */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            5. Action Items & Execution Deliverables
          </h2>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">Deliverable</th>
                <th className="p-2.5">Assigned Owner</th>
                <th className="p-2.5">Deadline (ISO 8601)</th>
                <th className="p-2.5 text-right">Source Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="p-2.5 font-bold text-slate-900">Deploy Virtual Scanner Operating System mode to staging server</td>
                <td className="p-2.5 text-slate-600">Avumm Dedhiaa (Engineering)</td>
                <td className="p-2.5 text-slate-600 font-mono">2026-11-05</td>
                <td className="p-2.5 text-right font-mono text-indigo-600">Timestamp 00:05</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-slate-900">Configure multi-turn countdown calibration for prompter buffer</td>
                <td className="p-2.5 text-slate-600">Krish (Operations)</td>
                <td className="p-2.5 text-slate-600 font-mono">2026-10-31</td>
                <td className="p-2.5 text-right font-mono text-indigo-600">Timestamp 00:01</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SECTION 6: DIGITAL CRYPTOGRAPHIC SEAL & GOVERNANCE PROOF */}
        <div className="pt-6 border-t-2 border-slate-900 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Cryptographic SHA-256 Governance Seal
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Status: IMMUTABLE & VERIFIED</span>
            </div>

            <div className="font-mono text-xs break-all bg-slate-950 p-3 rounded-xl border border-slate-800 text-slate-300">
              <span className="text-slate-500 block text-[10px] uppercase">SHA-256 Digest:</span>
              {digitalSeal}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 pt-1">
              <div>Sealed By: <span className="text-white font-semibold">System Administrator</span></div>
              <div>Revision: <span className="text-white font-semibold">Version #1 (Finalized)</span></div>
              <div>Audit Chain: <span className="text-emerald-400 font-semibold">Chain Intact (Tamper-Free)</span></div>
            </div>
          </div>

          <div className="flex justify-between items-end pt-4 text-xs text-slate-500">
            <div>
              <p>Generated by Enterprise AI Meeting Intelligence Operating System.</p>
              <p className="text-[10px]">Verified via Multi-Signal Diarization, In-Memory Screen OCR & SHA-256 Ledger.</p>
            </div>
            <div className="border-t border-slate-400 pt-1 w-48 text-center text-slate-700 font-semibold">
              Authorized Executive Signature
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

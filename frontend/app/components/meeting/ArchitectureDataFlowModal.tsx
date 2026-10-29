"use client";

import React, { useState } from "react";
import { 
  X, Cpu, Radio, Eye, Mic, Brain, ShieldCheck, Database, 
  ArrowRight, CheckCircle, FileText, Activity, Layers, ArrowDown
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  meetingId?: number;
}

export default function ArchitectureDataFlowModal({ isOpen, onClose, meetingId }: Props) {
  const [selectedModule, setSelectedModule] = useState<string>("fusion");

  if (!isOpen) return null;

  const modules = [
    {
      id: "capture",
      title: "1. Capture & Audio Preprocessor",
      icon: Radio,
      category: "Input Acquisition",
      color: "from-blue-600 to-cyan-600",
      bgLight: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
      inputs: ["Dual-source mic stream", "Browser tab audio", "Pre-recorded meeting files"],
      outputs: ["16kHz Mono PCM Audio", "Voice Activity Detection (VAD) regions", "SNR & Clipping diagnostics"],
      description: "Normalizes dual-source input audio, removes silence gaps, computes RMS volume levels, and segments audio into VAD-guided chunks."
    },
    {
      id: "ocr",
      title: "2. Ephemeral In-Memory Screen OCR",
      icon: Eye,
      category: "Vision & Presence",
      color: "from-emerald-600 to-teal-600",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
      inputs: ["Live conference video frames (Google Meet, Zoom, Teams)"],
      outputs: ["Participant tile bounding boxes", "Detected attendee names", "Active-speaker green contour events"],
      description: "Analyzes video conference tiles strictly in RAM with zero disk storage for enterprise privacy. Detects speaker borders and builds the real-time attendance roster."
    },
    {
      id: "asr",
      title: "3. Whisper ASR & Acoustic Extraction",
      icon: Mic,
      category: "Speech Processing",
      color: "from-purple-600 to-indigo-600",
      bgLight: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
      inputs: ["Preprocessed 16kHz audio chunks"],
      outputs: ["Verbatim raw speech text", "Word-level timestamp alignments", "124-dim sliding window acoustic features"],
      description: "Executes local Whisper ASR and extracts 20-band MFCCs, Delta, Delta-Delta, and Spectral Centroid embeddings for speaker turn detection."
    },
    {
      id: "fusion",
      title: "4. Multimodal Identity Fusion Engine (FIG. 2)",
      icon: Brain,
      category: "Core Identity",
      color: "from-amber-600 to-orange-600",
      bgLight: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
      inputs: [
        "124-dim acoustic embeddings",
        "Calibrated voice profiles",
        "OCR attendee roster",
        "Visual active speaker cues",
        "Rule B2 dialogue context ('what they say')"
      ],
      outputs: [
        "3-Tier classification (MATCHED ≥0.72, AMBIGUOUS 0.55-0.72, UNKNOWN <0.55)",
        "Verified human participant names",
        "Explainable evidence breakdowns"
      ],
      description: "Combines biometric voice matching, OCR tile verification, visual speaker highlights, and conversational cues with human-review routing."
    },
    {
      id: "minutes",
      title: "5. Grounded Minutes & Decisions Engine",
      icon: FileText,
      category: "NLP & Reasoning",
      color: "from-rose-600 to-pink-600",
      bgLight: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800",
      inputs: ["Named transcript segments", "Meeting agenda", "Confirmed attendance roster"],
      outputs: [
        "12-Section Format-Compliant Minutes",
        "Action items with ISO 8601 deadlines",
        "Corporate Decision Register with signatories"
      ],
      description: "Powered by Gemini 1.5 Flash / GPT-4 Turbo / Local deterministic NLP. Grounds every single deliverable, decision, and financial figure in exact transcript quotes."
    },
    {
      id: "governance",
      title: "6. Cryptographic Audit & Sealing Ledger (FIG. 6)",
      icon: ShieldCheck,
      category: "Governance & Security",
      color: "from-emerald-700 to-green-700",
      bgLight: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
      inputs: ["Finalized minutes state", "Approval credentials", "Previous block audit hash"],
      outputs: [
        "SHA-256 Digital Seal",
        "Immutable version snapshots",
        "Tamper-evident audit chain"
      ],
      description: "Applies SHA-256 chained hashing to finalize meeting records. Recomputing hash chains detects any retroactive modification."
    },
    {
      id: "narration",
      title: "7. Audio Narration & Multi-Format Export (FIG. 5)",
      icon: Layers,
      category: "Distribution",
      color: "from-sky-600 to-blue-600",
      bgLight: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800",
      inputs: ["Sealed minutes record", "Digital hash seal"],
      outputs: [
        "Audio Narration bound to version",
        "TXT, JSON, PDF, DOCX exports",
        "Dense RAG vector embeddings"
      ],
      description: "Generates spoken executive briefings cryptographically tied to the sealed minutes version, alongside formatted document exports and RAG indexing."
    }
  ];

  const activeMod = modules.find((m) => m.id === selectedModule) || modules[3];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                  FIG. 1 SPECIFICATION
                </span>
                <span className="text-xs text-slate-400">Meeting #{meetingId || "Active"}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                System Architecture & Inter-Module Data Exchange
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Module Pipeline Chain Selector */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
              Module Execution Pipeline (Click to inspect exchanged data)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {modules.map((m, idx) => {
                const Icon = m.icon;
                const isSelected = selectedModule === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModule(m.id)}
                    className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[10px] font-bold font-mono ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                        0{idx + 1}
                      </span>
                      <Icon className="w-4 h-4 shrink-0" />
                    </div>
                    <span className="text-xs font-bold leading-tight line-clamp-2">
                      {m.title.replace(/^\d+\.\s*/, "")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Selected Module Detail Card */}
          <div className={`p-6 rounded-3xl border ${activeMod.bgLight} transition space-y-5 shadow-sm`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl bg-gradient-to-br ${activeMod.color} text-white shadow-md`}>
                  <activeMod.icon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                    {activeMod.category}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeMod.title}
                  </h3>
                </div>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                Active Operational Module
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {activeMod.description}
            </p>

            {/* Data In vs Data Out Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Inputs */}
              <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <ArrowDown className="w-4 h-4" />
                  <span>Incoming Ingested Data Artifacts:</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {activeMod.inputs.map((inp, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span>{inp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Outputs */}
              <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <ArrowRight className="w-4 h-4" />
                  <span>Emitted Output Data Products:</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {activeMod.outputs.map((out, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="font-medium">{out}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Architecture Data Exchange Matrix Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2 font-mono">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Full System Data Contract Verified: Zero Disk Video Leakage · 100% Ephemeral Frame Buffer</span>
            </div>
            <span className="font-bold text-slate-700 dark:text-slate-300">FastAPI + Next.js Engine</span>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/40">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition shadow-sm"
          >
            Close Architecture Inspector
          </button>
        </div>

      </div>
    </div>
  );
}

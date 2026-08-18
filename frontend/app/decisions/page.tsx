"use client";

import React, { useState, useEffect } from "react";
import { 
  FileCheck, ShieldCheck, Scale, AlertCircle, ArrowUpRight, 
  Sparkles, Filter, CheckCircle2, Lock, ExternalLink
} from "lucide-react";
import { decisionsApi } from "../lib/api";

interface Decision {
  id: number;
  meeting_id: number;
  decision_text: string;
  rationale?: string;
  impact_level: "HIGH" | "MEDIUM" | "LOW";
  category: "Architecture" | "Financial" | "Policy" | "Operations" | "Strategy" | "HR";
  status: "DRAFT" | "REVIEW" | "APPROVED" | "FINALIZED" | "SEALED";
  source_timestamp: number;
  source_speaker?: string;
  evidence_text?: string;
  confidence: number;
  participants?: string[];
  created_at?: string;
}

export default function DecisionsRegister() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterImpact, setFilterImpact] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const data = await decisionsApi.list();
      setDecisions(data);
    } catch (err) {
      console.error("Failed to load decisions", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredDecisions = decisions.filter(d => {
    if (filterCategory !== "ALL" && d.category !== filterCategory) return false;
    if (filterImpact !== "ALL" && d.impact_level !== filterImpact) return false;
    if (searchTerm && !d.decision_text.toLowerCase().includes(searchTerm.toLowerCase()) && !d.rationale?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Scale className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Corporate Decision Register</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Immutable corporate governance ledger tracking executive decisions, architectural sign-offs, rationale, and grounded transcript evidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={loadDecisions}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            Refresh Register
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search decision or rationale..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Categories</option>
            <option value="Architecture">Architecture</option>
            <option value="Financial">Financial</option>
            <option value="Policy">Policy</option>
            <option value="Operations">Operations</option>
            <option value="Strategy">Strategy</option>
          </select>

          <select
            value={filterImpact}
            onChange={(e) => setFilterImpact(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Impact Levels</option>
            <option value="HIGH">High Impact</option>
            <option value="MEDIUM">Medium Impact</option>
            <option value="LOW">Low Impact</option>
          </select>
        </div>
      </div>

      {/* Decisions Ledger Table */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 animate-pulse text-sm font-semibold">
          Loading Decision Register & Cryptographic Seals...
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDecisions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 italic">
              No decision records found matching current filters.
            </div>
          ) : (
            filteredDecisions.map(dec => (
              <div 
                key={dec.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* Title & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold rounded-lg uppercase">
                      {dec.category}
                    </span>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                      dec.impact_level === "HIGH" 
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" 
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    }`}>
                      {dec.impact_level} Impact
                    </span>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg flex items-center gap-1">
                      <Lock className="w-3 h-3" /> {dec.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{Math.round(dec.confidence * 100)}% Extraction Confidence</span>
                  </div>
                </div>

                {/* Decision Statement */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {dec.decision_text}
                  </h3>
                  {dec.rationale && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Rationale: </span>
                      {dec.rationale}
                    </p>
                  )}
                </div>

                {/* Evidence & Participants Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-4 text-slate-500">
                    <span><strong>Speaker:</strong> {dec.source_speaker || "Rahul Sharma"}</span>
                    <span>•</span>
                    <a 
                      href={`/verify?meeting_id=${dec.meeting_id}#t=${dec.source_timestamp}`}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Grounded Evidence ({formatTimestamp(dec.source_timestamp)})
                    </a>
                  </div>

                  {dec.participants && dec.participants.length > 0 && (
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <span className="font-medium text-slate-500">Signatories:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{dec.participants.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

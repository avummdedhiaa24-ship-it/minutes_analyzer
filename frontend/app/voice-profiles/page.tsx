"use client";

import React, { useState } from "react";
import { Sparkles, ShieldCheck, UserCheck, AlertCircle, RefreshCw, Trash2, Award, History, Volume2, Mic, Settings, Layers, CheckCircle2, ChevronRight } from "lucide-react";

interface VoiceProfileCard {
  id: number;
  speakerName: string;
  role: string;
  department: string;
  status: "Active" | "Review Required" | "Not Enrolled" | "Revoked";
  qualityScore: number;
  version: string;
  lastCalibrated: string;
  driftRisk: "Low" | "Medium" | "High";
  environment: string;
  sampleCount: number;
}

export default function VoiceProfilesDashboard() {
  const [profiles, setProfiles] = useState<VoiceProfileCard[]>([
    {
      id: 1,
      speakerName: "Avumm",
      role: "Meeting Host / CTO",
      department: "Engineering",
      status: "Active",
      qualityScore: 94,
      version: "v3",
      lastCalibrated: "Today, 14:30",
      driftRisk: "Low",
      environment: "Laptop Mic + Headset",
      sampleCount: 3
    },
    {
      id: 2,
      speakerName: "Shyam",
      role: "Lead Developer",
      department: "Engineering",
      status: "Active",
      qualityScore: 91,
      version: "v2",
      lastCalibrated: "Today, 11:15",
      driftRisk: "Low",
      environment: "Conference Room Mic",
      sampleCount: 3
    },
    {
      id: 3,
      speakerName: "Sagar",
      role: "Product Manager",
      department: "Product",
      status: "Review Required",
      qualityScore: 72,
      version: "v1",
      lastCalibrated: "Yesterday, 16:45",
      driftRisk: "Medium",
      environment: "Browser Mic",
      sampleCount: 2
    },
    {
      id: 4,
      speakerName: "Krish",
      role: "Data Analyst",
      department: "Analytics",
      status: "Active",
      qualityScore: 96,
      version: "v4",
      lastCalibrated: "Today, 09:10",
      driftRisk: "Low",
      environment: "Headset Mic",
      sampleCount: 3
    }
  ]);

  const [filter, setFilter] = useState<"All" | "Active" | "Review Required">("All");

  const handleRevokeProfile = (id: number) => {
    if (confirm("Are you sure you want to revoke consent and purge raw biometric vectors for this participant?")) {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "Revoked", qualityScore: 0, version: "Revoked" } : p))
      );
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (filter === "Active") return p.status === "Active";
    if (filter === "Review Required") return p.status === "Review Required";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Enterprise Voice Profiles &amp; Calibration Health</h1>
                <p className="text-xs text-slate-400">
                  Identity-Aware Voice Calibration, Multi-Environment Profiles, &amp; Biometric Governance Ledger
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-400" />
              Org Privacy Controls
            </button>
            <button className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition shadow-lg shadow-purple-600/25 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              + Calibrate New Participant
            </button>
          </div>
        </div>

        {/* Top Health Metrics Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Voice Profiles</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-white">4</span>
              <span className="text-xs text-emerald-400 font-semibold">100% Consent Granted</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg Calibration Quality</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-purple-400">93.2%</span>
              <span className="text-xs text-purple-300">High Confidence</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Drift Candidates</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-amber-400">1</span>
              <span className="text-xs text-amber-300">Sagar (PM) Review</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Biometric Retention</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-blue-400">90 Days</span>
              <span className="text-xs text-blue-300">Auto-Purge Active</span>
            </div>
          </div>
        </div>

        {/* Governance & Privacy Banner */}
        <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between gap-4 text-xs text-purple-200">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <span className="font-bold text-white">Biometric Privacy Guard Active:</span> Raw vector embeddings are sanitized from client APIs and stored exclusively in encrypted server memory.
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
            SHA-256 Audited
          </span>
        </div>

        {/* Profiles Table */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Registered Participant Profiles</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full">{filteredProfiles.length}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              {(["All", "Active", "Review Required"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded-lg font-medium transition ${
                    filter === tab ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/50 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3.5 px-6">Participant</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Quality Score</th>
                  <th className="py-3.5 px-4">Profile Version</th>
                  <th className="py-3.5 px-4">Environment</th>
                  <th className="py-3.5 px-4">Drift Risk</th>
                  <th className="py-3.5 px-4">Last Calibrated</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-4 px-6 font-bold text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center border border-purple-500/20">
                        {p.speakerName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{p.speakerName}</div>
                        <span className="text-[11px] text-slate-400 font-normal">{p.role}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {p.status === "Active" && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                      {p.status === "Review Required" && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 w-fit">
                          <AlertCircle className="w-3 h-3" /> Review Required
                        </span>
                      )}
                      {p.status === "Revoked" && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 w-fit">
                          Revoked &amp; Purged
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-mono font-bold text-purple-300">
                      {p.qualityScore > 0 ? `${p.qualityScore}%` : "—"}
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded-md font-mono bg-slate-800 text-slate-300 text-[11px] border border-slate-700">
                        {p.version}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-slate-300 font-medium">
                      {p.environment}
                    </td>

                    <td className="py-4 px-4">
                      <span
                        className={`font-bold text-[11px] ${
                          p.driftRisk === "Low" ? "text-emerald-400" : p.driftRisk === "Medium" ? "text-amber-400" : "text-red-400"
                        }`}
                      >
                        {p.driftRisk} Risk
                      </span>
                    </td>

                    <td className="py-4 px-4 text-slate-400">{p.lastCalibrated}</td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevokeProfile(p.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

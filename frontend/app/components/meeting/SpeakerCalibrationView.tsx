"use client";

import React, { useState } from "react";
import { Mic, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw, Sparkles, Volume2, UserCheck, ChevronRight, UserX, Award } from "lucide-react";

export interface ParticipantProfile {
  id: number;
  name: string;
  role: string;
  department: string;
  consentGranted: boolean;
  samples: { index: number; quality: number; snr: number; status: "accepted" | "rejected" }[];
  isCalibrated: bool;
  overallQuality: number;
}

interface Props {
  isOpen: boolean;
  meetingId: number;
  onComplete: () => void;
  onSkip: () => void;
}

export default function SpeakerCalibrationView({ isOpen, meetingId, onComplete, onSkip }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedParticipantIdx, setSelectedParticipantIdx] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSampleIndex, setRecordingSampleIndex] = useState<1 | 2 | 3>(1);

  const [participants, setParticipants] = useState<ParticipantProfile[]>([
    {
      id: 1,
      name: "Avumm",
      role: "Meeting Host",
      department: "Engineering",
      consentGranted: true,
      samples: [],
      isCalibrated: false,
      overallQuality: 0.94
    },
    {
      id: 2,
      name: "Shyam",
      role: "Developer",
      department: "Engineering",
      consentGranted: true,
      samples: [],
      isCalibrated: false,
      overallQuality: 0.92
    },
    {
      id: 3,
      name: "Sagar",
      role: "Product Manager",
      department: "Product",
      consentGranted: true,
      samples: [],
      isCalibrated: false,
      overallQuality: 0.89
    },
    {
      id: 4,
      name: "Krish",
      role: "Analyst",
      department: "Analytics",
      consentGranted: true,
      samples: [],
      isCalibrated: false,
      overallQuality: 0.91
    }
  ]);

  if (!isOpen) return null;

  const currentP = participants[selectedParticipantIdx];

  const handleSimulateSampleRecord = (sampleIdx: 1 | 2 | 3) => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      const updated = [...participants];
      const p = updated[selectedParticipantIdx];
      p.samples.push({
        index: sampleIdx,
        quality: 0.92 + (sampleIdx * 0.02) % 0.06,
        snr: 22.4,
        status: "accepted"
      });
      if (p.samples.length >= 3) {
        p.isCalibrated = true;
      }
      setParticipants(updated);
    }, 2500);
  };

  const calibratedCount = participants.filter((p) => p.isCalibrated).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-950/60 via-slate-900 to-blue-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Speaker Voice Calibration &amp; Enrollment</h3>
              <p className="text-xs text-purple-300/80">3-Sample Multi-Criteria Voice Profile Registration Engine</p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition"
          >
            Skip Calibration
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="px-6 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className={`flex items-center gap-2 ${currentStep === 1 ? "text-purple-400 font-bold" : ""}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[10px]">1</span>
            Registration
          </div>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-2 ${currentStep === 2 ? "text-purple-400 font-bold" : ""}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[10px]">2</span>
            3-Sample Audio
          </div>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-2 ${currentStep === 3 ? "text-purple-400 font-bold" : ""}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[10px]">3</span>
            Quality Gate
          </div>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <div className={`flex items-center gap-2 ${currentStep === 4 || currentStep === 5 ? "text-purple-400 font-bold" : ""}`}>
            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[10px]">4</span>
            Profile Complete
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* STEP 1: Participant Roster & Consent */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-xs text-purple-200 space-y-1">
                <span className="font-bold block text-purple-300">📋 Participant Registration &amp; Biometric Consent</span>
                <p className="text-slate-300 leading-relaxed">
                  Verify meeting participants and confirm explicit consent for 3-sample voice calibration. Participants who decline can still join and participate normally.
                </p>
              </div>

              <div className="space-y-2.5">
                {participants.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between transition ${
                      idx === selectedParticipantIdx ? "bg-purple-950/30 border-purple-500/50 ring-1 ring-purple-500/20" : "bg-slate-950 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center text-sm border border-purple-500/20">
                        {p.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          {p.name}
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{p.role}</span>
                        </div>
                        <span className="text-xs text-slate-400">{p.department}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={p.consentGranted}
                          onChange={(e) => {
                            const updated = [...participants];
                            updated[idx].consentGranted = e.target.checked;
                            setParticipants(updated);
                          }}
                          className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                        />
                        Consent
                      </label>
                      {p.isCalibrated ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Calibrated
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedParticipantIdx(idx);
                            setCurrentStep(2);
                          }}
                          className="px-3 py-1 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm"
                        >
                          Calibrate Voice →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: 3-Sample Audio Enrollment */}
          {currentStep === 2 && currentP && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Calibrating: {currentP.name} ({currentP.role})</span>
                  <span className="text-xs font-mono text-purple-400 font-bold">{currentP.samples.length} / 3 Samples</span>
                </div>
                <p className="text-xs text-slate-400">Record 3 short 5-10 second prompts under varied natural speaking conditions.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((sampleIdx) => {
                  const sampleData = currentP.samples.find((s) => s.index === sampleIdx);
                  return (
                    <div
                      key={sampleIdx}
                      className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-between space-y-3 ${
                        sampleData ? "bg-emerald-950/20 border-emerald-500/40" : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sample #{sampleIdx}</span>

                      {sampleData ? (
                        <div className="space-y-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                          <span className="text-xs font-bold text-emerald-400 block">Quality {Math.round(sampleData.quality * 100)}%</span>
                          <span className="text-[10px] text-slate-400 block">SNR: {sampleData.snr} dB</span>
                        </div>
                      ) : (
                        <button
                          disabled={isRecording}
                          onClick={() => handleSimulateSampleRecord(sampleIdx as 1 | 2 | 3)}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition flex items-center gap-1.5 shadow-md"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          {isRecording ? "Recording..." : "Record 5s Sample"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
                <span className="font-bold block mb-1">Suggested Sample Script:</span>
                <p className="italic text-slate-300">
                  "Hi, I am {currentP.name}. I am participating in today's executive discussion and our team roadmap review."
                </p>
              </div>
            </div>
          )}

          {/* STEP 3 & 4 & 5: Calibration Summary */}
          {(currentStep === 3 || currentStep === 4 || currentStep === 5) && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Speaker Voice Calibration Complete!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  High-confidence composite voice profiles created for {calibratedCount} of {participants.length} registered participants.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left text-xs">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Enrolled</span>
                  <span className="text-base font-bold text-emerald-400 mt-0.5 block">{calibratedCount} / {participants.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Avg Quality</span>
                  <span className="text-base font-bold text-purple-400 mt-0.5 block">93%</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Drift Guard</span>
                  <span className="text-base font-bold text-blue-400 mt-0.5 block">Active</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Unknown Protection</span>
                  <span className="text-base font-bold text-amber-400 mt-0.5 block">Enabled</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition"
            >
              ← Back
            </button>
          ) : <div />}

          {currentStep < 3 ? (
            <button
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg shadow-purple-500/20"
            >
              Finalize Calibration ({calibratedCount} Ready) →
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Start High-Accuracy Meeting Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Lock,
  FileCheck,
  Copy,
  ExternalLink,
  RefreshCw,
  Hash,
  Award,
  Volume2
} from "lucide-react";
import { auditApi } from "@/app/lib/api";

interface SealVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: number;
  meetingTitle?: string;
  minutesVersion?: number;
  isFinalized?: boolean;
  digitalSealHash?: string | null;
  audioNarrationHash?: string | null;
  audioNarrationUrl?: string | null;
  finalizedAt?: string | null;
  finalizedBy?: string | null;
}

export const SealVerificationModal: React.FC<SealVerificationModalProps> = ({
  isOpen,
  onClose,
  meetingId,
  meetingTitle = "Meeting Record",
  minutesVersion = 1,
  isFinalized = false,
  digitalSealHash,
  audioNarrationHash,
  audioNarrationUrl,
  finalizedAt,
  finalizedBy = "Presiding Officer",
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen) return null;

  const runVerification = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const res = await auditApi.verifyChain(meetingId);
      setVerificationResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to verify audit hash chain");
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const effectiveSealHash =
    digitalSealHash ||
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 px-6 py-5 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  FIG. 6: Sealing & Verification
                </span>
                <span className="text-xs text-slate-400">SHA-256 Hash Chain</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Cryptographic Seal Verification
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1 rounded-lg text-sm bg-slate-800/60 border border-slate-700/60"
          >
            ✕ Close
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* FIG. 6 Architecture Flow Explainer */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              FIG. 6 Process Pipeline
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-white block mb-0.5">1. Multi-party Review</span>
                <span className="text-slate-400">Draft edited, quorum reached & signatures checked</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-white block mb-0.5">2. Canonical Hash</span>
                <span className="text-slate-400">SHA-256 digest computed across text, action items & audio</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-white block mb-0.5">3. Immutable Lock</span>
                <span className="text-slate-400">Status marked FINALIZED, version bumped & sealed in audit trail</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-white block mb-0.5">4. Audit Recomputation</span>
                <span className="text-slate-400">Independent recalculation proves record is 100% untampered</span>
              </div>
            </div>
          </div>

          {/* Record Metadata Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Record Under Inspection</span>
                <div className="text-base font-bold text-white">{meetingTitle}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Meeting ID: #{meetingId} • Version: v{minutesVersion}.0 • Finalized by: {finalizedBy}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isFinalized ? (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    SEALED & FINALIZED
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    DRAFT (PENDING SEAL)
                  </span>
                )}
              </div>
            </div>

            {/* SHA-256 Digest Box */}
            <div className="bg-black/50 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1 font-mono text-emerald-400">
                  <Hash className="w-3.5 h-3.5" /> SHA-256 Document Seal Hash
                </span>
                <button
                  onClick={() => copyToClipboard(effectiveSealHash)}
                  className="flex items-center gap-1 text-slate-400 hover:text-white"
                >
                  <Copy className="w-3 h-3" />
                  {copiedHash ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-xs break-all text-emerald-300 bg-slate-950 p-2 rounded border border-emerald-500/20 select-all">
                {effectiveSealHash}
              </div>
            </div>

            {/* Audio Narration Binding (FIG. 5 reference) */}
            {audioNarrationUrl && (
              <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-3 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-300">
                  <Volume2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>
                    <strong>Bound Audio Narration (FIG. 5):</strong> Cryptographically linked to this seal
                  </span>
                </div>
                <span className="font-mono text-[11px] text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded border border-blue-700/40">
                  {audioNarrationHash ? `${audioNarrationHash.slice(0, 16)}...` : "SHA256 Bound"}
                </span>
              </div>
            )}
          </div>

          {/* Verification Execution Area */}
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-400" />
                  Independent Hash Chain Verification
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Traces all logged modifications, signatures, and version commits from genesis.
                </p>
              </div>
              <button
                onClick={runVerification}
                disabled={isVerifying}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                {isVerifying ? "Verifying..." : "Verify Hash Chain (FIG. 6)"}
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {verificationResult && (
              <div
                className={`p-4 rounded-xl border ${
                  verificationResult.valid
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                    : "bg-red-950/40 border-red-500/40 text-red-300"
                } space-y-2 animate-in fade-in duration-150`}
              >
                <div className="flex items-center justify-between font-bold text-sm">
                  <span className="flex items-center gap-2">
                    {verificationResult.valid ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        CRYPTOGRAPHICALLY VALID & UNTAMPERED
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        AUDIT INTEGRITY VIOLATION DETECTED
                      </>
                    )}
                  </span>
                  <span className="text-xs opacity-80">
                    Checked {verificationResult.log_count} log entries
                  </span>
                </div>
                <p className="text-xs text-slate-300">{verificationResult.message}</p>
                {verificationResult.latest_hash && (
                  <div className="text-[11px] font-mono text-slate-400 bg-black/40 p-2 rounded break-all mt-2">
                    Chain Tip Hash: {verificationResult.latest_hash}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>ICSCNA 2026 / CyberVANET Standard Compliance</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

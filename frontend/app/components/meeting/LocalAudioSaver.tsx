import React, { useState, useEffect, useCallback } from "react";
import { Download, HardDrive, CheckCircle2, AlertTriangle, Trash2, RefreshCw, ShieldCheck, Database } from "lucide-react";
import { audioApi, getAuthToken } from "../../lib/api";
import { SyncWord } from "./useAudioSync";

export interface LocalAudioSaverProps {
  meetingId: number;
  syncMap: SyncWord[];
  onOfflineAudioLoaded?: (blobUrl: string, offlineSyncMap: SyncWord[]) => void;
}

const DB_NAME = "GramSabhaMeetingVault";
const DB_VERSION = 1;
const STORE_NAME = "offline_recordings";

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not supported in this browser environment."));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: any) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "meeting_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function computeSHA256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digestBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const LocalAudioSaver: React.FC<LocalAudioSaverProps> = ({
  meetingId,
  syncMap,
  onOfflineAudioLoaded,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(false);
  const [integrityStatus, setIntegrityStatus] = useState<{
    matches: boolean;
    computedHash: string;
    serverHash: string;
    checkedAt: string;
  } | null>(null);
  const [isStaleSyncMap, setIsStaleSyncMap] = useState<boolean>(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usedMB: number; quotaMB: number } | null>(null);

  // Check if offline copy already exists in IndexedDB (B2, B5)
  const checkOfflineStatus = useCallback(async () => {
    try {
      const db = await openVaultDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(meetingId);

      req.onsuccess = async () => {
        if (req.result) {
          setIsOfflineCached(true);
          const cached = req.result;

          // Recompute hash on stored blob (B2)
          try {
            const recomputed = await computeSHA256(cached.audio_blob);
            const matches = recomputed.toLowerCase() === (cached.sha256 || "").toLowerCase();
            setIntegrityStatus({
              matches,
              computedHash: recomputed,
              serverHash: cached.sha256,
              checkedAt: new Date().toLocaleTimeString(),
            });

            // If offline playback callback provided, supply object URL
            if (onOfflineAudioLoaded && cached.audio_blob) {
              const url = URL.createObjectURL(cached.audio_blob);
              onOfflineAudioLoaded(url, cached.sync_map || []);
            }
          } catch (hashErr) {
            console.error("Integrity check error:", hashErr);
          }

          // Check if sync map is stale compared to current server syncMap
          if (syncMap && syncMap.length > 0 && cached.sync_map) {
            const serverLength = syncMap.length;
            const cachedLength = cached.sync_map.length;
            if (serverLength !== cachedLength) {
              setIsStaleSyncMap(true);
            }
          }
        } else {
          setIsOfflineCached(false);
          setIntegrityStatus(null);
        }
      };
    } catch (err) {
      console.warn("Vault DB inspection warning:", err);
    }
  }, [meetingId, syncMap, onOfflineAudioLoaded]);

  useEffect(() => {
    checkOfflineStatus();
  }, [checkOfflineStatus]);

  // Quota check helper (B1)
  const verifyStorageQuota = async (requiredBytes: number): Promise<boolean> => {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      setStorageEstimate({
        usedMB: Math.round(used / (1024 * 1024)),
        quotaMB: Math.round(quota / (1024 * 1024)),
      });

      if (quota > 0 && quota - used < requiredBytes + 10 * 1024 * 1024) {
        throw new Error(
          `Insufficient browser storage quota. Available: ${Math.round(
            (quota - used) / (1024 * 1024)
          )}MB, Required: ${Math.round(requiredBytes / (1024 * 1024))}MB.`
        );
      }
    }
    return true;
  };

  // Fetch audio blob & integrity info from server with privacy & consent checks (B2, B4)
  const fetchAudioWithIntegrity = async (): Promise<{
    blob: Blob;
    serverSha256: string;
    computedSha256: string;
    recordedAt: string;
  }> => {
    const token = getAuthToken();

    // 1. Request server integrity & check speaker consent (B2, B4)
    const integrity = await audioApi.getIntegrity(meetingId, token);
    if (!integrity) {
      throw new Error("Meeting recording integrity record not found.");
    }

    if (integrity.consent_granted === false) {
      throw new Error(
        integrity.consent_message ||
          "Audio download restricted: one or more speakers have withheld recording release consent."
      );
    }

    // 2. Fetch the audio blob using authenticated endpoint
    const audioUrl = audioApi.meetingAudioUrl(meetingId, token);
    const res = await fetch(audioUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("No meeting recording exists for this session.");
      }
      throw new Error(`Failed to download audio recording: HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const computedHash = await computeSHA256(blob);

    // 3. Verify integrity against server SHA-256
    const serverHash = integrity.sha256;
    const matches = computedHash.toLowerCase() === serverHash.toLowerCase();

    setIntegrityStatus({
      matches,
      computedHash,
      serverHash,
      checkedAt: new Date().toLocaleTimeString(),
    });

    if (!matches) {
      throw new Error("Integrity mismatch: Computed SHA-256 does not match server record! Do not rely on this copy.");
    }

    return {
      blob,
      serverSha256: serverHash,
      computedSha256: computedHash,
      recordedAt: integrity.recorded_at,
    };
  };

  // B1: Save to device using File System Access API or fallback
  const handleSaveToDevice = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { blob, computedSha256 } = await fetchAudioWithIntegrity();
      const token = getAuthToken();
      const defaultFilename = `meeting_${meetingId}_master_audio.wav`;

      // Use File System Access API if available in browser
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultFilename,
            types: [
              {
                description: "Audio File",
                accept: { "audio/wav": [".wav"], "audio/mpeg": [".mp3"], "audio/webm": [".webm"] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (fsErr: any) {
          if (fsErr.name !== "AbortError") {
            // Fallback to link download
            downloadBlobDirectly(blob, defaultFilename);
          } else {
            setLoading(false);
            return;
          }
        }
      } else {
        downloadBlobDirectly(blob, defaultFilename);
      }

      // Log download to tamper-evident audit ledger (B4)
      await audioApi.logDownload(
        meetingId,
        { download_type: "device_file", sha256: computedSha256, file_name: defaultFilename },
        token
      );

      setSuccess("Audio saved to your device. SHA-256 verified against server audit seal!");
    } catch (err: any) {
      setError(err?.message || "Failed to save audio to device.");
    } finally {
      setLoading(false);
    }
  };

  const downloadBlobDirectly = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // B1 & B3: Keep Offline in IndexedDB alongside sync-map
  const handleKeepOffline = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { blob, serverSha256, computedSha256, recordedAt } = await fetchAudioWithIntegrity();
      await verifyStorageQuota(blob.size);

      const db = await openVaultDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record = {
        meeting_id: meetingId,
        audio_blob: blob,
        sha256: serverSha256,
        size_bytes: blob.size,
        recorded_at: recordedAt,
        sync_map: syncMap,
        saved_at: new Date().toISOString(),
      };

      await new Promise<void>((resolve, reject) => {
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });

      // Log offline cache to audit log (B4)
      const token = getAuthToken();
      await audioApi.logDownload(
        meetingId,
        { download_type: "offline_indexeddb", sha256: computedSha256 },
        token
      );

      setIsOfflineCached(true);
      setIsStaleSyncMap(false);
      setSuccess("Meeting audio and sync-map cached offline. You can listen without network!");

      if (onOfflineAudioLoaded) {
        const url = URL.createObjectURL(blob);
        onOfflineAudioLoaded(url, syncMap);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to cache meeting audio for offline use.");
    } finally {
      setLoading(false);
    }
  };

  // B5: Remove from this device
  const handleRemoveFromDevice = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const db = await openVaultDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const delReq = store.delete(meetingId);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
      });

      setIsOfflineCached(false);
      setIntegrityStatus(null);
      setIsStaleSyncMap(false);
      setSuccess("Meeting audio removed from offline device storage.");
    } catch (err: any) {
      setError(err?.message || "Failed to remove offline audio from device.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          <span className="font-bold text-slate-900 dark:text-white">
            Feature B: Local & Offline Audio Vault
          </span>
          {isOfflineCached && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Cached on Device
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* B1: Save to this device */}
          <button
            onClick={handleSaveToDevice}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition shadow-sm text-xs"
            title="Save copy directly to your disk (File System Access / Download)"
          >
            <Download className="w-3.5 h-3.5" />
            Save to this device
          </button>

          {/* B1 & B3: Keep Offline in IndexedDB */}
          {!isOfflineCached ? (
            <button
              onClick={handleKeepOffline}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold transition border border-slate-700 text-xs"
              title="Store in browser IndexedDB with sync-map for offline zero-network playback"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Keep offline
            </button>
          ) : (
            <>
              {isStaleSyncMap && (
                <button
                  onClick={handleKeepOffline}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold transition text-xs animate-pulse"
                  title="Server transcript was updated. Click to refresh offline sync map."
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh offline sync-map
                </button>
              )}

              {/* B5: Remove from device */}
              <button
                onClick={handleRemoveFromDevice}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold transition border border-rose-500/30 text-xs"
                title="Delete local IndexedDB copy"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove from this device
              </button>
            </>
          )}
        </div>
      </div>

      {/* B2: Integrity Verification Status Badge */}
      {integrityStatus && (
        <div
          className={`flex items-center justify-between p-2.5 rounded-lg border text-[11px] font-mono ${
            integrityStatus.matches
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 font-bold"
          }`}
        >
          <div className="flex items-center gap-2">
            {integrityStatus.matches ? (
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
            <span>
              {integrityStatus.matches
                ? "Matches server record (SHA-256 cryptographically verified)"
                : "Does not match, do not rely on this copy"}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
            Checked at {integrityStatus.checkedAt}
          </span>
        </div>
      )}

      {/* Feedback Messages */}
      {success && (
        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
          {success}
        </div>
      )}
      {error && (
        <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      )}
    </div>
  );
};

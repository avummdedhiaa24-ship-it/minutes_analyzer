"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { meetingsApi, getAuthToken } from "../../../lib/api";
import LiveMeetingCaptureView from "../../../components/meeting/LiveMeetingCaptureView";

export default function LiveMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = Number(params?.id);

  const [meeting, setMeeting] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = getAuthToken() || localStorage.getItem("token") || localStorage.getItem("auth_user");
    setToken(savedToken);

    if (!meetingId || isNaN(meetingId)) {
      setError("Invalid meeting ID provided.");
      setLoading(false);
      return;
    }

    meetingsApi
      .get(meetingId, savedToken)
      .then((data) => {
        setMeeting(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load meeting details.");
        setLoading(false);
      });
  }, [meetingId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-400">Loading Live Meeting Capture Workspace...</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 max-w-md text-center">
          <h3 className="text-lg font-bold mb-2">Error Accessing Meeting Workspace</h3>
          <p className="text-sm mb-4">{error || "Meeting record not found."}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <LiveMeetingCaptureView meeting={meeting} token={token} />
      </div>
    </div>
  );
}

"use client";
import React, { useEffect } from "react";
import Dashboard from "../page";

export default function TranscriptRoute() {
  useEffect(() => {
    // Direct user to verify with transcript view
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("tab")) {
        url.searchParams.set("tab", "transcript");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, []);

  return <Dashboard />;
}

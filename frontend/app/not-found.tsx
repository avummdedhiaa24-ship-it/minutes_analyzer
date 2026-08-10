"use client";

import React from "react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-md text-center space-y-3">
        <h2 className="text-2xl font-extrabold text-indigo-400">404 — Page Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested page or resource could not be located.
        </p>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

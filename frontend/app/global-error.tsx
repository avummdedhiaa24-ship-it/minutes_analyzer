"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-md text-center space-y-3">
          <h2 className="text-xl font-bold text-rose-400">Global Application Error</h2>
          <p className="text-xs text-slate-300 font-mono bg-slate-900 p-3 rounded-xl break-all">
            {error?.message || "A global error occurred."}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            Reset Application
          </button>
        </div>
      </body>
    </html>
  );
}

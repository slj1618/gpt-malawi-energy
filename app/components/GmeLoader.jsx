"use client";
/**
 * Grok‑style loader adapted for our app.
 * ─────────────────────────────────────────────
 * • Heading shows “GME 1.5”.
 * • Yellow dotted progress bar animates while `loading` is true.
 * • When `loading` becomes false the bar fills and the status flips to “DONE”.
 *
 * Usage: <GmeLoader loading={isFetching} />
 */

import { useEffect, useState } from "react";

export default function GmeLoader({ loading = true }) {
  // progress state (0‑100)
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loading) {
      setProgress(100);
      return;
    }

    // Animate: step from 0→100 repeatedly for a nice sweep effect
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 1));
    }, 120); // speed of the sweep (ms)

    return () => clearInterval(id);
  }, [loading]);

  return (
    <div className="w-full max-w-lg rounded-xl bg-[#2a2b2d] px-4 py-3 font-mono text-xs text-gray-300 shadow-lg">
      {/* Header */}
      <div className="mb-3 flex w-full items-center justify-between tracking-widest">
        <span className="text-[0.7rem]">GME&nbsp;1.5</span>
        <span className="text-[0.7rem]">{loading ? "LOADING" : "DONE"}</span>
      </div>

      {/* Progress bar container */}
      <div
        className="h-2 w-full overflow-hidden rounded-md bg-[#1f2023]"
        aria-label="loader progress"
      >
        {/* dotted fill element */}
        <div
          className="h-full bg-[length:4px_4px] bg-repeat-x bg-emerald-400 transition-[width] duration-150 ease-linear"
          style={{
            width: `${progress}%`,
            // dotted pattern via repeating linear-gradient
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 2px, rgba(0,0,0,0) 2px 4px)",
          }}
        />
      </div>
    </div>
  );
}

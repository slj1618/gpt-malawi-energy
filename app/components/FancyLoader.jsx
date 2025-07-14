"use client";
// A colourful gradient ring spinner (no extra deps)
// TailwindCSS 3.4+ required for arbitrary values like m-[2px].
// Usage: <FancyLoader size={32} />

export default function FancyLoader({ size = 32 }) {
  // keep ring 2px regardless of the diameter
  const innerOffset = 2;
  return (
    <div
      className="relative inline-flex mr-3"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      {/* rotating outer gradient */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-emerald-500 animate-spin" />

      {/* inner mask to create the ring effect */}
      <div
        className="absolute rounded-full bg-zinc-900 dark:bg-zinc-800" // matches page bg
        style={{
          top: innerOffset,
          left: innerOffset,
          right: innerOffset,
          bottom: innerOffset,
        }}
      />
    </div>
  );
}

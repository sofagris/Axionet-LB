/** Decorative world outline for Internet/Clients node — not real geo data. */
export function WorldMapBackdrop({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 64"
      fill="none"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <ellipse cx="60" cy="32" rx="56" ry="28" stroke="currentColor" strokeOpacity="0.25" />
      <path
        d="M18 28c6-8 14-10 22-8 6 2 8 8 14 9 5 1 10-3 16-2 7 1 12 8 18 7 5-1 9-6 12-4"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M22 38c8-2 14 2 20 1 7-1 11-6 18-5 6 1 10 5 16 4 5-1 9-4 14-2"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle cx="34" cy="26" r="1.5" fill="currentColor" fillOpacity="0.5" />
      <circle cx="58" cy="30" r="1.5" fill="currentColor" fillOpacity="0.55" />
      <circle cx="82" cy="28" r="1.5" fill="currentColor" fillOpacity="0.5" />
      <circle cx="96" cy="36" r="1.2" fill="currentColor" fillOpacity="0.4" />
    </svg>
  );
}

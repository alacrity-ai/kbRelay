import { useId } from 'react';

/**
 * The kbRelay brand mark (KBR-20) — the same blue-gradient kanban-tiles logo as
 * the favicon / OG image, inlined as SVG so the navbar branding matches. Sized
 * by CSS (`.brand-logo`, larger under `.gate`); crisp at any size.
 */
export default function BrandMark({ className = 'brand-logo' }: { className?: string }) {
  const gid = useId();
  return (
    <svg className={className} viewBox="0 0 512 512" role="img" aria-label="kbRelay" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gid})`} />
      <g fill="#ffffff">
        <rect x="112" y="168" width="80" height="48" rx="14" />
        <rect x="112" y="232" width="80" height="48" rx="14" opacity="0.9" />
        <rect x="112" y="296" width="80" height="48" rx="14" opacity="0.8" />
        <rect x="216" y="168" width="80" height="48" rx="14" opacity="0.95" />
        <rect x="216" y="232" width="80" height="48" rx="14" opacity="0.78" />
        <rect x="320" y="168" width="80" height="48" rx="14" opacity="0.85" />
      </g>
    </svg>
  );
}

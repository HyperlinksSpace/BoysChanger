import React from 'react';
import type { SceneVariant } from '../visuals/createVoiceScene';

type Props = {
  variant?: SceneVariant;
  accent?: string;
  className?: string;
};

/** Colorful CSS/SVG chip — no WebGL, safe for dense lists. */
export function SceneChip({ variant = 'mic', accent = '#d4ff4a', className }: Props) {
  return (
    <span
      className={className || 'scene-chip'}
      data-variant={variant}
      style={{ '--chip': accent } as React.CSSProperties}
      aria-hidden
    >
      <span className="scene-chip-orb" />
      <svg className="scene-chip-mark" viewBox="0 0 24 24" fill="none">
        {mark(variant)}
      </svg>
    </span>
  );
}

function mark(variant: SceneVariant) {
  switch (variant) {
    case 'mic':
      return (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V21M9 21h6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    case 'speaker':
      return (
        <>
          <path
            d="M4 9.5v5h3.2L12 18.5V5.5L7.2 9.5H4Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M15 9.2a3.2 3.2 0 0 1 0 5.6M17.5 7a5.5 5.5 0 0 1 0 10"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    case 'flask':
      return (
        <path
          d="M9 3h6M10 3v6.2L5.8 18.5A2.2 2.2 0 0 0 7.8 21.5h8.4a2.2 2.2 0 0 0 2-3L14 9.2V3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      );
    case 'gear':
      return (
        <>
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    case 'logo':
      return (
        <>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M8 13.5c1.2 1.6 2.4 2.4 4 2.4s2.8-.8 4-2.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="9" cy="10" r="1.15" fill="currentColor" />
          <circle cx="15" cy="10" r="1.15" fill="currentColor" />
        </>
      );
    case 'wave':
      return (
        <path
          d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      );
    case 'crystal':
      return (
        <path
          d="M12 3.5 18 9.5 12 20.5 6 9.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      );
    case 'ring':
      return (
        <>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        </>
      );
    case 'orb':
    default:
      return (
        <>
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="9.5" cy="9.5" r="2" fill="currentColor" opacity="0.85" />
        </>
      );
  }
}

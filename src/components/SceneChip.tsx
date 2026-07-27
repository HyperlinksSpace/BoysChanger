import React from 'react';
import type { SceneVariant } from '../visuals/createVoiceScene';

type Props = {
  variant?: SceneVariant;
  accent?: string;
  className?: string;
};

/**
 * Colourful animated stand-in for each 3D variant.
 * Used alone in dense UIs and as the under-layer beneath WebGL canvases.
 */
export function SceneChip({ variant = 'mic', accent = '#8dff6a', className }: Props) {
  return (
    <span
      className={className || 'scene-chip'}
      data-variant={variant}
      style={{ '--chip': accent } as React.CSSProperties}
      aria-hidden
    >
      <span className="scene-chip-glow" />
      <span className="scene-chip-orb" />
      <span className="scene-chip-orbit a" />
      <span className="scene-chip-orbit b" />
      <span className="scene-chip-spark s1" />
      <span className="scene-chip-spark s2" />
      <span className="scene-chip-spark s3" />
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
          <rect x="9" y="3.2" width="6" height="11" rx="3" fill="currentColor" opacity="0.92" />
          <path
            d="M6.4 11.2a5.6 5.6 0 0 0 11.2 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M12 16.8V21M9.2 21h5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case 'speaker':
      return (
        <>
          <path
            d="M3.8 9.2v5.6h3.4L12 19.2V4.8L7.2 9.2H3.8Z"
            fill="currentColor"
            opacity="0.92"
          />
          <path
            d="M15.2 9a3.4 3.4 0 0 1 0 6M17.8 6.8a5.8 5.8 0 0 1 0 10.4"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      );
    case 'flask':
      return (
        <>
          <path
            d="M9 3.2h6M10.2 3.2v5.8L5.6 18.2A2.3 2.3 0 0 0 7.7 21.4h8.6a2.3 2.3 0 0 0 2.1-3.2L13.8 9V3.2"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M8.2 16.2h7.6" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
          <circle cx="10.2" cy="14.2" r="1.1" fill="currentColor" opacity="0.85" />
          <circle cx="13.8" cy="12.6" r="0.8" fill="currentColor" opacity="0.7" />
        </>
      );
    case 'gear':
      return (
        <>
          <circle cx="12" cy="12" r="3.1" fill="currentColor" opacity="0.9" />
          <circle cx="12" cy="12" r="1.2" fill="#071410" />
          <path
            d="M12 3.4v2.1M12 18.5v2.1M3.4 12h2.1M18.5 12h2.1M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
    case 'logo':
      return (
        <>
          <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4.6" fill="currentColor" opacity="0.22" />
          <path
            d="M8 13.6c1.2 1.7 2.5 2.5 4 2.5s2.8-.8 4-2.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="9.1" cy="10.1" r="1.25" fill="currentColor" />
          <circle cx="14.9" cy="10.1" r="1.25" fill="currentColor" />
        </>
      );
    case 'wave':
      return (
        <>
          <path
            d="M3.2 12c1.7-4.2 3.4-4.2 5.1 0s3.4 4.2 5.1 0 3.4-4.2 5.1 0 1.7 2.1 2.5 2.1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4.5 16.5c1.4-2.4 2.8-2.4 4.2 0s2.8 2.4 4.2 0 2.8-2.4 4.2 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </>
      );
    case 'crystal':
      return (
        <>
          <path d="M12 2.8 18.4 9.4 12 21.2 5.6 9.4Z" fill="currentColor" opacity="0.9" />
          <path d="M12 2.8 15.2 9.4H8.8Z" fill="#fff" opacity="0.35" />
        </>
      );
    case 'ring':
      return (
        <>
          <circle cx="12" cy="12" r="7.4" stroke="currentColor" strokeWidth="2.1" />
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" opacity="0.75" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </>
      );
    case 'orb':
    default:
      return (
        <>
          <circle cx="12" cy="12" r="7.6" fill="currentColor" opacity="0.9" />
          <circle cx="9.4" cy="9.2" r="2.4" fill="#fff" opacity="0.55" />
          <circle cx="14.8" cy="14.6" r="1.4" fill="#071410" opacity="0.25" />
        </>
      );
  }
}

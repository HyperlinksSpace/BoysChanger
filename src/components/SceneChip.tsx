import React, { useId } from 'react';
import type { SceneVariant } from '../visuals/createVoiceScene';

type Props = {
  variant?: SceneVariant;
  accent?: string;
  className?: string;
};

/**
 * Lightweight dashboard-hero twin: black stage, metal forms, emissive accent,
 * orbiting sparks — CSS/SVG only so dense lists stay easy to load.
 */
export function SceneChip({ variant = 'mic', accent = '#8dff6a', className }: Props) {
  const gid = useId().replace(/:/g, '');
  return (
    <span
      className={className || 'scene-chip'}
      data-variant={variant}
      style={{ '--chip': accent } as React.CSSProperties}
      aria-hidden
    >
      <span className="scene-chip-stage" />
      <span className="scene-chip-glow" />
      <span className="scene-chip-rim" />
      <span className="scene-chip-rim soft" />
      <span className="scene-chip-spark a" />
      <span className="scene-chip-spark b" />
      <span className="scene-chip-spark c" />
      <svg className="scene-chip-form" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={`chip-metal-${gid}`} x1="18" y1="12" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2a3336" />
            <stop offset="45%" stopColor="#12181a" />
            <stop offset="100%" stopColor="#070a0b" />
          </linearGradient>
          <radialGradient id={`chip-core-${gid}`} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="35%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.35" />
          </radialGradient>
          <linearGradient id={`chip-edge-${gid}`} x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="40%" stopColor={accent} stopOpacity="0.95" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        {form(variant, gid)}
      </svg>
    </span>
  );
}

function form(variant: SceneVariant, gid: string) {
  const metal = `url(#chip-metal-${gid})`;
  const core = `url(#chip-core-${gid})`;
  const edge = `url(#chip-edge-${gid})`;
  const accent = 'var(--chip)';

  switch (variant) {
    case 'mic':
      return (
        <>
          <ellipse cx="32" cy="54" rx="15" ry="3.8" fill={accent} opacity="0.55" />
          <rect x="29" y="36" width="6" height="16" rx="2.5" fill={metal} stroke={edge} strokeWidth="1.2" />
          <rect x="23" y="12" width="18" height="28" rx="9" fill={metal} stroke={edge} strokeWidth="1.6" />
          <ellipse cx="32" cy="17" rx="8" ry="3" fill={core} opacity="0.9" />
          <path d="M23 26h18" stroke={accent} strokeWidth="1.4" opacity="0.55" />
          <path d="M23 32h18" stroke={accent} strokeWidth="1.2" opacity="0.35" />
          <circle cx="46" cy="20" r="2.6" fill={core} />
          <circle cx="18" cy="34" r="1.8" fill="#fff" opacity="0.55" />
        </>
      );
    case 'speaker':
      return (
        <>
          <ellipse cx="32" cy="32" rx="19" ry="19" fill={metal} stroke={edge} strokeWidth="2" />
          <ellipse cx="32" cy="32" rx="12.5" ry="12.5" fill="#0a0e10" stroke={accent} strokeWidth="1.5" />
          <ellipse cx="32" cy="32" rx="6" ry="6" fill={core} />
          <ellipse cx="32" cy="32" rx="2.2" ry="2.2" fill="#0a0e10" opacity="0.55" />
          <circle cx="48" cy="16" r="2.2" fill={accent} />
          <circle cx="16" cy="44" r="1.6" fill="#fff" opacity="0.45" />
        </>
      );
    case 'flask':
      return (
        <>
          <path
            d="M25 11h14M28 11v11l-10 21a9 9 0 0 0 8 13h12a9 9 0 0 0 8-13L36 22V11"
            fill={metal}
            stroke={edge}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <ellipse cx="32" cy="43" rx="11" ry="7" fill={core} opacity="0.8" />
          <circle cx="27" cy="40" r="2.2" fill="#fff" opacity="0.5" />
          <circle cx="38" cy="36" r="1.7" fill={accent} />
          <circle cx="46" cy="18" r="1.8" fill="#fff" opacity="0.45" />
        </>
      );
    case 'gear':
      return (
        <>
          <circle cx="32" cy="32" r="11" fill={metal} stroke={edge} strokeWidth="2" />
          <circle cx="32" cy="32" r="4.5" fill="#0a0e10" stroke={accent} strokeWidth="1.3" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const x = 32 + Math.cos(a) * 16.5;
            const y = 32 + Math.sin(a) * 16.5;
            return (
              <rect
                key={deg}
                x={x - 3.2}
                y={y - 3.2}
                width="6.4"
                height="6.4"
                rx="1.4"
                fill={core}
                transform={`rotate(${deg} ${x} ${y})`}
              />
            );
          })}
        </>
      );
    case 'logo':
      return (
        <>
          <rect x="15" y="15" width="34" height="34" rx="7" fill={metal} stroke={edge} strokeWidth="1.7" />
          <path d="M32 19 L44 32 L32 45 L20 32 Z" fill={core} />
          <path d="M32 24 L38.5 32 L32 40 L25.5 32 Z" fill="#0a0e10" opacity="0.35" />
          <circle cx="46" cy="18" r="2.4" fill="#fff" opacity="0.65" />
          <circle cx="18" cy="46" r="1.6" fill={accent} opacity="0.8" />
        </>
      );
    case 'wave':
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => {
            const h = 12 + ((i * 9) % 20);
            return (
              <rect
                key={i}
                className="scene-chip-bar"
                style={{ '--bar-i': i } as React.CSSProperties}
                x={15 + i * 7.2}
                y={32 - h / 2}
                width="5.2"
                height={h}
                rx="2.2"
                fill={i % 2 === 0 ? core : metal}
                stroke={edge}
                strokeWidth="0.8"
              />
            );
          })}
          <ellipse cx="32" cy="51" rx="17" ry="2.8" fill={accent} opacity="0.4" />
        </>
      );
    case 'crystal':
      return (
        <>
          <path d="M32 8 L50 30 L32 56 L14 30 Z" fill={metal} stroke={edge} strokeWidth="1.8" />
          <path d="M32 8 L42 30 L32 56 L22 30 Z" fill={core} opacity="0.85" />
          <path d="M32 8 L42 30 L22 30 Z" fill="#fff" opacity="0.28" />
          <path d="M42 28 L50 30 L42 36" fill={accent} opacity="0.45" />
          <circle cx="48" cy="16" r="2" fill={accent} />
        </>
      );
    case 'ring':
      return (
        <>
          <circle cx="32" cy="32" r="18.5" fill="none" stroke={edge} strokeWidth="3.2" opacity="0.95" />
          <circle cx="32" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="1.3" opacity="0.28" />
          <circle cx="32" cy="32" r="7" fill={metal} stroke={accent} strokeWidth="1.5" />
          <circle cx="32" cy="30" r="2.4" fill={core} />
          <circle cx="48" cy="16" r="2.2" fill={accent} />
          <circle cx="16" cy="44" r="1.6" fill="#fff" opacity="0.45" />
        </>
      );
    case 'orb':
    default:
      return (
        <>
          <circle cx="32" cy="34" r="17" fill={metal} stroke={edge} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="13.5" fill={core} />
          <circle cx="25" cy="25" r="4.5" fill="#fff" opacity="0.5" />
          <circle cx="38" cy="36" r="2" fill="#0a0e10" opacity="0.25" />
          <circle cx="46" cy="18" r="2.2" fill="#fff" opacity="0.6" />
        </>
      );
  }
}

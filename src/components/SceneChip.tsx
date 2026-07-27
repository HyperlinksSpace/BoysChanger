import React from 'react';
import type { SceneVariant } from '../visuals/createVoiceScene';

type Props = {
  variant?: SceneVariant;
  accent?: string;
  className?: string;
};

/**
 * Fallback that matches VoiceScene3D / dashboard hero language:
 * black stage, dark metal forms, emissive accent — not flat UI icons.
 */
export function SceneChip({ variant = 'mic', accent = '#8dff6a', className }: Props) {
  return (
    <span
      className={className || 'scene-chip'}
      data-variant={variant}
      style={{ '--chip': accent } as React.CSSProperties}
      aria-hidden
    >
      <span className="scene-chip-stage" />
      <span className="scene-chip-rim" />
      <span className="scene-chip-rim soft" />
      <svg className="scene-chip-form" viewBox="0 0 64 64" fill="none">
        {form(variant)}
      </svg>
    </span>
  );
}

function form(variant: SceneVariant) {
  const accent = 'var(--chip)';
  switch (variant) {
    case 'mic':
      return (
        <>
          <ellipse cx="32" cy="54" rx="14" ry="3.5" fill={accent} opacity="0.85" />
          <rect x="29.5" y="38" width="5" height="14" rx="2" fill="#1a2224" stroke={accent} strokeWidth="1.2" />
          <rect x="24" y="14" width="16" height="26" rx="8" fill="#141a1c" stroke={accent} strokeWidth="1.6" />
          <ellipse cx="32" cy="18" rx="7" ry="2.2" fill={accent} opacity="0.7" />
          <circle cx="44" cy="22" r="2.4" fill={accent} opacity="0.9" />
          <circle cx="20" cy="34" r="1.8" fill="#fff" opacity="0.55" />
        </>
      );
    case 'speaker':
      return (
        <>
          <ellipse cx="32" cy="32" rx="18" ry="18" fill="#12181a" stroke={accent} strokeWidth="2" />
          <ellipse cx="32" cy="32" rx="11" ry="11" fill="#0a0e10" stroke={accent} strokeWidth="1.4" opacity="0.9" />
          <ellipse cx="32" cy="32" rx="5" ry="5" fill={accent} opacity="0.85" />
          <circle cx="46" cy="18" r="2" fill={accent} />
        </>
      );
    case 'flask':
      return (
        <>
          <path
            d="M26 12h12M28 12v10l-9 20a8 8 0 0 0 7 12h12a8 8 0 0 0 7-12l-9-20V12"
            fill="#141a1c"
            stroke={accent}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <ellipse cx="32" cy="42" rx="10" ry="6" fill={accent} opacity="0.55" />
          <circle cx="28" cy="40" r="2" fill="#fff" opacity="0.45" />
          <circle cx="36" cy="36" r="1.5" fill={accent} />
        </>
      );
    case 'gear':
      return (
        <>
          <circle cx="32" cy="32" r="10" fill="#141a1c" stroke={accent} strokeWidth="2" />
          <circle cx="32" cy="32" r="4" fill="#0a0e10" stroke={accent} strokeWidth="1.2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const x = 32 + Math.cos(a) * 16;
            const y = 32 + Math.sin(a) * 16;
            return (
              <rect
                key={deg}
                x={x - 3}
                y={y - 3}
                width="6"
                height="6"
                rx="1.2"
                fill={accent}
                opacity="0.85"
                transform={`rotate(${deg} ${x} ${y})`}
              />
            );
          })}
        </>
      );
    case 'logo':
      return (
        <>
          <rect x="16" y="16" width="32" height="32" rx="6" fill="#12181a" stroke={accent} strokeWidth="1.6" />
          <path d="M32 20 L42 32 L32 44 L22 32 Z" fill={accent} opacity="0.92" />
          <path d="M32 24 L38 32 L32 40 L26 32 Z" fill="#0a0e10" opacity="0.35" />
          <circle cx="44" cy="20" r="2.2" fill="#fff" opacity="0.6" />
        </>
      );
    case 'wave':
      return (
        <>
          {[0, 1, 2, 3, 4].map((i) => {
            const h = 10 + ((i * 7) % 18);
            return (
              <rect
                key={i}
                x={16 + i * 7}
                y={32 - h / 2}
                width="5"
                height={h}
                rx="2"
                fill={i % 2 === 0 ? accent : '#1a2224'}
                stroke={accent}
                strokeWidth="0.8"
                opacity={i % 2 === 0 ? 0.95 : 0.8}
              />
            );
          })}
          <ellipse cx="32" cy="50" rx="16" ry="2.5" fill={accent} opacity="0.35" />
        </>
      );
    case 'crystal':
      return (
        <>
          <path d="M32 10 L48 30 L32 54 L16 30 Z" fill="#141a1c" stroke={accent} strokeWidth="1.8" />
          <path d="M32 10 L40 30 L32 54 L24 30 Z" fill={accent} opacity="0.55" />
          <path d="M32 10 L40 30 L24 30 Z" fill="#fff" opacity="0.25" />
          <circle cx="46" cy="18" r="1.8" fill={accent} />
        </>
      );
    case 'ring':
      return (
        <>
          <circle cx="32" cy="32" r="18" fill="none" stroke={accent} strokeWidth="3" opacity="0.9" />
          <circle cx="32" cy="32" r="12" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.35" />
          <circle cx="32" cy="32" r="6" fill="#12181a" stroke={accent} strokeWidth="1.4" />
          <circle cx="46" cy="18" r="2" fill={accent} />
        </>
      );
    case 'orb':
    default:
      return (
        <>
          <circle cx="32" cy="32" r="16" fill="#141a1c" stroke={accent} strokeWidth="1.6" />
          <circle cx="32" cy="32" r="11" fill={accent} opacity="0.88" />
          <circle cx="26" cy="26" r="4" fill="#fff" opacity="0.45" />
          <circle cx="44" cy="20" r="2" fill="#fff" opacity="0.55" />
        </>
      );
  }
}

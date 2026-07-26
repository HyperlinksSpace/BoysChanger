import React, { useId } from 'react';
import {
  ACC_OPTIONS,
  HAIR_OPTIONS,
  SKIN_OPTIONS,
  type ComposedAvatar,
  type ProfileAvatar,
} from '../profile/userProfile';

type Props = {
  avatar: ProfileAvatar;
  className?: string;
  title?: string;
};

function skinColor(id: ComposedAvatar['skin']) {
  return SKIN_OPTIONS.find((s) => s.id === id)?.color || '#d4ff4a';
}

function hairColor(id: ComposedAvatar['hair']) {
  return HAIR_OPTIONS.find((h) => h.id === id)?.color || '#1a1a1a';
}

function ComposedSvg({ avatar }: { avatar: ComposedAvatar }) {
  const gid = useId().replace(/:/g, '');
  const skin = skinColor(avatar.skin);
  const hair = hairColor(avatar.hair);
  const glow = skin;

  return (
    <svg viewBox="0 0 64 64" className="profile-avatar-svg" aria-hidden>
      <defs>
        <radialGradient id={`pa-glow-${gid}`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="45%" stopColor={glow} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0a0a0a" stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#pa-glow-${gid})`} />
      <circle cx="32" cy="34" r="18" fill={skin} />

      {avatar.hair === 'short' ? (
        <path d="M16 30c2-14 30-14 32 0v2c-6-8-26-8-32 0z" fill={hair} />
      ) : null}
      {avatar.hair === 'wavy' ? (
        <path d="M14 32c1-16 34-16 36 0-4-6-8-2-12-6s-8 2-12-4-8 2-12 10z" fill={hair} />
      ) : null}
      {avatar.hair === 'spike' ? (
        <>
          <path d="M20 28 L24 8 L28 28 Z" fill={hair} />
          <path d="M28 26 L32 6 L36 26 Z" fill={hair} />
          <path d="M36 28 L40 10 L44 28 Z" fill={hair} />
          <path d="M16 30c4-10 28-10 32 0v1c-8-7-24-7-32 0z" fill={hair} />
        </>
      ) : null}
      {avatar.hair === 'bun' ? (
        <>
          <circle cx="32" cy="12" r="7" fill={hair} />
          <path d="M18 30c3-12 25-12 28 0v1c-7-8-21-8-28 0z" fill={hair} />
        </>
      ) : null}
      {avatar.hair === 'cap' ? (
        <>
          <ellipse cx="32" cy="22" rx="18" ry="8" fill={hair} />
          <rect x="14" y="20" width="36" height="8" rx="3" fill={hair} />
          <rect x="10" y="26" width="18" height="4" rx="2" fill={hair} opacity="0.85" />
        </>
      ) : null}

      {avatar.eyes === 'round' ? (
        <>
          <circle cx="25" cy="34" r="3.2" fill="#111" />
          <circle cx="39" cy="34" r="3.2" fill="#111" />
          <circle cx="24.2" cy="33.2" r="1" fill="#fff" />
          <circle cx="38.2" cy="33.2" r="1" fill="#fff" />
        </>
      ) : null}
      {avatar.eyes === 'cat' ? (
        <>
          <ellipse cx="25" cy="34" rx="3.4" ry="4.2" fill="#111" />
          <ellipse cx="39" cy="34" rx="3.4" ry="4.2" fill="#111" />
          <rect x="24.2" y="31.5" width="1.6" height="5" rx="0.6" fill="#d4ff4a" />
          <rect x="38.2" y="31.5" width="1.6" height="5" rx="0.6" fill="#d4ff4a" />
        </>
      ) : null}
      {avatar.eyes === 'star' ? (
        <>
          <path d="M25 29l1.4 3.2 3.4.2-2.6 2.4.9 3.3L25 36.2 21.9 38l.9-3.3-2.6-2.4 3.4-.2z" fill="#111" />
          <path d="M39 29l1.4 3.2 3.4.2-2.6 2.4.9 3.3L39 36.2 35.9 38l.9-3.3-2.6-2.4 3.4-.2z" fill="#111" />
        </>
      ) : null}
      {avatar.eyes === 'shades' ? (
        <>
          <rect x="16" y="30" width="14" height="8" rx="3" fill="#111" />
          <rect x="34" y="30" width="14" height="8" rx="3" fill="#111" />
          <rect x="30" y="32" width="4" height="3" fill="#111" />
          <path d="M18 32h10" stroke="#5ce1ff" strokeWidth="1.2" opacity="0.7" />
          <path d="M36 32h10" stroke="#ff5cad" strokeWidth="1.2" opacity="0.7" />
        </>
      ) : null}

      {avatar.mood === 'smile' ? (
        <path d="M24 42c2.5 4 13.5 4 16 0" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
      ) : null}
      {avatar.mood === 'cool' ? (
        <path d="M26 43h12" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
      ) : null}
      {avatar.mood === 'laugh' ? (
        <path d="M24 41c1 7 15 7 16 0z" fill="#111" />
      ) : null}
      {avatar.mood === 'neutral' ? (
        <path d="M26 43h12" stroke="#111" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      ) : null}

      {avatar.accessory === 'headset' ? (
        <>
          <path d="M14 28c0-12 36-12 36 0" fill="none" stroke="#d4ff4a" strokeWidth="3" />
          <rect x="10" y="28" width="7" height="12" rx="3" fill="#d4ff4a" />
          <rect x="47" y="28" width="7" height="12" rx="3" fill="#d4ff4a" />
        </>
      ) : null}
      {avatar.accessory === 'earring' ? (
        <>
          <circle cx="14" cy="40" r="2.4" fill="#ffd166" />
          <circle cx="50" cy="40" r="2.4" fill="#ffd166" />
        </>
      ) : null}
      {avatar.accessory === 'bow' ? (
        <>
          <path d="M28 16c-4-4-8 0-6 4 4 0 6-2 6-4z" fill="#ff5cad" />
          <path d="M36 16c4-4 8 0 6 4-4 0-6-2-6-4z" fill="#ff5cad" />
          <circle cx="32" cy="18" r="2.2" fill="#fff" />
        </>
      ) : null}
      {avatar.accessory === 'spark' ? (
        <>
          <path d="M50 18l1.2 2.6 2.8.2-2.2 2 .8 2.7L50 24l-2.6 1.5.8-2.7-2.2-2 2.8-.2z" fill="#fff" />
          <path d="M12 20l.9 1.8 2 .1-1.5 1.4.5 1.9L12 24l-1.9 1 .5-1.9-1.5-1.4 2-.1z" fill="#5ce1ff" />
        </>
      ) : null}
    </svg>
  );
}

export function ProfileAvatar({ avatar, className, title }: Props) {
  if (avatar.mode === 'upload' && avatar.previewUrl) {
    return (
      <span className={className || 'profile-avatar'} title={title}>
        <img src={avatar.previewUrl} alt="" className="profile-avatar-img" draggable={false} />
      </span>
    );
  }

  const composed: ComposedAvatar =
    avatar.mode === 'compose'
      ? avatar
      : {
          mode: 'compose',
          skin: 'lime',
          hair: 'spike',
          eyes: 'star',
          accessory: 'headset',
          mood: 'smile',
        };

  return (
    <span className={className || 'profile-avatar'} title={title}>
      <ComposedSvg avatar={composed} />
    </span>
  );
}

export function SkinSwatch({ color, active }: { color: string; active?: boolean }) {
  return (
    <span
      className={`profile-swatch ${active ? 'active' : ''}`}
      style={{ background: color === 'transparent' ? '#222' : color }}
    />
  );
}

export { ACC_OPTIONS };

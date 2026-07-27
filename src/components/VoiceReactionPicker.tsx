import React, { useEffect, useLayoutEffect, useRef } from 'react';
import type { VoicePreset } from '../audio/voicePresets';

type Props = {
  open: boolean;
  x: number;
  y: number;
  presets: VoicePreset[];
  activeId: string | null;
  onPick: (preset: VoicePreset) => void;
  onClose: () => void;
};

/** Messenger-style reaction tray anchored near the pointer. */
export function VoiceReactionPicker({
  open,
  x,
  y,
  presets,
  activeId,
  onPick,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const pad = 10;
    const rect = el.getBoundingClientRect();
    let left = x - rect.width / 2;
    let top = y - rect.height - 12;
    if (top < pad) top = y + 14;
    if (left < pad) left = pad;
    if (left + rect.width > window.innerWidth - pad) {
      left = window.innerWidth - pad - rect.width;
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - pad - rect.height);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [open, x, y, presets.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="voice-reaction-picker"
      role="listbox"
      aria-label="Voice"
      style={{ left: x, top: y }}
    >
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={activeId === p.id}
          className={`voice-reaction ${activeId === p.id ? 'active' : ''}`}
          style={{ '--rx': p.color } as React.CSSProperties}
          title={p.name}
          onClick={(e) => {
            e.stopPropagation();
            onPick(p);
          }}
        >
          <span className="voice-reaction-emoji">{p.emoji}</span>
          <span className="voice-reaction-name">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

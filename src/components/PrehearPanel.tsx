import React, { useCallback, useEffect, useRef } from 'react';
import type { PrehearState } from '../audio/VoiceEngine';
import { PREHEAR_SECONDS } from '../audio/types';

type Props = {
  state: PrehearState;
  engineRunning: boolean;
  labels: {
    title: string;
    hint: string;
    play: string;
    pause: string;
    needEngine: string;
    empty: string;
    seekHint?: string;
  };
  onPlay: () => void;
  onPause: () => void;
  onSeek: (seconds: number) => void;
};

export function PrehearPanel({
  state,
  engineRunning,
  labels,
  onPlay,
  onPause,
  onSeek,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrubbing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 280;
    const cssH = canvas.clientHeight || 56;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = cssW;
    const h = cssH;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, 0, 0, w, h, 8);
    ctx.fill();

    const peaks = state.peaks;
    const n = peaks.length || 1;
    const mid = h / 2;
    const barW = Math.max(1, w / n - 1);
    const duration = Math.max(state.seconds, 0.001);

    for (let i = 0; i < n; i++) {
      const peak = peaks[i] ?? 0;
      const amp = Math.min(1, Math.pow(peak * 2.8, 0.75));
      const barH = Math.max(2, amp * (h * 0.78));
      const x = (i / n) * w;
      const spoken = amp > 0.08;
      const t = (i / n) * duration;
      const played = state.playing || state.paused ? t < state.position : false;
      if (played) {
        ctx.fillStyle = spoken ? 'rgba(212,255,74,0.95)' : 'rgba(212,255,74,0.35)';
      } else {
        ctx.fillStyle = spoken ? 'rgba(212,255,74,0.55)' : 'rgba(147,168,156,0.22)';
      }
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    }

    // Playhead across the waveform (full width = captured buffer)
    if (state.seconds > 0.05 && (state.playing || state.paused)) {
      const playX = w * (state.position / duration);
      ctx.strokeStyle = 'rgba(255,122,69,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 2);
      ctx.lineTo(playX, h - 2);
      ctx.stroke();
    }

    const fill = Math.min(1, state.seconds / PREHEAR_SECONDS);
    ctx.fillStyle = 'rgba(212,255,74,0.12)';
    ctx.fillRect(0, h - 3, w * fill, 3);
  }, [state]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !engineRunning || !state.ready || state.seconds < 0.05) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = rect.width > 0 ? x / rect.width : 0;
      onSeek(ratio * state.seconds);
    },
    [engineRunning, state.ready, state.seconds, onSeek],
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!scrubbing.current) return;
      seekFromEvent(e.clientX);
    };
    const onUp = () => {
      scrubbing.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [seekFromEvent]);

  const canPlay = engineRunning && state.ready;
  const isPlaying = state.playing && !state.paused;
  const hint = !engineRunning
    ? labels.needEngine
    : !state.ready
      ? labels.empty
      : labels.seekHint || labels.hint;

  return (
    <div className="prehear-block">
      <div className="prehear-head">
        <span className="prehear-title">{labels.title}</span>
        <span className="prehear-time">
          {formatTime(state.position)} / {formatTime(Math.min(state.seconds, PREHEAR_SECONDS))}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className={`prehear-wave ${canPlay ? 'seekable' : ''}`}
        height={56}
        role="slider"
        aria-label={labels.seekHint || labels.title}
        aria-valuemin={0}
        aria-valuemax={Math.round(state.seconds * 10) / 10}
        aria-valuenow={Math.round(state.position * 10) / 10}
        tabIndex={canPlay ? 0 : -1}
        onPointerDown={(e) => {
          if (!canPlay) return;
          scrubbing.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          seekFromEvent(e.clientX);
        }}
        onKeyDown={(e) => {
          if (!canPlay) return;
          const step = e.shiftKey ? 1 : 0.25;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, state.position - step));
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(state.seconds, state.position + step));
          } else if (e.key === 'Home') {
            e.preventDefault();
            onSeek(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            onSeek(Math.max(0, state.seconds - 0.05));
          }
        }}
      />
      <div className="prehear-controls">
        <button
          type="button"
          className="icon-btn"
          disabled={!canPlay || isPlaying}
          title={labels.play}
          aria-label={labels.play}
          onClick={onPlay}
        >
          <PlayIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={!canPlay || !isPlaying}
          title={labels.pause}
          aria-label={labels.pause}
          onClick={onPause}
        >
          <PauseIcon />
        </button>
        <p className="prehear-info">{hint}</p>
      </div>
    </div>
  );
}

function formatTime(s: number) {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60);
  const sec = Math.floor(v % 60);
  const ds = Math.floor((v % 1) * 10);
  return `${m}:${sec.toString().padStart(2, '0')}.${ds}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
    </svg>
  );
}

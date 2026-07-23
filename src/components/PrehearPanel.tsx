import React, { useEffect, useRef } from 'react';
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
  };
  onPlay: () => void;
  onPause: () => void;
};

export function PrehearPanel({ state, engineRunning, labels, onPlay, onPause }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Track background
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, 0, 0, w, h, 8);
    ctx.fill();

    const peaks = state.peaks;
    const n = peaks.length || 1;
    const mid = h / 2;
    const barW = Math.max(1, w / n - 1);

    for (let i = 0; i < n; i++) {
      const peak = peaks[i] ?? 0;
      // Speech activity: soft noise floor, taller = spoken
      const amp = Math.min(1, Math.pow(peak * 2.8, 0.75));
      const barH = Math.max(2, amp * (h * 0.78));
      const x = (i / n) * w;
      const spoken = amp > 0.08;
      ctx.fillStyle = spoken ? 'rgba(212,255,74,0.75)' : 'rgba(147,168,156,0.22)';
      ctx.fillRect(x, mid - barH / 2, barW, barH);
    }

    // Playhead across filled region
    if (state.seconds > 0.05 && (state.playing || state.paused)) {
      const filled = Math.min(1, state.seconds / PREHEAR_SECONDS);
      const playX = filled * w * (state.position / Math.max(state.seconds, 0.001));
      ctx.strokeStyle = 'rgba(255,122,69,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 2);
      ctx.lineTo(playX, h - 2);
      ctx.stroke();
    }

    // Ready fill hint (how much of 11s captured)
    const fill = Math.min(1, state.seconds / PREHEAR_SECONDS);
    ctx.fillStyle = 'rgba(212,255,74,0.12)';
    ctx.fillRect(0, h - 3, w * fill, 3);
  }, [state]);

  const canPlay = engineRunning && state.ready;
  const isPlaying = state.playing && !state.paused;
  const hint = !engineRunning
    ? labels.needEngine
    : !state.ready
      ? labels.empty
      : labels.hint;

  return (
    <div className="prehear-block">
      <div className="prehear-head">
        <span className="prehear-title">{labels.title}</span>
        <span className="prehear-time">
          {formatTime(state.position)} / {formatTime(Math.min(state.seconds, PREHEAR_SECONDS))}
        </span>
      </div>
      <canvas ref={canvasRef} className="prehear-wave" height={56} />
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

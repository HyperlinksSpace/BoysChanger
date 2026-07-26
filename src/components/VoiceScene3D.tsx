import React, { useEffect, useRef, useState } from 'react';
import {
  createVoiceScene,
  type SceneDensity,
  type SceneVariant,
  type VoiceSceneHandle,
} from '../visuals/createVoiceScene';
import { holdWebGLSlot, type ScenePriority } from '../visuals/scenePool';

type Props = {
  className?: string;
  accent?: string;
  density?: SceneDensity;
  variant?: SceneVariant;
  /** When true, only create WebGL while on screen (default true for card). */
  lazy?: boolean;
  /** Pool priority — heroes/nav keep slots; cards yield. */
  priority?: ScenePriority;
};

export function VoiceScene3D({
  className,
  accent,
  density = 'full',
  variant = 'mic',
  lazy,
  priority,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handle = useRef<VoiceSceneHandle | null>(null);
  const accentRef = useRef(accent);
  accentRef.current = accent;
  const shouldLazy = lazy ?? density === 'card';
  const poolPriority: ScenePriority =
    priority ?? (density === 'card' ? 'card' : 'hero');
  const [inView, setInView] = useState(!shouldLazy);
  const [hasSlot, setHasSlot] = useState(false);

  useEffect(() => {
    if (!shouldLazy) return;
    const el = mountRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: '120px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLazy]);

  useEffect(() => {
    if (!inView) {
      setHasSlot(false);
      return;
    }
    const release = holdWebGLSlot(poolPriority, {
      onGranted: () => setHasSlot(true),
      onRevoked: () => {
        handle.current?.dispose();
        handle.current = null;
        setHasSlot(false);
      },
    });
    return () => {
      handle.current?.dispose();
      handle.current = null;
      setHasSlot(false);
      release();
    };
  }, [inView, poolPriority]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !hasSlot) return;
    handle.current?.dispose();
    handle.current = createVoiceScene(el, {
      accent: accentRef.current,
      density,
      variant,
    });
    return () => {
      handle.current?.dispose();
      handle.current = null;
    };
  }, [hasSlot, density, variant]);

  useEffect(() => {
    if (accent) handle.current?.setAccent(accent);
  }, [accent]);

  const fallback = accent || '#d4ff4a';

  return (
    <div
      ref={mountRef}
      className={className || 'voice-scene-3d'}
      data-variant={variant}
      aria-hidden
    >
      {!hasSlot ? (
        <span className="voice-scene-fallback" style={{ '--fb': fallback } as React.CSSProperties} />
      ) : null}
    </div>
  );
}

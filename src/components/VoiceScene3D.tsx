import React, { useEffect, useRef, useState } from 'react';
import {
  createVoiceScene,
  type SceneDensity,
  type SceneVariant,
  type VoiceSceneHandle,
} from '../visuals/createVoiceScene';

type Props = {
  className?: string;
  accent?: string;
  density?: SceneDensity;
  variant?: SceneVariant;
  /** When true, only create WebGL while the element is on screen (default true for card). */
  lazy?: boolean;
};

export function VoiceScene3D({
  className,
  accent,
  density = 'full',
  variant = 'mic',
  lazy,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handle = useRef<VoiceSceneHandle | null>(null);
  const shouldLazy = lazy ?? density === 'card';
  const [live, setLive] = useState(!shouldLazy);

  useEffect(() => {
    if (!shouldLazy) return;
    const el = mountRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setLive(Boolean(entry?.isIntersecting)),
      { rootMargin: '80px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLazy]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !live) return;
    handle.current = createVoiceScene(el, { accent, density, variant });
    return () => {
      handle.current?.dispose();
      handle.current = null;
    };
  }, [live, density, variant]);

  useEffect(() => {
    if (accent) handle.current?.setAccent(accent);
  }, [accent]);

  return (
    <div
      ref={mountRef}
      className={className || 'voice-scene-3d'}
      data-variant={variant}
      aria-hidden
    />
  );
}

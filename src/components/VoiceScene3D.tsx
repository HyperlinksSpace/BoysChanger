import React, { useEffect, useRef, useState } from 'react';
import {
  createVoiceScene,
  type SceneDensity,
  type SceneVariant,
  type VoiceSceneHandle,
} from '../visuals/createVoiceScene';
import { holdWebGLSlot, type ScenePriority } from '../visuals/scenePool';
import { SceneChip } from './SceneChip';

type Props = {
  className?: string;
  accent?: string;
  density?: SceneDensity;
  variant?: SceneVariant;
  /** When true, only create WebGL while on screen (default true for card). */
  lazy?: boolean;
  /** Pool priority — heroes/nav keep slots; cards yield. */
  priority?: ScenePriority;
  /** Animation pace multiplier (profile mood). */
  motion?: number;
  accessory?: 'none' | 'headset' | 'earring' | 'bow' | 'spark';
};

export function VoiceScene3D({
  className,
  accent,
  density = 'full',
  variant = 'mic',
  lazy,
  priority,
  motion = 1,
  accessory = 'none',
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handle = useRef<VoiceSceneHandle | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const accentRef = useRef(accent);
  accentRef.current = accent;
  const shouldLazy = lazy ?? density === 'card';
  const poolPriority: ScenePriority =
    priority ?? (density === 'card' ? 'card' : 'hero');
  const [inView, setInView] = useState(!shouldLazy);
  const [hasSlot, setHasSlot] = useState(false);
  const [recoverKey, setRecoverKey] = useState(0);

  useEffect(() => {
    if (!shouldLazy) return;
    const el = mountRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: '80px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLazy]);

  useEffect(() => {
    if (!inView) {
      setHasSlot(false);
      releaseRef.current?.();
      releaseRef.current = null;
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
    releaseRef.current = release;
    return () => {
      handle.current?.dispose();
      handle.current = null;
      setHasSlot(false);
      releaseRef.current = null;
      release();
    };
  }, [inView, poolPriority, recoverKey]);

  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !hasSlot) {
      setSceneReady(false);
      return;
    }

    let canvas: HTMLCanvasElement | null = null;
    try {
      handle.current?.dispose();
      handle.current = createVoiceScene(el, {
        accent: accentRef.current,
        density,
        variant,
        motion,
        accessory,
      });
      canvas = el.querySelector('canvas');
      setSceneReady(Boolean(canvas));
    } catch {
      handle.current = null;
      setSceneReady(false);
      setHasSlot(false);
      releaseRef.current?.();
      releaseRef.current = null;
      window.setTimeout(() => setRecoverKey((k) => k + 1), 900);
      return;
    }

    const onLost = (event: Event) => {
      event.preventDefault();
      handle.current?.dispose();
      handle.current = null;
      setSceneReady(false);
      setHasSlot(false);
      releaseRef.current?.();
      releaseRef.current = null;
      window.setTimeout(() => setRecoverKey((k) => k + 1), 900);
    };
    canvas?.addEventListener('webglcontextlost', onLost, false);

    const t1 = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 40);
    const t2 = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 160);

    return () => {
      canvas?.removeEventListener('webglcontextlost', onLost, false);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      handle.current?.dispose();
      handle.current = null;
      setSceneReady(false);
    };
  }, [hasSlot, density, variant, motion, accessory]);

  useEffect(() => {
    if (accent) handle.current?.setAccent(accent);
  }, [accent]);

  const color = accent || '#8dff6a';

  return (
    <div
      ref={mountRef}
      className={className || 'voice-scene-3d'}
      data-variant={variant}
      data-live={sceneReady ? '1' : '0'}
      aria-hidden
    >
      {/* Always-on colourful animated variant — visible until / if WebGL mounts. */}
      <SceneChip variant={variant} accent={color} className="scene-chip underlay" />
    </div>
  );
}

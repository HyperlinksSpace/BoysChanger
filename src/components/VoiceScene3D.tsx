import React, { useEffect, useRef } from 'react';
import { createVoiceScene, type VoiceSceneHandle } from '../visuals/createVoiceScene';

type Props = {
  className?: string;
  accent?: string;
  density?: 'full' | 'compact';
};

export function VoiceScene3D({ className, accent, density = 'full' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<VoiceSceneHandle | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    handle.current = createVoiceScene(el, { accent, density });
    return () => {
      handle.current?.dispose();
      handle.current = null;
    };
  }, [density]);

  useEffect(() => {
    if (accent) handle.current?.setAccent(accent);
  }, [accent]);

  return <div ref={ref} className={className || 'voice-scene-3d'} aria-hidden />;
}

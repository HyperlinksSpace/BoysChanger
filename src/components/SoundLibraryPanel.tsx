import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  addUserMp3,
  getSoundArrayBuffer,
  listSounds,
  removeSound,
  type LibrarySound,
} from '../audio/soundLibrary';
import { SceneChip } from './SceneChip';
import { VoiceScene3D } from './VoiceScene3D';
import { accentFromSeed, variantFromSeed } from '../visuals/createVoiceScene';

type Props = {
  labels: {
    title: string;
    hint: string;
    upload: string;
    playing: string;
    remove: string;
    empty: string;
    needEngine: string;
  };
  engineRunning: boolean;
  onPlayBuffer: (buffer: ArrayBuffer) => Promise<number>;
  onStop: () => void;
  onEnsureEngine: () => Promise<boolean>;
};

export function SoundLibraryPanel({
  labels,
  engineRunning,
  onPlayBuffer,
  onStop,
  onEnsureEngine,
}: Props) {
  const [sounds, setSounds] = useState<LibrarySound[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const clearTimer = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listSounds();
      setSounds(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      onStop();
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, [refresh, onStop]);

  const play = async (sound: LibrarySound) => {
    setError('');
    onStop();
    setActiveId(null);
    activeIdRef.current = null;
    if (clearTimer.current) window.clearTimeout(clearTimer.current);

    const ready = engineRunning || (await onEnsureEngine());
    if (!ready) {
      setError(labels.needEngine);
      return;
    }

    try {
      activeIdRef.current = sound.id;
      setActiveId(sound.id);
      const buffer = await getSoundArrayBuffer(sound.id);
      const duration = await onPlayBuffer(buffer);
      clearTimer.current = window.setTimeout(() => {
        if (activeIdRef.current === sound.id) {
          activeIdRef.current = null;
          setActiveId(null);
        }
      }, Math.max(400, duration * 1000 + 80));
    } catch (e) {
      activeIdRef.current = null;
      setActiveId(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    const ok =
      /audio\/(mpeg|mp3|wav|x-wav|ogg|webm)/i.test(file.type) ||
      /\.(mp3|wav|ogg|webm)$/i.test(file.name);
    if (!ok) {
      setError('MP3 / WAV / OGG only');
      return;
    }
    try {
      await addUserMp3(file);
      await refresh();
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="panel compact sounds">
      <div className="library-hero sounds-hero">
        <div className="library-hero-copy">
          <h2>{labels.title}</h2>
          <p className="hint">{labels.hint}</p>
        </div>
        <div className="library-hero-art" aria-hidden>
          <VoiceScene3D
            density="compact"
            variant="speaker"
            accent="#5ce1ff"
            className="voice-scene-3d compact"
            priority="hero"
          />
        </div>
      </div>
      <div className="sound-actions">
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
          {labels.upload}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/mpeg,audio/mp3,.mp3,audio/wav,.wav,audio/ogg"
          hidden
          onChange={(e) => {
            void onUpload(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        {error ? <span className="sound-error">{error}</span> : null}
      </div>
      {sounds.length === 0 ? (
        <p className="hint">{labels.empty}</p>
      ) : (
        <div className="sound-grid">
          {sounds.map((s) => {
            const color = accentFromSeed(s.id + s.name);
            const variant = s.source === 'user' ? 'wave' : variantFromSeed(s.id);
            return (
              <div key={s.id} className={`sound-chip ${activeId === s.id ? 'active' : ''}`}>
                <button type="button" className="sound-play" onClick={() => void play(s)}>
                  <span className="sound-3d" aria-hidden>
                    <SceneChip
                      variant={variant === 'wave' ? 'wave' : variant}
                      accent={color}
                    />
                  </span>
                  <span className="sound-meta">
                    <strong>{s.name}</strong>
                    <span>
                      {activeId === s.id ? labels.playing : s.source === 'user' ? 'MP3' : 'FX'}
                    </span>
                  </span>
                </button>
                {s.source === 'user' ? (
                  <button
                    type="button"
                    className="sound-del"
                    title={labels.remove}
                    onClick={() => void removeSound(s.id).then(refresh)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

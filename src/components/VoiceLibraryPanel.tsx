import React, { useMemo, useState } from 'react';
import type { VoicePreset } from '../audio/voicePresets';
import { VoiceScene3D } from './VoiceScene3D';
import { variantForVoicePreset } from '../visuals/createVoiceScene';

type Filter = 'all' | 'builtin' | 'mine';

type Props = {
  presets: VoicePreset[];
  activeId: string | null;
  labels: {
    title: string;
    builtin: string;
    mine: string;
    all: string;
    search: string;
    emptyMine: string;
    freeBadge: string;
    delete: string;
    cloudSoon: string;
  };
  onSelect: (preset: VoicePreset) => void;
  onDelete: (id: string) => void;
};

export function VoiceLibraryPanel({
  presets,
  activeId,
  labels,
  onSelect,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return presets.filter((p) => {
      if (filter === 'builtin' && p.source !== 'builtin') return false;
      if (filter === 'mine' && p.source !== 'user') return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [presets, filter, query]);

  return (
    <div className="voice-library">
      <div className="library-hero">
        <div className="library-hero-copy">
          <h2>{labels.title}</h2>
          <p>{labels.cloudSoon}</p>
        </div>
        <div className="library-hero-art" aria-hidden>
          <VoiceScene3D
            density="compact"
            variant="mic"
            accent="#8dff6a"
            className="voice-scene-3d compact"
            priority="hero"
          />
        </div>
      </div>

      <div className="library-toolbar">
        <input
          className="library-search"
          type="search"
          placeholder={labels.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="library-filters">
          {(
            [
              ['all', labels.all],
              ['builtin', labels.builtin],
              ['mine', labels.mine],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={filter === id ? 'chip active' : 'chip'}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="library-empty">{labels.emptyMine}</p>
      ) : (
        <div className="voice-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`voice-card ${activeId === p.id ? 'active' : ''}`}
              style={{ '--card-accent': p.color } as React.CSSProperties}
              onClick={() => onSelect(p)}
            >
              <span className="voice-card-ring">
                <VoiceScene3D
                  density="card"
                  variant={variantForVoicePreset(p.id, p.name)}
                  accent={p.color}
                  className="voice-scene-3d card"
                  lazy
                  priority="card"
                />
              </span>
              <span className="voice-card-name">{p.name}</span>
              <span className="voice-card-meta">
                {p.source === 'builtin' ? labels.freeBadge : labels.mine}
              </span>
              {p.source === 'user' ? (
                <span
                  className="voice-card-delete"
                  role="button"
                  tabIndex={0}
                  title={labels.delete}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(p.id);
                    }
                  }}
                >
                  ×
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

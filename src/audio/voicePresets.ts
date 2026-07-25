/** Local Voice Studio presets (IndexedDB). Cloud comes later. */

import type { AgePreset, EffectId, GenderPreset, RacePreset, VoiceSettings } from './types';
import { DEFAULT_SETTINGS } from './types';

const DB_NAME = 'boyschanger-voices';
const STORE = 'presets';
const DB_VERSION = 1;

/** Character + FX slice of settings (devices stay global). */
export type VoicePresetPayload = {
  race: RacePreset;
  gender: GenderPreset;
  age: AgePreset;
  timbre: number;
  amplifier: number;
  volume: number;
  effects: Record<EffectId, boolean>;
  effectMix: number;
};

export type VoicePreset = {
  id: string;
  name: string;
  /** Accent color for cute card UI */
  color: string;
  emoji: string;
  source: 'builtin' | 'user';
  createdAt: number;
  updatedAt: number;
  payload: VoicePresetPayload;
};

const COLORS = ['#d4ff4a', '#5ce1ff', '#ff7a45', '#ff5cad', '#b388ff', '#ffd166', '#3ddc84', '#ff6b6b'];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(): Promise<VoicePreset[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as VoicePreset[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(preset: VoicePreset): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(preset);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function payloadFromSettings(s: VoiceSettings): VoicePresetPayload {
  return {
    race: s.race,
    gender: s.gender,
    age: s.age,
    timbre: s.timbre,
    amplifier: s.amplifier,
    volume: s.volume,
    effects: { ...s.effects },
    effectMix: s.effectMix,
  };
}

export function applyPayloadToSettings(
  settings: VoiceSettings,
  payload: VoicePresetPayload,
): VoiceSettings {
  return {
    ...settings,
    race: payload.race,
    gender: payload.gender,
    age: payload.age,
    timbre: payload.timbre,
    amplifier: payload.amplifier,
    volume: payload.volume,
    effects: { ...DEFAULT_SETTINGS.effects, ...payload.effects },
    effectMix: payload.effectMix,
  };
}

/** Built-in starter voices. */
export const BUILTIN_VOICES: VoicePreset[] = [
  {
    id: 'builtin-clean',
    name: 'Clean Mic',
    color: '#5ce1ff',
    emoji: '🎙️',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'european',
      gender: 'neutral',
      age: 'adult',
      timbre: 50,
      amplifier: 40,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects },
      effectMix: 20,
    },
  },
  {
    id: 'builtin-bright-girl',
    name: 'Bright Girl',
    color: '#ff5cad',
    emoji: '🌸',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'asian',
      gender: 'feminine',
      age: 'teen',
      timbre: 72,
      amplifier: 45,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects, chorus: true },
      effectMix: 28,
    },
  },
  {
    id: 'builtin-deep-hero',
    name: 'Deep Hero',
    color: '#b388ff',
    emoji: '🛡️',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'african',
      gender: 'masculine',
      age: 'adult',
      timbre: 28,
      amplifier: 48,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects, reverb: true },
      effectMix: 30,
    },
  },
  {
    id: 'builtin-robot',
    name: 'Robot',
    color: '#d4ff4a',
    emoji: '🤖',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'european',
      gender: 'androgynous',
      age: 'young',
      timbre: 60,
      amplifier: 42,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects, robot: true, bitcrush: true },
      effectMix: 55,
    },
  },
  {
    id: 'builtin-chipmunk',
    name: 'Chipmunk',
    color: '#ffd166',
    emoji: '🐿️',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'latin',
      gender: 'feminine',
      age: 'child',
      timbre: 80,
      amplifier: 50,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects },
      effectMix: 15,
    },
  },
  {
    id: 'builtin-elder',
    name: 'Wise Elder',
    color: '#ff7a45',
    emoji: '🧙',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'middleEastern',
      gender: 'masculine',
      age: 'elder',
      timbre: 35,
      amplifier: 38,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects, echo: true },
      effectMix: 32,
    },
  },
  {
    id: 'builtin-alien',
    name: 'Alien',
    color: '#3ddc84',
    emoji: '👽',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'asian',
      gender: 'androgynous',
      age: 'young',
      timbre: 65,
      amplifier: 44,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects, flanger: true, wahwah: true },
      effectMix: 48,
    },
  },
  {
    id: 'builtin-radio',
    name: 'Radio Star',
    color: '#ff6b6b',
    emoji: '📻',
    source: 'builtin',
    createdAt: 0,
    updatedAt: 0,
    payload: {
      race: 'latin',
      gender: 'neutral',
      age: 'adult',
      timbre: 55,
      amplifier: 46,
      volume: 100,
      effects: { ...DEFAULT_SETTINGS.effects, distortion: true, chorus: true },
      effectMix: 40,
    },
  },
];

export async function listVoicePresets(): Promise<VoicePreset[]> {
  const user = await idbGetAll();
  const userSorted = [...user].sort((a, b) => b.updatedAt - a.updatedAt);
  return [...BUILTIN_VOICES, ...userSorted];
}

export async function saveVoicePreset(
  name: string,
  settings: VoiceSettings,
  opts?: { id?: string; color?: string; emoji?: string },
): Promise<VoicePreset> {
  const now = Date.now();
  const id = opts?.id || `user-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const existing = (await idbGetAll()).find((p) => p.id === id);
  const color = opts?.color || existing?.color || COLORS[Math.floor(Math.random() * COLORS.length)];
  const emoji = opts?.emoji || existing?.emoji || '✨';
  const preset: VoicePreset = {
    id,
    name: name.trim() || 'My Voice',
    color,
    emoji,
    source: 'user',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    payload: payloadFromSettings(settings),
  };
  await idbPut(preset);
  return preset;
}

export async function deleteVoicePreset(id: string): Promise<void> {
  if (id.startsWith('builtin-')) return;
  await idbDelete(id);
}

export async function renameVoicePreset(id: string, name: string): Promise<VoicePreset | null> {
  if (id.startsWith('builtin-')) return null;
  const all = await idbGetAll();
  const found = all.find((p) => p.id === id);
  if (!found) return null;
  const next = { ...found, name: name.trim() || found.name, updatedAt: Date.now() };
  await idbPut(next);
  return next;
}

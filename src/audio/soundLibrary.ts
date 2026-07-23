/** Built-in + user MP3 sound library (IndexedDB). */

const DB_NAME = 'boyschanger-sounds';
const STORE = 'sounds';
const DB_VERSION = 1;

export type LibrarySound = {
  id: string;
  name: string;
  /** data URL or blob URL */
  url: string;
  source: 'builtin' | 'user';
  createdAt: number;
};

type StoredSound = {
  id: string;
  name: string;
  mime: string;
  buffer: ArrayBuffer;
  source: 'builtin' | 'user';
  createdAt: number;
};

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

async function idbGetAll(): Promise<StoredSound[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as StoredSound[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(sound: StoredSound): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(sound);
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

function writeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const w = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  w(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, n * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return buffer;
}

function tone(
  freq: number,
  seconds: number,
  sampleRate: number,
  type: 'sine' | 'square' | 'saw' | 'noise' = 'sine',
  gain = 0.35,
): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, i / (sampleRate * 0.01)) * Math.min(1, (n - i) / (sampleRate * 0.05));
    let v = 0;
    if (type === 'noise') v = Math.random() * 2 - 1;
    else if (type === 'square') v = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
    else if (type === 'saw') v = 2 * ((t * freq) % 1) - 1;
    else v = Math.sin(2 * Math.PI * freq * t);
    out[i] = v * gain * env;
  }
  return out;
}

function sweep(f0: number, f1: number, seconds: number, sampleRate: number, gain = 0.3): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t;
    phase += (2 * Math.PI * f) / sampleRate;
    const env = Math.sin(Math.PI * t);
    out[i] = Math.sin(phase) * gain * env;
  }
  return out;
}

function makeBuiltinCatalog(sampleRate = 44100): { id: string; name: string; samples: Float32Array }[] {
  return [
    { id: 'builtin-click', name: 'Click', samples: tone(1200, 0.06, sampleRate, 'sine', 0.4) },
    { id: 'builtin-beep', name: 'Beep', samples: tone(880, 0.18, sampleRate, 'sine', 0.35) },
    { id: 'builtin-blip', name: 'Blip', samples: sweep(400, 1400, 0.14, sampleRate, 0.32) },
    { id: 'builtin-laser', name: 'Laser', samples: sweep(1800, 220, 0.35, sampleRate, 0.28) },
    { id: 'builtin-whoosh', name: 'Whoosh', samples: (() => {
      const n = Math.floor(sampleRate * 0.45);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const env = Math.sin(Math.PI * t);
        out[i] = (Math.random() * 2 - 1) * env * 0.22 * (0.4 + 0.6 * t);
      }
      return out;
    })() },
    { id: 'builtin-coin', name: 'Coin', samples: (() => {
      const a = tone(988, 0.08, sampleRate, 'sine', 0.3);
      const b = tone(1319, 0.16, sampleRate, 'sine', 0.28);
      const out = new Float32Array(a.length + b.length);
      out.set(a, 0);
      out.set(b, a.length);
      return out;
    })() },
    { id: 'builtin-thud', name: 'Thud', samples: (() => {
      const n = Math.floor(sampleRate * 0.28);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 14);
        out[i] = Math.sin(2 * Math.PI * (90 + t * 40) * t) * env * 0.55;
      }
      return out;
    })() },
    { id: 'builtin-glitch', name: 'Glitch', samples: (() => {
      const n = Math.floor(sampleRate * 0.22);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 8);
        const v = Math.sin(2 * Math.PI * (200 + (i % 37) * 40) * t);
        out[i] = (v * 0.5 + (Math.random() * 2 - 1) * 0.3) * env * 0.35;
      }
      return out;
    })() },
  ];
}

const urlCache = new Map<string, string>();

function bufferToUrl(id: string, buffer: ArrayBuffer, mime: string): string {
  const prev = urlCache.get(id);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
  urlCache.set(id, url);
  return url;
}

export async function ensureBuiltinsSeeded(): Promise<void> {
  const existing = await idbGetAll();
  const have = new Set(existing.map((s) => s.id));
  const catalog = makeBuiltinCatalog();
  for (const item of catalog) {
    if (have.has(item.id)) continue;
    const wav = writeWav(item.samples, 44100);
    await idbPut({
      id: item.id,
      name: item.name,
      mime: 'audio/wav',
      buffer: wav,
      source: 'builtin',
      createdAt: Date.now(),
    });
  }
}

export async function listSounds(): Promise<LibrarySound[]> {
  await ensureBuiltinsSeeded();
  const rows = await idbGetAll();
  rows.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'builtin' ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: bufferToUrl(r.id, r.buffer, r.mime),
    source: r.source,
    createdAt: r.createdAt,
  }));
}

export async function addUserMp3(file: File): Promise<LibrarySound> {
  const buffer = await file.arrayBuffer();
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = file.name.replace(/\.[^.]+$/, '') || 'Sound';
  const mime = file.type || 'audio/mpeg';
  await idbPut({
    id,
    name,
    mime,
    buffer,
    source: 'user',
    createdAt: Date.now(),
  });
  return {
    id,
    name,
    url: bufferToUrl(id, buffer, mime),
    source: 'user',
    createdAt: Date.now(),
  };
}

export async function removeSound(id: string): Promise<void> {
  if (id.startsWith('builtin-')) return;
  await idbDelete(id);
  const prev = urlCache.get(id);
  if (prev) {
    URL.revokeObjectURL(prev);
    urlCache.delete(id);
  }
}

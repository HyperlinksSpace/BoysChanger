/** Local user profile (IndexedDB + localStorage). Cloud sync later. */

import type { SceneVariant } from '../visuals/createVoiceScene';

export type SkinId = 'peach' | 'warm' | 'deep' | 'cool' | 'lime' | 'pink' | 'cyan' | 'void';
export type HairId = 'none' | 'short' | 'wavy' | 'spike' | 'bun' | 'cap';
export type EyesId = 'round' | 'cat' | 'star' | 'shades';
export type AccId = 'none' | 'headset' | 'earring' | 'bow' | 'spark';
export type MoodId = 'smile' | 'cool' | 'laugh' | 'neutral';
export type FormId = SceneVariant;

export type ComposedAvatar = {
  mode: 'compose';
  /** Neon accent of the 3D avatar (dashboard hero language). */
  skin: SkinId;
  /** 3D shape / form — same variants as dashboard scenes. */
  form: FormId;
  /** Legacy cartoon fields kept for older saves; UI maps them into form when missing. */
  hair: HairId;
  eyes: EyesId;
  accessory: AccId;
  mood: MoodId;
};

export type UploadAvatar = {
  mode: 'upload';
  /** Object URL or data URL for display (rebuilt from blob on load). */
  previewUrl: string;
};

export type ProfileAvatar = ComposedAvatar | UploadAvatar;

export type UserProfile = {
  displayName: string;
  avatar: ProfileAvatar;
  updatedAt: number;
};

const META_KEY = 'boyschanger-profile';
const DB_NAME = 'boyschanger-profile';
const STORE = 'blobs';
const UPLOAD_KEY = 'avatar-upload';
const DB_VERSION = 1;

export const SKIN_OPTIONS: { id: SkinId; label: string; color: string }[] = [
  { id: 'peach', label: 'Peach', color: '#f2c4a0' },
  { id: 'warm', label: 'Warm', color: '#d08b5a' },
  { id: 'deep', label: 'Deep', color: '#8d5524' },
  { id: 'cool', label: 'Cool', color: '#c9b8a8' },
  { id: 'lime', label: 'Lime', color: '#8dff6a' },
  { id: 'pink', label: 'Pink', color: '#ff5cad' },
  { id: 'cyan', label: 'Cyan', color: '#5ce1ff' },
  { id: 'void', label: 'Void', color: '#2a3340' },
];

export const FORM_OPTIONS: { id: FormId; label: string }[] = [
  { id: 'logo', label: 'Crystal mark' },
  { id: 'orb', label: 'Orb' },
  { id: 'crystal', label: 'Shard' },
  { id: 'ring', label: 'Rings' },
  { id: 'mic', label: 'Mic' },
  { id: 'speaker', label: 'Speaker' },
  { id: 'flask', label: 'Flask' },
  { id: 'gear', label: 'Gear' },
  { id: 'wave', label: 'Wave' },
];

export const HAIR_OPTIONS: { id: HairId; label: string; color: string }[] = [
  { id: 'none', label: 'None', color: 'transparent' },
  { id: 'short', label: 'Short', color: '#1a1a1a' },
  { id: 'wavy', label: 'Wavy', color: '#6b3fa0' },
  { id: 'spike', label: 'Spike', color: '#8dff6a' },
  { id: 'bun', label: 'Bun', color: '#ff7a45' },
  { id: 'cap', label: 'Cap', color: '#5ce1ff' },
];

export const EYES_OPTIONS: { id: EyesId; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'cat', label: 'Cat' },
  { id: 'star', label: 'Star' },
  { id: 'shades', label: 'Shades' },
];

export const ACC_OPTIONS: { id: AccId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'headset', label: 'Headset' },
  { id: 'earring', label: 'Earring' },
  { id: 'bow', label: 'Bow' },
  { id: 'spark', label: 'Spark' },
];

export const MOOD_OPTIONS: { id: MoodId; label: string }[] = [
  { id: 'smile', label: 'Smile' },
  { id: 'cool', label: 'Cool' },
  { id: 'laugh', label: 'Laugh' },
  { id: 'neutral', label: 'Neutral' },
];

const FORM_IDS = new Set<string>(FORM_OPTIONS.map((f) => f.id));

function hairToForm(hair?: HairId): FormId {
  if (hair === 'short') return 'mic';
  if (hair === 'wavy') return 'wave';
  if (hair === 'spike') return 'crystal';
  if (hair === 'bun') return 'orb';
  if (hair === 'cap') return 'gear';
  return 'logo';
}

function normalizeForm(raw: unknown, hair?: HairId): FormId {
  if (typeof raw === 'string' && FORM_IDS.has(raw)) return raw as FormId;
  return hairToForm(hair);
}

export const DEFAULT_COMPOSE: ComposedAvatar = {
  mode: 'compose',
  skin: 'lime',
  form: 'logo',
  hair: 'spike',
  eyes: 'star',
  accessory: 'headset',
  mood: 'smile',
};

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  avatar: { ...DEFAULT_COMPOSE },
  updatedAt: 0,
};

export function avatarAccent(avatar: ProfileAvatar): string {
  if (avatar.mode === 'upload') return '#8dff6a';
  return SKIN_OPTIONS.find((s) => s.id === avatar.skin)?.color || '#8dff6a';
}

export function avatarForm(avatar: ProfileAvatar): FormId {
  if (avatar.mode === 'upload') return 'logo';
  return normalizeForm(avatar.form, avatar.hair);
}

/** Spin / float intensity for the 3D avatar (mood → motion). */
export function avatarMotion(avatar: ProfileAvatar): number {
  if (avatar.mode !== 'compose') return 1;
  if (avatar.mood === 'laugh') return 1.55;
  if (avatar.mood === 'cool') return 0.85;
  if (avatar.mood === 'neutral') return 0.55;
  return 1;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetBlob(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeleteBlob(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function normalizeCompose(avatar: Partial<ComposedAvatar>): ComposedAvatar {
  const hair = avatar.hair || DEFAULT_COMPOSE.hair;
  return {
    mode: 'compose',
    skin: avatar.skin || DEFAULT_COMPOSE.skin,
    form: normalizeForm(avatar.form, hair),
    hair,
    eyes: avatar.eyes || DEFAULT_COMPOSE.eyes,
    accessory: avatar.accessory || DEFAULT_COMPOSE.accessory,
    mood: avatar.mood || DEFAULT_COMPOSE.mood,
  };
}

function readMeta(): UserProfile {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, avatar: { ...DEFAULT_COMPOSE } };
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    const avatar = parsed.avatar;
    if (avatar?.mode === 'compose') {
      return {
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
        avatar: normalizeCompose(avatar),
        updatedAt: parsed.updatedAt || 0,
      };
    }
    if (avatar?.mode === 'upload') {
      return {
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
        avatar: { mode: 'upload', previewUrl: '' },
        updatedAt: parsed.updatedAt || 0,
      };
    }
    return { ...DEFAULT_PROFILE, avatar: { ...DEFAULT_COMPOSE } };
  } catch {
    return { ...DEFAULT_PROFILE, avatar: { ...DEFAULT_COMPOSE } };
  }
}

function writeMeta(profile: UserProfile) {
  const toStore: UserProfile =
    profile.avatar.mode === 'upload'
      ? {
          ...profile,
          avatar: { mode: 'upload', previewUrl: '' },
        }
      : profile;
  localStorage.setItem(META_KEY, JSON.stringify(toStore));
}

/** Load profile; rebuilds object URL for uploaded avatars. */
export async function loadUserProfile(): Promise<UserProfile> {
  const meta = readMeta();
  if (meta.avatar.mode !== 'upload') return meta;
  const blob = await idbGetBlob(UPLOAD_KEY);
  if (!blob) {
    return { ...meta, avatar: { ...DEFAULT_COMPOSE } };
  }
  const previewUrl = URL.createObjectURL(blob);
  return { ...meta, avatar: { mode: 'upload', previewUrl } };
}

export async function saveComposedProfile(
  displayName: string,
  avatar: ComposedAvatar,
): Promise<UserProfile> {
  await idbDeleteBlob(UPLOAD_KEY).catch(() => undefined);
  const next: UserProfile = {
    displayName: displayName.trim().slice(0, 32),
    avatar: normalizeCompose(avatar),
    updatedAt: Date.now(),
  };
  writeMeta(next);
  return next;
}

export async function saveUploadedAvatar(
  displayName: string,
  file: Blob,
): Promise<UserProfile> {
  const type = file.type || 'image/png';
  if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(type)) {
    throw new Error('Use PNG, JPG, WEBP, or GIF');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Image must be under 4 MB');
  }
  await idbPutBlob(UPLOAD_KEY, file);
  const previewUrl = URL.createObjectURL(file);
  const next: UserProfile = {
    displayName: displayName.trim().slice(0, 32),
    avatar: { mode: 'upload', previewUrl },
    updatedAt: Date.now(),
  };
  writeMeta(next);
  return next;
}

export async function clearUploadedAvatar(displayName: string): Promise<UserProfile> {
  await idbDeleteBlob(UPLOAD_KEY).catch(() => undefined);
  return saveComposedProfile(displayName, { ...DEFAULT_COMPOSE });
}

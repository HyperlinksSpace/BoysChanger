export type RacePreset = 'latin' | 'european' | 'african' | 'asian' | 'middleEastern';
export type GenderPreset = 'neutral' | 'feminine' | 'masculine' | 'androgynous';
export type AgePreset = 'child' | 'teen' | 'young' | 'adult' | 'elder';

export type EffectId =
  | 'echo'
  | 'wahwah'
  | 'distortion'
  | 'reverb'
  | 'chorus'
  | 'robot'
  | 'flanger'
  | 'bitcrush';

export interface VoiceSettings {
  enabled: boolean;
  race: RacePreset;
  gender: GenderPreset;
  age: AgePreset;
  /** 0–100: brightness / color of voice */
  timbre: number;
  /** 0–100: drive / loudness boost before effects */
  amplifier: number;
  /** 0–100: master output volume */
  volume: number;
  effects: Record<EffectId, boolean>;
  effectMix: number;
  inputDeviceId: string;
  /** Playback device id for virtual cable (CABLE Input / BlackHole) */
  outputDeviceId: string;
  monitorLocally: boolean;
}

export const RACE_PRESETS: RacePreset[] = [
  'latin',
  'european',
  'african',
  'asian',
  'middleEastern',
];

/** Map legacy bright/warm/deep/airy/neutral → new race ids */
export function migrateRace(raw: unknown): RacePreset {
  const v = String(raw || '');
  if ((RACE_PRESETS as string[]).includes(v)) return v as RacePreset;
  switch (v) {
    case 'warm':
      return 'latin';
    case 'deep':
      return 'african';
    case 'airy':
    case 'bright':
      return 'asian';
    case 'neutral':
    default:
      return 'european';
  }
}

export const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: false,
  race: 'european',
  gender: 'neutral',
  age: 'adult',
  timbre: 50,
  amplifier: 15,
  volume: 80,
  effects: {
    echo: false,
    wahwah: false,
    distortion: false,
    reverb: false,
    chorus: false,
    robot: false,
    flanger: false,
    bitcrush: false,
  },
  effectMix: 35,
  inputDeviceId: 'default',
  outputDeviceId: '',
  monitorLocally: false,
};

export const PREHEAR_SECONDS = 11;
export const PREHEAR_READY_SECONDS = 0.4;

export type VoiceCharacter = {
  /** Fundamental pitch shift in semitones */
  pitchSemitones: number;
  /**
   * Vocal-tract / formant scale (independent of pitch).
   * <1 = longer tract (deeper “body”), >1 = shorter tract (brighter/smaller).
   * This is what makes voices sound like different people — not just higher/lower.
   */
  formantRatio: number;
  /** Peaking formant band gains (dB) at F1..F4 * formantRatio */
  formantGains: [number, number, number, number];
  /** Base formant center frequencies before formantRatio (Hz) */
  formantBases: [number, number, number, number];
};

/**
 * Resolve a clearly distinct voice morph.
 * Based on common VC practice: independent pitch + formant (tract length) scaling
 * (see SoundTouch formant correction / Signalsmith formant factor / audiojs shift-formant).
 */
export function resolveVoiceCharacter(s: VoiceSettings): VoiceCharacter {
  let pitch = 0;
  let formant = 1;
  // Base speech formants F1–F4-ish
  const formantBases: [number, number, number, number] = [500, 900, 1500, 2800];
  let gains: [number, number, number, number] = [4, 5, 4, 2];

  switch (s.gender) {
    case 'feminine':
      pitch += 6;
      formant *= 1.32;
      gains = [4, 8, 8, 6];
      break;
    case 'masculine':
      pitch -= 6;
      formant *= 0.74;
      gains = [9, 5, 2, 0];
      break;
    case 'androgynous':
      pitch += 2;
      formant *= 1.12;
      gains = [4, 7, 6, 4];
      break;
    default:
      break;
  }

  switch (s.age) {
    case 'child':
      pitch += 7;
      formant *= 1.35;
      gains = [2, 6, 9, 7];
      break;
    case 'teen':
      pitch += 3.5;
      formant *= 1.16;
      gains = [3, 7, 7, 5];
      break;
    case 'young':
      pitch += 1.5;
      formant *= 1.06;
      break;
    case 'elder':
      pitch -= 3;
      formant *= 0.86;
      gains = [8, 4, 1, -1];
      break;
    default:
      break;
  }

  // Regional / stylistic tract + pitch colors (entertainment profiles).
  // Differences must be large — subtle EQ alone is not audible as a “different person”.
  switch (s.race) {
    case 'latin':
      pitch += 1.8;
      formant *= 1.1;
      gains = [gains[0] + 1, gains[1] + 4, gains[2] + 3, gains[3] + 2];
      break;
    case 'european':
      pitch += 0.2;
      formant *= 1.0;
      gains = [gains[0], gains[1] + 1, gains[2] + 2, gains[3] + 1];
      break;
    case 'african':
      pitch -= 2.5;
      formant *= 0.78;
      gains = [gains[0] + 5, gains[1] + 2, gains[2] - 2, gains[3] - 2];
      break;
    case 'asian':
      pitch += 3;
      formant *= 1.26;
      gains = [gains[0] - 2, gains[1] + 2, gains[2] + 5, gains[3] + 5];
      break;
    case 'middleEastern':
      pitch += 1;
      formant *= 1.14;
      gains = [gains[0] + 2, gains[1] + 5, gains[2] + 4, gains[3] + 1];
      break;
    default:
      break;
  }

  const tilt = (s.timbre - 50) / 50;
  pitch += tilt * 2.5;
  formant *= 1 + tilt * 0.14;
  gains = [
    gains[0] - tilt * 3,
    gains[1] + tilt * 1,
    gains[2] + tilt * 4,
    gains[3] + tilt * 5,
  ];

  return {
    pitchSemitones: Math.max(-12, Math.min(12, pitch)),
    formantRatio: Math.max(0.65, Math.min(1.5, formant)),
    formantGains: gains.map((g) => Math.max(-6, Math.min(14, g))) as [
      number,
      number,
      number,
      number,
    ],
    formantBases,
  };
}

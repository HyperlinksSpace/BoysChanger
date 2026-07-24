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

/**
 * Character → clearly audible EQ / pitch targets (stylistic voice colors).
 */
export function resolveVoiceCharacter(s: VoiceSettings): {
  pitchSemitones: number;
  lowGain: number;
  midGain: number;
  highGain: number;
  midFreq: number;
} {
  let pitch = 0;
  let low = 0;
  let mid = 0;
  let high = 0;
  let midFreq = 1200;

  switch (s.gender) {
    case 'feminine':
      pitch += 3.5;
      mid += 4;
      high += 5;
      midFreq = 1700;
      break;
    case 'masculine':
      pitch -= 3.5;
      low += 5;
      high -= 3;
      midFreq = 850;
      break;
    case 'androgynous':
      pitch += 1.2;
      mid += 2;
      high += 1.5;
      midFreq = 1400;
      break;
    default:
      break;
  }

  switch (s.age) {
    case 'child':
      pitch += 5;
      high += 5;
      mid += 3;
      low -= 2;
      midFreq = 1900;
      break;
    case 'teen':
      pitch += 2.5;
      high += 3;
      midFreq = 1600;
      break;
    case 'young':
      pitch += 1;
      high += 2;
      break;
    case 'elder':
      pitch -= 1.8;
      low += 3;
      high -= 3;
      midFreq = 950;
      break;
    default:
      break;
  }

  // Stylistic “race/region” voice colors — distinct formant tilts
  switch (s.race) {
    case 'latin':
      pitch += 0.8;
      low += 2;
      mid += 4;
      high += 2;
      midFreq = 1350;
      break;
    case 'european':
      mid += 1.5;
      high += 2.5;
      midFreq = 1250;
      break;
    case 'african':
      pitch -= 1.2;
      low += 6;
      mid += 2;
      high -= 3;
      midFreq = 800;
      break;
    case 'asian':
      pitch += 1.5;
      low -= 2;
      mid += 2;
      high += 5;
      midFreq = 1650;
      break;
    case 'middleEastern':
      pitch += 0.4;
      low += 1;
      mid += 5;
      high += 1;
      midFreq = 1100;
      break;
    default:
      break;
  }

  // Timbre: stronger tilt so the slider is obvious
  const tilt = (s.timbre - 50) / 50;
  high += tilt * 5;
  low -= tilt * 3.5;
  pitch += tilt * 1.2;

  return {
    pitchSemitones: Math.max(-8, Math.min(8, pitch)),
    lowGain: Math.max(-10, Math.min(10, low)),
    midGain: Math.max(-10, Math.min(10, mid)),
    highGain: Math.max(-10, Math.min(10, high)),
    midFreq,
  };
}

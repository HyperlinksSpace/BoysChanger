export type RacePreset = 'neutral' | 'bright' | 'warm' | 'deep' | 'airy';
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

export const DEFAULT_SETTINGS: VoiceSettings = {
  enabled: false,
  race: 'neutral',
  gender: 'neutral',
  age: 'adult',
  timbre: 50,
  amplifier: 20,
  volume: 85,
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
 * Character → gentle EQ / mild pitch targets.
 * Amounts stay small so speech stays intelligible.
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
      pitch += 2.2;
      mid += 2.5;
      high += 3.5;
      midFreq = 1600;
      break;
    case 'masculine':
      pitch -= 2.2;
      low += 3;
      high -= 2;
      midFreq = 900;
      break;
    case 'androgynous':
      pitch += 0.6;
      mid += 1;
      midFreq = 1400;
      break;
    default:
      break;
  }

  switch (s.age) {
    case 'child':
      pitch += 3.5;
      high += 4;
      mid += 2;
      midFreq = 1800;
      break;
    case 'teen':
      pitch += 1.5;
      high += 2;
      midFreq = 1500;
      break;
    case 'young':
      pitch += 0.5;
      high += 1;
      break;
    case 'elder':
      pitch -= 1;
      low += 1.5;
      high -= 1.5;
      midFreq = 1000;
      break;
    default:
      break;
  }

  switch (s.race) {
    case 'bright':
      high += 2;
      mid += 1;
      break;
    case 'warm':
      low += 2;
      high -= 1;
      break;
    case 'deep':
      pitch -= 1;
      low += 3;
      high -= 2;
      midFreq = 850;
      break;
    case 'airy':
      pitch += 0.8;
      high += 3;
      midFreq = 1700;
      break;
    default:
      break;
  }

  // Timbre: gentle tilt only
  const tilt = (s.timbre - 50) / 50;
  high += tilt * 3;
  low -= tilt * 2;
  pitch += tilt * 0.6;

  return {
    pitchSemitones: pitch,
    lowGain: low,
    midGain: mid,
    highGain: high,
    midFreq,
  };
}

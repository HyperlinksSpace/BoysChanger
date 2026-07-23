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
  amplifier: 35,
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
  effectMix: 55,
  inputDeviceId: 'default',
  outputDeviceId: '',
  monitorLocally: true,
};

export const EFFECT_META: { id: EffectId; label: string; description: string }[] = [
  { id: 'echo', label: 'Echo', description: 'Delayed repeats' },
  { id: 'wahwah', label: 'Wah-wah', description: 'Sweeping filter' },
  { id: 'distortion', label: 'Distortion', description: 'Gritty drive' },
  { id: 'reverb', label: 'Reverb', description: 'Room wash' },
  { id: 'chorus', label: 'Chorus', description: 'Wide doubles' },
  { id: 'robot', label: 'Robot', description: 'Ring-mod metallic' },
  { id: 'flanger', label: 'Flanger', description: 'Jet sweep' },
  { id: 'bitcrush', label: 'Bitcrush', description: 'Lo-fi crunch' },
];

/** Pitch / formant targets derived from character presets. */
export function resolveVoiceCharacter(s: VoiceSettings): {
  pitchSemitones: number;
  formantShift: number;
} {
  let pitch = 0;
  let formant = 0;

  switch (s.gender) {
    case 'feminine':
      pitch += 4;
      formant += 0.18;
      break;
    case 'masculine':
      pitch -= 4;
      formant -= 0.16;
      break;
    case 'androgynous':
      pitch += 1;
      formant += 0.04;
      break;
    default:
      break;
  }

  switch (s.age) {
    case 'child':
      pitch += 7;
      formant += 0.28;
      break;
    case 'teen':
      pitch += 3;
      formant += 0.12;
      break;
    case 'young':
      pitch += 1;
      formant += 0.05;
      break;
    case 'elder':
      pitch -= 2;
      formant -= 0.08;
      break;
    default:
      break;
  }

  switch (s.race) {
    case 'bright':
      formant += 0.1;
      pitch += 0.5;
      break;
    case 'warm':
      formant -= 0.06;
      pitch -= 0.3;
      break;
    case 'deep':
      formant -= 0.14;
      pitch -= 1.5;
      break;
    case 'airy':
      formant += 0.16;
      pitch += 1.2;
      break;
    default:
      break;
  }

  // Timbre: 0 = darker/lower formants, 100 = brighter
  formant += (s.timbre - 50) / 50 * 0.22;
  pitch += (s.timbre - 50) / 50 * 1.5;

  return { pitchSemitones: pitch, formantShift: formant };
}

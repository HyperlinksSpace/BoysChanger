/**
 * Real-time pitch + formant morphing.
 *
 * Primary path: SoundTouchJS LPC formant-correction worklet
 * (https://github.com/cutterbl/SoundTouchJS) — pitch can move independently
 * of vocal-tract resonances so presets sound like different people, not just
 * the same voice higher/lower.
 *
 * Fallback: lightweight OLA pitch shifter when SoundTouch fails to load.
 */

export const PITCH_WORKLET_CODE = `
class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = 1;
    this.size = 24576;
    this.buf = new Float32Array(this.size);
    this.write = 0;
    this.grain = 3072;
    this.pos = [0, this.grain * 0.33, this.grain * 0.66];
    this.port.onmessage = (e) => {
      if (!e.data) return;
      if (typeof e.data.ratio === 'number') {
        this.ratio = Math.min(2.0, Math.max(0.5, e.data.ratio));
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    const inp = input[0];
    const out = output[0];
    const bypass = Math.abs(this.ratio - 1) < 0.01;

    for (let i = 0; i < inp.length; i++) {
      this.buf[this.write] = inp[i];
      this.write = (this.write + 1) % this.size;

      if (bypass) {
        out[i] = inp[i];
        continue;
      }

      let mix = 0;
      let wsum = 0;
      for (let g = 0; g < 3; g++) {
        const local = this.pos[g] % this.grain;
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * local) / this.grain);
        const raw = (this.write - this.grain + this.pos[g] + this.size * 8) % this.size;
        const idx = raw | 0;
        const frac = raw - idx;
        const a = this.buf[idx];
        const b = this.buf[(idx + 1) % this.size];
        mix += (a + (b - a) * frac) * w;
        wsum += w;
        this.pos[g] += this.ratio;
        if (this.pos[g] >= this.grain) this.pos[g] -= this.grain;
      }
      out[i] = wsum > 1e-6 ? mix / wsum : 0;
    }

    for (let c = 1; c < output.length; c++) output[c].set(out);
    return true;
  }
}
registerProcessor('pitch-shift-processor', PitchShiftProcessor);
`;

export type PitchBackend = 'soundtouch' | 'ola' | 'none';

export type PitchMorphNode = AudioWorkletNode & {
  pitchSemitones?: AudioParam;
  formantStrength?: AudioParam;
};

let soundTouchCtor: (new (opts: {
  context: BaseAudioContext;
  outputChannelCount?: 1 | 2;
}) => PitchMorphNode) | null = null;

export async function loadPitchWorklet(ctx: AudioContext): Promise<PitchBackend> {
  try {
    const [{ FormantCorrectionNode }, processorUrl] = await Promise.all([
      import('@soundtouchjs/formant-correction-worklet'),
      import('@soundtouchjs/formant-correction-worklet/processor?url').then(
        (m) => (m as { default: string }).default,
      ),
    ]);
    await FormantCorrectionNode.register(ctx, processorUrl);
    soundTouchCtor = FormantCorrectionNode as unknown as typeof soundTouchCtor;
    return 'soundtouch';
  } catch {
    // fall through to OLA
  }

  try {
    const blob = new Blob([PITCH_WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    return 'ola';
  } catch {
    return 'none';
  }
}

export function createPitchNode(
  ctx: AudioContext,
  backend: PitchBackend,
): PitchMorphNode | null {
  if (backend === 'soundtouch' && soundTouchCtor) {
    return new soundTouchCtor({ context: ctx, outputChannelCount: 1 });
  }
  if (backend === 'ola') {
    return new AudioWorkletNode(ctx, 'pitch-shift-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    }) as PitchMorphNode;
  }
  return null;
}

/**
 * How much LPC formant correction to apply so net tract length ≈ formantRatio
 * while pitch ≈ pitchSemitones (SoundTouch formantStrength semantics).
 */
export function formantStrengthFor(
  pitchSemitones: number,
  formantRatio: number,
): number {
  const pitchRatio = Math.pow(2, pitchSemitones / 12);
  if (Math.abs(pitchRatio - 1) < 0.03) return 0.85;
  // strength 1 → formants stay ~original (1.0); strength 0 → formants track pitchRatio
  const strength = (pitchRatio - formantRatio) / (pitchRatio - 1);
  return Math.max(0, Math.min(1, strength));
}

export function applyPitchMorph(
  node: PitchMorphNode,
  backend: PitchBackend,
  pitchSemitones: number,
  formantRatio: number,
  active: boolean,
) {
  if (!active) {
    if (backend === 'soundtouch') {
      if (node.pitchSemitones) node.pitchSemitones.value = 0;
      if (node.formantStrength) node.formantStrength.value = 1;
    } else {
      node.port.postMessage({ ratio: 1 });
    }
    return;
  }

  if (backend === 'soundtouch') {
    if (node.pitchSemitones) {
      node.pitchSemitones.value = Math.max(-12, Math.min(12, pitchSemitones));
    }
    if (node.formantStrength) {
      node.formantStrength.value = formantStrengthFor(pitchSemitones, formantRatio);
    }
    return;
  }

  // OLA: pitch only; formants handled by EQ bank upstream
  const ratio = Math.pow(2, pitchSemitones / 12);
  node.port.postMessage({ ratio: Math.min(2, Math.max(0.5, ratio)) });
}

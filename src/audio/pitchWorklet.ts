/**
 * Pitch-shift AudioWorklet: overlap-add granular shifter.
 * Kept as a string so Vite can inject it as a Blob URL without a separate asset path.
 */
export const PITCH_WORKLET_CODE = `
class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = 1;
    this._buf = new Float32Array(8192);
    this._write = 0;
    this._read = 0;
    this._grain = 1024;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.ratio === 'number') {
        this._ratio = Math.min(2.5, Math.max(0.4, e.data.ratio));
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    const inp = input[0];
    const out = output[0];
    const chCount = Math.min(input.length, output.length);

    for (let i = 0; i < inp.length; i++) {
      this._buf[this._write] = inp[i];
      this._write = (this._write + 1) % this._buf.length;
    }

    for (let i = 0; i < out.length; i++) {
      let sample = 0;
      let wsum = 0;
      const grains = 4;
      for (let g = 0; g < grains; g++) {
        const phase = (this._read + (g * this._grain) / grains) % this._buf.length;
        const idx = Math.floor(phase) % this._buf.length;
        const frac = phase - Math.floor(phase);
        const a = this._buf[idx];
        const b = this._buf[(idx + 1) % this._buf.length];
        const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * ((phase % this._grain) / this._grain)));
        sample += (a + (b - a) * frac) * window;
        wsum += window;
      }
      out[i] = wsum > 0.0001 ? sample / wsum : 0;
      this._read += this._ratio;
      if (this._read >= this._buf.length) this._read -= this._buf.length;
    }

    for (let c = 1; c < chCount; c++) {
      output[c].set(out);
    }
    return true;
  }
}
registerProcessor('pitch-shift-processor', PitchShiftProcessor);
`;

export async function loadPitchWorklet(ctx: AudioContext): Promise<boolean> {
  try {
    const blob = new Blob([PITCH_WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

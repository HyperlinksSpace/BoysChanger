/**
 * High-quality-ish OLA pitch shifter with large grains.
 * When |ratio-1| is tiny, hard-bypasses for bit-clean passthrough.
 */
export const PITCH_WORKLET_CODE = `
class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = 1;
    this.size = 16384;
    this.buf = new Float32Array(this.size);
    this.write = 0;
    this.grain = 2048;
    this.pos = [0, this.grain * 0.5];
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.ratio === 'number') {
        this.ratio = Math.min(1.55, Math.max(0.65, e.data.ratio));
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    const inp = input[0];
    const out = output[0];
    const bypass = Math.abs(this.ratio - 1) < 0.015;

    for (let i = 0; i < inp.length; i++) {
      this.buf[this.write] = inp[i];
      this.write = (this.write + 1) % this.size;

      if (bypass) {
        out[i] = inp[i];
        continue;
      }

      let mix = 0;
      let wsum = 0;
      for (let g = 0; g < 2; g++) {
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

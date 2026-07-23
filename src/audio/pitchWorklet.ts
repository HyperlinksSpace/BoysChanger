/**
 * Dual-grain OLA pitch shifter. When ratio ≈ 1, acts as near-transparent passthrough.
 * Reads from a sliding window behind the write head (no free-running read pointer),
 * which avoids the classic “looped buffer echo” artifact.
 */
export const PITCH_WORKLET_CODE = `
class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = 1;
    this.size = 8192;
    this.buf = new Float32Array(this.size);
    this.write = 0;
    this.grain = 1280;
    this.pos = [0, this.grain * 0.5];
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.ratio === 'number') {
        const r = e.data.ratio;
        this.ratio = Math.min(1.85, Math.max(0.55, r));
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || !output || !output[0]) return true;
    const inp = input[0];
    const out = output[0];
    const bypass = Math.abs(this.ratio - 1) < 0.02;

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
        const raw = (this.write - this.grain + this.pos[g] + this.size * 4) % this.size;
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

/** Rolling PCM buffer that keeps the last N seconds for prehear replay. */
export class RingBuffer {
  private readonly samples: Float32Array;
  private write = 0;
  private filled = 0;

  constructor(
    private readonly sampleRate: number,
    seconds: number,
  ) {
    this.samples = new Float32Array(Math.max(1, Math.floor(sampleRate * seconds)));
  }

  get capacitySeconds(): number {
    return this.samples.length / this.sampleRate;
  }

  get availableSeconds(): number {
    return this.filled / this.sampleRate;
  }

  push(chunk: ArrayLike<number>) {
    for (let i = 0; i < chunk.length; i++) {
      this.samples[this.write] = chunk[i];
      this.write = (this.write + 1) % this.samples.length;
      if (this.filled < this.samples.length) this.filled++;
    }
  }

  /** Returns a copy of the most recent available audio (up to capacity). */
  snapshot(): Float32Array<ArrayBuffer> {
    const n = this.filled;
    const out = new Float32Array(new ArrayBuffer(n * 4));
    const start = (this.write - n + this.samples.length) % this.samples.length;
    for (let i = 0; i < n; i++) {
      out[i] = this.samples[(start + i) % this.samples.length];
    }
    return out;
  }

  clear() {
    this.write = 0;
    this.filled = 0;
    this.samples.fill(0);
  }
}

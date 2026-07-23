import { RingBuffer } from './RingBuffer';
import { loadPitchWorklet } from './pitchWorklet';
import {
  DEFAULT_SETTINGS,
  PREHEAR_READY_SECONDS,
  PREHEAR_SECONDS,
  resolveVoiceCharacter,
  type EffectId,
  type VoiceSettings,
} from './types';

type LevelListener = (level: number) => void;
type PrehearListener = (state: PrehearState) => void;

export type PrehearState = {
  ready: boolean;
  playing: boolean;
  paused: boolean;
  seconds: number;
  position: number;
  peaks: Float32Array;
};

export class VoiceEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private ampGain: GainNode | null = null;
  private pitchBypass: GainNode | null = null;
  private pitchWet: GainNode | null = null;
  private pitchNode: AudioWorkletNode | null = null;
  private formantLow: BiquadFilterNode | null = null;
  private formantMid: BiquadFilterNode | null = null;
  private formantHigh: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private effectsInput: GainNode | null = null;
  private effectsWet: GainNode | null = null;
  private effectsDry: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private monitorGain: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private outElement: HTMLAudioElement | null = null;
  private ring: RingBuffer | null = null;
  private prehearTimeData: Float32Array | null = null;
  private settings: VoiceSettings = { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
  private effectEnabled: Partial<Record<EffectId, GainNode>> = {};
  private lfoCtx: { stop: () => void }[] = [];
  private levelListeners = new Set<LevelListener>();
  private prehearListeners = new Set<PrehearListener>();
  private raf = 0;
  private running = false;
  private workletReady = false;

  private prehearBuffer: AudioBuffer | null = null;
  private prehearSource: AudioBufferSourceNode | null = null;
  private prehearGain: GainNode | null = null;
  private prehearPlaying = false;
  private prehearPaused = false;
  private prehearPauseAt = 0;
  private prehearStartedAt = 0;
  private prehearDuration = 0;
  private peaksCache: Float32Array = new Float32Array(128) as Float32Array;

  get isRunning() {
    return this.running;
  }

  get sampleRate() {
    return this.ctx?.sampleRate ?? 48000;
  }

  get prehearAvailableSeconds() {
    return this.ring?.availableSeconds ?? 0;
  }

  get isPrehearReady() {
    return this.prehearAvailableSeconds >= PREHEAR_READY_SECONDS;
  }

  onLevel(cb: LevelListener) {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }

  onPrehear(cb: PrehearListener) {
    this.prehearListeners.add(cb);
    cb(this.getPrehearState());
    return () => this.prehearListeners.delete(cb);
  }

  getPrehearState(): PrehearState {
    const seconds = this.prehearAvailableSeconds;
    return {
      ready: seconds >= PREHEAR_READY_SECONDS,
      playing: this.prehearPlaying,
      paused: this.prehearPaused,
      seconds,
      position: this.getPrehearPosition(),
      peaks: this.peaksCache,
    };
  }

  private emitPrehear() {
    const state = this.getPrehearState();
    this.prehearListeners.forEach((cb) => cb(state));
  }

  private getPrehearPosition() {
    if (!this.ctx || !this.prehearPlaying || this.prehearPaused) {
      return this.prehearPaused ? this.prehearPauseAt : 0;
    }
    const t = this.ctx.currentTime - this.prehearStartedAt;
    return Math.min(this.prehearDuration, Math.max(0, t));
  }

  async start(settings: VoiceSettings) {
    await this.stop();
    this.settings = { ...settings, effects: { ...settings.effects } };

    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.workletReady = await loadPitchWorklet(this.ctx);

    const wantsMonitor = settings.monitorLocally;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId:
          settings.inputDeviceId && settings.inputDeviceId !== 'default'
            ? { exact: settings.inputDeviceId }
            : undefined,
        echoCancellation: wantsMonitor || true,
        noiseSuppression: true,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: this.ctx.sampleRate,
      },
      video: false,
    });
    this.source = this.ctx.createMediaStreamSource(this.stream);

    this.highpass = this.ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 70;
    this.highpass.Q.value = 0.7;

    this.ampGain = this.ctx.createGain();
    this.pitchBypass = this.ctx.createGain();
    this.pitchWet = this.ctx.createGain();
    this.pitchBypass.gain.value = 1;
    this.pitchWet.gain.value = 0;

    this.effectsInput = this.ctx.createGain();
    this.effectsDry = this.ctx.createGain();
    this.effectsWet = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.monitorGain = this.ctx.createGain();
    this.monitorGain.gain.value = 0;

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 2.5;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.15;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.35;
    this.prehearTimeData = new Float32Array(this.analyser.fftSize);

    this.formantLow = this.ctx.createBiquadFilter();
    this.formantLow.type = 'lowshelf';
    this.formantLow.frequency.value = 220;
    this.formantLow.gain.value = 0;

    this.formantMid = this.ctx.createBiquadFilter();
    this.formantMid.type = 'peaking';
    this.formantMid.frequency.value = 1200;
    this.formantMid.Q.value = 0.9;
    this.formantMid.gain.value = 0;

    this.formantHigh = this.ctx.createBiquadFilter();
    this.formantHigh.type = 'highshelf';
    this.formantHigh.frequency.value = 3200;
    this.formantHigh.gain.value = 0;

    // Mic → HPF → amp → (dry|pitch) → formants → compressor → effects → master
    this.source.connect(this.highpass);
    this.highpass.connect(this.ampGain);

    this.ampGain.connect(this.pitchBypass);
    this.pitchBypass.connect(this.formantLow);

    if (this.workletReady) {
      this.pitchNode = new AudioWorkletNode(this.ctx, 'pitch-shift-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.ampGain.connect(this.pitchNode);
      this.pitchNode.connect(this.pitchWet);
      this.pitchWet.connect(this.formantLow);
    }

    this.formantLow.connect(this.formantMid);
    this.formantMid.connect(this.formantHigh);
    this.formantHigh.connect(this.compressor);
    this.compressor.connect(this.effectsInput);

    this.effectsInput.connect(this.effectsDry);
    this.effectsDry.connect(this.masterGain);

    this.buildEffectsChain();

    this.masterGain.connect(this.analyser);

    this.destination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.destination);
    this.outElement = new Audio();
    this.outElement.autoplay = true;
    this.outElement.srcObject = this.destination.stream;

    this.analyser.connect(this.monitorGain);
    this.monitorGain.connect(this.ctx.destination);

    await this.applyOutputDevice(settings.outputDeviceId);
    try {
      await this.outElement.play();
    } catch {
      /* */
    }

    this.ring = new RingBuffer(this.ctx.sampleRate, PREHEAR_SECONDS);
    this.prehearGain = this.ctx.createGain();
    this.prehearGain.gain.value = 1;
    this.prehearGain.connect(this.ctx.destination);

    this.applySettings(this.settings);
    this.running = true;
    this.tickLevels();
    this.emitPrehear();
  }

  private buildEffectsChain() {
    if (!this.ctx || !this.effectsInput || !this.masterGain) return;
    this.teardownEffects();

    const mixBus = this.ctx.createGain();
    mixBus.gain.value = 0;
    this.effectsWet = mixBus;
    mixBus.connect(this.masterGain);

    const makeEnable = () => {
      const g = this.ctx!.createGain();
      g.gain.value = 0;
      return g;
    };

    const addFx = (connect: (en: GainNode, bus: GainNode) => void) => {
      const en = makeEnable();
      connect(en, mixBus);
      return en;
    };

    this.effectEnabled.echo = addFx((en, bus) => {
      const delay = this.ctx!.createDelay(1.0);
      delay.delayTime.value = 0.2;
      const fb = this.ctx!.createGain();
      fb.gain.value = 0.22;
      const level = this.ctx!.createGain();
      level.gain.value = 0.4;
      this.effectsInput!.connect(en);
      en.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(level);
      level.connect(bus);
    });

    this.effectEnabled.wahwah = addFx((en, bus) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 5;
      filter.frequency.value = 800;
      const level = this.ctx!.createGain();
      level.gain.value = 0.55;
      this.effectsInput!.connect(en);
      en.connect(filter);
      filter.connect(level);
      level.connect(bus);
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.value = 1.8;
      lfoGain.gain.value = 420;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.lfoCtx.push({ stop: () => { try { lfo.stop(); } catch { /* */ } } });
    });

    this.effectEnabled.distortion = addFx((en, bus) => {
      const shaper = this.ctx!.createWaveShaper();
      shaper.curve = makeDistortionCurve(18);
      shaper.oversample = '2x';
      const level = this.ctx!.createGain();
      level.gain.value = 0.35;
      this.effectsInput!.connect(en);
      en.connect(shaper);
      shaper.connect(level);
      level.connect(bus);
    });

    this.effectEnabled.reverb = addFx((en, bus) => {
      const conv = this.ctx!.createConvolver();
      conv.buffer = makeImpulseResponse(this.ctx!, 0.9, 2.6);
      const level = this.ctx!.createGain();
      level.gain.value = 0.35;
      this.effectsInput!.connect(en);
      en.connect(conv);
      conv.connect(level);
      level.connect(bus);
    });

    this.effectEnabled.chorus = addFx((en, bus) => {
      const delay = this.ctx!.createDelay(0.04);
      delay.delayTime.value = 0.016;
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.value = 1.1;
      lfoGain.gain.value = 0.004;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();
      this.lfoCtx.push({ stop: () => { try { lfo.stop(); } catch { /* */ } } });
      const level = this.ctx!.createGain();
      level.gain.value = 0.35;
      this.effectsInput!.connect(en);
      en.connect(delay);
      delay.connect(level);
      level.connect(bus);
    });

    this.effectEnabled.robot = addFx((en, bus) => {
      const ringGain = this.ctx!.createGain();
      ringGain.gain.value = 0;
      const osc = this.ctx!.createOscillator();
      osc.frequency.value = 45;
      const depth = this.ctx!.createGain();
      depth.gain.value = 0.28;
      const offset = this.ctx!.createConstantSource();
      offset.offset.value = 0.65;
      offset.start();
      osc.connect(depth);
      depth.connect(ringGain.gain);
      offset.connect(ringGain.gain);
      osc.start();
      this.lfoCtx.push({
        stop: () => {
          try { osc.stop(); } catch { /* */ }
          try { offset.stop(); } catch { /* */ }
        },
      });
      const level = this.ctx!.createGain();
      level.gain.value = 0.4;
      this.effectsInput!.connect(en);
      en.connect(ringGain);
      ringGain.connect(level);
      level.connect(bus);
    });

    this.effectEnabled.flanger = addFx((en, bus) => {
      const delay = this.ctx!.createDelay(0.012);
      delay.delayTime.value = 0.0025;
      const fb = this.ctx!.createGain();
      fb.gain.value = 0.28;
      const lfo = this.ctx!.createOscillator();
      const lfoGain = this.ctx!.createGain();
      lfo.frequency.value = 0.25;
      lfoGain.gain.value = 0.002;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();
      this.lfoCtx.push({ stop: () => { try { lfo.stop(); } catch { /* */ } } });
      const level = this.ctx!.createGain();
      level.gain.value = 0.3;
      this.effectsInput!.connect(en);
      en.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(level);
      level.connect(bus);
    });

    this.effectEnabled.bitcrush = addFx((en, bus) => {
      const shaper = this.ctx!.createWaveShaper();
      shaper.curve = makeBitcrushCurve(12);
      const level = this.ctx!.createGain();
      level.gain.value = 0.35;
      this.effectsInput!.connect(en);
      en.connect(shaper);
      shaper.connect(level);
      level.connect(bus);
    });
  }

  private teardownEffects() {
    for (const l of this.lfoCtx) l.stop();
    this.lfoCtx = [];
    this.effectEnabled = {};
  }

  applySettings(settings: VoiceSettings) {
    this.settings = { ...settings, effects: { ...settings.effects } };
    if (
      !this.ctx ||
      !this.ampGain ||
      !this.masterGain ||
      !this.effectsDry ||
      !this.effectsWet ||
      !this.pitchBypass ||
      !this.formantLow ||
      !this.formantMid ||
      !this.formantHigh
    ) {
      return;
    }

    const enabled = settings.enabled;
    const character = resolveVoiceCharacter(settings);
    const pitchAbs = Math.abs(character.pitchSemitones);
    const usePitch = enabled && this.workletReady && this.pitchNode && pitchAbs >= 0.35;
    const ratio = usePitch ? Math.pow(2, character.pitchSemitones / 12) : 1;

    if (this.pitchNode) {
      this.pitchNode.port.postMessage({ ratio });
    }

    // Crossfade dry/pitch — dry stays dominant for clarity
    const t = this.ctx.currentTime;
    if (usePitch) {
      this.pitchBypass.gain.setTargetAtTime(0.15, t, 0.05);
      this.pitchWet!.gain.setTargetAtTime(0.9, t, 0.05);
    } else {
      this.pitchBypass.gain.setTargetAtTime(1, t, 0.05);
      if (this.pitchWet) this.pitchWet.gain.setTargetAtTime(0, t, 0.05);
    }

    if (enabled) {
      this.formantLow.gain.setTargetAtTime(character.lowGain, t, 0.05);
      this.formantMid.gain.setTargetAtTime(character.midGain, t, 0.05);
      this.formantHigh.gain.setTargetAtTime(character.highGain, t, 0.05);
      this.formantMid.frequency.setTargetAtTime(character.midFreq, t, 0.05);
    } else {
      this.formantLow.gain.setTargetAtTime(0, t, 0.05);
      this.formantMid.gain.setTargetAtTime(0, t, 0.05);
      this.formantHigh.gain.setTargetAtTime(0, t, 0.05);
    }

    // Soft amp: 1.0 at 0 → ~1.35 at 100 (no harsh drive)
    const amp = enabled ? 0.95 + (settings.amplifier / 100) * 0.4 : 1;
    this.ampGain.gain.setTargetAtTime(amp, t, 0.04);
    this.masterGain.gain.setTargetAtTime(settings.volume / 100, t, 0.04);

    const mix = settings.effectMix / 100;
    const anyEffect = enabled && Object.values(settings.effects).some(Boolean);
    this.effectsDry.gain.setTargetAtTime(anyEffect ? Math.max(0.55, 1 - mix * 0.4) : 1, t, 0.04);
    this.effectsWet.gain.setTargetAtTime(anyEffect ? mix * 0.55 : 0, t, 0.04);

    (Object.keys(settings.effects) as EffectId[]).forEach((id) => {
      const gate = this.effectEnabled[id];
      if (!gate) return;
      gate.gain.setTargetAtTime(enabled && settings.effects[id] ? 1 : 0, t, 0.04);
    });

    const hasVirtualOut = Boolean(settings.outputDeviceId);
    const monitorOn = settings.monitorLocally && hasVirtualOut;
    if (this.monitorGain) {
      this.monitorGain.gain.setTargetAtTime(monitorOn ? 0.65 : 0, t, 0.04);
    }
  }

  async applyOutputDevice(deviceId: string) {
    if (!this.outElement?.setSinkId) return;
    try {
      await this.outElement.setSinkId(deviceId || '');
    } catch (e) {
      console.warn('setSinkId failed', e);
    }
  }

  /** Capture current ring into a playable buffer and refresh peaks. */
  preparePrehear(): boolean {
    if (!this.ctx || !this.ring) return false;
    const data = this.ring.snapshot();
    if (data.length < this.ctx.sampleRate * PREHEAR_READY_SECONDS) return false;
    const buffer = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    (buffer as AudioBuffer).copyToChannel(data as never, 0);
    this.prehearBuffer = buffer;
    this.prehearDuration = buffer.duration;
    this.peaksCache = computePeaks(data, 160);
    this.emitPrehear();
    return true;
  }

  playPrehear(): boolean {
    if (!this.ctx || !this.prehearGain) return false;
    if (!this.prehearBuffer && !this.preparePrehear()) return false;
    if (!this.prehearBuffer) return false;

    this.stopPrehearSourceOnly();

    const offset = this.prehearPaused ? this.prehearPauseAt : 0;
    if (offset >= this.prehearDuration - 0.02) {
      this.prehearPauseAt = 0;
    }
    const startAt = this.prehearPaused ? this.prehearPauseAt : 0;

    const src = this.ctx.createBufferSource();
    src.buffer = this.prehearBuffer;
    src.connect(this.prehearGain);
    src.onended = () => {
      if (this.prehearSource === src) {
        this.prehearPlaying = false;
        this.prehearPaused = false;
        this.prehearPauseAt = 0;
        this.prehearSource = null;
        // Refresh buffer from latest ring for next play
        this.preparePrehear();
        this.emitPrehear();
      }
    };
    src.start(0, startAt);
    this.prehearSource = src;
    this.prehearStartedAt = this.ctx.currentTime - startAt;
    this.prehearPlaying = true;
    this.prehearPaused = false;
    this.emitPrehear();
    return true;
  }

  pausePrehear() {
    if (!this.prehearPlaying || this.prehearPaused) return;
    this.prehearPauseAt = this.getPrehearPosition();
    this.stopPrehearSourceOnly();
    this.prehearPlaying = true;
    this.prehearPaused = true;
    this.emitPrehear();
  }

  togglePrehear() {
    if (this.prehearPlaying && !this.prehearPaused) {
      this.pausePrehear();
    } else {
      this.playPrehear();
    }
  }

  stopPrehear() {
    this.stopPrehearSourceOnly();
    this.prehearPlaying = false;
    this.prehearPaused = false;
    this.prehearPauseAt = 0;
    this.emitPrehear();
  }

  private stopPrehearSourceOnly() {
    if (this.prehearSource) {
      try {
        this.prehearSource.onended = null;
        this.prehearSource.stop();
      } catch {
        /* */
      }
      this.prehearSource = null;
    }
  }

  /** @deprecated use playPrehear */
  async prehear(): Promise<{ seconds: number }> {
    const ok = this.playPrehear();
    return { seconds: ok ? this.prehearDuration : 0 };
  }

  private tickLevels() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (!this.analyser || !this.prehearTimeData || !this.ring) return;
      // TS DOM Float32Array generic mismatch
      (this.analyser as unknown as { getFloatTimeDomainData(a: Float32Array): void }).getFloatTimeDomainData(
        this.prehearTimeData,
      );
      const hop = Math.min(
        this.prehearTimeData.length,
        Math.max(128, Math.floor((this.ctx?.sampleRate ?? 48000) / 55)),
      );
      this.ring.push(this.prehearTimeData.subarray(this.prehearTimeData.length - hop));

      // Live peaks for timeline while not in dedicated playback prepare
      if (!this.prehearPlaying || this.prehearPaused) {
        const snap = this.ring.snapshot();
        if (snap.length > 64) this.peaksCache = computePeaks(snap, 160);
      }

      let sum = 0;
      for (let i = 0; i < this.prehearTimeData.length; i++) {
        const v = this.prehearTimeData[i];
        sum += v * v;
      }
      this.levelListeners.forEach((cb) => cb(Math.sqrt(sum / this.prehearTimeData!.length)));
      this.emitPrehear();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  async stop() {
    cancelAnimationFrame(this.raf);
    this.stopPrehear();
    this.teardownEffects();
    if (this.outElement) {
      this.outElement.pause();
      this.outElement.srcObject = null;
      this.outElement = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* */
      }
    }
    this.ctx = null;
    this.source = null;
    this.ring = null;
    this.prehearTimeData = null;
    this.prehearBuffer = null;
    this.pitchNode = null;
    this.running = false;
    this.emitPrehear();
  }
}

function computePeaks(data: ArrayLike<number>, bars: number): Float32Array {
  const out = new Float32Array(bars);
  const n = data.length;
  if (n === 0) return out;
  const step = n / bars;
  for (let i = 0; i < bars; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(n, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = start; j < end; j++) {
      const a = Math.abs(data[j]);
      if (a > peak) peak = a;
    }
    out[i] = peak;
  }
  return out as Float32Array;
}

function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 44100;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function makeBitcrushCurve(bits: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const steps = Math.pow(2, bits);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  return curve;
}

function makeImpulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

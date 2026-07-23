import { RingBuffer } from './RingBuffer';
import { loadPitchWorklet } from './pitchWorklet';
import {
  DEFAULT_SETTINGS,
  resolveVoiceCharacter,
  type EffectId,
  type VoiceSettings,
} from './types';

const PREHEAR_SECONDS = 11;

type LevelListener = (level: number) => void;

export class VoiceEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private ampGain: GainNode | null = null;
  private pitchNode: AudioWorkletNode | null = null;
  private formantLow: BiquadFilterNode | null = null;
  private formantMid: BiquadFilterNode | null = null;
  private formantHigh: BiquadFilterNode | null = null;
  private effectsInput: GainNode | null = null;
  private effectsWet: GainNode | null = null;
  private effectsDry: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private monitorGain: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private outElement: HTMLAudioElement | null = null;
  private ring: RingBuffer | null = null;
  private prehearSource: AudioBufferSourceNode | null = null;
  private prehearTimeData: Float32Array | null = null;
  private settings: VoiceSettings = { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
  private effectNodes: Partial<Record<EffectId, AudioNode>> = {};
  private effectEnabled: Partial<Record<EffectId, GainNode>> = {};
  private lfoCtx: { stop: () => void }[] = [];
  private levelListeners = new Set<LevelListener>();
  private raf = 0;
  private running = false;
  private workletReady = false;

  get isRunning() {
    return this.running;
  }

  get sampleRate() {
    return this.ctx?.sampleRate ?? 48000;
  }

  get prehearAvailableSeconds() {
    return this.ring?.availableSeconds ?? 0;
  }

  onLevel(cb: LevelListener) {
    this.levelListeners.add(cb);
    return () => this.levelListeners.delete(cb);
  }

  async start(settings: VoiceSettings) {
    await this.stop();
    this.settings = {
      ...settings,
      effects: { ...settings.effects },
    };

    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.workletReady = await loadPitchWorklet(this.ctx);

    const wantsMonitor = settings.monitorLocally;
    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId:
          settings.inputDeviceId && settings.inputDeviceId !== 'default'
            ? { exact: settings.inputDeviceId }
            : undefined,
        // Prevent speaker→mic feedback when monitoring locally
        echoCancellation: wantsMonitor,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.source = this.ctx.createMediaStreamSource(this.stream);

    this.ampGain = this.ctx.createGain();
    this.effectsInput = this.ctx.createGain();
    this.effectsDry = this.ctx.createGain();
    this.effectsWet = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.monitorGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;
    this.prehearTimeData = new Float32Array(this.analyser.fftSize);

    this.formantLow = this.ctx.createBiquadFilter();
    this.formantLow.type = 'peaking';
    this.formantLow.frequency.value = 400;
    this.formantLow.Q.value = 1.2;
    this.formantLow.gain.value = 0;

    this.formantMid = this.ctx.createBiquadFilter();
    this.formantMid.type = 'peaking';
    this.formantMid.frequency.value = 1200;
    this.formantMid.Q.value = 1.1;
    this.formantMid.gain.value = 0;

    this.formantHigh = this.ctx.createBiquadFilter();
    this.formantHigh.type = 'highshelf';
    this.formantHigh.frequency.value = 2800;
    this.formantHigh.gain.value = 0;

    this.source.connect(this.ampGain);

    let afterPitch: AudioNode = this.ampGain;
    if (this.workletReady) {
      this.pitchNode = new AudioWorkletNode(this.ctx, 'pitch-shift-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.ampGain.connect(this.pitchNode);
      afterPitch = this.pitchNode;
    }

    afterPitch.connect(this.formantLow);
    this.formantLow.connect(this.formantMid);
    this.formantMid.connect(this.formantHigh);
    this.formantHigh.connect(this.effectsInput);

    this.effectsInput.connect(this.effectsDry);
    this.effectsDry.connect(this.masterGain);

    this.buildEffectsChain();

    this.masterGain.connect(this.analyser);

    // Virtual-cable / selected output path (single playback element)
    this.destination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.destination);
    this.outElement = new Audio();
    this.outElement.autoplay = true;
    this.outElement.srcObject = this.destination.stream;

    // Local monitor ONLY when requested — never double-feed default speakers
    this.monitorGain.gain.value = 0;
    this.analyser.connect(this.monitorGain);
    this.monitorGain.connect(this.ctx.destination);

    await this.applyOutputDevice(settings.outputDeviceId);
    try {
      await this.outElement.play();
    } catch {
      /* autoplay */
    }

    this.ring = new RingBuffer(this.ctx.sampleRate, PREHEAR_SECONDS);

    this.applySettings(this.settings);
    this.running = true;
    this.tickLevels();
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

    // Echo
    {
      const delay = this.ctx.createDelay(1.2);
      delay.delayTime.value = 0.22;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.28;
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.55;
      this.effectsInput.connect(en);
      en.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(level);
      level.connect(mixBus);
      this.effectNodes.echo = delay;
      this.effectEnabled.echo = en;
    }

    // Wah-wah
    {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 6;
      filter.frequency.value = 800;
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.7;
      this.effectsInput.connect(en);
      en.connect(filter);
      filter.connect(level);
      level.connect(mixBus);
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 2.0;
      lfoGain.gain.value = 500;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();
      this.lfoCtx.push({ stop: () => { try { lfo.stop(); } catch { /* */ } } });
      this.effectNodes.wahwah = filter;
      this.effectEnabled.wahwah = en;
    }

    // Distortion
    {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(28);
      shaper.oversample = '2x';
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.45;
      this.effectsInput.connect(en);
      en.connect(shaper);
      shaper.connect(level);
      level.connect(mixBus);
      this.effectNodes.distortion = shaper;
      this.effectEnabled.distortion = en;
    }

    // Reverb
    {
      const conv = this.ctx.createConvolver();
      conv.buffer = makeImpulseResponse(this.ctx, 1.1, 2.4);
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.5;
      this.effectsInput.connect(en);
      en.connect(conv);
      conv.connect(level);
      level.connect(mixBus);
      this.effectNodes.reverb = conv;
      this.effectEnabled.reverb = en;
    }

    // Chorus
    {
      const delay = this.ctx.createDelay(0.05);
      delay.delayTime.value = 0.018;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 1.2;
      lfoGain.gain.value = 0.005;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();
      this.lfoCtx.push({ stop: () => { try { lfo.stop(); } catch { /* */ } } });
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.45;
      this.effectsInput.connect(en);
      en.connect(delay);
      delay.connect(level);
      level.connect(mixBus);
      this.effectNodes.chorus = delay;
      this.effectEnabled.chorus = en;
    }

    // Robot
    {
      const en = makeEnable();
      const ringGain = this.ctx.createGain();
      ringGain.gain.value = 0;
      const osc = this.ctx.createOscillator();
      osc.frequency.value = 50;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.4;
      const offset = this.ctx.createConstantSource();
      offset.offset.value = 0.55;
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
      const level = this.ctx.createGain();
      level.gain.value = 0.55;
      this.effectsInput.connect(en);
      en.connect(ringGain);
      ringGain.connect(level);
      level.connect(mixBus);
      this.effectNodes.robot = ringGain;
      this.effectEnabled.robot = en;
    }

    // Flanger
    {
      const delay = this.ctx.createDelay(0.015);
      delay.delayTime.value = 0.003;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.35;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.3;
      lfoGain.gain.value = 0.0025;
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();
      this.lfoCtx.push({ stop: () => { try { lfo.stop(); } catch { /* */ } } });
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.4;
      this.effectsInput.connect(en);
      en.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(level);
      level.connect(mixBus);
      this.effectNodes.flanger = delay;
      this.effectEnabled.flanger = en;
    }

    // Bitcrush
    {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = makeBitcrushCurve(10);
      const en = makeEnable();
      const level = this.ctx.createGain();
      level.gain.value = 0.5;
      this.effectsInput.connect(en);
      en.connect(shaper);
      shaper.connect(level);
      level.connect(mixBus);
      this.effectNodes.bitcrush = shaper;
      this.effectEnabled.bitcrush = en;
    }
  }

  private teardownEffects() {
    for (const l of this.lfoCtx) l.stop();
    this.lfoCtx = [];
    this.effectNodes = {};
    this.effectEnabled = {};
  }

  applySettings(settings: VoiceSettings) {
    this.settings = {
      ...settings,
      effects: { ...settings.effects },
    };
    if (!this.ctx || !this.ampGain || !this.masterGain || !this.effectsDry || !this.effectsWet) {
      return;
    }

    const enabled = settings.enabled;
    const { pitchSemitones, formantShift } = resolveVoiceCharacter(settings);
    const ratio = enabled ? Math.pow(2, pitchSemitones / 12) : 1;

    if (this.pitchNode) {
      this.pitchNode.port.postMessage({ ratio });
    }

    if (this.formantLow && this.formantMid && this.formantHigh) {
      const f = enabled ? formantShift : 0;
      this.formantLow.frequency.value = 450 * Math.pow(2, f);
      this.formantMid.frequency.value = 1400 * Math.pow(2, f * 0.85);
      this.formantHigh.frequency.value = 3200;
      this.formantLow.gain.value = enabled ? f * 6 : 0;
      this.formantMid.gain.value = enabled ? f * 5 : 0;
      this.formantHigh.gain.value = enabled ? f * 7 : 0;
    }

    // Mild amp — avoid harsh clipping that sounds like distortion loops
    const amp = enabled ? 0.85 + (settings.amplifier / 100) * 0.9 : 1;
    this.ampGain.gain.setTargetAtTime(amp, this.ctx.currentTime, 0.04);

    const vol = settings.volume / 100;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.04);

    const mix = settings.effectMix / 100;
    const anyEffect = Object.values(settings.effects).some(Boolean) && enabled;
    this.effectsDry.gain.setTargetAtTime(anyEffect ? Math.max(0.35, 1 - mix * 0.5) : 1, this.ctx.currentTime, 0.04);
    this.effectsWet.gain.setTargetAtTime(anyEffect ? mix * 0.85 : 0, this.ctx.currentTime, 0.04);

    (Object.keys(settings.effects) as EffectId[]).forEach((id) => {
      const gate = this.effectEnabled[id];
      if (!gate || !this.ctx) return;
      const on = enabled && settings.effects[id];
      gate.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04);
    });

    const hasVirtualOut = Boolean(settings.outputDeviceId);
    // Monitor on speakers only when explicitly enabled AND a virtual cable is selected
    // (otherwise outElement already plays on default speakers — dual path = echo).
    const monitorOn = settings.monitorLocally && hasVirtualOut;
    if (this.monitorGain) {
      this.monitorGain.gain.setTargetAtTime(monitorOn ? 0.7 : 0, this.ctx.currentTime, 0.04);
    }

    // If no virtual cable, hear through outElement on default device
    if (this.outElement) {
      this.outElement.muted = false;
      this.outElement.volume = hasVirtualOut || !settings.monitorLocally || !hasVirtualOut ? 1 : 1;
    }
  }

  async applyOutputDevice(deviceId: string) {
    if (!this.outElement) return;
    if (this.outElement.setSinkId) {
      try {
        await this.outElement.setSinkId(deviceId || '');
      } catch (e) {
        console.warn('setSinkId failed', e);
      }
    }
  }

  async prehear(): Promise<{ seconds: number }> {
    if (!this.ctx || !this.ring) return { seconds: 0 };
    const data = this.ring.snapshot();
    if (data.length < this.ctx.sampleRate * 0.2) return { seconds: 0 };

    if (this.prehearSource) {
      try {
        this.prehearSource.stop();
      } catch {
        /* */
      }
      this.prehearSource = null;
    }

    const buffer = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start();
    this.prehearSource = src;
    src.onended = () => {
      if (this.prehearSource === src) this.prehearSource = null;
    };
    return { seconds: data.length / this.ctx.sampleRate };
  }

  private tickLevels() {
    cancelAnimationFrame(this.raf);
    const loop = () => {
      if (!this.analyser || !this.prehearTimeData || !this.ring) return;
      // TS 5.7 + DOM lib Float32Array generic mismatch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.analyser as any).getFloatTimeDomainData(this.prehearTimeData);
      const hop = Math.min(
        this.prehearTimeData.length,
        Math.max(128, Math.floor((this.ctx?.sampleRate ?? 48000) / 55)),
      );
      this.ring.push(this.prehearTimeData.subarray(this.prehearTimeData.length - hop));

      let sum = 0;
      for (let i = 0; i < this.prehearTimeData.length; i++) {
        const v = this.prehearTimeData[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.prehearTimeData.length);
      this.levelListeners.forEach((cb) => cb(rms));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  async stop() {
    cancelAnimationFrame(this.raf);
    this.teardownEffects();
    if (this.prehearSource) {
      try {
        this.prehearSource.stop();
      } catch {
        /* */
      }
      this.prehearSource = null;
    }
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
    this.pitchNode = null;
    this.running = false;
  }
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

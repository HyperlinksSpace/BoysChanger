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
  private recorderNode: ScriptProcessorNode | null = null;
  private keepAliveGain: GainNode | null = null;
  private prehearTimeData: Float32Array | null = null;
  private settings: VoiceSettings = { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
  private effectEnabled: Partial<Record<EffectId, GainNode>> = {};
  private lfoCtx: { stop: () => void }[] = [];
  private levelListeners = new Set<LevelListener>();
  private prehearListeners = new Set<PrehearListener>();
  private raf = 0;
  private lastPrehearEmit = 0;
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

  /** One-shot clips (sound library) mixed to cable + local speakers */
  private libraryGain: GainNode | null = null;
  private libraryLocalGain: GainNode | null = null;
  private librarySource: AudioBufferSourceNode | null = null;
  private libraryPlaying = false;
  private outKeepAlive: ReturnType<typeof setInterval> | null = null;
  private lastSinkOk = false;
  private lastCaptureCtxTime = 0;
  private captureSilent: GainNode | null = null;
  private captureMode: 'auto' | 'script' | 'analyser' = 'auto';
  private scriptHits = 0;
  private rawAnalyser: AnalyserNode | null = null;
  private rawTimeData: Float32Array | null = null;
  private silenceFrames = 0;
  private onLog: ((level: string, msg: string, data?: unknown) => void) | null = null;
  private onMicWarning: ((code: string, detail?: string) => void) | null = null;

  setLogger(fn: ((level: string, msg: string, data?: unknown) => void) | null) {
    this.onLog = fn;
  }

  setMicWarningHandler(fn: ((code: string, detail?: string) => void) | null) {
    this.onMicWarning = fn;
  }

  private log(level: string, msg: string, data?: unknown) {
    this.onLog?.(level, msg, data);
  }

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
    // Always disable browser DSP — it fights voice changers and soft mics (Voicemod).
    const audioConstraints: MediaTrackConstraints = {
      deviceId:
        settings.inputDeviceId && settings.inputDeviceId !== 'default'
          ? { exact: settings.inputDeviceId }
          : undefined,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1,
    };
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });
    const track = this.stream.getAudioTracks()[0];
    if (track) {
      track.enabled = true;
      try {
        await track.applyConstraints({
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        });
      } catch {
        /* some soft mics reject constraint changes */
      }
    }
    const label = track?.label || '';
    this.log('info', 'mic acquired', {
      label,
      readyState: track?.readyState,
      muted: track?.muted,
      enabled: track?.enabled,
      settings: track?.getSettings?.(),
      wantsMonitor,
    });
    if (/voicemod|cable|blackhole|voicemeeter|vb-audio|virtual/i.test(label)) {
      this.log('warn', 'input looks like a virtual/soft mic — often silent', { label });
      this.onMicWarning?.('virtual-mic', label);
    }
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

    // Raw mic tap (diagnostics + prove whether silence is device vs graph)
    this.rawAnalyser = this.ctx.createAnalyser();
    this.rawAnalyser.fftSize = 2048;
    this.rawAnalyser.smoothingTimeConstant = 0.2;
    this.rawTimeData = new Float32Array(this.rawAnalyser.fftSize);
    this.source.connect(this.rawAnalyser);

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

    // Silent keep-alive so the graph keeps processing even when monitor is muted
    // and the virtual-cable HTMLAudioElement is not pulling samples.
    // Use a tiny non-zero gain — Chromium may skip ScriptProcessor when gain is exactly 0.
    this.keepAliveGain = this.ctx.createGain();
    this.keepAliveGain.gain.value = 0.00001;
    this.masterGain.connect(this.keepAliveGain);
    this.keepAliveGain.connect(this.ctx.destination);

    this.destination = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.destination);
    this.outElement = new Audio();
    this.outElement.autoplay = true;
    this.outElement.volume = 1;
    this.outElement.muted = false;
    this.outElement.srcObject = this.destination.stream;

    this.analyser.connect(this.monitorGain);
    this.monitorGain.connect(this.ctx.destination);

    // Sound library + prehear: both local speakers AND virtual-cable stream (Telegram mic)
    this.libraryGain = this.ctx.createGain();
    this.libraryGain.gain.value = 1;
    this.libraryLocalGain = this.ctx.createGain();
    this.libraryLocalGain.gain.value = 0.9;
    this.libraryGain.connect(this.destination);
    this.libraryGain.connect(this.libraryLocalGain);
    this.libraryLocalGain.connect(this.ctx.destination);

    this.ring = new RingBuffer(this.ctx.sampleRate, PREHEAR_SECONDS);
    this.prehearGain = this.ctx.createGain();
    this.prehearGain.gain.value = 1;
    this.prehearGain.connect(this.ctx.destination);
    this.prehearGain.connect(this.destination);

    await this.applyOutputDevice(settings.outputDeviceId);
    await this.ensureCablePlaying();
    this.startOutKeepAlive();

    // Prehear capture runs in tickLevels via analyser time slices (ScriptProcessor is
    // unreliable / often skipped in Chromium+Electron when the monitor path is muted).
    this.lastCaptureCtxTime = this.ctx.currentTime;
    this.captureMode = 'analyser';
    this.scriptHits = 0;

    this.applySettings(this.settings);
    this.running = true;
    this.tickLevels();
    this.emitPrehear();
    this.log('info', 'engine started', {
      sampleRate: this.ctx.sampleRate,
      workletReady: this.workletReady,
      outputDeviceId: settings.outputDeviceId || '(default)',
      enabled: settings.enabled,
      sinkOk: this.lastSinkOk,
    });
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

  async applyOutputDevice(deviceId: string): Promise<boolean> {
    if (!this.outElement) return false;
    const sinkId = deviceId || '';
    try {
      if (typeof this.outElement.setSinkId === 'function') {
        await this.outElement.setSinkId(sinkId);
      }
      this.lastSinkOk = true;
      await this.ensureCablePlaying();
      return true;
    } catch (e) {
      this.lastSinkOk = false;
      console.warn('setSinkId failed', e);
      return false;
    }
  }

  get cableSinkOk() {
    return this.lastSinkOk;
  }

  private async ensureCablePlaying() {
    if (!this.outElement) return;
    try {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      this.outElement.muted = false;
      this.outElement.volume = 1;
      if (this.outElement.paused) await this.outElement.play();
    } catch {
      /* autoplay / sink races */
    }
  }

  private startOutKeepAlive() {
    this.stopOutKeepAlive();
    this.outKeepAlive = setInterval(() => {
      void this.ensureCablePlaying();
    }, 2000);
  }

  private stopOutKeepAlive() {
    if (this.outKeepAlive) {
      clearInterval(this.outKeepAlive);
      this.outKeepAlive = null;
    }
  }

  /**
   * Play a library clip into BOTH the virtual-cable output (system mic / Telegram)
   * and local speakers. Pass raw ArrayBuffer (no fetch — blob: fetch fails in Electron).
   */
  async playLibraryBuffer(raw: ArrayBuffer): Promise<number> {
    if (!this.ctx || !this.libraryGain || !this.running) {
      throw new Error('Engine is not running — turn the changer ON first');
    }
    await this.ensureCablePlaying();
    this.stopLibrary();

    const audioBuffer = await this.ctx.decodeAudioData(raw.slice(0));
    const src = this.ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(this.libraryGain);
    src.onended = () => {
      if (this.librarySource === src) {
        this.librarySource = null;
        this.libraryPlaying = false;
      }
    };
    src.start(0);
    this.librarySource = src;
    this.libraryPlaying = true;
    this.log('info', 'library clip started', { duration: audioBuffer.duration });
    return audioBuffer.duration;
  }

  /** @deprecated use playLibraryBuffer */
  async playLibraryUrl(url: string): Promise<void> {
    // Prefer reading blob via XHR-free path when possible
    if (url.startsWith('blob:') || url.startsWith('data:')) {
      const res = await new Promise<ArrayBuffer>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            resolve(xhr.response as ArrayBuffer);
          } else reject(new Error(`XHR ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Failed to load sound data'));
        xhr.send();
      });
      await this.playLibraryBuffer(res);
      return;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch sound (${res.status})`);
    await this.playLibraryBuffer(await res.arrayBuffer());
  }

  stopLibrary() {
    if (this.librarySource) {
      try {
        this.librarySource.onended = null;
        this.librarySource.stop();
      } catch {
        /* */
      }
      this.librarySource = null;
    }
    this.libraryPlaying = false;
  }

  get isLibraryPlaying() {
    return this.libraryPlaying;
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

    // Save a fresh play (not resume) for debugging — last 2 WAVs in logs folder.
    if (startAt < 0.02) {
      void this.savePrehearDebugDump();
    }

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

  private async savePrehearDebugDump() {
    if (!this.prehearBuffer || !this.ctx) return;
    try {
      const ch = this.prehearBuffer.getChannelData(0);
      const samples = new Float32Array(ch.length);
      samples.set(ch);
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        const a = Math.abs(samples[i]);
        sum += samples[i] * samples[i];
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / Math.max(1, samples.length));
      const wav = encodeWavPcm16(samples, this.prehearBuffer.sampleRate);
      const result = await window.boysChanger?.savePrehearDebug(wav, {
        seconds: Number(this.prehearBuffer.duration.toFixed(3)),
        sampleRate: this.prehearBuffer.sampleRate,
        frames: samples.length,
        rms: Number(rms.toFixed(6)),
        peak: Number(peak.toFixed(6)),
        silent: rms < 0.0008,
      });
      this.log('info', 'prehear debug dump', result);
    } catch (e) {
      this.log('warn', 'prehear debug dump failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
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
    let frames = 0;
    const loop = () => {
      if (!this.analyser || !this.prehearTimeData || !this.ctx || !this.ring) return;
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      (this.analyser as unknown as { getFloatTimeDomainData(a: Float32Array): void }).getFloatTimeDomainData(
        this.prehearTimeData,
      );

      let sum = 0;
      for (let i = 0; i < this.prehearTimeData.length; i++) {
        const v = this.prehearTimeData[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.prehearTimeData.length);
      this.levelListeners.forEach((cb) => cb(rms));

      let rawRms = 0;
      if (this.rawAnalyser && this.rawTimeData) {
        (this.rawAnalyser as unknown as { getFloatTimeDomainData(a: Float32Array): void }).getFloatTimeDomainData(
          this.rawTimeData,
        );
        let rsum = 0;
        for (let i = 0; i < this.rawTimeData.length; i++) {
          const v = this.rawTimeData[i];
          rsum += v * v;
        }
        rawRms = Math.sqrt(rsum / this.rawTimeData.length);
      }

      if (rms < 0.0008 && rawRms < 0.0008) {
        this.silenceFrames++;
        if (this.silenceFrames === 120) {
          this.log('warn', 'mic silence detected', {
            rms,
            rawRms,
            prehearSec: this.ring.availableSeconds,
          });
          this.onMicWarning?.('silence');
        }
      } else {
        this.silenceFrames = 0;
      }

      // Continuous prehear: take newest ~dt samples from the analyser window.
      // Prefer processed signal; if it's dead but raw mic has audio, capture raw so prehear isn't empty.
      const now = this.ctx.currentTime;
      const dt = Math.max(0, Math.min(0.1, now - this.lastCaptureCtxTime));
      this.lastCaptureCtxTime = now;
      if (dt > 0 && (!this.prehearPlaying || this.prehearPaused)) {
        const n = Math.min(
          this.prehearTimeData.length,
          Math.max(1, Math.floor(dt * this.ctx.sampleRate)),
        );
        const useRaw = rms < 0.0008 && rawRms >= 0.0008 && this.rawTimeData;
        const srcData = useRaw ? this.rawTimeData! : this.prehearTimeData;
        this.ring.push(srcData.subarray(srcData.length - n));
        this.peaksCache = computePeaks(this.ring.snapshot(), 160);
      }

      frames++;
      if (frames === 60 || frames === 300) {
        this.log('info', 'engine heartbeat', {
          rms: Number(rms.toFixed(5)),
          rawRms: Number(rawRms.toFixed(5)),
          prehearSec: Number(this.ring.availableSeconds.toFixed(2)),
          captureMode: this.captureMode,
          ctx: this.ctx.state,
          sinkOk: this.lastSinkOk,
        });
      }

      const nowMs = performance.now();
      if (nowMs - this.lastPrehearEmit > 80) {
        this.lastPrehearEmit = nowMs;
        this.emitPrehear();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  async stop() {
    cancelAnimationFrame(this.raf);
    this.stopOutKeepAlive();
    this.stopLibrary();
    this.stopPrehear();
    this.teardownEffects();
    if (this.recorderNode) {
      this.recorderNode.onaudioprocess = null;
      try {
        this.recorderNode.disconnect();
      } catch {
        /* */
      }
      this.recorderNode = null;
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
    this.keepAliveGain = null;
    this.captureSilent = null;
    this.rawAnalyser = null;
    this.rawTimeData = null;
    this.silenceFrames = 0;
    this.libraryGain = null;
    this.libraryLocalGain = null;
    this.prehearTimeData = null;
    this.prehearBuffer = null;
    this.prehearGain = null;
    this.pitchNode = null;
    this.running = false;
    this.lastSinkOk = false;
    this.peaksCache = new Float32Array(160) as Float32Array;
    this.emitPrehear();
    this.log('info', 'engine stopped');
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

function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return buffer;
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

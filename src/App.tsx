import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceEngine } from './audio/VoiceEngine';
import {
  DEFAULT_SETTINGS,
  EFFECT_META,
  type AgePreset,
  type EffectId,
  type GenderPreset,
  type RacePreset,
  type VoiceSettings,
} from './audio/types';
import logoMark from './assets/logo-mark.svg';
import './styles.css';

interface DeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

const RACES: { id: RacePreset; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'bright', label: 'Bright' },
  { id: 'warm', label: 'Warm' },
  { id: 'deep', label: 'Deep' },
  { id: 'airy', label: 'Airy' },
];

const GENDERS: { id: GenderPreset; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'feminine', label: 'Feminine' },
  { id: 'masculine', label: 'Masculine' },
  { id: 'androgynous', label: 'Androgynous' },
];

const AGES: { id: AgePreset; label: string }[] = [
  { id: 'child', label: 'Child' },
  { id: 'teen', label: 'Teen' },
  { id: 'young', label: 'Young' },
  { id: 'adult', label: 'Adult' },
  { id: 'elder', label: 'Elder' },
];

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem('boyschanger-settings');
    if (!raw) return { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      effects: { ...DEFAULT_SETTINGS.effects, ...(parsed.effects ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
  }
}

function looksLikeVirtualOutput(label: string): boolean {
  return /cable input|blackhole|voicemeeter input|vb-audio/i.test(label);
}

function looksLikeVirtualInput(label: string): boolean {
  return /cable output|blackhole|voicemeeter output|vb-audio/i.test(label);
}

export default function App() {
  const engineRef = useRef(new VoiceEngine());
  const [settings, setSettings] = useState<VoiceSettings>(() => loadSettings());
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState('Idle');
  const [busy, setBusy] = useState(false);
  const [prehearInfo, setPrehearInfo] = useState('');
  const [platform, setPlatform] = useState<string>('win32');
  const [engineOn, setEngineOn] = useState(false);

  const inputs = useMemo(() => devices.filter((d) => d.kind === 'audioinput'), [devices]);
  const outputs = useMemo(() => devices.filter((d) => d.kind === 'audiooutput'), [devices]);

  const refreshDevices = useCallback(async () => {
    try {
      // Permission prompt unlocks device labels
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach((t) => t.stop());
    } catch {
      /* */
    }
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(
      list
        .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `${d.kind} (${d.deviceId.slice(0, 6)})`,
          kind: d.kind,
        })),
    );
  }, []);

  useEffect(() => {
    localStorage.setItem('boyschanger-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    void (async () => {
      if (window.boysChanger) {
        const p = await window.boysChanger.platform();
        setPlatform(p);
        await window.boysChanger.ensureMicPermission();
      }
      await refreshDevices();
    })();

    const unsub = engineRef.current.onLevel(setLevel);
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      unsub();
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      void engineRef.current.stop();
    };
  }, [refreshDevices]);

  // Auto-pick virtual cable output when available and unset
  useEffect(() => {
    if (settings.outputDeviceId) return;
    const virtual = outputs.find((d) => looksLikeVirtualOutput(d.label));
    if (virtual) {
      setSettings((s) => ({ ...s, outputDeviceId: virtual.deviceId }));
    }
  }, [outputs, settings.outputDeviceId]);

  useEffect(() => {
    if (!engineOn) return;
    engineRef.current.applySettings(settings);
    void engineRef.current.applyOutputDevice(settings.outputDeviceId);
  }, [settings, engineOn]);

  const update = <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const toggleEffect = (id: EffectId) => {
    setSettings((s) => ({
      ...s,
      effects: { ...s.effects, [id]: !s.effects[id] },
    }));
  };

  const startEngine = async (enabled: boolean) => {
    setBusy(true);
    setStatus('Starting audio…');
    try {
      const next = { ...settings, enabled };
      setSettings(next);
      await engineRef.current.start(next);
      setEngineOn(true);
      setStatus(enabled ? 'Changer ON — routing to virtual cable' : 'Passthrough (changer off)');
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setEngineOn(false);
    } finally {
      setBusy(false);
    }
  };

  const stopEngine = async () => {
    setBusy(true);
    await engineRef.current.stop();
    setEngineOn(false);
    setStatus('Stopped');
    setBusy(false);
  };

  const toggleChanger = async () => {
    if (!engineOn) {
      await startEngine(true);
      return;
    }
    const nextEnabled = !settings.enabled;
    update('enabled', nextEnabled);
    engineRef.current.applySettings({ ...settings, enabled: nextEnabled });
    setStatus(nextEnabled ? 'Changer ON' : 'Changer OFF (mic passthrough)');
  };

  const onPrehear = async () => {
    if (!engineOn) {
      setPrehearInfo('Start the engine first so audio can be captured.');
      return;
    }
    const { seconds } = await engineRef.current.prehear();
    setPrehearInfo(
      seconds > 0
        ? `Replaying last ${seconds.toFixed(1)}s`
        : 'Not enough audio yet — speak for a moment, then try again.',
    );
  };

  const applySystemWide = async () => {
    if (!window.boysChanger) {
      setStatus('System input switching requires the desktop app.');
      return;
    }
    // System mic uses the recording side of the virtual cable.
    const systemHint = platform === 'darwin' ? 'BlackHole' : 'CABLE Output';
    setStatus('Applying system input…');
    const res = await window.boysChanger.setSystemInput(systemHint);
    setStatus(res.message);
    if (res.ok && !engineOn) {
      await startEngine(true);
    }
  };

  const meterWidth = Math.min(100, Math.round(level * 280));

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-block">
          <div className="brand-row">
            <img className="brand-logo" src={logoMark} width={72} height={72} alt="BoysChanger" />
            <div>
              <p className="eyebrow">System-wide voice studio</p>
              <h1 className="brand">BoysChanger</h1>
            </div>
          </div>
          <p className="tagline">
            Shape race, gender, age, timbre, and stacked effects — then route the result as your
            system microphone.
          </p>
        </div>
        <div className="power-block">
          <button
            type="button"
            className={`power ${settings.enabled && engineOn ? 'on' : ''}`}
            disabled={busy}
            onClick={() => void toggleChanger()}
          >
            {settings.enabled && engineOn ? 'ON' : 'OFF'}
          </button>
          <p className="power-hint">Voice changer</p>
          <div className="meter" aria-hidden>
            <div className="meter-fill" style={{ width: `${meterWidth}%` }} />
          </div>
          <p className="status">{status}</p>
        </div>
      </header>

      <section className="panel devices">
        <h2>Audio routing</h2>
        <p className="hint">
          {platform === 'darwin'
            ? 'Install BlackHole 2ch. Set Output to BlackHole, then apply system input.'
            : 'Install VB-Cable. Set Output to CABLE Input, then apply system input (CABLE Output).'}
        </p>
        <div className="grid-2">
          <label>
            Input (your mic)
            <select
              value={settings.inputDeviceId}
              onChange={(e) => update('inputDeviceId', e.target.value)}
            >
              <option value="default">System default</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                  {looksLikeVirtualInput(d.label) ? ' (virtual — usually avoid)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Output (virtual cable)
            <select
              value={settings.outputDeviceId}
              onChange={(e) => update('outputDeviceId', e.target.value)}
            >
              <option value="">Default speakers</option>
              {outputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                  {looksLikeVirtualOutput(d.label) ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row actions">
          <button type="button" className="secondary" onClick={() => void refreshDevices()}>
            Refresh devices
          </button>
          <button type="button" className="secondary" onClick={() => void applySystemWide()}>
            Apply as system input
          </button>
          {!engineOn ? (
            <button type="button" className="secondary" disabled={busy} onClick={() => void startEngine(settings.enabled)}>
              Start engine
            </button>
          ) : (
            <button type="button" className="secondary" disabled={busy} onClick={() => void stopEngine()}>
              Stop engine
            </button>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={settings.monitorLocally}
              onChange={(e) => update('monitorLocally', e.target.checked)}
            />
            Monitor locally
          </label>
        </div>
      </section>

      <section className="panel character">
        <h2>Voice character</h2>
        <div className="grid-3">
          <fieldset>
            <legend>Race</legend>
            <div className="chips">
              {RACES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={settings.race === r.id ? 'chip active' : 'chip'}
                  onClick={() => update('race', r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Gender</legend>
            <div className="chips">
              {GENDERS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={settings.gender === g.id ? 'chip active' : 'chip'}
                  onClick={() => update('gender', g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Age</legend>
            <div className="chips">
              {AGES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={settings.age === a.id ? 'chip active' : 'chip'}
                  onClick={() => update('age', a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="sliders">
          <label>
            <span>Timbre <em>{settings.timbre}</em></span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.timbre}
              onChange={(e) => update('timbre', Number(e.target.value))}
            />
          </label>
          <label>
            <span>Amplifier <em>{settings.amplifier}</em></span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.amplifier}
              onChange={(e) => update('amplifier', Number(e.target.value))}
            />
          </label>
          <label>
            <span>Volume <em>{settings.volume}</em></span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(e) => update('volume', Number(e.target.value))}
            />
          </label>
          <label>
            <span>Effects mix <em>{settings.effectMix}</em></span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.effectMix}
              onChange={(e) => update('effectMix', Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      <section className="panel effects">
        <h2>Effects</h2>
        <p className="hint">Enable any combination — all selected effects run together.</p>
        <div className="effects-grid">
          {EFFECT_META.map((fx) => (
            <button
              key={fx.id}
              type="button"
              className={settings.effects[fx.id] ? 'fx on' : 'fx'}
              onClick={() => toggleEffect(fx.id)}
            >
              <strong>{fx.label}</strong>
              <span>{fx.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel prehear">
        <h2>Prehear</h2>
        <p className="hint">Replay the last 11 seconds of processed voice through your speakers.</p>
        <div className="row actions">
          <button type="button" className="primary" onClick={() => void onPrehear()}>
            Prehear last 11s
          </button>
          <span className="prehear-info">{prehearInfo}</span>
        </div>
      </section>

      <footer className="footer">
        <span>BoysChanger · Windows & macOS</span>
        <span className="footer-note">Releases publish automatically on each main commit</span>
      </footer>
    </div>
  );
}

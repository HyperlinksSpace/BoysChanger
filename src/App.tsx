import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceEngine } from './audio/VoiceEngine';
import {
  DEFAULT_SETTINGS,
  type AgePreset,
  type EffectId,
  type GenderPreset,
  type RacePreset,
  type VoiceSettings,
} from './audio/types';
import { LOCALES, detectLocale, t, type Locale, type MessageKey } from './i18n';
import './styles.css';

interface DeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

const RACES: RacePreset[] = ['neutral', 'bright', 'warm', 'deep', 'airy'];
const GENDERS: GenderPreset[] = ['neutral', 'feminine', 'masculine', 'androgynous'];
const AGES: AgePreset[] = ['child', 'teen', 'young', 'adult', 'elder'];
const FX_IDS: EffectId[] = [
  'echo',
  'wahwah',
  'distortion',
  'reverb',
  'chorus',
  'robot',
  'flanger',
  'bitcrush',
];

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || '1.0.0';

function loadSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem('boyschanger-settings');
    if (!raw) return { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      effects: { ...DEFAULT_SETTINGS.effects, ...(parsed.effects ?? {}) },
      // Force-safe default if user had monitor on from older builds
      monitorLocally: parsed.monitorLocally ?? false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
  }
}

function loadLocale(systemLocale?: string | null): Locale {
  const saved = localStorage.getItem('boyschanger-locale') as Locale | null;
  if (saved && LOCALES.some((l) => l.id === saved)) return saved;
  return detectLocale(systemLocale);
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
  const [statusKey, setStatusKey] = useState<MessageKey>('statusIdle');
  const [statusVars, setStatusVars] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [prehearInfo, setPrehearInfo] = useState('');
  const [platform, setPlatform] = useState<string>('win32');
  const [engineOn, setEngineOn] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [version, setVersion] = useState(APP_VERSION);
  const [updateNote, setUpdateNote] = useState('');

  const tr = useCallback((key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars), [locale]);

  const inputs = useMemo(() => devices.filter((d) => d.kind === 'audioinput'), [devices]);
  const outputs = useMemo(() => devices.filter((d) => d.kind === 'audiooutput'), [devices]);

  const setStatus = (key: MessageKey, vars: Record<string, string | number> = {}) => {
    setStatusKey(key);
    setStatusVars(vars);
  };

  const refreshDevices = useCallback(async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach((track) => track.stop());
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
    localStorage.setItem('boyschanger-locale', locale);
  }, [locale]);

  useEffect(() => {
    let unsubUpdate: (() => void) | undefined;

    void (async () => {
      if (window.boysChanger) {
        const p = await window.boysChanger.platform();
        setPlatform(p);
        const sys = await window.boysChanger.getLocale();
        setLocale((prev) => {
          const saved = localStorage.getItem('boyschanger-locale');
          return saved ? prev : loadLocale(sys);
        });
        const ver = await window.boysChanger.getVersion();
        setVersion(ver);
        await window.boysChanger.ensureMicPermission();

        unsubUpdate = window.boysChanger.onUpdateStatus((payload) => {
          const loc = (localStorage.getItem('boyschanger-locale') as Locale) || 'en';
          if (payload.status === 'checking') setUpdateNote(t(loc, 'updateChecking'));
          else if (payload.status === 'available')
            setUpdateNote(t(loc, 'updateAvailable', { version: payload.version ?? '' }));
          else if (payload.status === 'downloaded') setUpdateNote(t(loc, 'updateDownloaded'));
          else if (payload.status === 'not-available') setUpdateNote(t(loc, 'updateLatest'));
          else if (payload.status === 'error') setUpdateNote(t(loc, 'updateError'));
        });
        void window.boysChanger.checkForUpdates();
      }
    })();

    const unsubLevel = engineRef.current.onLevel(setLevel);
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    void refreshDevices();
    return () => {
      unsubUpdate?.();
      unsubLevel();
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      void engineRef.current.stop();
    };
  }, [refreshDevices]);

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
    setStatus('statusStarting');
    try {
      const next = { ...settings, enabled };
      setSettings(next);
      await engineRef.current.start(next);
      setEngineOn(true);
      setStatus(enabled ? 'statusOn' : 'statusPassthrough');
    } catch (e) {
      setStatus('statusFailed', { error: e instanceof Error ? e.message : String(e) });
      setEngineOn(false);
    } finally {
      setBusy(false);
    }
  };

  const stopEngine = async () => {
    setBusy(true);
    await engineRef.current.stop();
    setEngineOn(false);
    setStatus('statusStopped');
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
    setStatus(nextEnabled ? 'statusOn' : 'statusOff');
  };

  const onPrehear = async () => {
    if (!engineOn) {
      setPrehearInfo(tr('prehearNeedEngine'));
      return;
    }
    const { seconds } = await engineRef.current.prehear();
    setPrehearInfo(
      seconds > 0 ? tr('prehearPlaying', { seconds: seconds.toFixed(1) }) : tr('prehearEmpty'),
    );
  };

  const applySystemWide = async () => {
    if (!window.boysChanger) {
      setStatus('statusNeedDesktop');
      return;
    }
    const systemHint = platform === 'darwin' ? 'BlackHole' : 'CABLE Output';
    setStatus('statusApplying');
    const res = await window.boysChanger.setSystemInput(systemHint);
    setStatusKey('statusIdle');
    setStatusVars({});
    // Show server message in status line as raw via failed key substitution fallback
    setPrehearInfo(res.message);
    if (res.ok && !engineOn) {
      await startEngine(true);
    }
  };

  const meterWidth = Math.min(100, Math.round(level * 280));
  const logoSrc = './logo.png';

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-block">
          <div className="brand-row">
            <img className="brand-logo" src={logoSrc} width={72} height={72} alt="BoysChanger" />
            <div>
              <p className="eyebrow">{tr('eyebrow')}</p>
              <h1 className="brand">
                BoysChanger
                <span className="version">v{version}</span>
              </h1>
            </div>
          </div>
          <p className="tagline">{tr('tagline')}</p>
          <div className="lang-row">
            <label>
              {tr('language')}
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                {LOCALES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            {updateNote ? <span className="update-note">{updateNote}</span> : null}
          </div>
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
          <p className="power-hint">{tr('powerHint')}</p>
          <div className="meter" aria-hidden>
            <div className="meter-fill" style={{ width: `${meterWidth}%` }} />
          </div>
          <p className="status">{tr(statusKey, statusVars)}</p>
        </div>
      </header>

      <section className="panel devices">
        <h2>{tr('audioRouting')}</h2>
        <p className="hint">{platform === 'darwin' ? tr('hintMac') : tr('hintWin')}</p>
        <div className="grid-2">
          <label>
            {tr('inputMic')}
            <select
              value={settings.inputDeviceId}
              onChange={(e) => update('inputDeviceId', e.target.value)}
            >
              <option value="default">{tr('systemDefault')}</option>
              {inputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                  {looksLikeVirtualInput(d.label) ? tr('virtualAvoid') : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr('outputCable')}
            <select
              value={settings.outputDeviceId}
              onChange={(e) => update('outputDeviceId', e.target.value)}
            >
              <option value="">{tr('defaultSpeakers')}</option>
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
            {tr('refreshDevices')}
          </button>
          <button type="button" className="secondary" onClick={() => void applySystemWide()}>
            {tr('applySystem')}
          </button>
          {!engineOn ? (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void startEngine(settings.enabled)}
            >
              {tr('startEngine')}
            </button>
          ) : (
            <button type="button" className="secondary" disabled={busy} onClick={() => void stopEngine()}>
              {tr('stopEngine')}
            </button>
          )}
          <label className="check" title={tr('monitorHint')}>
            <input
              type="checkbox"
              checked={settings.monitorLocally}
              onChange={(e) => update('monitorLocally', e.target.checked)}
            />
            {tr('monitorLocally')}
          </label>
        </div>
      </section>

      <section className="panel character">
        <h2>{tr('voiceCharacter')}</h2>
        <div className="grid-3">
          <fieldset>
            <legend>{tr('race')}</legend>
            <div className="chips">
              {RACES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={settings.race === r ? 'chip active' : 'chip'}
                  onClick={() => update('race', r)}
                >
                  {tr(`race_${r}` as MessageKey)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{tr('gender')}</legend>
            <div className="chips">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={settings.gender === g ? 'chip active' : 'chip'}
                  onClick={() => update('gender', g)}
                >
                  {tr(`gender_${g}` as MessageKey)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{tr('age')}</legend>
            <div className="chips">
              {AGES.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={settings.age === a ? 'chip active' : 'chip'}
                  onClick={() => update('age', a)}
                >
                  {tr(`age_${a}` as MessageKey)}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="sliders">
          <label>
            <span>
              {tr('timbre')} <em>{settings.timbre}</em>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.timbre}
              onChange={(e) => update('timbre', Number(e.target.value))}
            />
          </label>
          <label>
            <span>
              {tr('amplifier')} <em>{settings.amplifier}</em>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.amplifier}
              onChange={(e) => update('amplifier', Number(e.target.value))}
            />
          </label>
          <label>
            <span>
              {tr('volume')} <em>{settings.volume}</em>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(e) => update('volume', Number(e.target.value))}
            />
          </label>
          <label>
            <span>
              {tr('effectsMix')} <em>{settings.effectMix}</em>
            </span>
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
        <h2>{tr('effects')}</h2>
        <p className="hint">{tr('effectsHint')}</p>
        <div className="effects-grid">
          {FX_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={settings.effects[id] ? 'fx on' : 'fx'}
              onClick={() => toggleEffect(id)}
            >
              <strong>{tr(`fx_${id}` as MessageKey)}</strong>
              <span>{tr(`fx_${id}_desc` as MessageKey)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel prehear">
        <h2>{tr('prehear')}</h2>
        <p className="hint">{tr('prehearHint')}</p>
        <div className="row actions">
          <button type="button" className="primary" onClick={() => void onPrehear()}>
            {tr('prehearBtn')}
          </button>
          <span className="prehear-info">{prehearInfo}</span>
        </div>
      </section>

      <footer className="footer">
        <span>
          {tr('footer')} · v{version}
        </span>
      </footer>
    </div>
  );
}

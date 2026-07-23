import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceEngine, type PrehearState } from './audio/VoiceEngine';
import {
  DEFAULT_SETTINGS,
  type AgePreset,
  type EffectId,
  type GenderPreset,
  type RacePreset,
  type VoiceSettings,
} from './audio/types';
import { PrehearPanel } from './components/PrehearPanel';
import { SoundLibraryPanel } from './components/SoundLibraryPanel';
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
  const [platform, setPlatform] = useState<string>('win32');
  const [engineOn, setEngineOn] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => loadLocale());
  const [version, setVersion] = useState(APP_VERSION);
  const [updateNote, setUpdateNote] = useState('');
  const [prehear, setPrehear] = useState<PrehearState>({
    ready: false,
    playing: false,
    paused: false,
    seconds: 0,
    position: 0,
    peaks: new Float32Array(160),
  });
  const [systemMsg, setSystemMsg] = useState('');

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
    engineRef.current.setLogger((level, msg, data) => {
      void window.boysChanger?.debugLog({
        level: level === 'error' || level === 'warn' ? level : 'info',
        scope: 'VoiceEngine',
        message: msg,
        data,
      });
    });
  }, []);

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
        const paths = await window.boysChanger.getLogPath();
        void window.boysChanger.debugLog({
          scope: 'App',
          message: 'renderer ready',
          data: { version: ver, logPaths: paths },
        });

        unsubUpdate = window.boysChanger.onUpdateStatus((payload) => {
          const loc = (localStorage.getItem('boyschanger-locale') as Locale) || 'en';
          if (payload.status === 'checking') setUpdateNote(t(loc, 'updateChecking'));
          else if (payload.status === 'available') {
            const pct = payload.message ? ` ${payload.message}` : '';
            setUpdateNote(t(loc, 'updateAvailable', { version: payload.version ?? '' }) + pct);
          } else if (payload.status === 'downloaded') setUpdateNote(t(loc, 'updateDownloaded'));
          else if (payload.status === 'not-available') setUpdateNote(t(loc, 'updateLatest'));
          else if (payload.status === 'error') {
            const net =
              payload.message === 'network' ||
              payload.message === 'network-soft' ||
              /ERR_CONNECTION|ECONNRESET|ETIMEDOUT|network/i.test(payload.message || '');
            if (payload.message === 'network-soft') {
              // Background flaky GitHub — keep quiet unless already showing an error
              setUpdateNote((prev) =>
                prev && /fail|ошиб|失败|ERR_/i.test(prev) ? t(loc, 'updateErrorNetwork') : prev,
              );
            } else {
              setUpdateNote(
                net
                  ? t(loc, 'updateErrorNetwork')
                  : `${t(loc, 'updateError')}${payload.message ? `: ${payload.message}` : ''}`,
              );
            }
          }
        });
        void window.boysChanger.checkForUpdates();
      }
    })();

    const unsubLevel = engineRef.current.onLevel(setLevel);
    const unsubPrehear = engineRef.current.onPrehear(setPrehear);
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    void refreshDevices();
    return () => {
      unsubUpdate?.();
      unsubLevel();
      unsubPrehear();
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
    const active = Boolean(settings.enabled && engineOn);
    void window.boysChanger?.setChangerStatus(active);
  }, [settings.enabled, engineOn]);

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

  const startEngine = async (enabled: boolean, base: VoiceSettings = settings) => {
    setBusy(true);
    setStatus('statusStarting');
    try {
      const next = { ...base, enabled };
      setSettings(next);
      void window.boysChanger?.debugLog({
        scope: 'App',
        message: 'startEngine',
        data: {
          enabled,
          inputDeviceId: next.inputDeviceId,
          outputDeviceId: next.outputDeviceId,
        },
      });
      await engineRef.current.start(next);
      setEngineOn(true);
      setStatus(enabled ? 'statusOn' : 'statusPassthrough');
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      void window.boysChanger?.debugLog({
        level: 'error',
        scope: 'App',
        message: 'startEngine failed',
        data: { error },
      });
      setStatus('statusFailed', { error });
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
    // OFF keeps the engine running in passthrough so Telegram/Discord still
    // hear the real mic through the virtual cable (instead of silence).
    if (engineOn && settings.enabled) {
      const next = { ...settings, enabled: false };
      setSettings(next);
      engineRef.current.applySettings(next);
      setStatus('statusPassthrough');
      return;
    }
    await startEngine(true);
  };

  const applySystemWide = async () => {
    if (!window.boysChanger) {
      setStatus('statusNeedDesktop');
      return;
    }

    // Prefer virtual cable as output so processed audio reaches Telegram's mic path.
    let nextSettings = settings;
    if (!settings.outputDeviceId || !looksLikeVirtualOutput(
      outputs.find((d) => d.deviceId === settings.outputDeviceId)?.label || '',
    )) {
      const virtual = outputs.find((d) => looksLikeVirtualOutput(d.label));
      if (virtual) {
        nextSettings = { ...settings, outputDeviceId: virtual.deviceId };
        setSettings(nextSettings);
      }
    }

    const systemHint = platform === 'darwin' ? 'BlackHole' : 'CABLE Output';
    setStatus('statusApplying');
    const res = await window.boysChanger.setSystemInput(systemHint);
    setStatusKey('statusIdle');
    setStatusVars({});
    const tip = tr('chatMicTip');
    setSystemMsg(res.ok ? `${res.message} — ${tip}` : `${res.message} — ${tip}`);
    if (!engineOn) {
      await startEngine(true, { ...nextSettings, enabled: true });
    } else {
      const active = { ...nextSettings, enabled: true };
      setSettings(active);
      engineRef.current.applySettings(active);
      const sinkOk = await engineRef.current.applyOutputDevice(active.outputDeviceId);
      if (!sinkOk) {
        setSystemMsg(`${tr('sinkFailed')} — ${tip}`);
      } else {
        setStatus('statusOn');
      }
    }
  };

  const ensureEngineForSounds = useCallback(async () => {
    if (engineOn) return true;
    setBusy(true);
    setStatus('statusStarting');
    try {
      const next = { ...settings, enabled: true };
      setSettings(next);
      await engineRef.current.start(next);
      setEngineOn(true);
      setStatus('statusOn');
      return true;
    } catch (e) {
      setStatus('statusFailed', { error: e instanceof Error ? e.message : String(e) });
      setEngineOn(false);
      return false;
    } finally {
      setBusy(false);
    }
  }, [engineOn, settings]);

  const playLibraryBuffer = useCallback(async (buffer: ArrayBuffer) => {
    return engineRef.current.playLibraryBuffer(buffer);
  }, []);

  const stopLibrary = useCallback(() => {
    engineRef.current.stopLibrary();
  }, []);

  const meterWidth = Math.min(100, Math.round(level * 280));
  const logoSrc = './logo.png';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-row">
          <img className="brand-logo" src={logoSrc} width={44} height={44} alt="BoysChanger" />
          <div className="brand-text">
            <h1 className="brand">
              BoysChanger
              <span className="version">v{version}</span>
            </h1>
            <p className="eyebrow">{tr('eyebrow')}</p>
          </div>
        </div>
        <div className="topbar-right">
          <label className="lang-inline">
            <span>{tr('language')}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary update-btn"
            onClick={() => {
              setUpdateNote(tr('updateChecking'));
              void window.boysChanger?.checkForUpdates();
            }}
          >
            {tr('updateCheck')}
          </button>
          <button
            type="button"
            className="secondary update-btn"
            title={tr('openLogs')}
            onClick={() => void window.boysChanger?.openLogFolder()}
          >
            {tr('openLogs')}
          </button>
          {updateNote ? <span className="update-note">{updateNote}</span> : null}
        </div>
      </header>

      <section className="control-strip">
        <div className="power-block">
          <button
            type="button"
            className={`power ${settings.enabled && engineOn ? 'on' : ''}`}
            disabled={busy}
            onClick={() => void toggleChanger()}
          >
            {settings.enabled && engineOn ? 'ON' : 'OFF'}
          </button>
          <div className="power-meta">
            <p className="power-hint">{tr('powerHint')}</p>
            <div className="meter" aria-hidden>
              <div className="meter-fill" style={{ width: `${meterWidth}%` }} />
            </div>
            <p className="status">{tr(statusKey, statusVars)}</p>
          </div>
        </div>
        <PrehearPanel
          state={prehear}
          engineRunning={engineOn}
          labels={{
            title: tr('prehear'),
            hint: systemMsg || tr('prehearHint'),
            play: tr('prehearPlay'),
            pause: tr('prehearPause'),
            needEngine: tr('prehearNeedEngine'),
            empty: tr('prehearEmpty'),
          }}
          onPlay={() => {
            engineRef.current.preparePrehear();
            engineRef.current.playPrehear();
          }}
          onPause={() => engineRef.current.pausePrehear()}
        />
      </section>

      <section className="panel compact devices">
        <div className="panel-head">
          <h2>{tr('audioRouting')}</h2>
          <p className="hint">{platform === 'darwin' ? tr('hintMac') : tr('hintWin')}</p>
        </div>
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

      <div className="two-col">
        <section className="panel compact character">
          <h2>{tr('voiceCharacter')}</h2>
          <div className="preset-rows">
            <div className="preset-row">
              <span className="preset-label">{tr('race')}</span>
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
            </div>
            <div className="preset-row">
              <span className="preset-label">{tr('gender')}</span>
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
            </div>
            <div className="preset-row">
              <span className="preset-label">{tr('age')}</span>
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
            </div>
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

        <section className="panel compact effects">
          <h2>{tr('effects')}</h2>
          <div className="effects-grid">
            {FX_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={settings.effects[id] ? 'fx on' : 'fx'}
                onClick={() => toggleEffect(id)}
                title={tr(`fx_${id}_desc` as MessageKey)}
              >
                <strong>{tr(`fx_${id}` as MessageKey)}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>

      <SoundLibraryPanel
        labels={{
          title: tr('soundsTitle'),
          hint: tr('soundsHint'),
          upload: tr('soundsUpload'),
          playing: tr('soundsPlaying'),
          remove: tr('soundsRemove'),
          empty: tr('soundsEmpty'),
          needEngine: tr('soundsNeedEngine'),
        }}
        engineRunning={engineOn}
        onPlayBuffer={playLibraryBuffer}
        onStop={stopLibrary}
        onEnsureEngine={ensureEngineForSounds}
      />

      <footer className="footer">
        <span>
          {tr('footer')} · v{version}
        </span>
        <button type="button" className="linkish" onClick={() => void window.boysChanger?.openLogFolder()}>
          {tr('openLogs')}
        </button>
      </footer>
    </div>
  );
}

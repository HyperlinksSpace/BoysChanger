import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VoiceEngine, type PrehearState } from './audio/VoiceEngine';
import {
  DEFAULT_SETTINGS,
  RACE_PRESETS,
  migrateRace,
  type AgePreset,
  type EffectId,
  type GenderPreset,
  type RacePreset,
  type VoiceSettings,
} from './audio/types';
import { PrehearPanel } from './components/PrehearPanel';
import { SoundLibraryPanel } from './components/SoundLibraryPanel';
import { TelegramGuideModal } from './components/TelegramGuideModal';
import { VoiceLibraryPanel } from './components/VoiceLibraryPanel';
import { VoiceScene3D } from './components/VoiceScene3D';
import { variantFromSeed, type SceneVariant } from './visuals/createVoiceScene';
import { getSoundArrayBuffer, listSounds, type LibrarySound } from './audio/soundLibrary';
import {
  applyPayloadToSettings,
  deleteVoicePreset,
  listVoicePresets,
  saveVoicePreset,
  type VoicePreset,
} from './audio/voicePresets';
import { LOCALES, detectLocale, t, type Locale, type MessageKey } from './i18n';
import './styles.css';

type AppTab = 'main' | 'voices' | 'sounds' | 'studio' | 'settings';

interface DeviceOption {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

const RACES: RacePreset[] = [...RACE_PRESETS];
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
      race: migrateRace(parsed.race ?? DEFAULT_SETTINGS.race),
      effects: { ...DEFAULT_SETTINGS.effects, ...(parsed.effects ?? {}) },
      // Force-safe default if user had monitor on from older builds
      monitorLocally: parsed.monitorLocally ?? false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, effects: { ...DEFAULT_SETTINGS.effects } };
  }
}

function loadLocale(systemLocale?: string | null): Locale {
  // Explicit user choice only — otherwise follow OS/browser language.
  const user = localStorage.getItem('boyschanger-locale-user') as Locale | null;
  if (user && LOCALES.some((l) => l.id === user)) return user;
  return detectLocale(systemLocale);
}

function looksLikeVirtualOutput(label: string): boolean {
  return /cable input|blackhole|voicemeeter input|vb-audio/i.test(label);
}

/** Soft / loop / processed inputs that often cause silence or feedback. */
function looksLikeBadInput(label: string): boolean {
  return /voicemod|cable output|cable input|blackhole|voicemeeter|vb-audio|virtual|stereo mix|what u hear|wave out mix|noise-cancell|asus utility|ai noise/i.test(
    label,
  );
}

function looksLikeVirtualInput(label: string): boolean {
  return looksLikeBadInput(label);
}

function scoreHardwareMic(label: string): number {
  if (!label || looksLikeBadInput(label)) return -1000;
  let score = 1;
  if (/microphone|микрофон|headset|наушник|mic\b/i.test(label)) score += 20;
  if (/realtek|usb|logitech|hyperx|steelseries|razer|sony|jabra|blue yeti/i.test(label)) score += 10;
  if (/array|webcam|camera/i.test(label)) score -= 5;
  return score;
}

async function pickHardwareInputId(
  preferred: string,
  devices: { deviceId: string; label: string; kind: MediaDeviceKind }[],
): Promise<{ deviceId: string; label: string; changed: boolean }> {
  const inputs = devices.filter((d) => d.kind === 'audioinput');
  const preferredDev =
    preferred && preferred !== 'default'
      ? inputs.find((d) => d.deviceId === preferred)
      : undefined;

  if (preferredDev && scoreHardwareMic(preferredDev.label) > 0) {
    return { deviceId: preferredDev.deviceId, label: preferredDev.label, changed: false };
  }

  const ranked = [...inputs]
    .map((d) => ({ d, score: scoreHardwareMic(d.label) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked[0]) {
    return {
      deviceId: ranked[0].d.deviceId,
      label: ranked[0].d.label,
      changed: !preferredDev || preferredDev.deviceId !== ranked[0].d.deviceId,
    };
  }

  return {
    deviceId: preferredDev?.deviceId || 'default',
    label: preferredDev?.label || 'default',
    changed: false,
  };
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
  const [locale, setLocale] = useState<Locale>(() =>
    loadLocale(typeof navigator !== 'undefined' ? navigator.language : null),
  );
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
  const [telegramGuideOpen, setTelegramGuideOpen] = useState(false);
  const [cableInstallerReady, setCableInstallerReady] = useState(false);
  const [cableOsInstalled, setCableOsInstalled] = useState(false);
  const [cableInstallBusy, setCableInstallBusy] = useState(false);
  const [tab, setTab] = useState<AppTab>('main');
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>('builtin-clean');
  const [saveName, setSaveName] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [dashSounds, setDashSounds] = useState<LibrarySound[]>([]);
  const [dashPlayingId, setDashPlayingId] = useState<string | null>(null);

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

  // Do not auto-persist locale here — that raced ahead of OS locale and locked "en".
  useEffect(() => {
    engineRef.current.setLogger((level, msg, data) => {
      void window.boysChanger?.debugLog({
        level: level === 'error' || level === 'warn' ? level : 'info',
        scope: 'VoiceEngine',
        message: msg,
        data,
      });
    });
    engineRef.current.setMicWarningHandler((code, detail) => {
      if (code === 'silence') setSystemMsg(tr('micSilence'));
      else if (code === 'virtual-mic') setSystemMsg(tr('micBadInput', { label: detail || '' }));
    });
  }, [tr]);

  useEffect(() => {
    let unsubUpdate: (() => void) | undefined;

    void (async () => {
      if (window.boysChanger) {
        const p = await window.boysChanger.platform();
        setPlatform(p);
        const sys = await window.boysChanger.getLocale();
        localStorage.setItem('boyschanger-last-sys-locale', sys || '');
        setLocale(loadLocale(sys));
        // Drop legacy auto-saved locale so future launches keep following the OS
        // unless the user picks a language in the UI.
        if (!localStorage.getItem('boyschanger-locale-user')) {
          localStorage.removeItem('boyschanger-locale');
        }
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
          const loc =
            (localStorage.getItem('boyschanger-locale-user') as Locale) ||
            detectLocale(localStorage.getItem('boyschanger-last-sys-locale')) ||
            'en';
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
      let deviceList = devices;
      if (deviceList.length === 0) {
        await refreshDevices();
        // refreshDevices updates state async — re-enumerate here for a sync pick
        const list = await navigator.mediaDevices.enumerateDevices();
        deviceList = list
          .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `${d.kind} (${d.deviceId.slice(0, 6)})`,
            kind: d.kind,
          }));
      }

      // Prefer a real hardware mic — Windows "Default" is often Voicemod (silent here).
      let next = { ...base, enabled };
      const picked = await pickHardwareInputId(next.inputDeviceId, deviceList);
      if (picked.changed || (picked.deviceId !== 'default' && next.inputDeviceId === 'default')) {
        next = { ...next, inputDeviceId: picked.deviceId };
        setSystemMsg(tr('micAutoPicked', { label: picked.label }));
      }
      if (looksLikeBadInput(picked.label)) {
        setSystemMsg(tr('micBadInput', { label: picked.label }));
      }

      const outList = deviceList.filter((d) => d.kind === 'audiooutput');
      // Prefer virtual cable as output when available
      if (!next.outputDeviceId || !looksLikeVirtualOutput(
        outList.find((d) => d.deviceId === next.outputDeviceId)?.label || '',
      )) {
        const virtual = outList.find((d) => looksLikeVirtualOutput(d.label));
        if (virtual) {
          next = { ...next, outputDeviceId: virtual.deviceId };
        }
      }

      // No cable → warn; keep monitor available (headphones recommended).
      if (!next.outputDeviceId) {
        setSystemMsg(tr('echoNoCable'));
      } else if (next.monitorLocally) {
        setSystemMsg(tr('monitorHint'));
      }

      setSettings(next);
      void window.boysChanger?.debugLog({
        scope: 'App',
        message: 'startEngine',
        data: {
          enabled,
          inputDeviceId: next.inputDeviceId,
          inputLabel: picked.label,
          outputDeviceId: next.outputDeviceId,
          micAutoPicked: picked.changed,
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

  const toggleChangerRef = useRef(toggleChanger);
  toggleChangerRef.current = toggleChanger;

  useEffect(() => {
    const unsub = window.boysChanger?.onTrayToggleChanger?.(() => {
      void toggleChangerRef.current();
    });
    return () => unsub?.();
  }, []);

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

  const setupForTelegram = async () => {
    if (!window.boysChanger) {
      setStatus('statusNeedDesktop');
      return;
    }
    setTelegramGuideOpen(true);
    setBusy(true);
    try {
      await refreshDevices();
      const list = await navigator.mediaDevices.enumerateDevices();
      const outs = list
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId, kind: d.kind }));
      const virtual = outs.find((d) => looksLikeVirtualOutput(d.label));
      if (!virtual) {
        setSystemMsg(tr('telegramCableMissing'));
        setTelegramGuideOpen(true);
        setStatusKey('statusIdle');
        return;
      }

      const next = { ...settings, outputDeviceId: virtual.deviceId, enabled: true };
      setSettings(next);

      const systemHint = platform === 'darwin' ? 'BlackHole' : 'CABLE Output';
      setStatus('statusApplying');
      const res = await window.boysChanger.setSystemInput(systemHint);

      if (!engineOn) {
        await startEngine(true, next);
      } else {
        engineRef.current.applySettings(next);
        const sinkOk = await engineRef.current.applyOutputDevice(next.outputDeviceId);
        if (!sinkOk) {
          setSystemMsg(`${tr('sinkFailed')} — ${tr('telegramDoneTip')}`);
          return;
        }
        setStatus('statusOn');
      }

      const tip = tr('telegramDoneTip');
      setSystemMsg(res.ok ? `${res.message} — ${tip}` : `${res.message} — ${tip}`);
      if (!res.ok) {
        await window.boysChanger.openSoundInputSettings();
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void listVoicePresets().then(setVoicePresets);
  }, []);

  useEffect(() => {
    if (tab !== 'main') return;
    void listSounds()
      .then(setDashSounds)
      .catch(() => setDashSounds([]));
  }, [tab]);

  const refreshVoicePresets = useCallback(async () => {
    setVoicePresets(await listVoicePresets());
  }, []);

  const selectPreset = useCallback((preset: VoicePreset) => {
    setActivePresetId(preset.id);
    setSettings((s) => applyPayloadToSettings(s, preset.payload));
    setSaveName(preset.source === 'user' ? preset.name : '');
  }, []);

  const handleSaveVoice = async () => {
    setSaveBusy(true);
    try {
      const name =
        saveName.trim() ||
        `${tr(`gender_${settings.gender}` as MessageKey)} ${tr(`age_${settings.age}` as MessageKey)}`;
      const existingUser =
        activePresetId && !activePresetId.startsWith('builtin-')
          ? voicePresets.find((p) => p.id === activePresetId)
          : undefined;
      const saved = await saveVoicePreset(name, settings, {
        id: existingUser?.id,
        color: existingUser?.color,
        emoji: existingUser?.emoji,
      });
      setActivePresetId(saved.id);
      setSaveName(saved.name);
      setSystemMsg(tr('studioSaved'));
      await refreshVoicePresets();
    } finally {
      setSaveBusy(false);
    }
  };

  const handleDeleteVoice = async (id: string) => {
    await deleteVoicePreset(id);
    if (activePresetId === id) setActivePresetId(null);
    await refreshVoicePresets();
  };

  const refreshCableStatus = useCallback(async () => {
    const st = await window.boysChanger?.virtualCableStatus();
    if (!st) return;
    setCableInstallerReady(Boolean(st.installerAvailable));
    setCableOsInstalled(Boolean(st.installed));
  }, []);

  useEffect(() => {
    void refreshCableStatus();
  }, [refreshCableStatus]);

  /** When a virtual cable appears, auto-select it as Output once. */
  useEffect(() => {
    if (settings.outputDeviceId) return;
    const virtual = outputs.find((d) => looksLikeVirtualOutput(d.label));
    if (!virtual) return;
    setSettings((prev) =>
      prev.outputDeviceId ? prev : { ...prev, outputDeviceId: virtual.deviceId },
    );
  }, [outputs, settings.outputDeviceId]);

  const installVirtualCable = async () => {
    if (!window.boysChanger) {
      setStatus('statusNeedDesktop');
      return;
    }
    if (platform === 'darwin') {
      await window.boysChanger.openExternal('https://existential.audio/blackhole/');
      return;
    }
    if (!cableInstallerReady) {
      await window.boysChanger.openExternal('https://www.vb-cable.com/');
      return;
    }
    setCableInstallBusy(true);
    setSystemMsg(tr('cableInstallBusy'));
    try {
      const res = await window.boysChanger.installVirtualCable();
      setSystemMsg(res.ok ? tr('cableInstallOk') : tr('cableInstallFail', { error: res.message }));
      await refreshCableStatus();
      await refreshDevices();
    } finally {
      setCableInstallBusy(false);
    }
  };
  const cablePresent = useMemo(
    () =>
      cableOsInstalled ||
      outputs.some((d) => looksLikeVirtualOutput(d.label)) ||
      inputs.some((d) => /cable output|vb-audio virtual cable|blackhole/i.test(d.label)),
    [cableOsInstalled, outputs, inputs],
  );
  const outputIsCable = useMemo(() => {
    if (!settings.outputDeviceId) return false;
    const label = outputs.find((d) => d.deviceId === settings.outputDeviceId)?.label || '';
    return looksLikeVirtualOutput(label);
  }, [outputs, settings.outputDeviceId]);

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
  const changerOn = Boolean(settings.enabled && engineOn);
  const activePreset = voicePresets.find((p) => p.id === activePresetId) || null;
  const activeVariant: SceneVariant = activePreset
    ? activePreset.id.includes('robot')
      ? 'gear'
      : activePreset.id.includes('radio')
        ? 'speaker'
        : activePreset.id.includes('clean')
          ? 'mic'
          : activePreset.id.includes('alien')
            ? 'crystal'
            : activePreset.id.includes('chipmunk')
              ? 'orb'
              : activePreset.id.includes('elder') || activePreset.id.includes('hero')
                ? 'flask'
                : activePreset.id.includes('girl') || activePreset.id.includes('bright')
                  ? 'ring'
                  : variantFromSeed(activePreset.id)
    : 'logo';

  const navVariant = (id: AppTab): SceneVariant => {
    if (id === 'main') return 'logo';
    if (id === 'voices') return 'mic';
    if (id === 'sounds') return 'speaker';
    if (id === 'studio') return 'flask';
    return 'gear';
  };

  const playDashSound = async (sound: LibrarySound) => {
    stopLibrary();
    setDashPlayingId(null);
    const ready = engineOn || (await ensureEngineForSounds());
    if (!ready) {
      setSystemMsg(tr('soundsNeedEngine'));
      return;
    }
    try {
      setDashPlayingId(sound.id);
      const buffer = await getSoundArrayBuffer(sound.id);
      const duration = await playLibraryBuffer(buffer);
      window.setTimeout(() => {
        setDashPlayingId((cur) => (cur === sound.id ? null : cur));
      }, Math.max(400, duration * 1000 + 80));
    } catch (e) {
      setDashPlayingId(null);
      setSystemMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const studioPanel = (
    <>
      <div className="active-voice-card">
        <div className="active-voice-art">
          <VoiceScene3D
            density="compact"
            variant={activeVariant}
            accent={activePreset?.color || '#d4ff4a'}
            className="voice-scene-3d compact"
            priority="hero"
          />
        </div>
        <div className="active-voice-meta">
          <p className="eyebrow">{tr('studioActive')}</p>
          <h3>{activePreset?.name || tr('studioTitle')}</h3>
          <p className="hint">{tr('studioFree')}</p>
        </div>
      </div>

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

      <div className="effects-grid compact">
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

      <div className="studio-save-row">
        <input
          type="text"
          value={saveName}
          placeholder={tr('studioNamePlaceholder')}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button
          type="button"
          className="primary-action"
          disabled={saveBusy}
          onClick={() => void handleSaveVoice()}
        >
          {tr('studioSave')}
        </button>
      </div>

      <PrehearPanel
        state={prehear}
        engineRunning={engineOn}
        labels={{
          title: tr('prehear'),
          hint: systemMsg || tr('prehearHint'),
          seekHint: tr('prehearSeekHint'),
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
        onSeek={(seconds) => {
          engineRef.current.seekPrehear(seconds);
        }}
      />
    </>
  );

  return (
    <div className="app-shell">
      <aside className="nav-rail" aria-label="Main">
        <div className="nav-logo" title="BoysChanger">
          <VoiceScene3D
            density="card"
            variant="logo"
            accent="#d4ff4a"
            className="voice-scene-3d card"
            lazy={false}
            priority="nav"
          />
        </div>
        {(
          [
            ['main', tr('navMain')],
            ['voices', tr('navVoices')],
            ['sounds', tr('navSounds')],
            ['studio', tr('navStudio')],
            ['settings', tr('navSettings')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'nav-item active' : 'nav-item'}
            title={label}
            onClick={() => setTab(id)}
          >
            <span className="nav-icon-3d" aria-hidden>
              <VoiceScene3D
                density="card"
                variant={navVariant(id)}
                accent={tab === id ? '#0c1210' : '#d4ff4a'}
                className="voice-scene-3d card"
                lazy={false}
                priority="nav"
              />
            </span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
        <div className="nav-spacer" />
        <span className="nav-version">v{version}</span>
      </aside>

      <div className="shell-body">
        <header className="shell-top">
          <div className="shell-brand">
            <h1>BoysChanger</h1>
            <p>{tr('eyebrow')}</p>
          </div>
          <input
            className="shell-search"
            type="search"
            placeholder={tr('searchApp')}
            readOnly
            tabIndex={-1}
          />
          <div className="shell-top-actions">
            <label className="lang-inline">
              <span>{tr('language')}</span>
              <select
                value={locale}
                onChange={(e) => {
                  const next = e.target.value as Locale;
                  localStorage.setItem('boyschanger-locale-user', next);
                  setLocale(next);
                }}
              >
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
            {updateNote ? <span className="update-note">{updateNote}</span> : null}
          </div>
        </header>

        <div className="shell-content">
          <main className="shell-center">
            {tab === 'main' ? (
              <section className="home-hub">
                <div className="dash-live">
                  <div className="dash-live-copy">
                    <h2>{tr('homeTitle')}</h2>
                    <p>{tr('homeLede')}</p>
                    <div className="dash-live-actions">
                      <button
                        type="button"
                        className={`primary-action ${changerOn ? 'on' : ''}`}
                        disabled={busy}
                        onClick={() => void toggleChanger()}
                      >
                        {changerOn ? tr('homeChangerOn') : tr('homeChangerOff')}
                      </button>
                      <label
                        className={`dock-monitor dash-monitor ${settings.monitorLocally ? 'on' : ''}`}
                        title={tr('monitorHint')}
                      >
                        <input
                          type="checkbox"
                          checked={settings.monitorLocally}
                          onChange={(e) => {
                            const on = e.target.checked;
                            update('monitorLocally', on);
                            if (on) {
                              setSystemMsg(tr('monitorHint'));
                              if (!engineOn) {
                                void startEngine(true, { ...settings, monitorLocally: true });
                              }
                            }
                          }}
                        />
                        <span>{tr('dockHearMyself')}</span>
                      </label>
                    </div>
                    <div className="dash-meter" aria-hidden>
                      <div className="meter-fill" style={{ width: `${meterWidth}%` }} />
                    </div>
                    <p className="dash-status">{tr(statusKey, statusVars)}</p>
                  </div>
                  <div className="library-hero-art" aria-hidden>
                    <VoiceScene3D
                      density="compact"
                      variant="logo"
                      accent="#d4ff4a"
                      className="voice-scene-3d compact"
                      priority="hero"
                    />
                  </div>
                </div>

                <article className="dash-panel">
                  <header className="dash-panel-head">
                    <div>
                      <h3>{tr('navVoices')}</h3>
                      <p>{tr('homeVoicesDesc')}</p>
                    </div>
                    <button type="button" className="secondary" onClick={() => setTab('voices')}>
                      {tr('homeMore')}
                    </button>
                  </header>
                  <div className="dash-voice-row">
                    {voicePresets.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`dash-voice-chip ${activePresetId === p.id ? 'active' : ''}`}
                        style={{ '--card-accent': p.color } as React.CSSProperties}
                        onClick={() => selectPreset(p)}
                      >
                        <span className="dash-voice-3d" aria-hidden>
                          <VoiceScene3D
                            density="card"
                            variant={
                              p.id.includes('robot')
                                ? 'gear'
                                : p.id.includes('radio')
                                  ? 'speaker'
                                  : p.id.includes('clean')
                                    ? 'mic'
                                    : p.id.includes('alien')
                                      ? 'crystal'
                                      : p.id.includes('chipmunk')
                                        ? 'orb'
                                        : p.id.includes('elder') || p.id.includes('hero')
                                          ? 'flask'
                                          : p.id.includes('girl')
                                            ? 'ring'
                                            : variantFromSeed(p.id)
                            }
                            accent={p.color}
                            className="voice-scene-3d card"
                            lazy
                            priority="card"
                          />
                        </span>
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="dash-panel">
                  <header className="dash-panel-head">
                    <div>
                      <h3>{tr('navSounds')}</h3>
                      <p>{tr('homeSoundsDesc')}</p>
                    </div>
                    <button type="button" className="secondary" onClick={() => setTab('sounds')}>
                      {tr('homeMore')}
                    </button>
                  </header>
                  {dashSounds.length === 0 ? (
                    <p className="hint">{tr('soundsEmpty')}</p>
                  ) : (
                    <div className="dash-sound-row">
                      {dashSounds.slice(0, 8).map((s) => {
                        const color = `hsl(${[...s.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 90% 62%)`;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`dash-sound-chip ${dashPlayingId === s.id ? 'active' : ''}`}
                            style={{ '--card-accent': color } as React.CSSProperties}
                            onClick={() => void playDashSound(s)}
                          >
                            <span className="dash-voice-3d" aria-hidden>
                              <VoiceScene3D
                                density="card"
                                variant={s.source === 'user' ? 'wave' : 'speaker'}
                                accent={color}
                                className="voice-scene-3d card"
                                lazy
                                priority="card"
                              />
                            </span>
                            <span>{dashPlayingId === s.id ? tr('soundsPlaying') : s.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </article>

                <article className="dash-panel">
                  <header className="dash-panel-head">
                    <div>
                      <h3>{tr('navStudio')}</h3>
                      <p>{tr('homeStudioDesc')}</p>
                    </div>
                    <button type="button" className="secondary" onClick={() => setTab('studio')}>
                      {tr('homeMore')}
                    </button>
                  </header>
                  <div className="preset-row dash-studio-row">
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
                  <div className="preset-row dash-studio-row">
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
                  <div className="effects-grid compact dash-fx">
                    {FX_IDS.slice(0, 4).map((id) => (
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
                </article>

                <article className="dash-panel">
                  <header className="dash-panel-head">
                    <div>
                      <h3>{tr('audioRouting')}</h3>
                      <p>{tr('homeSettingsDesc')}</p>
                    </div>
                    <button type="button" className="secondary" onClick={() => setTab('settings')}>
                      {tr('homeMore')}
                    </button>
                  </header>
                  <div className="dash-route-grid">
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
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="dash-route-actions">
                    <button type="button" className="primary-action" onClick={() => setTelegramGuideOpen(true)}>
                      {tr('telegramGuideBtn')}
                    </button>
                    <span className={`dash-cable ${cablePresent ? 'ok' : 'bad'}`}>
                      {cablePresent ? tr('telegramCableOk') : tr('cableStatusMissing')}
                    </span>
                  </div>
                </article>
              </section>
            ) : null}

            {tab === 'voices' ? (
              <VoiceLibraryPanel
                presets={voicePresets}
                activeId={activePresetId}
                labels={{
                  title: tr('voicesTitle'),
                  builtin: tr('voicesBuiltin'),
                  mine: tr('voicesMine'),
                  all: tr('voicesAll'),
                  search: tr('voicesSearch'),
                  emptyMine: tr('voicesEmptyMine'),
                  freeBadge: tr('voicesFree'),
                  delete: tr('voicesDelete'),
                  cloudSoon: tr('voicesCloudSoon'),
                }}
                onSelect={(p) => {
                  selectPreset(p);
                  setTab('studio');
                }}
                onDelete={(id) => void handleDeleteVoice(id)}
              />
            ) : null}

            {tab === 'sounds' ? (
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
            ) : null}

            {tab === 'studio' ? (
              <section className="panel studio-main">
                <h2>{tr('studioTitle')}</h2>
                <p className="hint">{tr('studioFree')}</p>
                {studioPanel}
              </section>
            ) : null}

            {tab === 'settings' ? (
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
                  <button
                    type="button"
                    className="primary-action"
                    disabled={busy}
                    onClick={() => void setupForTelegram()}
                  >
                    {tr('telegramSetupBtn')}
                  </button>
                  <button type="button" className="secondary" onClick={() => setTelegramGuideOpen(true)}>
                    {tr('telegramGuideBtn')}
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
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => void stopEngine()}
                    >
                      {tr('stopEngine')}
                    </button>
                  )}
                </div>
                <ul className="telegram-checks inline-status">
                  <li className={cablePresent ? 'ok' : 'bad'}>
                    {cablePresent ? tr('telegramCableOk') : tr('cableStatusMissing')}
                  </li>
                  <li className={outputIsCable ? 'ok' : 'bad'}>
                    {outputIsCable ? tr('telegramOutputOk') : tr('telegramOutputNeed')}
                  </li>
                </ul>
                <footer className="footer">
                  <span>
                    {tr('footer')} · v{version}
                  </span>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => void window.boysChanger?.openLogFolder()}
                  >
                    {tr('openLogs')}
                  </button>
                </footer>
              </section>
            ) : null}
          </main>

          {tab === 'voices' ? (
            <aside className="shell-right">
              <h2>{tr('voiceCharacter')}</h2>
              {studioPanel}
            </aside>
          ) : null}
        </div>
      </div>

      <div className="dock-bar" role="toolbar" aria-label="Voice controls">
        <button
          type="button"
          className={`dock-power ${changerOn ? 'on' : 'off'}`}
          disabled={busy}
          title={tr('powerHint')}
          onClick={() => void toggleChanger()}
        >
          ⏻
        </button>
        <button
          type="button"
          className={`dock-mic ${changerOn ? 'on' : ''}`}
          disabled={busy}
          onClick={() => void toggleChanger()}
        >
          <VoiceScene3D
            density="card"
            variant="mic"
            accent={changerOn ? '#0c1210' : '#d4ff4a'}
            className="voice-scene-3d card"
            lazy={false}
            priority="nav"
          />
        </button>
        <label className={`dock-monitor ${settings.monitorLocally ? 'on' : ''}`} title={tr('monitorHint')}>
          <input
            type="checkbox"
            checked={settings.monitorLocally}
            onChange={(e) => {
              const on = e.target.checked;
              update('monitorLocally', on);
              if (on) {
                setSystemMsg(tr('monitorHint'));
                if (!engineOn) void startEngine(true, { ...settings, monitorLocally: true });
              }
            }}
          />
          <span>👂 {tr('dockHearMyself')}</span>
        </label>
        <button type="button" className="dock-fx" onClick={() => setTab('studio')} title={tr('dockEffects')}>
          ⚡
        </button>
        <div className="dock-meter" aria-hidden>
          <div className="meter-fill" style={{ width: `${meterWidth}%` }} />
        </div>
        <p className="dock-status">{tr(statusKey, statusVars)}</p>
      </div>

      <TelegramGuideModal
        open={telegramGuideOpen}
        onClose={() => setTelegramGuideOpen(false)}
        platform={platform}
        cablePresent={cablePresent}
        cableInstallerReady={cableInstallerReady}
        outputIsCable={outputIsCable}
        engineOn={engineOn}
        busy={busy}
        cableInstallBusy={cableInstallBusy}
        tr={tr}
        onSetup={() => {
          setTelegramGuideOpen(false);
          void setupForTelegram();
        }}
        onInstallCable={() => void installVirtualCable()}
        onOpenSound={() => void window.boysChanger?.openSoundInputSettings()}
      />
    </div>
  );
}

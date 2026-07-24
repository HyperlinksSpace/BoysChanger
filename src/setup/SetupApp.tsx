import React, { useEffect, useState } from 'react';

type Step = 'welcome' | 'install' | 'done';

type SetupApi = {
  getDefaults: () => Promise<{ installPath: string; version: string; hasPayload: boolean }>;
  pickFolder: () => Promise<string | null>;
  startInstall: (installPath: string) => Promise<{ ok: boolean; message: string }>;
  onProgress: (cb: (p: { phase: string; percent: number; detail?: string }) => void) => () => void;
  rebootNow: () => Promise<void>;
  launchApp: () => Promise<void>;
  quit: () => Promise<void>;
};

declare global {
  interface Window {
    boysSetup?: SetupApi;
  }
}

export function SetupApp() {
  const api = window.boysSetup;
  const [step, setStep] = useState<Step>('welcome');
  const [installPath, setInstallPath] = useState('');
  const [version, setVersion] = useState('');
  const [hasPayload, setHasPayload] = useState(true);
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!api) return;
    void api.getDefaults().then((d) => {
      setInstallPath(d.installPath);
      setVersion(d.version);
      setHasPayload(d.hasPayload);
    });
    return api.onProgress((p) => {
      setPercent(p.percent);
      setPhase(p.phase);
      setDetail(p.detail || '');
    });
  }, [api]);

  const browse = async () => {
    if (!api) return;
    const picked = await api.pickFolder();
    if (picked) setInstallPath(picked);
  };

  const install = async () => {
    if (!api) return;
    setBusy(true);
    setError('');
    setStep('install');
    setPercent(0);
    try {
      const res = await api.startInstall(installPath);
      if (!res.ok) {
        setError(res.message);
        setStep('welcome');
        return;
      }
      setStep('done');
    } catch (e) {
      setError(String(e));
      setStep('welcome');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setup-shell">
      <div className="setup-glow" aria-hidden />
      <header className="setup-top">
        <div className="setup-brand">
          <img src="./logo.png" alt="" width={40} height={40} />
          <div>
            <h1>BoysChanger</h1>
            <p>Setup {version ? `v${version}` : ''}</p>
          </div>
        </div>
        <button type="button" className="setup-x" onClick={() => void api?.quit()} aria-label="Close">
          ×
        </button>
      </header>

      <main className="setup-main">
        {step === 'welcome' ? (
          <section className="setup-card">
            <p className="setup-kicker">System-wide voice studio</p>
            <h2>Install BoysChanger</h2>
            <p className="setup-lead">
              Voice character, effects, and Telegram routing — with VB-CABLE bundled so other apps
              can use your changed voice as a microphone.
            </p>
            {!hasPayload ? (
              <p className="setup-error">Setup payload missing. Rebuild with npm run pack:win.</p>
            ) : null}
            {error ? <p className="setup-error">{error}</p> : null}
            <label className="setup-path">
              <span>Install location</span>
              <div className="setup-path-row">
                <input value={installPath} onChange={(e) => setInstallPath(e.target.value)} />
                <button type="button" className="setup-ghost" onClick={() => void browse()}>
                  Browse
                </button>
              </div>
            </label>
            <ul className="setup-bullets">
              <li>Quietly installs VB-CABLE (VB-Audio donationware)</li>
              <li>A reboot activates CABLE Output for Telegram</li>
              <li>You can reboot now or later when setup finishes</li>
            </ul>
            <div className="setup-actions">
              <button type="button" className="setup-primary" disabled={busy || !hasPayload} onClick={() => void install()}>
                Install
              </button>
              <button type="button" className="setup-ghost" onClick={() => void api?.quit()}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {step === 'install' ? (
          <section className="setup-card">
            <p className="setup-kicker">Installing</p>
            <h2>{phase || 'Working…'}</h2>
            <p className="setup-lead">{detail || 'Please wait'}</p>
            <div className="setup-bar" aria-hidden>
              <div className="setup-bar-fill" style={{ width: `${Math.max(4, percent)}%` }} />
            </div>
            <p className="setup-pct">{Math.round(percent)}%</p>
          </section>
        ) : null}

        {step === 'done' ? (
          <section className="setup-card">
            <p className="setup-kicker">Ready</p>
            <h2>Installation complete</h2>
            <p className="setup-lead">
              Windows needs a reboot so <strong>CABLE Output</strong> appears as a microphone for
              Telegram and other apps. Without it, the voice changer cannot be used system-wide.
            </p>
            <p className="setup-note">VB-CABLE is donationware by VB-Audio — www.vb-cable.com</p>
            <div className="setup-actions">
              <button type="button" className="setup-primary" onClick={() => void api?.rebootNow()}>
                Reboot now
              </button>
              <button
                type="button"
                className="setup-ghost"
                onClick={() => void api?.launchApp().then(() => api.quit())}
              >
                Reboot later — open BoysChanger
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

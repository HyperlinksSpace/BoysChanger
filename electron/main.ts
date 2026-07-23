import fs from 'node:fs';
import https from 'node:https';
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeImage,
  shell,
  systemPreferences,
} from 'electron';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { autoUpdater } from 'electron-updater';
import {
  getLogPaths,
  getPrimaryLogPath,
  initLogger,
  logError,
  logInfo,
  logWarn,
  readTail,
} from './logger';

const execFileAsync = promisify(execFile);

const GH_OWNER = 'HyperlinksSpace';
const GH_REPO = 'BoysChanger';

/** Must match package.json build.appId — required for Windows taskbar pin identity. */
const APP_USER_MODEL_ID = 'com.hyperlinksspace.boyschanger';

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;
let changerActive = false;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let updateCheckInFlight = false;
let lastUpdateCheckAt = 0;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function assetCandidates(...names: string[]): string[] {
  const roots = [
    path.join(__dirname, '../build'),
    path.join(__dirname, '../public'),
    process.resourcesPath || '',
    process.env.VITE_PUBLIC || '',
    path.join(__dirname, '../dist'),
  ];
  const out: string[] = [];
  for (const root of roots) {
    if (!root) continue;
    for (const name of names) {
      out.push(path.join(root, name));
    }
  }
  return out;
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((p) => p && fs.existsSync(p));
}

function resolveIconPath() {
  return firstExisting(
    assetCandidates('icon.ico', 'icon.png', 'logo.png'),
  );
}

function resolveOverlayPath(on: boolean) {
  return firstExisting(
    assetCandidates(on ? 'overlay-on.png' : 'overlay-off.png'),
  );
}

function resolveStatusIconPath(on: boolean) {
  return firstExisting(
    assetCandidates(on ? 'icon-status-on.png' : 'icon-status-off.png', 'icon.png'),
  );
}

function applyChangerStatus(on: boolean) {
  changerActive = on;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (process.platform === 'win32') {
    const overlayPath = resolveOverlayPath(on);
    if (overlayPath) {
      const overlay = nativeImage.createFromPath(overlayPath);
      if (!overlay.isEmpty()) {
        mainWindow.setOverlayIcon(overlay, on ? 'BoysChanger ON' : 'BoysChanger OFF');
      }
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
    // Keep the base window icon pinned to the .ico so taskbar shortcuts stay valid
    const base = resolveIconPath();
    if (base) {
      try {
        mainWindow.setIcon(base);
      } catch {
        /* */
      }
    }
  } else if (process.platform === 'darwin') {
    const statusPath = resolveStatusIconPath(on);
    if (statusPath && app.dock) {
      const img = nativeImage.createFromPath(statusPath);
      if (!img.isEmpty()) {
        app.dock.setIcon(img);
      }
    }
  }
}

function createWindow() {
  const icon = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: `BoysChanger v${app.getVersion()}`,
    backgroundColor: '#0c1210',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  if (process.platform === 'win32') {
    // Helps Windows keep the same identity when pinning from the running window
    mainWindow.setAppDetails({
      appId: APP_USER_MODEL_ID,
      appIconPath: icon && icon.endsWith('.ico') ? icon : undefined,
      appIconIndex: 0,
      relaunchDisplayName: 'BoysChanger',
      relaunchCommand: app.isPackaged ? process.execPath : undefined,
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    applyChangerStatus(false);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err);
  return /ERR_CONNECTION_CLOSED|ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_TIMED_OUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|TLS|SSL/i.test(
    msg,
  );
}

function httpsJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `BoysChanger/${app.getVersion()}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...headers,
        },
        timeout: 20000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsJson<T>(res.headers.location, headers).then(resolve, reject);
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`GitHub API HTTP ${res.statusCode}: ${body.slice(0, 180)}`));
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('GitHub API timeout'));
    });
    req.on('error', reject);
  });
}

function parseSemver(v: string): number[] | null {
  const m = String(v)
    .replace(/^v/i, '')
    .split(/[+-]/)[0]
    .split('.')
    .map((p) => Number(p));
  if (m.length < 1 || m.some((n) => Number.isNaN(n))) return null;
  while (m.length < 3) m.push(0);
  return m.slice(0, 3);
}

function isNewerVersion(remote: string, local: string): boolean {
  const a = parseSemver(remote);
  const b = parseSemver(local);
  if (!a || !b) return remote.replace(/^v/i, '') !== local.replace(/^v/i, '');
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

type GhRelease = { tag_name?: string; html_url?: string; prerelease?: boolean; draft?: boolean };

async function fetchLatestReleaseViaApi(): Promise<{ tag: string; url: string }> {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const data = await httpsJson<GhRelease>(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases/latest`,
    headers,
  );
  const tag = data.tag_name || '';
  if (!tag) throw new Error('GitHub latest release has no tag');
  return {
    tag,
    url: data.html_url || `https://github.com/${GH_OWNER}/${GH_REPO}/releases/tag/${tag}`,
  };
}

function configureGithubFeed() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GH_OWNER,
    repo: GH_REPO,
    private: Boolean(token),
    token: token || undefined,
  });
  autoUpdater.requestHeaders = {
    'User-Agent': `BoysChanger/${app.getVersion()} (${process.platform})`,
  };
}

function configureGenericReleaseFeed(tag: string) {
  // Direct asset folder for that tag — often more reliable than the GitHub provider path.
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: `https://github.com/${GH_OWNER}/${GH_REPO}/releases/download/${tag}/`,
  });
  autoUpdater.requestHeaders = {
    'User-Agent': `BoysChanger/${app.getVersion()} (${process.platform})`,
  };
}

async function checkForUpdatesResilient(reason: string, manual = false) {
  if (!app.isPackaged) return { ok: false as const, message: 'dev' };
  if (updateCheckInFlight) return { ok: false as const, message: 'busy' };
  updateCheckInFlight = true;
  lastUpdateCheckAt = Date.now();

  const send = (status: string, version?: string, message?: string) => {
    logInfo('updater', status, { version, message, reason, manual });
    mainWindow?.webContents.send('update-status', { status, version, message });
  };

  const attempts = manual ? 4 : 3;
  let lastErr: unknown;

  try {
    configureGithubFeed();
    for (let i = 0; i < attempts; i++) {
      try {
        logInfo('updater', 'check attempt', { reason, attempt: i + 1, attempts });
        if (i === 0 || manual) send('checking');
        const result = await autoUpdater.checkForUpdates();
        return { ok: true as const, version: result?.updateInfo?.version };
      } catch (err) {
        lastErr = err;
        logWarn('updater', 'check attempt failed', {
          attempt: i + 1,
          err: String(err),
          transient: isTransientNetworkError(err),
        });
        if (!isTransientNetworkError(err) || i === attempts - 1) break;
        await sleep(1200 * Math.pow(2, i));
      }
    }

    // Fallback: GitHub REST API + generic feed for that release tag
    logInfo('updater', 'trying GitHub API fallback');
    const latest = await fetchLatestReleaseViaApi();
    const local = app.getVersion();
    const remote = latest.tag.replace(/^v/i, '');
    if (!isNewerVersion(remote, local)) {
      send('not-available', local);
      return { ok: true as const, version: local };
    }

    configureGenericReleaseFeed(latest.tag);
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true as const, version: result?.updateInfo?.version || remote };
    } catch (err) {
      logWarn('updater', 'generic feed failed after API found newer version', {
        remote,
        err: String(err),
      });
      // Soft success: tell UI an update exists and open releases if manual
      send('available', remote, 'open');
      if (manual) {
        void shell.openExternal(latest.url);
      }
      return {
        ok: true as const,
        version: remote,
        message: `Update ${remote} available — download page opened`,
      };
    }
  } catch (err) {
    lastErr = err;
    const msg = err instanceof Error ? err.message : String(err);
    const soft = isTransientNetworkError(lastErr) || isTransientNetworkError(err);
    logError('updater', 'check failed', { err: msg, soft, reason, manual });
    // Background polls: don't scare the UI with raw Chromium net errors
    if (manual || !soft) {
      send('error', undefined, soft ? 'network' : msg);
    } else {
      send('error', undefined, 'network-soft');
    }
    return { ok: false as const, message: msg };
  } finally {
    updateCheckInFlight = false;
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    logInfo('updater', 'skipped in dev (not packaged)');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.allowDowngrade = false;
  configureGithubFeed();

  const send = (status: string, version?: string, message?: string) => {
    logInfo('updater', status, { version, message });
    mainWindow?.webContents.send('update-status', { status, version, message });
  };

  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) => send('available', info.version));
  autoUpdater.on('update-not-available', (info) =>
    send('not-available', info?.version ?? app.getVersion()),
  );
  autoUpdater.on('error', (err) => {
    const msg = err?.message ? String(err.message) : String(err);
    logError('updater', msg);
    // Avoid duplicate noisy UI if resilient check already reported it
    if (isTransientNetworkError(err)) {
      send('error', undefined, 'network-soft');
    } else {
      send('error', undefined, msg);
    }
  });
  autoUpdater.on('download-progress', (p) => {
    send('available', undefined, `${Math.round(p.percent)}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    send('downloaded', info.version);
    setTimeout(() => {
      logInfo('updater', 'quitAndInstall', { version: info.version });
      autoUpdater.quitAndInstall(false, true);
    }, 800);
  });

  const check = (reason: string, manual = false) => {
    void checkForUpdatesResilient(reason, manual);
  };

  setTimeout(() => check('startup'), 8000);
  setTimeout(() => check('startup-retry'), 45000);
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => {
    if (Date.now() - lastUpdateCheckAt < 1000 * 60 * 10) return;
    check('interval');
  }, 1000 * 60 * 30);
}

async function ensureMicPermission(): Promise<boolean> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') return true;
    return systemPreferences.askForMediaAccess('microphone');
  }
  return true;
}

async function setSystemInputDevice(deviceHint: string): Promise<{ ok: boolean; message: string }> {
  const hint = deviceHint.toLowerCase();

  if (process.platform === 'win32') {
    const script = `
$ErrorActionPreference = 'Stop'
try {
  Import-Module AudioDeviceCmdlets -ErrorAction Stop
  $dev = Get-AudioDevice -List | Where-Object { $_.Type -eq 'Recording' -and ($_.Name -match '${deviceHint.replace(/'/g, "''")}' -or $_.Name -match 'CABLE|VoiceMeeter|VB-Audio') } | Select-Object -First 1
  if (-not $dev) { throw 'Virtual cable recording device not found. Install VB-Cable and select CABLE Output.' }
  Set-AudioDevice -ID $dev.ID | Out-Null
  Write-Output ("OK:" + $dev.Name)
} catch {
  Write-Output ("ERR:" + $_.Exception.Message)
}
`;
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { windowsHide: true, timeout: 15000 },
      );
      const out = stdout.trim();
      if (out.startsWith('OK:')) {
        return { ok: true, message: `System input set to ${out.slice(3)}` };
      }
      return {
        ok: false,
        message:
          out.replace(/^ERR:/, '') ||
          'Could not set system input. Install VB-Cable, then optionally AudioDeviceCmdlets.',
      };
    } catch (e) {
      return {
        ok: false,
        message: `Windows system input change failed. Set default recording device to CABLE Output. (${String(e)})`,
      };
    }
  }

  if (process.platform === 'darwin') {
    try {
      const { stdout: list } = await execFileAsync('SwitchAudioSource', ['-a', '-t', 'input']);
      const lines = list.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const match =
        lines.find((l) => l.toLowerCase().includes(hint)) ||
        lines.find((l) => /blackhole|vb-cable|cable/i.test(l));
      if (!match) {
        return {
          ok: false,
          message:
            'Virtual input not found. Install BlackHole 2ch, then set it as the system microphone.',
        };
      }
      await execFileAsync('SwitchAudioSource', ['-t', 'input', '-s', match]);
      return { ok: true, message: `System input set to ${match}` };
    } catch {
      return {
        ok: false,
        message:
          'Install BlackHole 2ch and optionally SwitchAudioSource (brew install switchaudio-osx).',
      };
    }
  }

  return { ok: false, message: 'System input switching is supported on Windows and macOS only.' };
}

function detectVirtualCableHints(): string[] {
  if (process.platform === 'win32') {
    return ['CABLE Output', 'VoiceMeeter Output', 'VB-Audio'];
  }
  if (process.platform === 'darwin') {
    return ['BlackHole 2ch', 'BlackHole', 'VB-Cable'];
  }
  return [];
}

app.whenReady().then(async () => {
  initLogger();
  await ensureMicPermission();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('platform', () => process.platform);
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-locale', () => app.getLocale());
ipcMain.handle('ensure-mic-permission', async () => ensureMicPermission());
ipcMain.handle('virtual-cable-hints', () => detectVirtualCableHints());
ipcMain.handle('set-system-input', async (_evt, deviceHint: string) =>
  setSystemInputDevice(deviceHint || (detectVirtualCableHints()[0] ?? '')),
);
ipcMain.handle('open-external', async (_evt, url: string) => {
  await shell.openExternal(url);
});
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { ok: false, message: 'dev' };
  return checkForUpdatesResilient('manual', true);
});
ipcMain.handle('set-changer-status', (_evt, on: boolean) => {
  applyChangerStatus(Boolean(on));
  return { ok: true, on: changerActive };
});
ipcMain.handle(
  'debug-log',
  (_evt, payload: { level?: string; scope?: string; message?: string; data?: unknown }) => {
    const level = (payload?.level || 'info').toLowerCase();
    const scope = payload?.scope || 'renderer';
    const message = payload?.message || '';
    if (level === 'error') logError(scope, message, payload?.data);
    else if (level === 'warn') logWarn(scope, message, payload?.data);
    else logInfo(scope, message, payload?.data);
    return { ok: true };
  },
);
ipcMain.handle('get-log-path', () => ({
  primary: getPrimaryLogPath(),
  paths: getLogPaths(),
}));
ipcMain.handle('read-debug-log', (_evt, maxLines?: number) => readTail(maxLines ?? 250));
ipcMain.handle('open-log-folder', async () => {
  const dir = path.dirname(getPrimaryLogPath());
  await shell.openPath(dir);
  return { ok: true, path: dir };
});

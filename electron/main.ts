import fs from 'node:fs';
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

function setupAutoUpdater() {
  if (!app.isPackaged) {
    logInfo('updater', 'skipped in dev (not packaged)');
    return;
  }

  // Public GitHub Releases need no token. For private repos set GH_TOKEN / GITHUB_TOKEN.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.allowDowngrade = false;

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
    logError('updater', err?.message ? String(err.message) : String(err));
    send('error', undefined, err?.message ? String(err.message) : String(err));
  });
  autoUpdater.on('download-progress', (p) => {
    send('available', undefined, `${Math.round(p.percent)}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    send('downloaded', info.version);
    // Seamless install: relaunch into the new version (Electron requires a restart).
    setTimeout(() => {
      logInfo('updater', 'quitAndInstall', { version: info.version });
      autoUpdater.quitAndInstall(false, true);
    }, 800);
  });

  const check = (reason: string) => {
    logInfo('updater', 'checkForUpdates', { reason });
    void autoUpdater.checkForUpdates().catch((err) => {
      logError('updater', 'check failed', { err: String(err) });
      send('error', undefined, err instanceof Error ? err.message : String(err));
    });
  };

  // Poll GitHub Releases API periodically (no webhook needed for public repos).
  setTimeout(() => check('startup'), 5000);
  setTimeout(() => check('startup-retry'), 30000);
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => check('interval'), 1000 * 60 * 30);

  app.on('browser-window-focus', () => {
    // Light debounce via last-check would be nicer; interval + focus is enough.
  });
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
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version };
  } catch (e) {
    logError('updater', 'manual check failed', { err: String(e) });
    return { ok: false, message: String(e) };
  }
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

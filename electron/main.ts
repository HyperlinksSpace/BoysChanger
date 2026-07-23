import fs from 'node:fs';
import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  systemPreferences,
} from 'electron';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, '../build/icon.png'),
    path.join(process.env.VITE_PUBLIC ?? '', 'logo.png'),
    path.join(__dirname, '../public/logo.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function createWindow() {
  const icon = resolveIconPath();
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 820,
    minHeight: 600,
    title: 'BoysChanger',
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

  mainWindow.once('ready-to-show', () => mainWindow?.show());

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

async function ensureMicPermission(): Promise<boolean> {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') return true;
    return systemPreferences.askForMediaAccess('microphone');
  }
  return true;
}

/** Best-effort: set OS default input to a virtual cable so the changer is system-wide. */
async function setSystemInputDevice(deviceHint: string): Promise<{ ok: boolean; message: string }> {
  const hint = deviceHint.toLowerCase();

  if (process.platform === 'win32') {
    // Prefer AudioDeviceCmdlets if installed; fall back to PowerShell COM enumeration tip.
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
          'Could not set system input. Install VB-Cable, then optionally AudioDeviceCmdlets (Install-Module AudioDeviceCmdlets). Or set “CABLE Output” as default mic in Windows Sound settings.',
      };
    } catch (e) {
      return {
        ok: false,
        message: `Windows system input change failed. Manually set default recording device to CABLE Output. (${String(e)})`,
      };
    }
  }

  if (process.platform === 'darwin') {
    // Prefer SwitchAudioSource if present; else AppleScript via CoreAudio is unreliable without helper.
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
            'Virtual input not found. Install BlackHole 2ch, then set it as the system microphone in Sound settings.',
        };
      }
      await execFileAsync('SwitchAudioSource', ['-t', 'input', '-s', match]);
      return { ok: true, message: `System input set to ${match}` };
    } catch {
      return {
        ok: false,
        message:
          'Install BlackHole 2ch and optionally SwitchAudioSource (brew install switchaudio-osx), or set BlackHole as input in System Settings → Sound.',
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
  await ensureMicPermission();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('platform', () => process.platform);

ipcMain.handle('ensure-mic-permission', async () => ensureMicPermission());

ipcMain.handle('virtual-cable-hints', () => detectVirtualCableHints());

ipcMain.handle('set-system-input', async (_evt, deviceHint: string) =>
  setSystemInputDevice(deviceHint || (detectVirtualCableHints()[0] ?? '')),
);

ipcMain.handle('open-external', async (_evt, url: string) => {
  await shell.openExternal(url);
});

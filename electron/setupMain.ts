/**
 * BoysChanger custom Setup (NVIDIA-style frameless UI).
 * Copies payload → install dir, installs VB-CABLE, offers reboot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from 'electron';

const execFileAsync = promisify(execFile);

let mainWindow: BrowserWindow | null = null;
let installedExe = '';

function sendProgress(phase: string, percent: number, detail?: string) {
  mainWindow?.webContents.send('setup-progress', { phase, percent, detail });
}

function payloadRoot(): string {
  const candidates = [
    path.join(process.resourcesPath, 'payload'),
    path.join(__dirname, '../release/win-unpacked'),
    path.join(process.cwd(), 'release/win-unpacked'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'BoysChanger.exe')) || fs.existsSync(path.join(c, 'boyschanger.exe'))) {
      return c;
    }
  }
  return candidates[0];
}

function findAppExe(dir: string): string {
  const names = ['BoysChanger.exe', 'boyschanger.exe'];
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return path.join(dir, 'BoysChanger.exe');
}

function defaultInstallPath(): string {
  const base = process.env.ProgramFiles || 'C:\\Program Files';
  return path.join(base, 'BoysChanger');
}

async function copyDir(src: string, dest: string, onFile?: (n: number, total: number) => void) {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(src);
  fs.mkdirSync(dest, { recursive: true });
  let i = 0;
  for (const file of files) {
    const rel = path.relative(src, file);
    const out = path.join(dest, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(file, out);
    i += 1;
    onFile?.(i, files.length);
  }
}

async function createShortcuts(installDir: string, exePath: string) {
  const ps = `
$WshShell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$exe = '${exePath.replace(/'/g, "''")}'
$work = '${installDir.replace(/'/g, "''")}'
$icon = $exe
$d = $WshShell.CreateShortcut((Join-Path $desktop 'BoysChanger.lnk'))
$d.TargetPath = $exe; $d.WorkingDirectory = $work; $d.IconLocation = $icon; $d.Save()
$menuDir = Join-Path $programs 'BoysChanger'
New-Item -ItemType Directory -Force -Path $menuDir | Out-Null
$m = $WshShell.CreateShortcut((Join-Path $menuDir 'BoysChanger.lnk'))
$m.TargetPath = $exe; $m.WorkingDirectory = $work; $m.IconLocation = $icon; $m.Save()
`;
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { windowsHide: true },
  );
}

async function writeUninstallKey(installDir: string, exePath: string) {
  const version = app.getVersion();
  const ps = `
$key = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\BoysChanger'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty $key DisplayName 'BoysChanger'
Set-ItemProperty $key DisplayVersion '${version.replace(/'/g, "''")}'
Set-ItemProperty $key Publisher 'HyperlinksSpace'
Set-ItemProperty $key InstallLocation '${installDir.replace(/'/g, "''")}'
Set-ItemProperty $key DisplayIcon '${exePath.replace(/'/g, "''")}'
Set-ItemProperty $key UninstallString ('cmd /c rmdir /s /q "' + '${installDir.replace(/'/g, "''")}' + '"')
`;
  await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
    { windowsHide: true },
  );
}

async function installVbCable(installDir: string) {
  const setup = path.join(installDir, 'resources', 'vbcable', 'VBCABLE_Setup_x64.exe');
  if (!fs.existsSync(setup)) return;
  const ps = `
$p = Start-Process -FilePath '${setup.replace(/'/g, "''")}' -ArgumentList '-i','-h' -Verb RunAs -PassThru -Wait
if ($null -eq $p) { exit 2 }
exit $p.ExitCode
`;
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, timeout: 180000 },
    );
  } catch {
    /* UAC cancel / driver prompt — continue */
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 480,
    minWidth: 640,
    minHeight: 420,
    frame: false,
    transparent: false,
    backgroundColor: '#0b1210',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'BoysChanger Setup',
    webPreferences: {
      preload: path.join(__dirname, 'setupPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}setup.html`);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/setup.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('setup-defaults', () => {
    const root = payloadRoot();
    return {
      installPath: defaultInstallPath(),
      version: app.getVersion(),
      hasPayload: fs.existsSync(findAppExe(root)) || fs.existsSync(path.join(root, 'BoysChanger.exe')),
    };
  });

  ipcMain.handle('setup-pick-folder', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    return path.join(res.filePaths[0], 'BoysChanger');
  });

  ipcMain.handle('setup-install', async (_e, installPath: string) => {
    try {
      const dest = installPath || defaultInstallPath();
      const src = payloadRoot();
      if (!fs.existsSync(findAppExe(src))) {
        return { ok: false, message: 'Setup payload not found (BoysChanger.exe missing).' };
      }

      sendProgress('Copying files', 5, dest);
      await copyDir(src, dest, (n, total) => {
        const pct = 5 + Math.round((n / Math.max(1, total)) * 70);
        sendProgress('Copying files', pct, `${n} / ${total}`);
      });

      const exe = findAppExe(dest);
      installedExe = exe;

      sendProgress('Shortcuts', 80, 'Desktop & Start Menu');
      await createShortcuts(dest, exe);
      await writeUninstallKey(dest, exe);

      sendProgress('Virtual cable', 88, 'Installing VB-CABLE…');
      await installVbCable(dest);

      sendProgress('Finishing', 100, 'Done');
      return { ok: true, message: 'ok' };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  });

  ipcMain.handle('setup-reboot', async () => {
    try {
      await execFileAsync('shutdown.exe', ['/r', '/t', '0'], { windowsHide: true });
    } catch (e) {
      dialog.showErrorBox('Reboot', String(e));
    }
  });

  ipcMain.handle('setup-launch', async () => {
    const exe = installedExe || findAppExe(defaultInstallPath());
    if (fs.existsSync(exe)) await shell.openPath(exe);
  });

  ipcMain.handle('setup-quit', () => {
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());

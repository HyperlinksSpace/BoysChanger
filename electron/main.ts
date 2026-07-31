import fs from 'node:fs';
import https from 'node:https';
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  shell,
  systemPreferences,
} from 'electron';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { autoUpdater } from 'electron-updater';
import {
  getVirtualCableStatus,
  installBundledVirtualCable,
} from './virtualCable';
import {
  getLogPaths,
  getPrimaryLogPath,
  initLogger,
  logError,
  logInfo,
  logWarn,
  readTail,
  savePrehearDebug,
} from './logger';

const execFileAsync = promisify(execFile);

const GH_OWNER = 'HyperlinksSpace';
const GH_REPO = 'BoysChanger';

/** Must match package.json build.appId — required for Windows taskbar pin identity. */
const APP_USER_MODEL_ID = 'com.hyperlinksspace.boyschanger';

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

// Prevent stacked tray icons: closing the window hides to tray, so a second
// launch would otherwise start another process with another notification icon.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let changerActive = false;
let isQuitting = false;
let updateCheckTimer: ReturnType<typeof setInterval> | null = null;
let updateCheckInFlight = false;
/** True after installer package is on disk and ready to apply. */
let updateDownloadedReady = false;
let downloadedUpdateVersion: string | undefined;
/**
 * When true, finish install + relaunch as soon as the download completes
 * (manual “Check for updates”). Background checks leave the app running.
 */
let installWhenDownloaded = false;
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

function resolveTrayIconPath(on: boolean) {
  // Prefer the app mark with ON/OFF badge (not the old power-glyph tray assets).
  return firstExisting(
    assetCandidates(
      on ? 'icon-status-on.png' : 'icon-status-off.png',
      on ? 'tray-on.png' : 'tray-off.png',
      'icon.png',
    ),
  );
}

function destroyTray() {
  if (!tray) return;
  try {
    if (!tray.isDestroyed()) tray.destroy();
  } catch {
    /* */
  }
  tray = null;
}

function updateTrayIcon() {
  if (!tray || tray.isDestroyed()) return;
  const trayPath = resolveTrayIconPath(changerActive);
  if (!trayPath) return;
  let img = nativeImage.createFromPath(trayPath);
  if (img.isEmpty()) return;
  // Windows tray looks best around 16–32px; keep the app mark crisp.
  if (process.platform === 'win32') {
    const { width } = img.getSize();
    if (width > 32) img = img.resize({ width: 32, height: 32 });
  } else if (process.platform === 'darwin') {
    img = img.resize({ width: 18, height: 18 });
  }
  tray.setImage(img);
  tray.setToolTip(changerActive ? 'BoysChanger — ON' : 'BoysChanger — OFF');
  rebuildTrayMenu();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady()) createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function rebuildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const menu = Menu.buildFromTemplate([
    {
      label: changerActive ? 'Voice changer: ON' : 'Voice changer: OFF',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: changerActive ? 'Turn OFF' : 'Turn ON',
      click: () => {
        mainWindow?.webContents.send('tray-toggle-changer');
      },
    },
    {
      label: 'Show BoysChanger',
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function createTray() {
  // Always rebuild from a clean slate (dev reloads / partial quit can leave ghosts).
  destroyTray();
  const trayPath = resolveTrayIconPath(false);
  const fallback = resolveIconPath();
  const src = trayPath || fallback;
  if (!src) return;
  let img = nativeImage.createFromPath(src);
  if (img.isEmpty()) return;
  if (process.platform === 'darwin') {
    img = img.resize({ width: 18, height: 18 });
  }
  tray = new Tray(img);
  tray.setToolTip('BoysChanger — OFF');
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
  rebuildTrayMenu();
}

function applyChangerStatus(on: boolean) {
  changerActive = on;
  updateTrayIcon();

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
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
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

  // If the UI failed to load (e.g. files still settling after an update), retry
  // once and never leave the user staring at an empty black window.
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    logError('window', 'did-fail-load', { code, desc, url });
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      try {
        if (VITE_DEV_SERVER_URL) mainWindow.loadURL(VITE_DEV_SERVER_URL);
        else mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
      } catch (err) {
        logError('window', 'reload after fail failed', { err: String(err) });
      }
      if (!mainWindow.isVisible()) mainWindow.show();
    }, 900);
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      logWarn('window', 'ready-to-show timed out — forcing show');
      mainWindow.show();
    }
  }, 5000);

  mainWindow.on('close', (e) => {
    if (isQuitting || process.platform === 'darwin') return;
    e.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexHtml = path.join(process.env.DIST!, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      logError('window', 'missing index.html after update', { indexHtml });
    }
    mainWindow.loadFile(indexHtml);
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

  // Manual click while an update is already downloaded → apply it now.
  if (manual && updateDownloadedReady) {
    return applyDownloadedUpdate('manual-button');
  }

  updateCheckInFlight = true;
  lastUpdateCheckAt = Date.now();
  if (manual) installWhenDownloaded = true;

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
      installWhenDownloaded = false;
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
      installWhenDownloaded = false;
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
    if (manual) installWhenDownloaded = false;
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

function sendUpdateStatus(status: string, version?: string, message?: string) {
  logInfo('updater', status, { version, message });
  mainWindow?.webContents.send('update-status', { status, version, message });
}

function applyDownloadedUpdate(reason: string) {
  if (!updateDownloadedReady) {
    return { ok: false as const, message: 'none' };
  }
  sendUpdateStatus('applying', downloadedUpdateVersion);
  logInfo('updater', 'quitAndInstall', {
    reason,
    version: downloadedUpdateVersion,
    silent: true,
    forceRunAfter: true,
  });

  // Must quit for real (not hide-to-tray), or NSIS cannot replace files and the
  // next launch loads a half-written app → black window.
  isQuitting = true;

  // UAC + per-machine NSIS often finishes without relaunching. Schedule a
  // fully hidden watcher that starts the app again after the installer exits.
  schedulePostUpdateRelaunch(downloadedUpdateVersion);

  // Brief delay so the renderer can paint the in-app “installing” overlay
  // before the process tears down — no external console/updater UI.
  setTimeout(() => {
    try {
      // Silent install (UAC may still appear for per-machine). Force-run asks
      // NSIS to start the app; schedulePostUpdateRelaunch is the safety net.
      autoUpdater.quitAndInstall(true, true);
    } catch (err) {
      logError('updater', 'quitAndInstall failed', { err: String(err) });
      isQuitting = false;
      sendUpdateStatus('error', downloadedUpdateVersion, String(err));
      void openPendingInstallerFallback();
    }
  }, 480);
  return { ok: true as const, version: downloadedUpdateVersion };
}

/**
 * Survives app quit: waits until the elevated silent NSIS install is done,
 * then launches BoysChanger in a normal visible window.
 * (Style 0 / SW_HIDE caused a blank black window after updates.)
 */
function schedulePostUpdateRelaunch(expectedVersion?: string) {
  const exe = process.execPath;
  logInfo('updater', 'schedule post-update relaunch', {
    exe,
    platform: process.platform,
    expectedVersion,
  });
  try {
    if (process.platform === 'win32') {
      const vbsPath = path.join(
        app.getPath('temp'),
        `boyschanger-relaunch-${process.pid}-${Date.now()}.vbs`,
      );
      const exeEsc = exe.replace(/"/g, '""');
      const localAppData =
        process.env.LOCALAPPDATA ||
        path.join(path.dirname(app.getPath('appData')), 'Local');
      const pendingDir = path
        .join(localAppData, 'boyschanger-updater', 'pending')
        .replace(/"/g, '""');
      const body = [
        'On Error Resume Next',
        'Dim sh, fso, wmi, procs, p, exe, pendingDir, i, busy, nameL, cmdL',
        'Set sh = CreateObject("WScript.Shell")',
        'Set fso = CreateObject("Scripting.FileSystemObject")',
        `exe = "${exeEsc}"`,
        `pendingDir = "${pendingDir}"`,
        // Give UAC / NSIS a moment to start before we poll.
        'WScript.Sleep 6000',
        // Wait until updater/installer processes are gone (max ~90s).
        'For i = 1 To 90',
        '  busy = False',
        '  Set wmi = GetObject("winmgmts:{impersonationLevel=impersonate}!\\\\.\\root\\cimv2")',
        '  If Not wmi Is Nothing Then',
        '    Set procs = wmi.ExecQuery("SELECT Name,CommandLine FROM Win32_Process")',
        '    For Each p In procs',
        '      nameL = LCase(p.Name & "")',
        '      cmdL = LCase(p.CommandLine & "")',
        '      If InStr(nameL, "boyschanger") > 0 Then',
        '        If InStr(nameL, "windows-x64") > 0 Or InStr(cmdL, "--updated") > 0 Or InStr(cmdL, "/s") > 0 Then busy = True',
        '      End If',
        '      If InStr(nameL, "installer.exe") > 0 And InStr(cmdL, "boyschanger") > 0 Then busy = True',
        '      If InStr(cmdL, "boyschanger-updater") > 0 And InStr(nameL, ".exe") > 0 Then',
        '        If InStr(nameL, "boyschanger.exe") = 0 Then busy = True',
        '      End If',
        '    Next',
        '  End If',
        '  If fso.FolderExists(pendingDir) Then',
        '    Dim f',
        '    For Each f In fso.GetFolder(pendingDir).Files',
        '      If LCase(fso.GetExtensionName(f.Name)) = "exe" Then busy = True',
        '    Next',
        '  End If',
        '  If Not busy And i >= 8 Then Exit For',
        '  WScript.Sleep 1000',
        'Next',
        // Settle after file replace so we do not open a half-written tree.
        'WScript.Sleep 2500',
        'If fso.FileExists(exe) Then',
        // 1 = normal visible window. 0 (hidden) left a black empty shell.
        '  sh.Run """" & exe & """", 1, False',
        'End If',
        'fso.DeleteFile WScript.ScriptFullName, True',
        '',
      ].join('\r\n');
      fs.writeFileSync(vbsPath, body, 'utf8');
      const child = spawn('wscript.exe', ['//B', '//Nologo', vbsPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      return;
    }
    if (process.platform === 'darwin') {
      const child = spawn('sh', ['-c', `sleep 16; open -n "${exe}"`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }
  } catch (err) {
    logError('updater', 'failed to schedule relaunch', { err: String(err) });
  }
}

async function openPendingInstallerFallback() {
  try {
    const localAppData =
      process.env.LOCALAPPDATA ||
      path.join(path.dirname(app.getPath('appData')), 'Local');
    const pendingDir = path.join(localAppData, 'boyschanger-updater', 'pending');
    const infoPath = path.join(pendingDir, 'update-info.json');
    if (!fs.existsSync(infoPath)) {
      logWarn('updater', 'no update-info.json for fallback');
      return;
    }
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8')) as { fileName?: string };
    const installer = info.fileName ? path.join(pendingDir, info.fileName) : '';
    if (!installer || !fs.existsSync(installer)) {
      logWarn('updater', 'pending installer missing', { installer });
      return;
    }
    logInfo('updater', 'opening pending installer fallback', { installer });
    // Silent NSIS (/S) + force-run — no installer UI / console for end users.
    spawn(installer, ['/S', '--updated', '--force-run'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  } catch (err) {
    logError('updater', 'fallback installer open failed', { err: String(err) });
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

  autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
  autoUpdater.on('update-available', (info) => sendUpdateStatus('available', info.version));
  autoUpdater.on('update-not-available', (info) => {
    installWhenDownloaded = false;
    sendUpdateStatus('not-available', info?.version ?? app.getVersion());
  });
  autoUpdater.on('error', (err) => {
    const msg = err?.message ? String(err.message) : String(err);
    logError('updater', msg);
    // Avoid duplicate noisy UI if resilient check already reported it
    if (isTransientNetworkError(err)) {
      sendUpdateStatus('error', undefined, 'network-soft');
    } else {
      sendUpdateStatus('error', undefined, msg);
    }
  });
  autoUpdater.on('download-progress', (p) => {
    sendUpdateStatus('available', downloadedUpdateVersion, `${Math.round(p.percent)}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloadedReady = true;
    downloadedUpdateVersion = info.version;
    sendUpdateStatus('downloaded', info.version);
    if (installWhenDownloaded) {
      installWhenDownloaded = false;
      applyDownloadedUpdate('manual-download-complete');
    } else {
      logInfo('updater', 'downloaded — waiting for reload', { version: info.version });
    }
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
  if (process.platform !== 'darwin') return true;
  try {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'granted') return true;
    // Without NSMicrophoneUsageDescription this throws / kills the process on macOS.
    return await systemPreferences.askForMediaAccess('microphone');
  } catch (err) {
    logError('audio', 'mic permission request failed', { err: String(err) });
    return false;
  }
}

async function resolveScriptPath(name: string): Promise<string | null> {
  const candidates = [
    path.join(process.resourcesPath, 'scripts', name),
    path.join(__dirname, '../electron/scripts', name),
    path.join(__dirname, 'scripts', name),
    path.join(app.getAppPath(), 'electron/scripts', name),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function setSystemInputDevice(deviceHint: string): Promise<{ ok: boolean; message: string }> {
  const hint = deviceHint || 'CABLE Output';

  if (process.platform === 'win32') {
    const scriptPath = await resolveScriptPath('set-default-recording.ps1');
    if (!scriptPath) {
      return {
        ok: false,
        message:
          'Missing set-default-recording.ps1. Set Windows default mic to CABLE Output manually (Sound settings → Recording).',
      };
    }
    try {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, hint],
        { windowsHide: true, timeout: 25000 },
      );
      const out = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
      if (out.startsWith('OK:')) {
        logInfo('audio', 'system input set', { device: out.slice(3) });
        return { ok: true, message: `System input set to ${out.slice(3)}` };
      }
      return {
        ok: false,
        message:
          out.replace(/^ERR:/, '') ||
          'Could not set system input. Install VB-Cable, then set default recording device to CABLE Output.',
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
        lines.find((l) => l.toLowerCase().includes(hint.toLowerCase())) ||
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

async function openSoundInputSettings(): Promise<{ ok: boolean; message: string }> {
  try {
    if (process.platform === 'win32') {
      // Classic Recording tab — easiest place to set CABLE Output as Default Device
      await execFileAsync('control.exe', ['mmsys.cpl,,1'], { windowsHide: true });
      return { ok: true, message: 'Opened Windows Recording devices' };
    }
    if (process.platform === 'darwin') {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.sound?input',
      );
      return { ok: true, message: 'Opened macOS Sound settings' };
    }
    return { ok: false, message: 'Unsupported platform' };
  } catch (e) {
    return { ok: false, message: String(e) };
  }
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

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    initLogger();
    // Show UI first. Asking for mic before the window exists crashes unsigned /
    // incomplete Mac builds when Info.plist usage text is missing, and also
    // makes first launch look like “app won’t open”.
    createWindow();
    createTray();
    applyChangerStatus(false);
    setupAutoUpdater();
    void ensureMicPermission().catch((err) => {
      logWarn('audio', 'deferred mic permission failed', { err: String(err) });
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showMainWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  destroyTray();
});

app.on('will-quit', () => {
  destroyTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

ipcMain.handle('platform', () => process.platform);
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-locale', () => {
  try {
    // Prefer OS UI language (ru-RU, zh-CN, …) over Chromium/app packaging locale
    const sys = typeof app.getSystemLocale === 'function' ? app.getSystemLocale() : '';
    return sys || app.getLocale();
  } catch {
    return app.getLocale();
  }
});
ipcMain.handle('ensure-mic-permission', async () => ensureMicPermission());
ipcMain.handle('virtual-cable-hints', () => detectVirtualCableHints());
ipcMain.handle('set-system-input', async (_evt, deviceHint: string) =>
  setSystemInputDevice(deviceHint || (detectVirtualCableHints()[0] ?? '')),
);
ipcMain.handle('open-sound-input-settings', async () => openSoundInputSettings());
ipcMain.handle('virtual-cable-status', async () => getVirtualCableStatus());
ipcMain.handle('install-virtual-cable', async () => {
  logInfo('audio', 'install virtual cable requested');
  const res = await installBundledVirtualCable();
  logInfo('audio', 'install virtual cable result', res);
  return res;
});
ipcMain.handle('open-external', async (_evt, url: string) => {
  await shell.openExternal(url);
});
ipcMain.handle('check-for-updates', async (_evt, opts?: { manual?: boolean }) => {
  if (!app.isPackaged) return { ok: false, message: 'dev' };
  const manual = Boolean(opts?.manual);
  return checkForUpdatesResilient(manual ? 'manual' : 'renderer', manual);
});
ipcMain.handle('apply-update', async () => {
  if (!app.isPackaged) return { ok: false, message: 'dev' };
  return applyDownloadedUpdate('renderer');
});
ipcMain.handle('update-ready', async () => ({
  ready: updateDownloadedReady,
  version: downloadedUpdateVersion,
}));
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
ipcMain.handle(
  'save-prehear-debug',
  (
    _evt,
    payload: { wav: ArrayBuffer; meta?: Record<string, unknown> },
  ) => {
    if (!payload?.wav) return { ok: false, error: 'missing wav' };
    return savePrehearDebug(payload.wav, payload.meta || {});
  },
);

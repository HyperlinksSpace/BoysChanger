import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';

const execFileAsync = promisify(execFile);

export type CableStatus = {
  platform: NodeJS.Platform;
  /** Virtual cable already visible to Windows/macOS */
  installed: boolean;
  /** Bundled installer is available in app resources */
  installerAvailable: boolean;
  installerPath: string | null;
  deviceHint: string;
  message: string;
};

export type CableInstallResult = {
  ok: boolean;
  rebootRequired: boolean;
  message: string;
};

function candidateInstallerPaths(): string[] {
  return [
    path.join(process.resourcesPath, 'vbcable', 'VBCABLE_Setup_x64.exe'),
    path.join(app.getAppPath(), 'vendor', 'vbcable', 'VBCABLE_Setup_x64.exe'),
    path.join(__dirname, '../vendor/vbcable/VBCABLE_Setup_x64.exe'),
    path.join(process.cwd(), 'vendor', 'vbcable', 'VBCABLE_Setup_x64.exe'),
  ];
}

export function resolveVbCableInstaller(): string | null {
  for (const p of candidateInstallerPaths()) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function windowsCableInstalled(): Promise<boolean> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$nameKey = '{a45c254e-df1c-4efd-8020-67d146a850e0},2'
$found = $false
Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Capture' -ErrorAction SilentlyContinue | ForEach-Object {
  $props = Get-ItemProperty (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue
  if ($props -and [string]$props.$nameKey -match 'CABLE|VB-Audio|VoiceMeeter') { $found = $true }
}
Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render' -ErrorAction SilentlyContinue | ForEach-Object {
  $props = Get-ItemProperty (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue
  if ($props -and [string]$props.$nameKey -match 'CABLE Input|VB-Audio Virtual Cable') { $found = $true }
}
if ($found) { 'YES' } else { 'NO' }
`;
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 12000 },
    );
    return stdout.trim().includes('YES');
  } catch {
    return false;
  }
}

async function macCableInstalled(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('SwitchAudioSource', ['-a', '-t', 'input']);
    return /blackhole|vb-cable|cable/i.test(stdout);
  } catch {
    try {
      const { stdout } = await execFileAsync('system_profiler', ['SPAudioDataType']);
      return /blackhole|vb-cable/i.test(stdout);
    } catch {
      return false;
    }
  }
}

export async function getVirtualCableStatus(): Promise<CableStatus> {
  const platform = process.platform;
  if (platform === 'win32') {
    const installerPath = resolveVbCableInstaller();
    const installed = await windowsCableInstalled();
    return {
      platform,
      installed,
      installerAvailable: Boolean(installerPath),
      installerPath,
      deviceHint: 'CABLE Output',
      message: installed
        ? 'VB-CABLE is installed'
        : installerPath
          ? 'VB-CABLE not detected — bundled installer is ready'
          : 'VB-CABLE not detected — download from vb-cable.com',
    };
  }
  if (platform === 'darwin') {
    const installed = await macCableInstalled();
    return {
      platform,
      installed,
      installerAvailable: false,
      installerPath: null,
      deviceHint: 'BlackHole',
      message: installed
        ? 'BlackHole / virtual cable detected'
        : 'Install BlackHole 2ch (existential.audio/blackhole) — macOS cannot bundle a kernel audio driver the same way',
    };
  }
  return {
    platform,
    installed: false,
    installerAvailable: false,
    installerPath: null,
    deviceHint: '',
    message: 'Virtual cable install is supported on Windows and macOS only',
  };
}

/**
 * Elevated silent install of bundled VB-CABLE (-i -h).
 * Windows may still show a driver trust dialog; reboot is usually required.
 */
export async function installBundledVirtualCable(): Promise<CableInstallResult> {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      rebootRequired: false,
      message: 'Built-in cable install is Windows-only. On macOS install BlackHole 2ch.',
    };
  }

  const setup = resolveVbCableInstaller();
  if (!setup) {
    return {
      ok: false,
      rebootRequired: false,
      message: 'Bundled VB-CABLE installer not found. Reinstall BoysChanger or download from vb-cable.com.',
    };
  }

  // Elevate via UAC; wait for installer to finish
  const ps = `
$p = Start-Process -FilePath '${setup.replace(/'/g, "''")}' -ArgumentList '-i','-h' -Verb RunAs -PassThru -Wait
if ($null -eq $p) { Write-Output 'ERR:UAC cancelled or elevation failed'; exit 1 }
Write-Output ('OK:' + $p.ExitCode)
`;
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true, timeout: 180000 },
    );
    const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || '';
    if (line.startsWith('ERR:')) {
      return { ok: false, rebootRequired: false, message: line.slice(4) };
    }
    const code = Number(line.replace(/^OK:/, '')) || 0;
    // Exit 0 / unknown — treat as success; driver often needs reboot to appear
    return {
      ok: true,
      rebootRequired: true,
      message:
        code === 0
          ? 'VB-CABLE installed. Reboot Windows, then open BoysChanger and click Setup for Telegram.'
          : `VB-CABLE installer finished (code ${code}). Reboot Windows if CABLE devices are missing.`,
    };
  } catch (e) {
    return {
      ok: false,
      rebootRequired: false,
      message: `VB-CABLE install failed: ${String(e)}`,
    };
  }
}

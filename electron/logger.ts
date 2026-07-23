import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const MAX_BYTES = 2_000_000;

let logPaths: string[] = [];
let ready = false;

function unique(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

export function initLogger() {
  const userLog = path.join(app.getPath('userData'), 'logs', 'boyschanger.log');
  const candidates = [userLog];

  // Dev / Cursor workspace — agent can read this path directly
  try {
    const cwdLog = path.join(process.cwd(), 'logs', 'boyschanger.log');
    candidates.push(cwdLog);
  } catch {
    /* */
  }

  if (!app.isPackaged) {
    try {
      candidates.push(path.join(app.getAppPath(), '..', 'logs', 'boyschanger.log'));
    } catch {
      /* */
    }
  }

  logPaths = unique(candidates);
  for (const p of logPaths) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
    } catch {
      /* */
    }
  }
  ready = true;
  writeLine('INFO', 'logger', `BoysChanger v${app.getVersion()} starting`, {
    packaged: app.isPackaged,
    platform: process.platform,
    paths: logPaths,
  });
}

export function getLogPaths(): string[] {
  return [...logPaths];
}

export function getPrimaryLogPath(): string {
  return logPaths[0] || path.join(app.getPath('userData'), 'logs', 'boyschanger.log');
}

export function getLogDir(): string {
  return path.dirname(getPrimaryLogPath());
}

/**
 * Keep the last 2 prehear WAVs for debugging:
 *   prehear-1.wav (newest), prehear-2.wav (previous)
 * plus matching .json metadata.
 */
export function savePrehearDebug(
  wavBytes: ArrayBuffer | Uint8Array,
  meta: Record<string, unknown> = {},
): { ok: boolean; files?: string[]; error?: string } {
  try {
    const dir = getLogDir();
    fs.mkdirSync(dir, { recursive: true });

    const newestWav = path.join(dir, 'prehear-1.wav');
    const prevWav = path.join(dir, 'prehear-2.wav');
    const newestJson = path.join(dir, 'prehear-1.json');
    const prevJson = path.join(dir, 'prehear-2.json');

    try {
      if (fs.existsSync(newestWav)) fs.copyFileSync(newestWav, prevWav);
      if (fs.existsSync(newestJson)) fs.copyFileSync(newestJson, prevJson);
    } catch {
      /* */
    }

    const buf = Buffer.from(wavBytes instanceof ArrayBuffer ? new Uint8Array(wavBytes) : wavBytes);
    fs.writeFileSync(newestWav, buf);
    fs.writeFileSync(
      newestJson,
      JSON.stringify(
        {
          savedAt: new Date().toISOString(),
          bytes: buf.length,
          ...meta,
        },
        null,
        2,
      ),
      'utf8',
    );

    // Mirror into other log dirs (dev workspace) when present
    for (const logFile of logPaths.slice(1)) {
      try {
        const d = path.dirname(logFile);
        fs.mkdirSync(d, { recursive: true });
        fs.copyFileSync(newestWav, path.join(d, 'prehear-1.wav'));
        fs.copyFileSync(newestJson, path.join(d, 'prehear-1.json'));
        if (fs.existsSync(prevWav)) fs.copyFileSync(prevWav, path.join(d, 'prehear-2.wav'));
        if (fs.existsSync(prevJson)) fs.copyFileSync(prevJson, path.join(d, 'prehear-2.json'));
      } catch {
        /* */
      }
    }

    logInfo('prehear-debug', 'saved prehear WAV', {
      newestWav,
      seconds: meta.seconds,
      rms: meta.rms,
      peak: meta.peak,
    });
    return { ok: true, files: [newestWav, prevWav] };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logError('prehear-debug', 'failed to save prehear', { error });
    return { ok: false, error };
  }
}

function rotateIfNeeded(file: string) {
  try {
    if (!fs.existsSync(file)) return;
    const st = fs.statSync(file);
    if (st.size < MAX_BYTES) return;
    const bak = `${file}.1`;
    try {
      if (fs.existsSync(bak)) fs.unlinkSync(bak);
    } catch {
      /* */
    }
    fs.renameSync(file, bak);
  } catch {
    /* */
  }
}

function writeLine(level: string, scope: string, message: string, data?: unknown) {
  if (!ready) return;
  const ts = new Date().toISOString();
  let extra = '';
  if (data !== undefined) {
    try {
      extra = ' ' + JSON.stringify(data);
    } catch {
      extra = ' [unserializable]';
    }
  }
  const line = `${ts} [${level}] [${scope}] ${message}${extra}\n`;
  for (const file of logPaths) {
    try {
      rotateIfNeeded(file);
      fs.appendFileSync(file, line, 'utf8');
    } catch {
      /* */
    }
  }
}

export function logInfo(scope: string, message: string, data?: unknown) {
  writeLine('INFO', scope, message, data);
  console.log(`[${scope}]`, message, data ?? '');
}

export function logWarn(scope: string, message: string, data?: unknown) {
  writeLine('WARN', scope, message, data);
  console.warn(`[${scope}]`, message, data ?? '');
}

export function logError(scope: string, message: string, data?: unknown) {
  writeLine('ERROR', scope, message, data);
  console.error(`[${scope}]`, message, data ?? '');
}

export function readTail(maxLines = 200): string {
  const file = getPrimaryLogPath();
  try {
    if (!fs.existsSync(file)) return '';
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
  } catch (e) {
    return `Failed to read log: ${String(e)}`;
  }
}

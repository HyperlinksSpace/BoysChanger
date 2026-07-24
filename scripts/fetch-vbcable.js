/**
 * Download official VB-CABLE driver pack (donationware from vb-audio.com)
 * into vendor/vbcable for bundling with the Windows installer / app.
 *
 * Redistribution allowed under VB-Audio donationware rules when we attribute
 * www.vb-cable.com and keep donate visibility for end users.
 */
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'vendor', 'vbcable');
const ZIP_URL = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip';
const ZIP_PATH = path.join(OUT_DIR, 'VBCABLE_Driver_Pack45.zip');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u, redirects = 0) => {
      https
        .get(u, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location &&
            redirects < 5
          ) {
            res.resume();
            get(res.headers.location, redirects + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${u}`));
            res.resume();
            return;
          }
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        })
        .on('error', reject);
    };
    get(url);
  });
}

function findSetupExe(dir) {
  const names = fs.readdirSync(dir);
  const preferred = names.find((n) => /^VBCABLE_Setup_x64\.exe$/i.test(n));
  if (preferred) return path.join(dir, preferred);
  const any = names.find((n) => /^VBCABLE_Setup.*\.exe$/i.test(n));
  if (any) return path.join(dir, any);
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      const nested = findSetupExe(p);
      if (nested) return nested;
    }
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const existing = findSetupExe(OUT_DIR);
  if (existing) {
    console.log('VB-CABLE already present:', existing);
    return;
  }

  console.log('Downloading VB-CABLE from', ZIP_URL);
  await download(ZIP_URL, ZIP_PATH);

  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${ZIP_PATH.replace(/'/g, "''")}' -DestinationPath '${OUT_DIR.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('unzip', ['-o', ZIP_PATH, '-d', OUT_DIR], { stdio: 'inherit' });
  }

  const setup = findSetupExe(OUT_DIR);
  if (!setup) {
    throw new Error('VBCABLE_Setup_*.exe not found after extract');
  }
  // Normalize name for NSIS / Electron
  const target = path.join(OUT_DIR, 'VBCABLE_Setup_x64.exe');
  if (path.resolve(setup) !== path.resolve(target)) {
    fs.copyFileSync(setup, target);
  }
  console.log('VB-CABLE ready:', target);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

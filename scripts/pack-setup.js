/**
 * Build custom BoysChanger Setup (frameless Electron UI) wrapping the app payload.
 *
 * Important: app payload and Setup packaging must use DIFFERENT output dirs.
 * Using the same win-unpacked for both caused recursive payload nesting → ENOSPC on CI.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const APP_OUT = path.join(root, 'release', 'app-payload');
const APP_UNPACKED = path.join(APP_OUT, 'win-unpacked');

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env });
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

async function buildSetupElectron() {
  await esbuild.build({
    entryPoints: [path.join(root, 'electron/setupMain.ts')],
    outfile: path.join(root, 'dist-electron/setupMain.js'),
    platform: 'node',
    bundle: true,
    format: 'cjs',
    target: 'node18',
    external: ['electron', 'electron-updater'],
  });
  await esbuild.build({
    entryPoints: [path.join(root, 'electron/setupPreload.ts')],
    outfile: path.join(root, 'dist-electron/setupPreload.js'),
    platform: 'node',
    bundle: true,
    format: 'cjs',
    target: 'node18',
    external: ['electron'],
  });
}

async function main() {
  // Fresh release tree — avoids leftover nested payload from failed builds
  rmrf(path.join(root, 'release'));

  run('npm run icons');
  run('npm run installer-art');
  run('npm run fetch:vbcable');
  run('npx vite build');
  await buildSetupElectron();

  // 1) Main app unpacked payload (separate folder from Setup packaging)
  run('npx electron-builder --win --dir --config.directories.output=release/app-payload --publish never');

  const payloadExe = path.join(APP_UNPACKED, 'BoysChanger.exe');
  if (!fs.existsSync(payloadExe)) {
    console.error('Missing', payloadExe);
    process.exit(1);
  }

  // Guard: never nest a previous setup payload inside the app tree
  rmrf(path.join(APP_UNPACKED, 'resources', 'payload'));

  const pkgPath = path.join(root, 'package.json');
  const backup = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(backup);
  pkg.main = 'dist-electron/setupMain.js';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  try {
    // 2) Custom Setup UI (portable) — reads payload from release/app-payload/win-unpacked
    run('npx electron-builder --config setup.builder.json --win --publish never');
  } finally {
    fs.writeFileSync(pkgPath, backup);
  }

  // 3) Classic NSIS (auto-update) — uses package.json build.output = release
  run('npx electron-builder --win nsis --publish never');

  console.log('\nArtifacts in release/:');
  console.log('  BoysChanger-Setup-*-Windows-*.exe  ← custom UI (recommended)');
  console.log('  BoysChanger-*-Windows-*.exe        ← NSIS (auto-update)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

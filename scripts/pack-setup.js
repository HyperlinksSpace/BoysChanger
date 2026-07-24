/**
 * Build custom BoysChanger Setup (frameless Electron UI) wrapping win-unpacked.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env });
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
  run('npm run icons');
  run('npm run installer-art');
  run('npm run fetch:vbcable');
  run('npx vite build');
  await buildSetupElectron();

  // App payload + classic NSIS (for auto-update) + custom Setup
  run('npx electron-builder --win --dir --publish never');

  const payloadExe = path.join(root, 'release/win-unpacked/BoysChanger.exe');
  if (!fs.existsSync(payloadExe)) {
    console.error('Missing', payloadExe);
    process.exit(1);
  }

  const pkgPath = path.join(root, 'package.json');
  const backup = fs.readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(backup);
  pkg.main = 'dist-electron/setupMain.js';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  try {
    run('npx electron-builder --config setup.builder.json --win --publish never');
  } finally {
    fs.writeFileSync(pkgPath, backup);
  }

  // Also build NSIS installer (updates + optional classic path)
  run('npx electron-builder --win nsis --publish never');

  console.log('\nArtifacts in release/:');
  console.log('  BoysChanger-Setup-*-Windows-*.exe  ← custom UI (recommended)');
  console.log('  BoysChanger-*-Windows-*.exe        ← NSIS (auto-update)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

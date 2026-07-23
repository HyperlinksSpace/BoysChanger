/**
 * Build opaque square icons for Windows/macOS (no transparent corners → no white halo).
 * Also writes public UI assets and taskbar status overlays.
 */
const fs = require('fs');
const path = require('path');

async function makeStatusDot(sharp, color, size = 32) {
  const r = Math.round(size * 0.34);
  const cx = size / 2;
  const cy = size / 2;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="rgba(0,0,0,0.45)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>
  <circle cx="${cx - r * 0.25}" cy="${cy - r * 0.25}" r="${r * 0.28}" fill="rgba(255,255,255,0.35)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeIconWithCornerDot(sharp, basePng, color, size = 256) {
  const dot = 56;
  const margin = 14;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${size - margin - dot / 2}" cy="${size - margin - dot / 2}" r="${dot / 2 + 4}" fill="#0f1a16"/>
  <circle cx="${size - margin - dot / 2}" cy="${size - margin - dot / 2}" r="${dot / 2}" fill="${color}"/>
</svg>`;
  return sharp(basePng)
    .composite([{ input: await sharp(Buffer.from(svg)).png().toBuffer(), gravity: 'southeast' }])
    .png()
    .toBuffer();
}

async function main() {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico').default || require('png-to-ico');

  const root = path.join(__dirname, '..');
  const svgPath = path.join(root, 'brand', 'logo.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');

  // Full-bleed square (no rounded transparent corners) for OS shell icons
  const opaqueSvg = svg.replace(/rx="112"/, 'rx="0"');

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
  const buildDir = path.join(root, 'build');
  const publicDir = path.join(root, 'public');
  const brandDir = path.join(root, 'brand');
  fs.mkdirSync(buildDir, { recursive: true });

  const pngBuffers = {};
  for (const size of sizes) {
    const buf = await sharp(Buffer.from(opaqueSvg))
      .resize(size, size, { fit: 'fill' })
      .png()
      .toBuffer();
    pngBuffers[size] = buf;
  }

  const icon512 = pngBuffers[512];
  fs.writeFileSync(path.join(buildDir, 'icon.png'), icon512);
  fs.writeFileSync(path.join(publicDir, 'icon.png'), icon512);
  fs.writeFileSync(path.join(brandDir, 'icon-opaque.png'), icon512);

  // UI mark keeps rounded corners (from original SVG)
  const ui256 = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  fs.writeFileSync(path.join(publicDir, 'logo.png'), ui256);
  fs.writeFileSync(path.join(root, 'src', 'assets', 'logo.png'), ui256);

  const ico = await pngToIco([
    pngBuffers[16],
    pngBuffers[24],
    pngBuffers[32],
    pngBuffers[48],
    pngBuffers[64],
    pngBuffers[128],
    pngBuffers[256],
  ]);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

  fs.writeFileSync(path.join(buildDir, 'icon-1024.png'), pngBuffers[1024]);

  // Taskbar overlay dots (Windows setOverlayIcon)
  const green = '#3DDC84';
  const red = '#FF4B4B';
  const overlayOn = await makeStatusDot(sharp, green, 32);
  const overlayOff = await makeStatusDot(sharp, red, 32);
  fs.writeFileSync(path.join(buildDir, 'overlay-on.png'), overlayOn);
  fs.writeFileSync(path.join(buildDir, 'overlay-off.png'), overlayOff);
  fs.writeFileSync(path.join(publicDir, 'overlay-on.png'), overlayOn);
  fs.writeFileSync(path.join(publicDir, 'overlay-off.png'), overlayOff);

  // Full icons with corner status (macOS dock / window setIcon fallback)
  const statusOn = await makeIconWithCornerDot(sharp, pngBuffers[256], green, 256);
  const statusOff = await makeIconWithCornerDot(sharp, pngBuffers[256], red, 256);
  fs.writeFileSync(path.join(buildDir, 'icon-status-on.png'), statusOn);
  fs.writeFileSync(path.join(buildDir, 'icon-status-off.png'), statusOff);

  console.log('Icons written to build/ and public/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

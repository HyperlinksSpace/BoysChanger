/**
 * Generate NSIS installer art matching BoysChanger UI
 * (dark green + lime accent). Outputs 24-bit BMPs required by MUI2.
 *
 * Sizes (electron-builder / NSIS):
 * - installerSidebar.bmp / uninstallerSidebar.bmp: 164 × 314
 * - installerHeader.bmp: 150 × 57
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build');
const LOGO = path.join(ROOT, 'build', 'icon.png');

const BG0 = { r: 11, g: 18, b: 16, alpha: 1 }; // #0b1210
const BG1 = { r: 18, g: 32, b: 27, alpha: 1 }; // #12201b
const ACCENT = { r: 212, g: 255, b: 74, alpha: 1 }; // #d4ff4a
const INK = { r: 232, g: 242, b: 236, alpha: 1 };

async function gradientSvg(w, h) {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1210"/>
      <stop offset="55%" stop-color="#12201b"/>
      <stop offset="100%" stop-color="#0e1814"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="8%" r="70%">
      <stop offset="0%" stop-color="#d4ff4a" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="#d4ff4a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="warm" cx="100%" cy="0%" r="55%">
      <stop offset="0%" stop-color="#ff7a45" stop-opacity="0.14"/>
      <stop offset="60%" stop-color="#ff7a45" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect width="${w}" height="${h}" fill="url(#warm)"/>
  <rect x="0" y="0" width="3" height="${h}" fill="#d4ff4a"/>
</svg>`);
}

async function toBmp(pngBuf, dest) {
  // sharp → raw → write classic BI_RGB BMP (NSIS-friendly)
  const { data, info } = await sharp(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const rowSize = Math.floor((w * 3 + 3) / 4) * 4;
  const pixelBytes = rowSize * h;
  const fileSize = 54 + pixelBytes;
  const buf = Buffer.alloc(fileSize);

  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22); // bottom-up
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(0, 30);
  buf.writeUInt32LE(pixelBytes, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);

  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y;
    let destOff = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (srcY * w + x) * 4;
      buf[destOff++] = data[i + 2]; // B
      buf[destOff++] = data[i + 1]; // G
      buf[destOff++] = data[i]; // R
    }
  }
  fs.writeFileSync(dest, buf);
}

async function makeSidebar() {
  const w = 164;
  const h = 314;
  const base = await sharp(await gradientSvg(w, h)).png().toBuffer();
  const logoSize = 72;
  let composed = base;
  if (fs.existsSync(LOGO)) {
    const logo = await sharp(LOGO)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    composed = await sharp(base)
      .composite([
        { input: logo, top: 36, left: Math.round((w - logoSize) / 2) },
        {
          input: Buffer.from(`<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="120">
  <text x="82" y="28" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="700" fill="#e8f2ec" letter-spacing="1">BOYSCHANGER</text>
  <text x="82" y="52" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#d4ff4a">Voice studio</text>
  <text x="82" y="88" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#93a89c">System-wide</text>
  <text x="82" y="104" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#93a89c">for Windows</text>
</svg>`),
          top: 120,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }
  await toBmp(composed, path.join(OUT, 'installerSidebar.bmp'));
  await toBmp(composed, path.join(OUT, 'uninstallerSidebar.bmp'));
  console.log('Wrote installerSidebar.bmp / uninstallerSidebar.bmp');
}

async function makeHeader() {
  const w = 150;
  const h = 57;
  const base = await sharp(await gradientSvg(w, h)).png().toBuffer();
  let composed = base;
  if (fs.existsSync(LOGO)) {
    const logo = await sharp(LOGO).resize(36, 36).png().toBuffer();
    composed = await sharp(base)
      .composite([
        { input: logo, top: 10, left: 10 },
        {
          input: Buffer.from(`<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="57">
  <text x="0" y="28" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#e8f2ec">BoysChanger</text>
  <text x="0" y="44" font-family="Segoe UI, Arial, sans-serif" font-size="9" fill="#d4ff4a">Setup</text>
</svg>`),
          top: 0,
          left: 52,
        },
      ])
      .png()
      .toBuffer();
  }
  await toBmp(composed, path.join(OUT, 'installerHeader.bmp'));
  console.log('Wrote installerHeader.bmp');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await makeSidebar();
  await makeHeader();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Build opaque square icons for Windows/macOS (no transparent corners → no white halo).
 * Also writes public UI assets.
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico').default || require('png-to-ico');

  const root = path.join(__dirname, '..');
  const svgPath = path.join(root, 'brand', 'logo.svg');
  const svg = fs.readFileSync(svgPath, 'utf8');

  // Full-bleed square (no rounded transparent corners) for OS shell icons
  const opaqueSvg = svg
    .replace(/rx="112"/, 'rx="0"')
    .replace(/<svg[^>]*>/, (m) => m);

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

  // macOS prefers 1024 master; electron-builder builds .icns from icon.png
  fs.writeFileSync(path.join(buildDir, 'icon-1024.png'), pngBuffers[1024]);

  console.log('Icons written to build/ and public/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

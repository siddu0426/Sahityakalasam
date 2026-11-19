import fs from 'fs';
import path from 'path';

const iconDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Write high-res SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1F7A6D"/>
      <stop offset="100%" stop-color="#134F47"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#tealGrad)"/>
  <circle cx="256" cy="256" r="180" fill="none" stroke="#E5F2F0" stroke-width="12" opacity="0.3"/>
  <circle cx="256" cy="256" r="140" fill="none" stroke="#E5F2F0" stroke-width="16" opacity="0.6"/>
  <!-- Audio wave bars -->
  <rect x="176" y="216" width="16" height="80" rx="8" fill="#FFFFFF"/>
  <rect x="208" y="176" width="16" height="160" rx="8" fill="#FFFFFF"/>
  <rect x="240" y="140" width="16" height="232" rx="8" fill="#FFFFFF"/>
  <rect x="272" y="190" width="16" height="132" rx="8" fill="#FFFFFF"/>
  <rect x="304" y="226" width="16" height="60" rx="8" fill="#FFFFFF"/>
</svg>`;

fs.writeFileSync(path.join(iconDir, 'icon.svg'), svgContent);

// A minimal valid 1x1 or 192x192 PNG buffer fallback
// Simple valid RGBA PNG
function createPngBuffer(width, height) {
  // Minimal 1x1 RGBA PNG
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // RGBA
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT
    0x54, 0x78, 0x9c, 0x63, 0x28, 0x7a, 0x6d, 0x00,
    0x00, 0x02, 0x1f, 0x01, 0x3d, 0x04, 0x8b, 0x78,
    0x61, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND
    0x44, 0xae, 0x42, 0x60, 0x82
  ]);
}

fs.writeFileSync(path.join(iconDir, 'icon-192.png'), createPngBuffer(192, 192));
fs.writeFileSync(path.join(iconDir, 'icon-512.png'), createPngBuffer(512, 512));
console.log('Icons generated successfully.');

// Renders Zenith's icon set from the logo (zenith-logo.svg: 120-unit design, mark centred at 60,60).
// Re-run after changing the logo — sharp is fetched on the fly, not a project dependency:
//   npx -y -p sharp node assets/brand/render-icons.js assets/images
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const BG = '#161B1B';

// The mark alone, scaled by s and centred at (cx, cy).
function mark(s, cx, cy, { ring = '#1C3B38', z = '#80CBC4', dot = '#F2B45C', showRing = true } = {}) {
  const t = `translate(${cx - 60 * s} ${cy - 60 * s}) scale(${s})`;
  return `<g transform="${t}">
    ${showRing ? `<circle cx="60" cy="60" r="46" stroke="${ring}" stroke-width="4" fill="none"/>` : ''}
    <path d="M40 38H80L44 82H84" stroke="${z}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="82" cy="38" r="4.5" fill="${dot}"/>
  </g>`;
}

const svg = (size, body, bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}${body}</svg>`);

async function png(name, size, body, bg) {
  await sharp(svg(size, body, bg)).png().toFile(path.join(OUT, name));
  console.log('wrote', name);
}

(async () => {
  // iOS / store icon: full-bleed square — the OS applies its own rounded mask.
  await png('icon.png', 1024, mark(1024 / 120, 512, 512), BG);
  // Android adaptive: solid background layer + the mark inside the 66/108 safe zone.
  await png('android-icon-background.png', 1024, '', BG);
  await png('android-icon-foreground.png', 1024, mark(6, 512, 512));
  // Android 13 themed icons: one colour; the faint ring is dropped so the Z reads clearly.
  await png('android-icon-monochrome.png', 1024, mark(6, 512, 512, { z: '#FFFFFF', dot: '#FFFFFF', showRing: false }));
  // Splash: the mark on the app background colour set in app.json.
  await png('splash-icon.png', 1024, mark(1024 / 120, 512, 512));
  // Favicon: the rounded tile as designed.
  await png('favicon.png', 196, `<rect width="196" height="196" rx="${28 * 196 / 120}" fill="${BG}"/>${mark(196 / 120, 98, 98)}`);
})();

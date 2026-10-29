/**
 * ONE-OFF: generate favicon.png (64), apple-touch-icon.png (180),
 * og-image.png (1200x630) and Nexus_logo.webp (navbar/mobile mark)
 * from the official NEXUS ROBOTICS logo. Windows-side node.
 */
const sharp = require('sharp');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LOGO = path.join(ROOT, 'public/Images/Nexus_logo_final.png');
const OUT = path.join(ROOT, 'public/Images');

(async () => {
  // favicon — universal PNG, tiny
  await sharp(LOGO).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, 'favicon.png'));
  // apple touch icon — 180px, solid bg (iOS composites rounded corners)
  await sharp(LOGO).resize(180, 180, { fit: 'contain', background: '#05070D' }).png().toFile(path.join(OUT, 'apple-touch-icon.png'));
  // navbar / mobile-nav mark — aspect-true, covers 42px @2x with headroom
  await sharp(LOGO).resize({ width: 480 }).webp({ quality: 92 }).toFile(path.join(OUT, 'Nexus_logo.webp'));

  // OG image 1200x630 — dark engineering bg, cyan grid, official logo lockup
  const W = 1200, H = 630;
  const grid = [];
  for (let x = 0; x <= W; x += 60) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#0E1626" stroke-width="1"/>`);
  for (let y = 0; y <= H; y += 60) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#0E1626" stroke-width="1"/>`);

  // the official logo carries its own NEXUS ROBOTICS wordmark across the
  // crest — show it large instead of duplicating the name in SVG text
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#05070D"/>
  ${grid.join('')}
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#22D3EE"/>
  <text x="600" y="88" font-family="Arial, Helvetica, sans-serif" font-size="26" letter-spacing="10" fill="#22D3EE" text-anchor="middle">EST. 2010 · MUMBAI</text>
  <text x="600" y="566" font-family="Arial, Helvetica, sans-serif" font-size="28" letter-spacing="3" fill="#8A93A6" text-anchor="middle">K J SOMAIYA SCHOOL OF ENGINEERING</text>
</svg>`;

  const LOGO_H = 360;
  const logo = await sharp(LOGO).resize({ height: LOGO_H }).png().toBuffer();
  const logoW = (await sharp(logo).metadata()).width;

  await sharp(Buffer.from(svg))
    .composite([{ input: logo, left: Math.round((W - logoW) / 2), top: (H - LOGO_H) / 2 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'og-image.png'));

  for (const f of ['favicon.png', 'apple-touch-icon.png', 'og-image.png']) {
    console.log(f, require('fs').statSync(path.join(OUT, f)).size);
  }
})();

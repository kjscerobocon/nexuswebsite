/**
 * ONE-OFF: optimize the La Casa De Bots workshop poster.
 * Source: public/Images/La Casa de bots_workshop_26.png (1024x1536, 2.4 MB PNG)
 * Emits (project WebP convention, mirrors KYNEX poster-900/1600):
 *   public/Images/la-casa-poster-900.webp   — NEXUS NOW hub card
 *   public/Images/la-casa-poster-1600.webp  — story hero + plate
 */
const sharp = require('sharp');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public/Images/La Casa de bots_workshop_26.png');
const OUT = path.join(ROOT, 'public/Images');

(async () => {
  for (const w of [900, 1600]) {
    const f = path.join(OUT, `la-casa-poster-${w}.webp`);
    await sharp(SRC).resize({ width: w }).webp({ quality: 85 }).toFile(f);
    console.log(path.basename(f));
  }
})();

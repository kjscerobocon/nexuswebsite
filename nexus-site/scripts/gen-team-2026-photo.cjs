/**
 * ONE-OFF: provisional team photographs for years without a usable
 * group photo. The workshop photo (public/Images/archive/workshop-03.webp,
 * 1600x900 native) stands in through the standard group-photo pipeline:
 *   public/assets/team-photos-group/<base>-{800,1200,1600}.webp
 *
 * PROVISIONAL BASES:
 *   team-2026 — no 2026 group photo exists yet
 *   team-2025 — the previous 2025 photo was washed out / illegible
 * (the pre-2025 originals remain recoverable from git history:
 *  git checkout -- public/assets/team-photos-group/team-2025-*)
 *
 * When a real group photo for a year arrives, regenerate that base
 * from the new file (same widths) — no code changes needed.
 */
const sharp = require('sharp');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'public/Images/archive/workshop-03.webp');
const OUT = path.join(ROOT, 'public/assets/team-photos-group');
const BASES = ['team-2026', 'team-2025'];

(async () => {
  for (const base of BASES) {
    for (const w of [800, 1200, 1600]) {
      const f = path.join(OUT, `${base}-${w}.webp`);
      await sharp(SRC).resize({ width: w }).webp({ quality: 84 }).toFile(f);
      console.log(path.basename(f));
    }
  }
})();

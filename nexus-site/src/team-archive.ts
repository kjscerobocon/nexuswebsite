/**
 * TEAM ARCHIVE — interactive generation archive for team.html.
 *
 * Structure:
 *   01 hero            split editorial: type column + protected photo zone
 *   02 archive bar     integrated year selector (sticky below navbar)
 *   03 stage           year + telemetry + team photo
 *   04 guidance        mentors
 *   05 leadership      core four (equal weight) + dept leaders
 *   06 collective      portrait wall (info below photo, no overlays)
 *   07 filter          departments[] membership filter (GSAP Flip)
 *   10 end             chapter close + prev/next generation nav
 *
 * All sections render from TEAMS data — adding a year is data-only.
 * Requires the #ta-rail root; safe no-op otherwise.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import type Lenis from 'lenis';
import { TEAMS, YEARS, DEFAULT_YEAR, DEPT_LABELS, DEPT_CODES, portrait, groupPhoto } from './data/team-data';
import { PHOTO_SLUGS } from './data/photo-manifest';
import type { Member, DeptKey, TeamYear } from './data/team-data';
import { SYSTEM_CAPABILITIES, setActiveRosterSource } from './data/system-capabilities';
import { TOOLCHAIN_CATEGORIES_ARRAY } from './data/toolchain-data';
import { fetchPublicRoster } from './lib/roster';

gsap.registerPlugin(ScrollTrigger, Flip);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(sel);

const el = (cls: string, text = '', tag = 'div'): HTMLElement => {
  const node = document.createElement(tag);
  node.className = cls;
  if (text) node.textContent = text;
  return node;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const photoSlug = (m: Member): string =>
  m.photoBase ?? m.name.trim().replace(/['’]/g, '').replace(/\s+/g, '-').toLowerCase();

/** true when a portrait exists for this member — remote URL, or a
 *  local optimized asset whose slug is in the manifest */
const hasPhoto = (m: Member): boolean =>
  (!!m.photoUrl && /^https?:\/\//i.test(m.photoUrl)) || PHOTO_SLUGS.includes(photoSlug(m));

/** responsive <img> for a member portrait */
const imgFor = (m: Member): HTMLImageElement => {
  const img = document.createElement('img');
  if (m.photoUrl && /^https?:\/\//i.test(m.photoUrl)) {
    img.src = m.photoUrl;
    img.removeAttribute('srcset');
  } else {
    const p = portrait(m);
    img.src = p.src;
    img.srcset = p.srcset;
  }
  img.sizes = '(min-width: 900px) 260px, 40vw';
  img.alt = m.name;
  img.loading = 'lazy';
  img.draggable = false;
  img.decoding = 'async';
  img.width = 800;
  img.height = 1000;   // 4:5 — reserves layout space, no shift
  if (m.objectPosition) img.style.objectPosition = m.objectPosition;
  return img;
};

/** deliberate placeholder portrait — visually consistent, never fake */
const placeholderFor = (m: Member): HTMLElement => {
  const ph = el('ta-placeholder');
  ph.setAttribute('role', 'img');
  ph.setAttribute('aria-label', `${m.name} — portrait pending`);
  const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('');
  ph.append(el('ta-placeholder-init', initials));
  return ph;
};

const rankLabel = (m: Member): string => {
  if (m.rank === 'captain') return 'CAPTAIN';
  if (m.rank === 'vice') return 'VICE-CAPTAIN';
  if (m.rank === 'treasurer') return 'TREASURER';
  if (m.rank === 'cto') return 'C.T.O.';
  return 'DEPARTMENT LEAD';
};

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* module state                                                        */
/* ------------------------------------------------------------------ */

/** live roster — static team-data until the database answers */
let teams: Record<number, TeamYear> = TEAMS;
let years: number[] = YEARS;

let activeYear = DEFAULT_YEAR;
let activeDept: DeptKey | 'all' = 'all';
let switching = false;
let lenisRef: Lenis | null = null;

/* ------------------------------------------------------------------ */
/* 02 — ARCHIVE BAR (rail)                                             */
/* ------------------------------------------------------------------ */

function renderRail(): void {
  const rail = $('#ta-rail');
  if (!rail) return;

  rail.innerHTML = '';
  years.forEach((y) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ta-year-item';
    b.textContent = String(y);
    b.setAttribute('aria-label', `View the ${y} team`);
    // click handling is delegated on the rail in initRailDrag()
    rail.appendChild(b);
  });
  updateRail();
}

function updateRail(): void {
  const rail = $('#ta-rail');
  if (!rail) return;
  const items = Array.from(rail.children) as HTMLButtonElement[];
  const idx = years.indexOf(activeYear);

  items.forEach((b) => {
    const y = Number(b.textContent);
    const d = Math.abs(years.indexOf(y) - idx);
    b.classList.toggle('is-active', y === activeYear);
    b.dataset.near = String(Math.min(d, 2));
    b.setAttribute('aria-current', y === activeYear ? 'true' : 'false');
  });

  const count = $('#ta-rail-count');
  if (count) count.textContent = `GENERATION ${pad2(idx + 1)} / ${pad2(years.length)}`;

  const activeBtn = items.find((b) => Number(b.textContent) === activeYear);
  activeBtn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

/* ------------------------------------------------------------------ */
/* 03 — STAGE                                                          */
/* ------------------------------------------------------------------ */

function setText(sel: string, text: string): void {
  const node = $(sel);
  if (node) node.textContent = text;
}

function deptCount(team: TeamYear): number {
  const set = new Set<string>();
  team.members.forEach((m) => m.departments.forEach((d) => { if (d !== 'mentor') set.add(d); }));
  return set.size;
}

function renderStage(team: TeamYear): void {
  setText('#ta-year-num', String(team.year));
  setText('#ta-stage-ghost', String(team.year));
  setText('#ta-stat-year', String(team.year));
  setText('#ta-stat-members', pad2(team.members.filter((m) => m.tier !== 'mentor').length));
  setText('#ta-stat-divisions', pad2(deptCount(team)));
  setText('#ta-stat-status', team.status);
  const statusEl = $('#ta-stat-status');
  if (statusEl) statusEl.classList.toggle('is-accent', team.status === 'ACTIVE');

  // team photo — real image if the base exists, placeholder frame otherwise
  const fig = $('#ta-stage-photo');
  if (!fig) return;
  fig.innerHTML = '';
  const base = team.teamPhotoBase;
  if (base && GROUP_PHOTOS.has(base)) {
    fig.classList.remove('ta-stage-photo--placeholder');
    const img = document.createElement('img');
    const g = groupPhoto(base);
    img.src = g.src;
    img.srcset = g.srcset;
    img.sizes = '(min-width: 1440px) 1440px, 96vw';
    img.alt = `Team NEXUS Robotics ${team.year} group photograph`;
    img.loading = 'lazy';
    img.width = 1200;
    img.height = 675;
    img.decoding = 'async';
    fig.appendChild(img);
  } else {
    fig.classList.add('ta-stage-photo--placeholder');
    fig.append(el('ta-ph-frame'), el('ta-ph-text', `${team.year} GROUP PHOTOGRAPH — PENDING`));
  }
}

/** group-photo bases that exist as optimized assets (2026 = provisional workshop stand-in) */
const GROUP_PHOTOS = new Set(['team-2025', 'team-2022', 'team-robocon-2012', 'team-robocon-2019', 'team-2026']);

/* ------------------------------------------------------------------ */
/* 04 — GUIDANCE                                                       */
/* ------------------------------------------------------------------ */

function renderGuidance(): void {
  const section = $('#ta-guidance');
  const flow = $('#ta-guidance-flow');
  if (!section || !flow) return;

  // guidance is institution-level, not per-generation: every mentor on
  // record across all years, deduped by name — the section stays constant
  // even when a generation's own roster carries no mentor entries
  const seen = new Set<string>();
  const mentors: Member[] = [];
  years.forEach((y) => {
    (teams[y]?.members ?? []).forEach((m) => {
      if (m.tier === 'mentor' && !seen.has(m.name)) {
        seen.add(m.name);
        mentors.push(m);
      }
    });
  });

  section.hidden = mentors.length === 0;
  if (mentors.length === 0) return;

  flow.innerHTML = '';
  mentors.forEach((m, i) => {
    const item = el('ta-mentor');
    const photo = el('ta-mentor-photo');
    photo.appendChild(hasPhoto(m) ? imgFor(m) : placeholderFor(m));

    const body = el('ta-mentor-body');
    body.append(
      el('ta-mentor-name', m.name, 'h3'),
      rolesList(m, 'ta-mentor-roles'),
    );
    item.append(photo, body, el('ta-mentor-idx', `G-${pad2(i + 1)}`));
    flow.appendChild(item);
  });
}

/** modular role metadata list — '/' prefixed, wraps naturally */
function rolesList(m: Member, cls: string): HTMLElement {
  const ul = el(cls, '', 'ul');
  m.roles.forEach((r) => ul.appendChild(el('', r, 'li')));
  return ul;
}

/* ------------------------------------------------------------------ */
/* 05 — LEADERSHIP                                                     */
/* ------------------------------------------------------------------ */

function renderLeadership(team: TeamYear): void {
  const section = $('#ta-lead');
  const coreFlow = $('#ta-core-flow');
  const deptFlow = $('#ta-dept-flow');
  if (!section || !coreFlow || !deptFlow) return;

  const core = team.members.filter((m) => m.tier === 'core');
  const dept = team.members.filter((m) => m.tier === 'dept');
  section.hidden = core.length + dept.length === 0;
  if (section.hidden) return;

  const note = $('#ta-lead-note');
  if (note) note.textContent = `${team.year} COMMAND`;

  coreFlow.innerHTML = '';
  deptFlow.innerHTML = '';
  core.forEach((m, i) => coreFlow.appendChild(leadItem(m, `C-${pad2(i + 1)}`)));
  dept.forEach((m, i) => deptFlow.appendChild(leadItem(m, `D-${pad2(i + 1)}`)));

  const deptLabel = $('#ta-lead-dept-label');
  if (deptLabel) deptLabel.hidden = dept.length === 0;
}

function leadItem(m: Member, idx: string): HTMLElement {
  const item = el('ta-lead-item');

  const photo = el('ta-lead-photo');
  photo.appendChild(hasPhoto(m) ? imgFor(m) : placeholderFor(m));
  photo.appendChild(el('ta-lead-idx', idx));

  const info = el('ta-lead-info');
  info.append(
    el('ta-lead-rank', rankLabel(m)),
    el('ta-lead-name', m.name, 'h3'),
    rolesList(m, 'ta-lead-roles'),
  );

  item.append(photo, info);
  return item;
}

/* ------------------------------------------------------------------ */
/* 06+07 — COLLECTIVE WALL + FILTER (departments[] membership)         */
/* ------------------------------------------------------------------ */

function renderFilter(team: TeamYear): void {
  const bar = $('#ta-filter');
  if (!bar) return;
  bar.innerHTML = '';

  const roster = team.members.filter((m) => m.tier !== 'mentor');
  const present = new Set<DeptKey>();
  roster.forEach((m) => m.departments.forEach((d) => { if (d !== 'mentor') present.add(d); }));
  const depts = (Object.keys(DEPT_LABELS) as DeptKey[]).filter((d) => d !== 'mentor' && present.has(d));

  const countFor = (d: DeptKey) => roster.filter((m) => m.departments.includes(d)).length;

  const mk = (key: DeptKey | 'all', label: string, count: number) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ta-filter-item';
    b.dataset.dept = key;
    b.setAttribute('role', 'tab');
    b.innerHTML = `${label}<sup>${pad2(count)}</sup>`;
    b.addEventListener('click', () => setFilter(key));
    bar.appendChild(b);
  };

  mk('all', 'ALL', roster.length);
  depts.forEach((d) => mk(d, DEPT_LABELS[d], countFor(d)));
  updateFilterUI();
}

function updateFilterUI(): void {
  const bar = $('#ta-filter');
  if (!bar) return;
  Array.from(bar.children).forEach((b) => {
    b.classList.toggle('is-active', (b as HTMLElement).dataset.dept === activeDept);
  });
}

function renderWall(team: TeamYear): void {
  const section = $('#ta-collective');
  const wall = $('#ta-wall');
  if (!section || !wall) return;

  wall.querySelectorAll('.ta-cell, .ta-empty').forEach((n) => n.remove());

  const roster = team.members.filter((m) => m.tier !== 'mentor');
  section.hidden = roster.length === 0;
  if (roster.length === 0) {
    const bar = $('#ta-filter');
    if (bar) bar.innerHTML = '';
    return;
  }

  roster.forEach((m) => {
    const cell = el('ta-cell');
    cell.dataset.depts = m.departments.filter((d) => d !== 'mentor').join(' ');

    const photo = el('ta-cell-photo');
    photo.appendChild(hasPhoto(m) ? imgFor(m) : placeholderFor(m));

    const info = el('ta-cell-info');
    info.append(
      el('ta-cell-name', m.name, 'span'),
      rolesList(m, 'ta-cell-roles'),
      el('ta-cell-code', m.departments.map((d) => DEPT_CODES[d]).join(' ')),
    );

    cell.append(photo, info);
    wall.appendChild(cell);
  });

  const note = $('#ta-collective-note');
  if (note) note.textContent = `REGISTRY / ${roster.length} PORTRAITS`;
  const ghost = $('#ta-wall-ghost');
  if (ghost) ghost.textContent = activeDept === 'all' ? 'ALL' : DEPT_LABELS[activeDept].split(' ')[0];
}

function setFilter(next: DeptKey | 'all'): void {
  if (next === activeDept || switching) return;
  activeDept = next;
  updateFilterUI();
  applyFilter(true);
  const ghost = $('#ta-wall-ghost');
  if (ghost) ghost.textContent = next === 'all' ? 'ALL' : DEPT_LABELS[next].split(' ')[0];
}

function applyFilter(animate: boolean): void {
  const wall = $('#ta-wall');
  if (!wall) return;
  const cells = Array.from(wall.querySelectorAll<HTMLElement>('.ta-cell'));
  if (cells.length === 0) return;

  const show = (c: HTMLElement) =>
    activeDept === 'all' || (c.dataset.depts ?? '').split(' ').includes(activeDept);

  if (!animate || reduced()) {
    cells.forEach((c) => { c.style.display = show(c) ? '' : 'none'; });
    ScrollTrigger.refresh();
    return;
  }

  const state = Flip.getState(cells);
  cells.forEach((c) => { c.style.display = show(c) ? '' : 'none'; });
  Flip.from(state, {
    duration: 0.55,
    ease: 'power3.inOut',
    stagger: 0.005,
    absolute: true,
    scale: true,
    onEnter: (ents) => gsap.fromTo(ents, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', stagger: 0.008 }),
    onLeave: (lv) => gsap.to(lv, { opacity: 0, scale: 0.92, duration: 0.3, ease: 'power2.in', stagger: 0.006 }),
    onComplete: () => ScrollTrigger.refresh(),
  });
}

/* ------------------------------------------------------------------ */
/* 10 — END OF ARCHIVE                                                 */
/* ------------------------------------------------------------------ */

function renderEnd(team: TeamYear): void {
  const yearEl = $('#ta-end-year');
  if (yearEl) yearEl.innerHTML = `${team.year}<span class="ta-dot">.</span>`;

  const nav = $('#ta-end-nav');
  if (!nav) return;
  nav.innerHTML = '';

  const idx = years.indexOf(team.year);
  const prev = years[idx - 1];
  const next = years[idx + 1];

  if (prev === undefined && next === undefined) {
    nav.append(el('ta-end-none', 'FIRST CHAPTER — MORE GENERATIONS TO COME'));
    return;
  }

  if (prev !== undefined) nav.appendChild(endLink('← PREV', prev));
  if (prev !== undefined && next !== undefined) nav.appendChild(el('ta-end-divider'));
  if (next !== undefined) {
    const b = endLink('NEXT →', next);
    b.classList.add('is-next');
    nav.appendChild(b);
  }
}

function endLink(dir: string, year: number): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ta-end-link';
  b.innerHTML = `<span class="ta-end-dir">${dir}</span><span class="ta-end-num">${year}</span>`;
  b.addEventListener('click', () => void switchYear(year));
  return b;
}

/* ------------------------------------------------------------------ */
/* 03b — YEAR SWITCH (fast, restrained: 0.5–1.0s total)                */
/* ------------------------------------------------------------------ */

async function switchYear(year: number): Promise<void> {
  if (switching || year === activeYear || !teams[year]) return;
  switching = true;

  try {
    const overlay = $('#ta-switch');
    const team = teams[year];
    const bar = $('#ta-bar');
    const animate = !!overlay && !reduced();

    if (animate) {
      const fromEl = $('#ta-switch-from');
      const toEl = $('#ta-switch-to');
      if (fromEl) fromEl.textContent = String(activeYear);
      if (toEl) toEl.textContent = String(year);

      overlay!.style.visibility = 'visible';
      overlay!.style.pointerEvents = 'auto';

      await gsap.timeline()
        .to(overlay, { clipPath: 'inset(0 0 0% 0)', duration: 0.3, ease: 'power4.in' })
        .fromTo(fromEl, { scale: 1, opacity: 1 }, { scale: 0.6, opacity: 0, duration: 0.24, ease: 'power3.inOut' }, '<0.03')
        .fromTo(toEl, { yPercent: 16, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.3, ease: 'power4.out' }, '<0.05')
        .fromTo('.ta-switch-rule', { width: 0 }, { width: 'min(40vw, 460px)', duration: 0.3, ease: 'power3.inOut' }, '<0.02')
        .to({}, { duration: 0.14 })   // brief hold of the year card
        .then();
    }

    // swap the archive content (fully data-driven)
    activeYear = year;
    activeDept = 'all';
    renderAll(team);

    if (animate) {
      await gsap.timeline()
        .to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: 0.38, ease: 'power4.out' })
        .then();
      overlay!.style.visibility = 'hidden';
      overlay!.style.pointerEvents = 'none';
    }

    // land at the archive bar — top of the new chapter, below navbar
    const top = bar ? bar.getBoundingClientRect().top + window.scrollY - navOffset() : 0;
    if (lenisRef) lenisRef.scrollTo(top, { duration: 0.5 });
    else window.scrollTo({ top });

    ScrollTrigger.refresh();
    playYearIntro(false);
  } finally {
    switching = false;
  }
}

const navOffset = (): number =>
  window.innerWidth <= 760 ? 78 : 82;

/* ------------------------------------------------------------------ */
/* ENTRANCES                                                           */
/* ------------------------------------------------------------------ */

function playYearIntro(first: boolean): void {
  if (reduced()) return;

  const yearMask = $('#ta-year-num');
  const stats = document.querySelectorAll<HTMLElement>('.ta-stat');
  const photo = $('#ta-stage-photo');
  const leadPhotos = document.querySelectorAll<HTMLElement>('.ta-lead-photo');
  const cells = document.querySelectorAll<HTMLElement>('.ta-cell');

  void first;

  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .fromTo(yearMask, { yPercent: 110 }, { yPercent: 0, duration: 0.85 }, 0)
    .fromTo(stats, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.05 }, 0.25)
    .fromTo(photo, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.75, ease: 'power3.inOut' }, 0.18)
    .fromTo(leadPhotos, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.75, stagger: 0.06, ease: 'power3.inOut' }, 0.3)
    .fromTo(cells, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, stagger: { each: 0.008, from: 'start' }, ease: 'power3.out', clearProps: 'opacity,transform' }, 0.36);
}

/* ------------------------------------------------------------------ */
/* SCROLL SEQUENCES                                                    */
/* ------------------------------------------------------------------ */

function initHero(): void {
  if (reduced()) {
    document.querySelectorAll<HTMLElement>('.ta-line-inner').forEach((l) => (l.style.transform = 'none'));
    return;
  }

  // load-in: masked type reveal
  gsap.to('.ta-line-inner', {
    y: '0%',
    duration: 1.15,
    ease: 'power4.out',
    stagger: 0.11,
    delay: 0.18,
    onComplete: () => document.querySelectorAll<HTMLElement>('.ta-line-inner').forEach((l) => (l.style.willChange = 'auto')),
  });

  // scroll scrub: photo parallax inside its own protected zone
  ScrollTrigger.create({
    trigger: '.ta-hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    animation: gsap.timeline()
      .to('.ta-hero-media img', { yPercent: 7, scale: 1.05, ease: 'none' }, 0),
  });
}

function initStageScroll(): void {
  if (reduced()) return;

  gsap.fromTo('#ta-stage-ghost',
    { yPercent: -12 },
    {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: { trigger: '.ta-stage', start: 'top bottom', end: 'bottom top', scrub: true },
    });

  document.querySelectorAll<HTMLElement>('.ta-sec-head').forEach((head) => {
    gsap.fromTo(head.querySelector('.ta-sec-rule'), { scaleX: 0 }, {
      scaleX: 1,
      duration: 1.0,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: head, start: 'top 88%', toggleActions: 'play none none none' },
    });
    gsap.fromTo(head.querySelector('.ta-sec-title'), { opacity: 0, y: 18 }, {
      opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: head, start: 'top 88%', toggleActions: 'play none none none' },
    });
  });
}

/* ------------------------------------------------------------------ */
/* RAIL DRAG (horizontal scroll by pointer)                            */
/* ------------------------------------------------------------------ */

function initRailDrag(): void {
  const rail = $('#ta-rail');
  if (!rail) return;

  let down = false;
  let startX = 0;
  let startScroll = 0;
  let moved = false;

  const downFn = (e: PointerEvent) => {
    down = true;
    moved = false;
    startX = e.clientX;
    startScroll = rail.scrollLeft;
    // NOTE: no setPointerCapture here — capturing the pointer redirects the
    // resulting `click` event to the rail itself, which silently killed the
    // year buttons' click handlers.
  };
  const moveFn = (e: PointerEvent) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    rail.scrollLeft = startScroll - dx;
  };
  const upFn = () => { down = false; };

  // released outside the rail → no click on the rail will follow, so clear
  // the drag flag instead of letting it eat the next legitimate click
  const winUpFn = (e: PointerEvent) => {
    if (down && !rail.contains(e.target as Node)) { down = false; moved = false; }
  };

  rail.addEventListener('pointerdown', downFn);
  rail.addEventListener('pointermove', moveFn);
  rail.addEventListener('pointerup', upFn);
  rail.addEventListener('pointercancel', upFn);
  window.addEventListener('pointerup', winUpFn);
  window.addEventListener('pointercancel', winUpFn);

  // suppress click after a drag (capture phase, before it reaches the year button)
  rail.addEventListener('click', (e) => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);

  // year selection via delegation — one listener on the rail, works no matter
  // how the buttons are (re)rendered
  rail.addEventListener('click', (e) => {
    if (moved) return;
    const btn = (e.target as HTMLElement | null)?.closest?.('.ta-year-item') as HTMLElement | null;
    if (!btn) return;
    const y = Number((btn.textContent ?? '').trim());
    if (Number.isFinite(y) && teams[y]) void switchYear(y);
  });
}

/* ------------------------------------------------------------------ */
/* 07 — CAPABILITIES (WHAT WE BUILD)                                   */
/* ------------------------------------------------------------------ */

// capabilities/toolchain DOM setup must run ONCE — renderAll() runs on
// every year switch, and re-running this would duplicate the toolchain
// categories, stack click listeners and stack ScrollTriggers (distorted
// layout). Detail panels read the live roster at click time, so nothing
// goes stale by initializing only once.
let capabilitiesInitialized = false;

function initCapabilities(): void {
  const capabilitiesSection = $('#ta-capabilities');
  const systemModules = document.querySelectorAll('.ta-system-module');
  const systemDetail = $('#ta-system-detail');
  const systemTitle = $('#ta-system-title');
  const systemDesc = $('#ta-system-desc');
  const systemCaps = $('#ta-system-caps');
  const systemTools = $('#ta-system-tools');
  const systemMembers = $('#ta-system-members');

  if (!capabilitiesSection) return;
  if (capabilitiesInitialized) return;
  capabilitiesInitialized = true;

  // Show capabilities section
  capabilitiesSection.hidden = false;

  // Initialize toolchain section
  initToolchain();

  // System module click handlers
  systemModules.forEach((module) => {
    module.addEventListener('click', () => {
      const systemKey = module.getAttribute('data-system') as DeptKey;
      if (!systemKey || !SYSTEM_CAPABILITIES[systemKey]) return;

      const capability = SYSTEM_CAPABILITIES[systemKey];

      // Update active state
      systemModules.forEach(m => m.classList.remove('ta-system-module--active'));
      module.classList.add('ta-system-module--active');

      // Populate and show detail panel
      if (systemTitle) systemTitle.textContent = capability.name;
      if (systemDesc) systemDesc.textContent = capability.description;

      // Populate core functions
      if (systemCaps) {
        systemCaps.innerHTML = '';
        systemCaps.appendChild(el('ta-system-caps-title', 'CORE FUNCTIONS', 'h4'));
        const funcsList = el('ta-system-caps-list', '', 'ul');
        capability.coreFunctions.forEach(func => {
          funcsList.appendChild(el('', `• ${func}`, 'li'));
        });
        systemCaps.appendChild(funcsList);
      }

      // Populate tools
      if (systemTools) {
        systemTools.innerHTML = '';
        systemTools.appendChild(el('ta-system-tools-title', 'TOOLS & TECHNOLOGIES', 'h4'));
        const toolsList = el('ta-system-tools-list', '', 'div');
        capability.tools.forEach(tool => {
          toolsList.appendChild(el('ta-system-tool', tool, 'span'));
        });
        systemTools.appendChild(toolsList);
      }

      // Populate associated members
      if (systemMembers) {
        systemMembers.innerHTML = '';
        systemMembers.appendChild(el('ta-system-members-title', 'ASSOCIATED TEAM MEMBERS', 'h4'));

        const membersList = el('ta-system-members-list', '', 'div');
        const members = capability.getMembers();

        if (members.length === 0) {
          membersList.appendChild(el('ta-system-members-empty', 'No members currently assigned to this system.'));
        } else {
          members.forEach(member => {
            const memberCard = el('ta-system-member');
            memberCard.innerHTML = `
              <div class="ta-system-member-photo">
                ${member.photoBase ? `<img src="/assets/team-photos/${member.photoBase}-400.webp" alt="${member.name}">` : '<div class="ta-system-member-placeholder">?</div>'}
              </div>
              <div class="ta-system-member-info">
                <span class="ta-system-member-name">${member.name}</span>
                <span class="ta-system-member-role">${member.role}</span>
              </div>
            `;
            membersList.appendChild(memberCard);
          });
        }
        systemMembers.appendChild(membersList);
      }

      // Show detail panel with animation
      if (systemDetail) {
        systemDetail.hidden = false;
        gsap.fromTo(systemDetail,
          { opacity: 0, height: 0 },
          { opacity: 1, height: 'auto', duration: 0.4, ease: 'power2.out' }
        );
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* 08 — TOOLCHAIN                                                      */
/* ------------------------------------------------------------------ */

function initToolchain(): void {
  const toolchainSection = $('#ta-toolchain');
  const toolchainCategories = $('#ta-toolchain-categories');

  if (!toolchainSection || !toolchainCategories) return;
  // render once — callers guard against re-init, but keep this safe if
  // ever called directly: never duplicate category blocks
  if (toolchainCategories.childElementCount > 0) return;

  // Show toolchain section
  toolchainSection.hidden = false;

  // Render toolchain categories
  TOOLCHAIN_CATEGORIES_ARRAY.forEach((category) => {
    const categoryEl = el('ta-toolchain-cat');
    categoryEl.setAttribute('data-category', category.name);

    const title = el('ta-toolchain-cat-title', category.name, 'h4');
    categoryEl.appendChild(title);

    const toolsContainer = el('ta-toolchain-tools');
    category.tools.forEach((tool) => {
      const toolEl = el('ta-toolchain-tool', tool, 'span');
      toolsContainer.appendChild(toolEl);
    });
    categoryEl.appendChild(toolsContainer);

    toolchainCategories.appendChild(categoryEl);
  });

  // Animate toolchain categories on scroll
  gsap.from('.ta-toolchain-cat', {
    scrollTrigger: {
      trigger: toolchainSection,
      start: 'top 80%',
      toggleActions: 'play none none none'
    },
    opacity: 0,
    y: 30,
    duration: 0.6,
    stagger: 0.1,
    ease: 'power2.out'
  });
}

/* ------------------------------------------------------------------ */
/* RENDER ALL                                                          */
/* ------------------------------------------------------------------ */

function renderAll(team: TeamYear): void {
  renderRail();
  renderStage(team);
  renderGuidance();
  renderLeadership(team);
  renderFilter(team);
  renderWall(team);
  renderEnd(team);
  initCapabilities(); // Initialize what we build section

  // hero photo follows the active generation when one exists
  const heroImg = $('#ta-hero-img') as HTMLImageElement | null;
  if (heroImg) {
    if (team.teamPhotoBase && GROUP_PHOTOS.has(team.teamPhotoBase)) {
      const g = groupPhoto(team.teamPhotoBase);
      heroImg.src = g.src;
      heroImg.srcset = g.srcset;
      heroImg.parentElement?.classList.remove('ta-hero-media--pending');
    } else {
      heroImg.removeAttribute('src');
      heroImg.removeAttribute('srcset');
      heroImg.parentElement?.classList.add('ta-hero-media--pending');
    }
  }
}

/* ------------------------------------------------------------------ */
/* ENTRY                                                               */
/* ------------------------------------------------------------------ */

export function initTeamArchive(lenis: Lenis | null): void {
  if (!$('#ta-rail')) return;   // not the team page
  lenisRef = lenis;

  // 1. paint immediately from the static roster — the page works
  //    before Supabase is configured or the import has run
  renderAll(teams[DEFAULT_YEAR] ?? teams[YEARS[YEARS.length - 1]]);
  activeYear = DEFAULT_YEAR;
  activeDept = 'all';

  initHero();
  initStageScroll();
  initRailDrag();
  playYearIntro(true);

  ScrollTrigger.refresh();

  // 2. ask the database for the authoritative roster. On success it
  //    REPLACES the static data — including years where an admin has
  //    removed members (an empty year stays empty; no silent fallback).
  void loadDatabaseRoster();
}

/** fetch the DB roster and swap it in when it is authoritative */
async function loadDatabaseRoster(): Promise<void> {
  const result = await fetchPublicRoster();
  if (result.source !== 'database') return;   // not configured / failed / empty → keep static

  // don't fight an in-flight year-switch animation
  if (switching) {
    setTimeout(() => void loadDatabaseRoster(), 150);
    return;
  }

  teams = result.teams;
  years = result.years;
  setActiveRosterSource(teams);   // capabilities section reads the same source

  // keep the visitor's year when it still exists; otherwise land on the latest
  const target = teams[activeYear] ? activeYear : years[years.length - 1];
  activeYear = target;
  activeDept = 'all';
  renderAll(teams[target]);
  ScrollTrigger.refresh();
}

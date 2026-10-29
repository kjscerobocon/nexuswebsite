/**
 * HOMEPAGE MOTION ENGINE — NEXUS ROBOTICS
 *
 * Six chapters, one instrument. Everything scroll-driven runs through one
 * master-scrub philosophy: heavy deliberate motion for big elements, fast
 * precise motion for UI, and moments of stillness between chapters.
 *
 * Structure:
 *   1. Arrival — load-in mask reveals + scroll-linked hero exit (depth)
 *   2. Manifesto — line-mask reveals, asymmetric drift
 *   3. Collective — pinned viewport-dominant number sequence
 *   4. Machine — crop-locked zoom into the pit photo, overlapping type
 *   5. System — division index rows, cursor-following archival plate
 *   6. Archive — hover plates + closing statement mask reveal
 *   + chapter instrument (fixed readout)
 *
 * Navbar: the shared GlobalNavbar component (see src/components/).
 *
 * No scroll-jacking: Lenis feeds native scroll, ScrollTrigger scrubs only.
 * prefers-reduced-motion: static readable composition (CSS handles most;
 * JS bails from all sequences).
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const q = (s: string, ctx: ParentNode = document) => ctx.querySelector<HTMLElement>(s);
const qa = (s: string, ctx: ParentNode = document) =>
  gsap.utils.toArray<HTMLElement>(s, ctx);

/* ------------------------------------------------------------------ */
/* NAVBAR — handled by the shared GlobalNavbar component               */
/* (src/components/global-navbar.ts); the homepage no longer styles   */
/* or drives its own navigation.                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 01 ARRIVAL                                                          */
/* ------------------------------------------------------------------ */

function initArrival(): void {
  const section = q('.hp-arrival');
  const title = q('#hp-arrival-title');
  const img = q('#hp-arrival-img');
  const kicker = q('.hp-arrival-kicker');
  const foot = q('.hp-arrival-foot');
  if (!section) return;

  /* load-in: line masks rise, metadata staggers in — deliberate */
  if (title) {
    gsap.to(qa('.hp-line-inner', title), {
      y: '0%',
      duration: 1.6,
      ease: 'power4.out',
      stagger: 0.14,
      delay: 0.25
    });
  }

  if (kicker && foot) {
    gsap.from([kicker, foot], {
      opacity: 0,
      y: 14,
      duration: 1.1,
      ease: 'power3.out',
      stagger: 0.18,
      delay: 0.9,
      clearProps: 'all'
    });
    gsap.from(qa('.hp-arrival-units', foot), {
      opacity: 0,
      y: 10,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.1,
      delay: 1.25,
      clearProps: 'all'
    });
  }

  /* scroll exit: photo gains scale + brightness, type separates upward
     at a different rate — layered depth, not a fade */
  if (img) {
    gsap.fromTo(
      img,
      { scale: 1.06, filter: 'brightness(0.7) saturate(0.82)' },
      {
        scale: 1.18,
        filter: 'brightness(1) saturate(0.82)',
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6
        }
      }
    );
  }

  if (title) {
    gsap.to(title, {
      yPercent: -22,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5
      }
    });
  }

  /* foot drifts slower — parallax separation into the manifesto */
  if (foot) {
    gsap.to(foot, {
      yPercent: -10,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: '40% top',
        end: 'bottom top',
        scrub: 0.5
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/* 02 MANIFESTO                                                        */
/* ------------------------------------------------------------------ */

function initManifesto(): void {
  /* mask reveal per line, with a beat of stillness between blocks */
  qa('.hp-m-block').forEach((block) => {
    gsap.to(qa('.hp-m-inner', block), {
      y: '0%',
      duration: 1.3,
      ease: 'power4.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: block,
        start: 'top 78%',
        toggleActions: 'play none none none'
      }
    });
  });

  /* aside copy: one precise entrance */
  const aside = q('.hp-m-aside');
  if (aside) {
    gsap.from(aside, {
      opacity: 0,
      y: 24,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: aside,
        start: 'top 82%',
        toggleActions: 'play none none none'
      },
      clearProps: 'opacity,transform'
    });
  }

  /* data rows draw in as a group */
  const data = q('.hp-m-data');
  if (data) {
    gsap.from(data, {
      opacity: 0,
      y: 18,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: data, start: 'top 86%' },
      clearProps: 'all'
    });
  }
}

/* ------------------------------------------------------------------ */
/* 03 COLLECTIVE — pinned number sequence                              */
/* ------------------------------------------------------------------ */

function initCollective(): void {
  const stage = q('#hp-col-stage');
  const nums = qa('[data-num]');
  if (!stage || nums.length === 0) return;

  /* ONE SCROLL OWNER — pinned scrub; every statistic plate, its label
     and its index are derived from the SAME progress scalar inside
     renderCollective(). No per-plate GSAP tweens, no second owner
     toggling .is-active on its own rounding, no enter-from-below that
     can leave the frame. Transitions are OVERLAPPING crossfades: the
     outgoing plate eases out across the SAME window in which the
     incoming plate eases in. */
  const smoothstep = (t: number): number => {
    const c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
  };
  const cross = (p: number, a: number, b: number): number =>
    smoothstep((p - a) / Math.max(1e-6, b - a));

  const renderCollective = (progress: number): void => {
    const p = Math.min(1, Math.max(0, progress));
    const n = nums.length;
    const w = 0.025; /* half-window: transition ≈22% of centre distance */
    nums.forEach((num, i) => {
      /* plate centres mapped across the pin: 38 ≈ 0.10, 05 ≈ 0.35,
         10+ ≈ 0.60, AIR 5 ≈ 0.85 — the first plate is fully on at p=0
         and the last settles shortly before the pin releases, so THE
         MACHINE (R3) follows naturally with no dead tail */
      const c = n > 1 ? 0.1 + 0.75 * (i / (n - 1)) : 0;
      const cn = n > 1 ? 0.1 + 0.75 * ((i + 1) / (n - 1)) : 1;
      let o = 1;
      let cin = 1;   /* 0→1 as this plate arrives */
      let cout = 0;  /* 0→1 as this plate leaves */
      if (i > 0) {
        cin = cross(p, c - w, c + w);
        o *= cin;
      }
      if (i < n - 1) {
        cout = cross(p, cn - w, cn + w);
        o *= 1 - cout;
      }
      num.style.opacity = o.toFixed(4);
      num.style.visibility = o > 0.001 ? 'visible' : 'hidden';
      num.classList.toggle('is-active', o > 0.5);
      /* same-box settle: incoming rises +6px into place, outgoing lifts
         −6px away — every plate keeps the EXACT same bounding box */
      const dy = (1 - cin) * 6 - cout * 6;
      const fig = q('.hp-num-figure', num);
      fig && (fig.style.transform = `translateY(${dy.toFixed(2)}px)`);
      const lab = q('.hp-num-label', num);
      lab && (lab.style.transform = `translateY(${(dy * 1.6).toFixed(2)}px)`);
      const idxEl = q('.hp-num-idx', num);
      idxEl && (idxEl.style.opacity = o.toFixed(4));
    });
  };

  /* trigger on the SECTION element: 'top top' then refers to the
     section top, which equals the stage top (stage is its first child
     at full width, no gap) — and the section's document position is
     after the s01 section, keeping refresh order unambiguous */
  const orderEl = stage.parentElement ?? stage;

  /* seed the composition before any scroll */
  renderCollective(0);

  /* refreshPriority: refreshes run highest-priority-first, so -1 makes
     this trigger measure AFTER the SYSTEM_01 master pin (default 0).
     The s01 pin spacer is 1944px tall — if this trigger measured before
     that spacer existed it would cache a start ~one viewport too high,
     and progress would already be 1 when the user reaches the stage. */
  ScrollTrigger.create({
    trigger: orderEl,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight * 1.5)}`, // pacing only
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    refreshPriority: -1,
    onUpdate: (self) => renderCollective(self.progress),
  });

  /* dev diagnostics (?s01debug) — cached trigger geometry */
  if (new URLSearchParams(location.search).has('s01debug')) {
    const dump = (): void => {
      const st = ScrollTrigger.getAll().find(
        (t) => t.trigger === orderEl
      );
      const r = stage.getBoundingClientRect();
      const spacer = stage.closest('.pin-spacer') as HTMLElement | null;
      console.log(
        '[COLLECTIVE DEBUG] start=' + (st?.start ?? '?') +
        ' end=' + (st?.end ?? '?') +
        ' progress=' + (st?.progress.toFixed(3) ?? '?') +
        ' stageAbs=' + (r.top + window.scrollY).toFixed(0) +
        ' spacerAbs=' + (spacer
          ? spacer.getBoundingClientRect().top + window.scrollY : -1).toFixed(0) +
        ' spacerH=' + (spacer?.offsetHeight ?? -1)
      );
    };
    requestAnimationFrame(dump);
    ScrollTrigger.addEventListener('refresh', dump);
  }
}

/* ------------------------------------------------------------------ */
/* 04 MACHINE — crop-locked zoom                                       */
/* ------------------------------------------------------------------ */

function initMachine(): void {
  const img = q('#hp-unit-img');
  if (img) {
    /* gentle push-in — kept subtle (1.06) so the full portrait frame
       stays visible while scrolling (a bigger scale re-crops the photo) */
    gsap.fromTo(
      img,
      { scale: 1 },
      {
        scale: 1.06,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hp-unit-media',
          start: 'top 85%',
          end: 'bottom 30%',
          scrub: 0.6
        }
      }
    );
  }

  /* spec rows: staggered hairline draws, not cards */
  qa('.hp-spec-row').forEach((row, i) => {
    gsap.from(row, {
      opacity: 0,
      x: -24,
      duration: 0.7,
      ease: 'power3.out',
      delay: i * 0.05,
      scrollTrigger: { trigger: row, start: 'top 92%' },
      clearProps: 'opacity,transform'
    });
  });

  /* name: heavy overlap entrance */
  const name = q('.hp-unit-name');
  if (name) {
    gsap.from(name, {
      yPercent: 12,
      opacity: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: name, start: 'top 88%' },
      clearProps: 'opacity,transform'
    });
  }
}

/* ------------------------------------------------------------------ */
/* 05 SYSTEM — division index with cursor plate                        */
/* ------------------------------------------------------------------ */

function initSystem(): void {
  const rows = qa('.hp-sys-row');
  if (!rows.length) return;

  /* rows draw in as one system graphic */
  gsap.fromTo(rows,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: '.hp-system-index',
        start: 'top 85%',
        toggleActions: 'play none none none'
      }
    }
  );

  /* cursor-following archival plate — fast, precise */
  const plate = q('#hp-idx-float');
  const plateImg = plate ? plate.querySelector('img') : null;
  if (plate && plateImg) {
    const xTo = gsap.quickTo(plate, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(plate, 'y', { duration: 0.5, ease: 'power3.out' });
    let visible = false;

    const show = () => {
      gsap.to(plate, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      visible = true;
    };
    const hide = () => {
      gsap.to(plate, { opacity: 0, duration: 0.3, ease: 'power2.in' });
      visible = false;
    };

    document.querySelectorAll<HTMLElement>('[data-img]').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        const src = row.dataset.img;
        if (src) plateImg.setAttribute('src', src);
        if (!visible) show();
      });
      row.addEventListener('mouseleave', hide);
    });

    window.addEventListener('mousemove', (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
    });
  }

  /* tint the division name per dept signature color on hover */
  rows.forEach((row) => {
    const tint = row.dataset.tint;
    const nameEl = q('.hp-sys-name', row);
    if (!tint || !nameEl) return;
    row.addEventListener('mouseenter', () =>
      gsap.to(nameEl, { color: tint, duration: 0.35 })
    );
    row.addEventListener('mouseleave', () =>
      gsap.to(nameEl, { color: '#E8EDF0', duration: 0.35 })
    );
  });
}

/* ------------------------------------------------------------------ */
/* 06 ARCHIVE — rows + closing statement                               */
/* ------------------------------------------------------------------ */

function initArchive(): void {
  const rows = qa('.hp-idx-row');
  if (rows.length) {
    gsap.from(rows, {
      opacity: 0,
      y: 44,
      duration: 0.9,
      ease: 'power3.out',
      stagger: 0.09,
      scrollTrigger: { trigger: '.hp-index-rows', start: 'top 85%' },
      clearProps: 'opacity,transform'
    });
  }

  const close = q('.hp-close');
  if (close) {
    gsap.to(qa('.hp-close-line .hp-m-inner', close), {
      y: '0%',
      duration: 1.3,
      ease: 'power4.out',
      stagger: 0.14,
      scrollTrigger: { trigger: close, start: 'top 80%', toggleActions: 'play none none none' }
    });
    const cta = q('.hp-close-cta', close);
    if (cta) {
      gsap.from(cta, {
        opacity: 0,
        y: 16,
        duration: 0.9,
        delay: 0.4,
        ease: 'power3.out',
        scrollTrigger: { trigger: close, start: 'top 80%', toggleActions: 'play none none none' }
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* CHAPTER INSTRUMENT — progress readout                               */
/* ------------------------------------------------------------------ */

function initInstrument(): void {
  /* GLOBAL PERSISTENT HUD - one instrument for the whole homepage.
     The corner labels never disappear; they step opacity per section:
     hide (arrival - hero owns its own labels), dim (text-heavy),
     lift (visual chapters). The assembly overrides the SYSTEM STATUS
     word and the sub-phase readout while it is pinned. */
  const hud = q('#hp-hud');
  const fill = q('#hp-hud-fill');
  const numEl = q('#hp-hud-num');
  const nameEl = q('#hp-hud-name');
  const wordEl = q('#hp-hud-status-word');
  const subEl = q('#hp-hud-sub');
  const sections = qa('section[data-chapter]');
  if (!hud || !fill || !numEl || !nameEl || !sections.length) return;

  /* status word ownership: assembly writes it while pinned, then hands back */
  let statusOwner = 0; /* 0 = chapters, 1 = assembly */

  /* appear after the arrival hero */
  gsap.set(hud, { opacity: 0 });
  ScrollTrigger.create({
    trigger: '#hp-arrival',
    start: 'bottom 70%',
    onEnter: () => gsap.to(hud, { opacity: 1, duration: 0.6 }),
    onLeaveBack: () => gsap.to(hud, { opacity: 0, duration: 0.4 })
  });

  /* per-chapter values + hud dimming */
  sections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return;
        numEl.textContent = section.dataset.chapter || '01';
        nameEl.textContent = section.dataset.name || '';
        const mode = section.dataset.hud || 'dim';
        /* hide = hero owns its labels; dim = 0.28; lift = 0.55 */
        const target = mode === 'hide' ? 0 : mode === 'lift' ? 0.55 : 0.28;
        gsap.to(hud, { opacity: target, duration: 0.5, overwrite: 'auto' });
        if (statusOwner === 0) {
          if (wordEl) {
            const busy = section.dataset.name === 'THE ASSEMBLY';
            wordEl.textContent = busy ? 'ASSEMBLING' : 'ACTIVE';
          }
        }
      }
    });
  });

  /* the fill is the homepage progress 0 - 1 across all chapters */
  gsap.fromTo(
    fill,
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hp-arrival',
        start: 'top top',
        endTrigger: '#hp-index',
        end: 'bottom bottom',
        scrub: true
      }
    }
  );

  /* expose one global setter so the assembly timeline can drive the
     same HUD (status word + sub-phase line) without a second instrument */
  (window as unknown as Record<string, unknown>).hpHudSetStatus =
    (word: string, sub: string): void => {
      statusOwner = 1;
      if (wordEl) wordEl.textContent = word;
      if (subEl) subEl.textContent = sub;
    };
  (window as unknown as Record<string, unknown>).hpHudReleaseStatus = (): void => {
    statusOwner = 0;
  };
}

/* ------------------------------------------------------------------ */
/* ENTRY                                                               */
/* ------------------------------------------------------------------ */

export function initHome(): void {
  if (!document.body.classList.contains('hp-scope')) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    /* CSS already renders a full static composition; nothing to drive */
    return;
  }

  // initNavbar was removed with the legacy homepage navbar — the shared
  // GlobalNavbar (src/components/global-navbar.ts) owns all navigation.
  initArrival();
  initManifesto();
  initCollective();
  initMachine();
  initSystem();
  initArchive();
  initInstrument();

  /* NO refresh here. SYSTEM_01's section module (lazy chunk, mounted
     right after this) synchronously creates its master pin and then
     performs the ONE deterministic ScrollTrigger.refresh() for the whole
     homepage — measuring every trigger WITH the pin spacer in place.
     A rAF refresh here would race the lazy chunk and measure the page
     without the spacer, producing the startup jump. */
}

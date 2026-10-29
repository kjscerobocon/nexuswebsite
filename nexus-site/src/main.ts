import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Import utilities
import { mountGlobalNavbar } from './components/global-navbar';
import './components/global-navbar.css';
import { FormHandler } from './utils/form-handler';
import { initJourney } from './journey';
import { initHome } from './home';
import { initTeamArchive } from './team-archive';
import { initNetwork } from './network';
import { initNexusNow } from './nexus-now';
import { renderNowPreview } from './nn-preview';
import { initContact } from './contact';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scroll (Lenis) — buttery inertial scrolling, GSAP-ticker driven.
 * Falls back to native scrolling when the user prefers reduced motion
 * or the browser lacks the basics Lenis needs.
 */
export const lenis: Lenis | null = (() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const capable = 'IntersectionObserver' in window && 'ResizeObserver' in window;
  if (reducedMotion || !capable) return null;

  const instance = new Lenis({
    duration: 1.15,              // length of the glide per scroll tick
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out glide
    wheelMultiplier: 1,
    touchMultiplier: 1.4,
    autoRaf: false               // we drive frames from the GSAP ticker
  });

  // Drive Lenis from the GSAP ticker so ScrollTrigger scrub stays perfectly in sync
  gsap.ticker.add((time) => instance.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);   // no lag-compensation jumps on tab-switch back

  // Keep ScrollTrigger measurement in the loop
  instance.on('scroll', ScrollTrigger.update);

  return instance;
})();

// Anchor links (<a href="#...">) route through Lenis for the same glide
if (lenis) {
  document.addEventListener('click', (e) => {
    const anchor = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const id = anchor.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target as HTMLElement, { offset: -72 });   // navbar clearance (scrolled state 60px + 12px air)
  });
}

/**
 * Initialize scroll-triggered animations
 */
function initScrollAnimations(): void {
  gsap.utils.toArray<HTMLElement>('.intro-text').forEach((element) => {
    gsap.to(element, {
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power3.out'
    });
  });

  // Stats animation
  gsap.utils.toArray<HTMLElement>('.stat-item').forEach((item, index) => {
    gsap.to(item, {
      scrollTrigger: {
        trigger: item,
        start: 'top 90%',
        toggleActions: 'play none none none'
      },
      opacity: 1,
      y: 0,
      duration: 0.9,
      delay: index * 0.15,
      ease: 'power3.out'
    });
  });

  // Preview cards animation - staggered
  gsap.utils.toArray<HTMLElement>('.preview-card').forEach((card, index) => {
    gsap.to(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
        toggleActions: 'play none none none'
      },
      opacity: 1,
      y: 0,
      duration: 1,
      delay: index * 0.12,
      ease: 'power3.out'
    });
  });

  // Department cards animation - staggered
  gsap.utils.toArray<HTMLElement>('.dept-preview-card').forEach((card, index) => {
    gsap.to(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 90%',
        toggleActions: 'play none none none'
      },
      opacity: 1,
      y: 0,
      duration: 1,
      delay: index * 0.1,
      ease: 'power3.out'
    });
  });

  // Section titles animation
  gsap.utils.toArray<HTMLElement>('.section-title').forEach((title) => {
    gsap.from(title, {
      scrollTrigger: {
        trigger: title,
        start: 'top 90%',
        toggleActions: 'play none none none'
      },
      opacity: 0,
      y: 40,
      duration: 1,
      ease: 'power3.out'
    });
  });

  // Section subtitles animation
  gsap.utils.toArray<HTMLElement>('.section-subtitle').forEach((subtitle) => {
    gsap.from(subtitle, {
      scrollTrigger: {
        trigger: subtitle,
        start: 'top 90%',
        toggleActions: 'play none none none'
      },
      opacity: 0,
      y: 30,
      duration: 0.9,
      delay: 0.1,
      ease: 'power3.out'
    });
  });

  // Timeline items — slide in from the side they sit on, staggered
  gsap.utils.toArray<HTMLElement>('.timeline-item').forEach((item, index) => {
    gsap.from(item, {
      scrollTrigger: {
        trigger: item,
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      x: index % 2 === 0 ? -60 : 60,
      opacity: 0,
      duration: 1,
      ease: 'power3.out'
    });
  });

  // Achievement cards — staggered rise
  gsap.utils.toArray<HTMLElement>('.achievement-card').forEach((card, index) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
        toggleActions: 'play none none none'
      },
      y: 50,
      opacity: 0,
      duration: 0.8,
      delay: index * 0.12,
      ease: 'power3.out'
    });
  });

  // NOTE: the About page journey timeline now runs through ./journey.ts
  // (initJourney) — the legacy .timeline scrub was removed with it.

  // Page header title + subtitle (e.g. About, Departments hero)
  gsap.utils.toArray<HTMLElement>('.page-header h1').forEach((title) => {
    gsap.from(title, {
      opacity: 0,
      y: 40,
      duration: 1.2,
      ease: 'power3.out'
    });
  });
}

/**
 * Animate counters with smooth easing
 */
function animateCounters(): void {
  const counters = document.querySelectorAll<HTMLElement>('.stat-number, .achievement-number');

  counters.forEach((counter) => {
    const target = parseInt(counter.getAttribute('data-target') || '0');

    ScrollTrigger.create({
      trigger: counter,
      start: 'top 90%',
      onEnter: () => {
        gsap.to(counter, {
          innerHTML: target,
          duration: 2,
          snap: { innerHTML: 1 },
          ease: 'power2.out'
        });
      }
    });
  });
}

/**
 * Initialize all visual effects and utilities
 */
function initVisualEffects(): void {
    // Global navbar — THE one navigation interface, mounted from this root
    // entry so every route receives the exact same component. Must run
    // regardless of reduced-motion (states fall back to instant).
    mountGlobalNavbar();

    // Initialize form handler
    new FormHandler('contactForm');
}

/**
 * Initialize all animations
 */
function initAllAnimations(): void {
  // Homepage six-chapter experience (body.hp-scope gates it)
  initHome();

  // Scroll-triggered animations (legacy sections on inner pages)
  initScrollAnimations();

  // Journey cinematic timeline (About page) — needs lenis for rail glide
  initJourney(lenis);

  // Team archive (Team page) — year generations, portrait wall, filters
  initTeamArchive(lenis);

  // Nexus Now (nexus-now page) — live operations feed
  initNexusNow();

  // Counter animations
  animateCounters();
}
/**
 * Application initialization
 */
function init(): void {
  // Skip heavy animations if user prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) {
    initAllAnimations();
  } else {
    // Reduced motion: RENDERING is not animation. The team archive
    // mounts the roster and self-gates every animation on the media
    // query (reduced()) — without this call the Team page rendered
    // completely empty. Same convention as initNetwork / initContact.
    initTeamArchive(lenis);
  }
  initVisualEffects();

  // Nexus network (Sponsors page) — renders the partner archive and wires
  // interactions. Called unconditionally: RENDERING is not animation — the
  // archive must exist even under reduced-motion (its internal motion
  // self-gates on the media query). No #nw-root on other pages = no-op.
  initNetwork(lenis);

  // Communications terminal (Contact page) — renders the signal field and
  // entrance choreography. Unconditional like initNetwork: rendering is not
  // animation; no #ct-root on other pages = no-op.
  initContact();

  // NEXUS NOW preview strip (homepage) — renders the live teaser rows
  // from the nexus-now data module. Rendering is not animation; no
  // #hp-now-rows on other pages = no-op.
  renderNowPreview();

  // Load the 3D explode viewer only on the Robots page (heavy three.js dep)
  if (document.getElementById('robot-3d-canvas')) {
    import('./robot-viewer').then(({ initRobotViewer }) => {
      initRobotViewer();
    }).catch((err) => {
      console.error('[Robot Viewer] Failed to load module:', err);
    });
  }

  // SYSTEM_01 assembly (homepage chapter 03) — section choreography +
  // three.js engine both live in lazy chunks; nothing loads on other pages.
  // Runs even under reduced-motion: the module mounts the static fallback.
  if (document.getElementById('s01-stage')) {
    import('./system01-section').then(({ initSystem01Section }) => {
      initSystem01Section();
    }).catch((err) => {
      console.error('[SYSTEM_01] Failed to load section module:', err);
    });
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for potential external use
export { init };

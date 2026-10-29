/**
 * MOBILE NAVIGATION — the SYSTEM INDEX drawer.
 *
 * Full-height overlay in the site's dark technical language: a header
 * row with the three-anchor identity (Vidyavihar · Nexus · Trust),
 * then the six routes as indexed rows (01 / ABOUT …), with the active
 * route marked. No white drawer, no generic hamburger panel.
 */
import { NAV_ITEMS, type NavState } from '../config/navigation';

export function createMobileNavigation(state: NavState): string {
    const rows = NAV_ITEMS.map((item) => {
        const active = state.active?.route === item.route;
        return `
          <a class="gn-m-row${active ? ' is-active' : ''}" href="${item.route}"${active ? ' aria-current="page"' : ''}>
            <span class="gn-m-index">${item.index}</span>
            <span class="gn-m-sep" aria-hidden="true">/</span>
            <span class="gn-m-label">${item.label}</span>
            <span class="gn-m-context">${item.context}</span>
            <span class="gn-m-rule" aria-hidden="true"></span>
          </a>`;
    }).join('');

    return `
      <div class="gn-mobile" id="gn-mobile" aria-hidden="true">
        <div class="gn-m-head">
          <img class="gn-m-inst gn-m-inst-left" src="/Images/K J Somaiya College of Engineering.webp" alt="Somaiya Vidyavihar">
          <img class="gn-m-mark" src="/Images/Nexus_logo.webp" alt="NEXUS ROBOTICS">
          <img class="gn-m-inst gn-m-inst-right" src="/Images/somaiya trust.webp" alt="Somaiya Trust">
        </div>
        <div class="gn-m-index-label" aria-hidden="true">SYSTEM INDEX</div>
        <nav class="gn-m-rows">${rows}</nav>
        <div class="gn-m-foot">
          <span>${state.metaLabel}</span>
          <span class="gn-m-dot" aria-hidden="true"></span>
          <span>KJ SOMAIYA</span>
        </div>
      </div>`;
}

/** Wires open/close behaviour. */
export function bindMobileNavigation(
    drawer: HTMLElement,
    toggle: HTMLElement
): void {
    const setOpen = (open: boolean) => {
        toggle.classList.toggle('is-active', open);
        toggle.setAttribute('aria-expanded', String(open));
        drawer.classList.toggle('is-open', open);
        drawer.setAttribute('aria-hidden', String(!open));
        document.body.classList.toggle('gn-locked', open);
    };

    toggle.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));

    // Close on route selection
    drawer.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        a.addEventListener('click', () => setOpen(false));
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
    });

    // Reset if resized past the mobile breakpoint
    const mq = window.matchMedia('(min-width: 1080px)');
    const onChange = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener('change', onChange);
}

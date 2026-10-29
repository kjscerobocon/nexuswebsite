/**
 * NEXUS NOW PREVIEW — homepage teaser strip.
 *
 * Renders the compact live-activity rows (#hp-now-rows) from the same
 * data module that powers the NEXUS NOW page, so both surfaces stay in
 * sync from one source of truth.
 *
 * Rendering is NOT animation: this runs even under prefers-reduced-motion
 * (same contract as initNetwork / initContact). The reveal transition
 * self-gates on the media query. No #hp-now-rows on the page = no-op.
 */

import { LIVE_STATUS, STORIES } from './data/nexus-now-data';

export function renderNowPreview(): void {
    const mount = document.getElementById('hp-now-rows');
    if (!mount) return;

    /* live rows (build / recruitment / accolade) + first completed story */
    const story = STORIES[0];

    const rows = LIVE_STATUS.slice(0, 3).map((row) => `
        <a class="hp-now-row" href="${row.link?.url || 'nexus-now.html'}">
            <span class="hp-now-row-label">${row.label}</span>
            <span class="hp-now-row-rule" aria-hidden="true"></span>
            <span class="hp-now-row-value">${row.value} — ${row.status}</span>
            <span class="hp-now-row-go" aria-hidden="true">→</span>
        </a>
    `).join('');

    const storyRow = story ? `
        <a class="hp-now-row" href="${story.url}">
            <span class="hp-now-row-label">${story.title}</span>
            <span class="hp-now-row-rule" aria-hidden="true"></span>
            <span class="hp-now-row-value">EVENT COMPLETE</span>
            <span class="hp-now-row-go" aria-hidden="true">→</span>
        </a>
    ` : '';

    mount.innerHTML = rows + storyRow;

    /* lightweight stagger reveal — static under reduced motion */
    const items = Array.from(mount.querySelectorAll<HTMLElement>('.hp-now-row'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || !('IntersectionObserver' in window)) return;

    items.forEach((item) => { item.style.opacity = '0'; });

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            const index = items.indexOf(el);
            el.style.transition = `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 0.08}s, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 0.08}s`;
            el.style.transform = 'translateY(14px)';
            requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.transform = 'none';
            });
            io.unobserve(entry.target);
        });
    }, { threshold: 0.3 });

    items.forEach((item) => io.observe(item));
}

export default renderNowPreview;

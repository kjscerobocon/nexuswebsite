/**
 * NEXUS NOW PAGE LOGIC — the live heartbeat.
 *
 * Renders and animates the three layers of the page:
 *   - LIVE   : status console rows (from LIVE_STATUS data)
 *   - STORIES: permanent story cards (from STORIES data)
 *   - LOG    : field-log timeline (from FIELD_LOG data)
 *
 * Plus the mission-clock readout (IST) and scroll reveals via
 * IntersectionObserver + CSS — no extra global ScrollTrigger work,
 * nothing here touches the homepage SYSTEM_01 architecture.
 */

import { LIVE_STATUS, STORIES, FIELD_LOG, ROBOCON_2026_PHASES } from './data/nexus-now-data';

export function initNexusNow(): void {
    if (!document.getElementById('nn-status-console')) return;
    renderStatusConsole();
    renderPhaseTracker();
    renderStories();
    renderFieldLog();
    initMissionClock();
    initReveals();
}

/* ------------------------------------------------------------------ */
/* LIVE — status console                                               */
/* ------------------------------------------------------------------ */

function renderStatusConsole(): void {
    const console_ = document.getElementById('nn-status-console');
    if (!console_) return;

    console_.innerHTML = LIVE_STATUS.map((row) => `
        <div class="nn-row" data-level="${row.level}">
            <span class="nn-row-label">${row.label}</span>
            <span class="nn-row-value">${row.value}</span>
            <span class="nn-row-status"><i class="nn-dot"></i>${row.status}</span>
        </div>
    `).join('');

    /* the note panel under the console mirrors the hovered/active row */
    const noteEl = document.getElementById('nn-status-note');
    const noteText = document.getElementById('nn-status-note-text');
    const noteLink = document.getElementById('nn-status-note-link') as HTMLAnchorElement | null;

    const rows = Array.from(console_.querySelectorAll<HTMLElement>('.nn-row'));

    const showNote = (row: HTMLElement, index: number) => {
        rows.forEach((r) => r.classList.remove('is-active'));
        row.classList.add('is-active');
        const data = LIVE_STATUS[index];
        if (!data) return;
        if (noteEl) noteEl.dataset.level = data.level;
        if (noteText) noteText.textContent = data.note || '';
        if (noteLink) {
            if (data.link) {
                noteLink.textContent = `${data.link.text} →`;
                noteLink.setAttribute('href', data.link.url);
                noteLink.removeAttribute('hidden');
            } else {
                noteLink.setAttribute('hidden', '');
            }
        }
    };

    rows.forEach((row, index) => {
        row.addEventListener('mouseenter', () => showNote(row, index));
        row.addEventListener('click', () => showNote(row, index));
        row.addEventListener('focus', () => showNote(row, index));
    });

    /* default: first row active */
    if (rows.length) showNote(rows[0], 0);
}

/* ------------------------------------------------------------------ */
/* LIVE — Robocon phase tracker                                        */
/* ------------------------------------------------------------------ */

function renderPhaseTracker(): void {
    const tracker = document.getElementById('nn-phase-track');
    if (!tracker) return;

    tracker.innerHTML = ROBOCON_2026_PHASES.map((p) => `
        <div class="nn-phase" data-status="${p.status}">
            <i class="nn-phase-dot"></i>
            <span class="nn-phase-name">${p.name}</span>
        </div>
    `).join('') + '<span class="nn-phase-rule" aria-hidden="true"></span>';
}

/* ------------------------------------------------------------------ */
/* STORIES — permanent event retrospectives                            */
/* ------------------------------------------------------------------ */

function renderStories(): void {
    const grid = document.getElementById('nn-stories-grid');
    if (!grid) return;

    grid.innerHTML = STORIES.map((s, i) => `
        <a class="nn-story" href="${s.url}" data-reveal>
            <figure class="nn-story-media">
                <img src="${s.image}" alt="${s.imageAlt}" loading="${i === 0 ? 'eager' : 'lazy'}">
                <span class="nn-story-kind">${s.kind}</span>
            </figure>
            <div class="nn-story-body">
                <div class="nn-story-meta">
                    <span class="nn-story-date">${s.date}</span>
                    <span class="nn-story-flag">● COMPLETE</span>
                </div>
                <h3 class="nn-story-title">${s.title}</h3>
                <p class="nn-story-summary">${s.summary}</p>
                <div class="nn-story-stats">
                    ${s.stats.map((st) => `
                        <div class="nn-story-stat">
                            <span class="nn-story-stat-k">${st.k}</span>
                            <span class="nn-story-stat-v">${st.v}</span>
                        </div>
                    `).join('')}
                </div>
                <span class="nn-story-cta">READ THE STORY →</span>
            </div>
        </a>
    `).join('');
}

/* ------------------------------------------------------------------ */
/* FIELD LOG — the living timeline                                     */
/* ------------------------------------------------------------------ */

function renderFieldLog(): void {
    const timeline = document.getElementById('nn-timeline');
    if (!timeline) return;

    timeline.innerHTML = FIELD_LOG.map((entry) => `
        <div class="nn-entry" data-reveal>
            <div class="nn-entry-marker"><i></i></div>
            <div class="nn-entry-body">
                <div class="nn-entry-head">
                    <span class="nn-entry-date">${entry.date}</span>
                    <span class="nn-entry-title">${entry.title}</span>
                </div>
                <p class="nn-entry-desc">${entry.description}</p>
                ${entry.link ? `<a class="nn-entry-link" href="${entry.link.url}">${entry.link.text} →</a>` : ''}
            </div>
        </div>
    `).join('');
}

/* ------------------------------------------------------------------ */
/* MISSION CLOCK — IST readout in the hero                             */
/* ------------------------------------------------------------------ */

function initMissionClock(): void {
    const clock = document.getElementById('nn-clock');
    if (!clock) return;

    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const tick = () => { clock.textContent = `${fmt.format(new Date())} IST`; };
    tick();
    window.setInterval(tick, 1000);
}

/* ------------------------------------------------------------------ */
/* REVEALS — one lightweight observer for this page only               */
/* ------------------------------------------------------------------ */

function initReveals(): void {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
        els.forEach((el) => el.classList.add('is-in'));
        return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
        els.forEach((el) => el.classList.add('is-in'));
        return;
    }

    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach((el) => io.observe(el));
}

export default initNexusNow;

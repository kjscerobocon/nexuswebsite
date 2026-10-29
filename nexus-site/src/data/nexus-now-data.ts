/**
 * NEXUS NOW DATA — the live heartbeat of NEXUS Robotics.
 *
 * One data file drives the whole NEXUS NOW layer:
 *
 *   LIVE    — what the team is doing right now (status console rows)
 *   STORIES — permanent retrospective pages for completed major
 *             activities (KYNEX '26, LA CASA DE BOTS, … future events)
 *   FIELD LOG — dated entries, newest first; the living timeline
 *
 * UPDATE GUIDE (no code changes needed):
 *   - Change a status        → edit `status` / `phase` in LIVE_STATUS
 *   - Recruitment cycle      → edit the recruitment entry (status:
 *                             'OPEN' | 'CLOSED' | 'PLANNING')
 *   - Surface a new accolade → edit LATEST_ACCOLADE, point its link at
 *                             about.html#record (the permanent archive)
 *   - Add a story            → add an entry to STORIES + create
 *                             nexus-now/<slug>.html from story.html
 *   - Post an update         → prepend an entry to FIELD_LOG
 *
 * FACTS SOURCES: KYNEX '26 rulebooks (SUMO / LINE FOLLOWER, in
 * public/KYNEX-26 Material/), the official poster, site copy.
 * No invented statistics — unknown outcomes are omitted.
 */

/* ================================================================== */
/* LIVE — current team activity                                        */
/* ================================================================== */

export type LiveLevel = 'primary' | 'accent' | 'neutral' | 'dim';

export interface LiveStatusItem {
    /** row label shown in the status console ("CURRENT BUILD") */
    label: string;
    /** main readout ("ROBOCON '26") */
    value: string;
    /** status word with the indicator dot ("INTEGRATION") */
    status: string;
    /** indicator + word colour */
    level: LiveLevel;
    /** one-line explanation under the console */
    note?: string;
    /** optional outbound link (project page, achievements, contact…) */
    link?: { text: string; url: string };
}

/** Robocon '26 internal development phases — status per site data */
export const ROBOCON_2026_PHASES: Array<{ name: string; status: 'complete' | 'active' | 'pending' }> = [
    { name: 'CONCEPT', status: 'complete' },
    { name: 'PROTOTYPE', status: 'complete' },
    { name: 'DEVELOPMENT', status: 'active' },
    { name: 'TESTING', status: 'pending' },
    { name: 'INTEGRATION', status: 'pending' },
    { name: 'COMPETITION', status: 'pending' }
];

/**
 * STATUS CONSOLE — the LIVE layer.
 * Rows render top to bottom; first row is the hero readout.
 */
export const LIVE_STATUS: LiveStatusItem[] = [
    {
        label: 'CURRENT BUILD',
        value: "ROBOCON '26",
        status: 'DEVELOPMENT',
        level: 'primary',
        note: 'Competition robot in active development — prototype validated, systems being brought up for the arena.',
        link: { text: 'VIEW PROJECT', url: '/robots.html' }
    },
    {
        label: 'RECRUITMENT 2026–27',
        value: 'JOIN THE TEAM',
        status: 'OPEN',
        level: 'accent',
        note: 'Applications open across all five divisions — mechanical, electronics, embedded, automation and PR.',
        link: { text: 'JOIN NEXUS', url: '/contact.html' }
    },
    {
        label: 'LATEST ACCOLADE',
        value: 'AIR 1',
        status: 'MATHWORKS',
        level: 'accent',
        note: 'MathWorks Modelling Competition — national first rank.',
        link: { text: 'VIEW ACHIEVEMENTS', url: '/about.html#record' }
    },
    {
        label: 'NEXT OPERATION',
        value: 'OUTREACH SEASON',
        status: 'ACTIVE',
        level: 'neutral',
        note: 'Workshops and demos rolling out through the semester.',
        link: undefined
    }
];

/* ================================================================== */
/* STORIES — permanent pages for completed major activities            */
/* ================================================================== */

export interface Story {
    id: string;
    /** story page route under /nexus-now/ */
    url: string;
    title: string;
    /** one-word category tag shown on the card */
    kind: 'COMPETITION' | 'WORKSHOP' | 'EVENT' | 'OPERATION';
    /** completion stamp ("26 SEP 2026") */
    date: string;
    /** short factual standfirst (shown on the NEXUS NOW card) */
    summary: string;
    /** key stat pairs shown on the card */
    stats: Array<{ k: string; v: string }>;
    /** poster/hero image for the card */
    image: string;
    imageAlt: string;
}

export const STORIES: Story[] = [
    {
        id: 'kynex-26',
        url: '/nexus-now/kynex-26.html',
        title: "KYNEX '26",
        kind: 'COMPETITION',
        date: '26 SEP 2026',
        summary: 'Two robotics competitions — Robo Sumo and Line Following — in one arena. Built, inspected and fought in a single day.',
        stats: [
            { k: 'COMPETITIONS', v: '2' },
            { k: 'PRIZE POOL', v: '₹69,000' },
            { k: 'DOHYO', v: '7 FT' }
        ],
        image: '/KYNEX-26 Material/poster-900.webp',
        imageAlt: "KYNEX '26 official poster — Robo Sumo and Line Following"
    },
    {
        id: 'la-casa-de-bots',
        url: '/nexus-now/la-casa-de-bots.html',
        title: 'LA CASA DE BOTS',
        kind: 'WORKSHOP',
        date: '30 SEP 2026',
        summary: 'Maze-solver workshop — from sensor fundamentals to a robot finding its own way out. Built and run by team members.',
        stats: [
            { k: 'FORMAT', v: 'WORKSHOP' },
            { k: 'PROJECT', v: 'MAZE SOLVER' }
        ],
        image: '/Images/la-casa-poster-900.webp',
        imageAlt: 'La Casa De Bots official poster — maze-solver workshop'
    }
];

/* ================================================================== */
/* FIELD LOG — dated entries, NEWEST FIRST                             */
/* ================================================================== */

export interface FieldLogEntry {
    /** display stamp ("04 OCT 2026") */
    date: string;
    /** machine-sortable iso date for ordering checks */
    iso: string;
    title: string;
    description: string;
    /** tag colour level */
    level?: LiveLevel;
    /** internal link (story page or section anchor) */
    link?: { text: string; url: string };
}

export const FIELD_LOG: FieldLogEntry[] = [
    {
        date: '04 OCT 2026',
        iso: '2026-10-04',
        title: 'RECRUITMENT EXTENDED',
        description: 'The 2026–27 recruitment window stays open — applications across all five divisions are still being accepted.',
        level: 'accent',
        link: { text: 'JOIN NEXUS', url: '/contact.html' }
    },
    {
        date: '30 SEP 2026',
        iso: '2026-09-30',
        title: 'LA CASA DE BOTS — WORKSHOP COMPLETE',
        description: 'The maze-solver workshop closed out the September operations. Participants took robots from bare sensors to a full maze escape.',
        level: 'primary',
        link: { text: 'READ THE STORY', url: '/nexus-now/la-casa-de-bots.html' }
    },
    {
        date: '26 SEP 2026',
        iso: '2026-09-26',
        title: "KYNEX '26 — EVENT COMPLETE",
        description: 'Both arenas ran full schedules — Sumo on the 7 ft Dohyo, Line Followers on the confidential track. The event is now a permanent story.',
        level: 'primary',
        link: { text: 'READ THE STORY', url: '/nexus-now/kynex-26.html' }
    },
    {
        date: 'SEP 2026',
        iso: '2026-09-15',
        title: 'ROBOCON ’26 — DEVELOPMENT PHASE',
        description: 'The competition robot moved into its development phase — prototype validated, systems being brought up for the arena.',
        level: 'neutral'
    },
    {
        date: 'SEP 2026',
        iso: '2026-09-08',
        title: 'AIR 1 — MATHWORKS MODELLING',
        description: 'First rank at the MathWorks Modelling Competition — the latest entry in the team record.',
        level: 'accent',
        link: { text: 'VIEW ACHIEVEMENTS', url: '/about.html#record' }
    }
];

/* Legacy named export kept for the homepage preview module. */
export const NEXUS_NOW_DATA = {
    liveStatus: LIVE_STATUS,
    stories: STORIES,
    fieldLog: FIELD_LOG,
    roboconPhases: ROBOCON_2026_PHASES
};

export default NEXUS_NOW_DATA;

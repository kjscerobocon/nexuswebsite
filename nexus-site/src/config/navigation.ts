/**
 * GLOBAL NAVIGATION CONFIG — NEXUS ROBOTICS
 * -------------------------------------------------------------------------
 * Single source of truth for the site-wide navigation system.
 *
 * The navbar itself is ONE component (src/components/global-navbar.ts)
 * mounted from the root entry (src/main.ts) into #gn-root. Pages never
 * define their own navigation — only the resolved active item and the
 * page-context metadata change per route, and both are derived from the
 * URL here at runtime.
 */

export interface NavItem {
    /** technical index shown on hover / in the system index ("01") */
    index: string;
    /** uppercase navigation label ("ABOUT") */
    label: string;
    /** route file ("about.html") */
    route: string;
    /** page-context metadata ("JOURNEY") */
    context: string;
}

export const NAV_ITEMS: NavItem[] = [
    { index: '01', label: 'ABOUT',       route: 'about.html',       context: 'JOURNEY' },
    { index: '02', label: 'NEXUS NOW',   route: 'nexus-now.html',   context: 'LIVE OPERATIONS' },
    { index: '03', label: 'ROBOTS',      route: 'robots.html',      context: 'MACHINES' },
    { index: '04', label: 'TEAM',        route: 'team.html',        context: 'TEAM ARCHIVE' },
    { index: '05', label: 'SPONSORS',    route: 'sponsors.html',    context: 'PARTNERS' },
    { index: '06', label: 'CONTACT',     route: 'contact.html',     context: 'CONTACT' },
];

/**
 * Department subpages and NEXUS NOW story pages resolve to their parent
 * nav item, so the active state and metadata stay correct on every route.
 */
const SUBPAGE_ALIASES: Record<string, string> = {
    'mechanical.html': 'team.html',
    'electronics.html': 'team.html',
    'programming.html': 'team.html',
    'image-processing.html': 'team.html',  // legacy slug → Automation dept now at automation.html
    'automation.html': 'team.html',
    'management.html': 'team.html',
    // NEXUS NOW stories — children of the live-operations section
    'kynex-26.html': 'nexus-now.html',
    'la-casa-de-bots.html': 'nexus-now.html',
};

export interface NavState {
    /** active nav item, or null on the homepage (home is the brand mark) */
    active: NavItem | null;
    isHome: boolean;
    /** technical readout for the current route ("04 / TEAM ARCHIVE") */
    metaLabel: string;
}

export function resolveNavState(pathname: string = window.location.pathname): NavState {
    let page = pathname.split('/').pop() || '';
    if (page === '' || page === '/') page = 'index.html';
    if (SUBPAGE_ALIASES[page]) page = SUBPAGE_ALIASES[page];

    const isHome = page === 'index.html';
    const active = NAV_ITEMS.find((item) => item.route === page) ?? null;
    const metaLabel = active
        ? `${active.index} / ${active.context}`
        : 'NEXUS ROBOTICS · EST. 2010';

    return { active, isHome, metaLabel };
}

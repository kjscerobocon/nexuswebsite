/**
 * BRAND MODULE — the central NEXUS ROBOTICS identity.
 *
 * The mark + wordmark sit at the exact viewport center of the navbar
 * (equal-flex link groups flank it, equal-width institutional zones
 * flank those). The whole module is the homepage hyperlink.
 */
export function createBrandModule(): string {
    return `
      <a class="gn-brand" href="index.html" aria-label="NEXUS ROBOTICS — home">
        <img class="gn-brand-mark" src="/Images/Nexus_logo.webp" alt="">
        <span class="gn-brand-word">
          <span class="gn-brand-name">NEXUS ROBOTICS</span>
          <span class="gn-brand-sub">KJ SOMAIYA · EST. 2010</span>
        </span>
      </a>`;
}

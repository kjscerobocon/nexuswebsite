/**
 * TEAM ARCHIVE DATA — source of truth for the Team page (team.html).
 *
 * One entry per generation. The UI (rail, stage, leadership, collective
 * wall, filters, end-of-archive nav) renders entirely from this data —
 * adding a year is a matter of adding one object here.
 *
 * DATA MODEL
 * ----------
 * roles: string[]         all positions held (displayed as metadata list)
 * departments: DeptKey[]  memberships used by the filter — a person with
 *                         multiple departments appears under each filter.
 * tier: 'mentor' | 'core' | 'dept' | 'member'
 *   mentor — guidance section
 *   core   — primary leadership: Captain / Vice-Captain / Treasurer / C.T.O.
 *            (equal visual weight in the leadership composition)
 *   dept   — department heads & co-heads (secondary leadership layer)
 *   member — the collective wall
 * rank   — ordering emphasis inside core ('captain' first, etc.)
 * photoBase — stem under /assets/team-photos/ (optimized WebP, responsive)
 * objectPosition — optional per-member crop for face-safe framing
 */

export type DeptKey = 'mech' | 'elec' | 'embed' | 'auto' | 'prm' | 'mentor';

export type Tier = 'mentor' | 'core' | 'dept' | 'member';

export interface Member {
  name: string;
  roles: string[];
  departments: DeptKey[];
  tier: Tier;
  rank?: 'captain' | 'vice' | 'treasurer' | 'cto';
  photoBase?: string;
  objectPosition?: string;
  /** full remote portrait URL (database roster) — takes precedence over photoBase */
  photoUrl?: string;
  /** link to an internal portal account (database roster only) */
  memberId?: string;
}

export interface TeamYear {
  year: number;
  label: string;
  status: 'ACTIVE' | 'IN DEVELOPMENT' | 'ARCHIVED';
  teamPhotoBase?: string;
  members: Member[];
}

export const DEPT_LABELS: Record<DeptKey, string> = {
  mech: 'MECHANICAL',
  elec: 'ELECTRONICS',
  embed: 'EMBEDDED',
  auto: 'AUTOMATION',
  prm: 'PR & MARKETING',
  mentor: 'GUIDANCE',
};

export const DEPT_CODES: Record<DeptKey, string> = {
  mech: 'MEC',
  elec: 'ELE',
  embed: 'EMB',
  auto: 'AUT',
  prm: 'PRM',
  mentor: 'ADV',
};

const slug = (name: string): string =>
  name.trim().replace(/['’]/g, '').replace(/\s+/g, '-').toLowerCase();

/** Build responsive <img> attributes for a member portrait */
export const portrait = (m: Member): { src: string; srcset: string } => {
  const p = `/assets/team-photos/${m.photoBase ?? slug(m.name)}`;
  return {
    src: `${p}-400.webp`,
    srcset: `${p}-400.webp 400w, ${p}-800.webp 800w, ${p}-1200.webp 1200w`,
  };
};

/** Group-photo responsive attributes */
export const groupPhoto = (base: string): { src: string; srcset: string } => {
  const p = `/assets/team-photos-group/${base}`;
  return {
    src: `${p}-800.webp`,
    srcset: `${p}-800.webp 800w, ${p}-1200.webp 1200w, ${p}-1600.webp 1600w`,
  };
};

export const TEAMS: Record<number, TeamYear> = {
  2025: {
    year: 2025,
    label: 'THE PREVIOUS MACHINE',
    status: 'ARCHIVED',
    teamPhotoBase: 'team-2025',
    members: [
      // ---- guidance ----
      { name: 'Dr. S. K. Ukarande', roles: ['Director'], departments: ['mentor'], tier: 'mentor' },
      { name: 'Prof. Vijay Bhosale', roles: ['Faculty Advisor — Mechanical'], departments: ['mentor'], tier: 'mentor', photoBase: 'vijay-bhosale' },

      // ---- core leadership (equal weight) ----
      { name: 'Mayank Verma', roles: ['Captain', 'Embedded Coding Head'], departments: ['embed'], tier: 'core', rank: 'captain' },
      { name: 'Aryan Nair', roles: ['Vice-Captain', 'Mechanical Head'], departments: ['mech'], tier: 'core', rank: 'vice' },
      { name: 'Rutambhar Gada', roles: ['Treasurer', 'Mechanical'], departments: ['mech'], tier: 'core', rank: 'treasurer' },

      // ---- department leadership ----
      { name: 'Aditya Anchan', roles: ['Electronics Head'], departments: ['elec'], tier: 'dept' },
      { name: 'Yash Thakkar', roles: ['Automation Co-Head'], departments: ['auto'], tier: 'dept' },
      { name: 'Harsh Sharma', roles: ['Automation Co-Head'], departments: ['auto'], tier: 'dept' },

      // ---- collective ----
      { name: 'Shubham Mehta', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Paarth Mehta', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Arpita Bhalekar', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Daksh Mishra', roles: ['Embedded Coding'], departments: ['embed'], tier: 'member' },
      { name: 'Hrishikesh Samant', roles: ['Embedded Coding'], departments: ['embed'], tier: 'member' },
      { name: 'Tanisha Shah', roles: ['Electronics'], departments: ['elec'], tier: 'member' },
      { name: 'Tashi Shrivastava', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Tushar Pawar', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Atharva Singh', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Anurag Rai', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Atharv Chavan', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Dhairya Doshi', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Ansh Dsouza', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Sanmeet Dey', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Swaraj Gite', roles: ['Mechanical', 'PR & Marketing'], departments: ['mech', 'prm'], tier: 'member' },
      { name: 'Avika Bhagwat', roles: ['Mechanical', 'PR & Marketing'], departments: ['mech', 'prm'], tier: 'member' },
      { name: 'Sneha Bhat', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Samruddhi Bhilare', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Soham Jadhav', roles: ['Mechanical'], departments: ['mech'], tier: 'member' },
      { name: 'Kanishk Thacker', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Siddharth Ganguly', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Rohini Vemula', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Bhumesh Dadhwal', roles: ['Automation'], departments: ['auto'], tier: 'member', photoBase: 'bhumesh-dhadwal' },
      { name: 'Neeshna Patel', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Tirth Vora', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Omkar Ghosh', roles: ['Automation'], departments: ['auto'], tier: 'member' },
      { name: 'Mohammad Haris Khan', roles: ['Electronics Junior Member'], departments: ['elec'], tier: 'member' },
      { name: 'Nidhi Bhatkar', roles: ['Electronics'], departments: ['elec'], tier: 'member' },
      { name: 'Prit Khanolkar', roles: ['Electronics'], departments: ['elec'], tier: 'member' },
      { name: 'Ishwar Vijayakumar', roles: ['Electronics'], departments: ['elec'], tier: 'member' },
      { name: 'Himanshu Chavan', roles: ['Embedded Coding'], departments: ['embed'], tier: 'member' },
      { name: 'Sonam Sinha', roles: ['Embedded Coding'], departments: ['embed'], tier: 'member' },
      { name: 'Avani Mantri', roles: ['Automation Junior Member'], departments: ['auto'], tier: 'member' },
    ],
  },

  2026: {
    year: 2026,
    label: 'THE CURRENT MACHINE',
    status: 'ACTIVE',
    teamPhotoBase: 'team-2026',
    members: [
      // ---- core leadership (equal weight) ----
      { name: 'Paarth Mehta', roles: ['Captain', 'PR & Marketing Head', 'Mechanical Co-Head'], departments: ['mech', 'prm'], tier: 'core', rank: 'captain' },
      { name: 'Arpita Bhalekar', roles: ['Vice-Captain', 'Treasurer', 'Mechanical Co-Head'], departments: ['mech'], tier: 'core', rank: 'vice' },
      { name: 'Rishabh Jain', roles: ['C.T.O.', 'Electronics Head'], departments: ['elec'], tier: 'core', rank: 'cto' },

      // ---- department leadership ----
      { name: 'Himanshu Chavan', roles: ['Embedded Coding Co-Head'], departments: ['embed'], tier: 'dept' },
      { name: 'Sonam Sinha', roles: ['Embedded Coding Co-Head'], departments: ['embed'], tier: 'dept' },
      { name: 'Omkar Ghosh', roles: ['Automation Co-Head'], departments: ['auto'], tier: 'dept' },
      { name: 'Siddharth Ganguly', roles: ['Automation Co-Head'], departments: ['auto'], tier: 'dept' },

      // ---- senior members ----
      { name: 'Nidhi Bhatkar', roles: ['Electronics Senior Member'], departments: ['elec'], tier: 'member' },
      { name: 'Prit Khanolkar', roles: ['Electronics Senior Member'], departments: ['elec'], tier: 'member' },
      { name: 'Anurag Rai', roles: ['Mechanical Senior Member'], departments: ['mech'], tier: 'member' },
      { name: 'Atharv Chavan', roles: ['Mechanical Senior Member'], departments: ['mech'], tier: 'member' },
      { name: 'Avika Bhagwat', roles: ['Mechanical Senior Member', 'PR & Marketing Senior Member'], departments: ['mech', 'prm'], tier: 'member' },
      { name: 'Sneha Bhat', roles: ['Embedded Coding Junior Member'], departments: ['embed'], tier: 'member' },
      { name: 'Swaraj Gite', roles: ['Mechanical Senior Member', 'PR & Marketing Senior Member'], departments: ['mech', 'prm'], tier: 'member' },
      { name: 'Sanmeet Dey', roles: ['Mechanical Senior Member'], departments: ['mech'], tier: 'member' },
      { name: 'Samruddhi Bhilare', roles: ['Mechanical Senior Member'], departments: ['mech'], tier: 'member' },
      { name: 'Soham Jadhav', roles: ['Mechanical Senior Member'], departments: ['mech'], tier: 'member' },
      { name: 'Dhairya Doshi', roles: ['Mechanical Senior Member'], departments: ['mech'], tier: 'member' },
    ],
  },
};

/** Years sorted ascending — the archive rail order */
export const YEARS: number[] = Object.keys(TEAMS).map(Number).sort((a, b) => a - b);

/** The year the Team page opens on — the current generation */
export const DEFAULT_YEAR = 2026;

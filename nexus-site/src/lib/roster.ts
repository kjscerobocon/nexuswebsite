/**
 * TEAM ROSTER — shared client for the public Team Archive and the
 * team-admin console. Single source of truth for:
 *
 *   • mapping DB rows (team_years + team_members) to the UI's
 *     TeamYear/Member shape used by team-archive.ts
 *   • photo resolution: local asset stem first, remote URL second,
 *     honest placeholder otherwise
 *   • the safe static fallback (site works before Supabase is
 *     configured / before the one-time import)
 *
 * AUTHORITY RULE — once a database query succeeds AND the DB contains
 * roster rows, the database is authoritative. The static fallback is
 * only used when Supabase is not configured or the query fails. We
 * never silently fall back after a successful empty-ish query: an
 * admin removing members must see them gone on the public page.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEAMS, type TeamYear, type Member, type DeptKey, type Tier, YEARS } from '../data/team-data';

/* ------------------------------------------------------------------ */
/* client                                                              */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** singleton browser client — anon key only. The service-role key must
 *  NEVER appear here or in any VITE_* variable. */
export const rosterClient: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null;

export const supabaseConfigured = rosterClient !== null;

/* ------------------------------------------------------------------ */
/* types (DB rows)                                                     */
/* ------------------------------------------------------------------ */

export interface TeamYearRow {
  id: string;
  year: number;
  label: string;
  status: string;               // 'active' | 'archive' | 'upcoming'
  team_photo_url: string | null;
  created_at: string;
}

export interface TeamMemberRow {
  id: string;
  team_year_id: string;
  member_id: string | null;     // link to internal portal account
  name: string;
  photo_url: string | null;
  photo_base: string | null;
  object_position: string | null;
  tier: string | null;
  rank: string | null;
  departments: string[] | null;
  roles: string[] | null;
  bio: string | null;
  is_alumni: boolean;
  display_order: number;
}

export type RosterSource = 'database' | 'static';

export interface RosterResult {
  teams: Record<number, TeamYear>;
  years: number[];
  source: RosterSource;
}

/* ------------------------------------------------------------------ */
/* constants                                                           */
/* ------------------------------------------------------------------ */

const TIERS: Tier[] = ['mentor', 'core', 'dept', 'member'];
const DEPT_KEYS: DeptKey[] = ['mech', 'elec', 'embed', 'auto', 'prm', 'mentor'];

const STATUS_MAP: Record<string, TeamYear['status']> = {
  active: 'ACTIVE',
  upcoming: 'IN DEVELOPMENT',
  archive: 'ARCHIVED',
};

/* ------------------------------------------------------------------ */
/* mapping                                                             */
/* ------------------------------------------------------------------ */

const asDeptKeys = (raw: string[] | null): DeptKey[] =>
  (raw ?? []).filter((d): d is DeptKey => (DEPT_KEYS as string[]).includes(d));

const asTier = (raw: string | null): Tier =>
  TIERS.includes(raw as Tier) ? (raw as Tier) : 'member';

const asRank = (raw: string | null): Member['rank'] => {
  if (raw === 'captain' || raw === 'vice' || raw === 'treasurer' || raw === 'cto') return raw;
  return undefined;
};

/** map a DB row pair into the UI Member shape */
export function rowToMember(row: TeamMemberRow): Member {
  return {
    name: row.name,
    roles: row.roles?.length ? row.roles : [row.tier ?? 'Member'],
    departments: asDeptKeys(row.departments),
    tier: asTier(row.tier),
    rank: asRank(row.rank),
    photoBase: row.photo_base ?? undefined,
    objectPosition: row.object_position ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    memberId: row.member_id ?? undefined,
  };
}

/** map DB year + its member rows into the UI TeamYear shape */
export function rowsToTeam(yearRow: TeamYearRow, memberRows: TeamMemberRow[]): TeamYear {
  const members = memberRows
    .filter((m) => m.team_year_id === yearRow.id)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(rowToMember);

  return {
    year: yearRow.year,
    label: yearRow.label,
    status: STATUS_MAP[yearRow.status] ?? 'ARCHIVED',
    teamPhotoBase: yearRow.team_photo_url ?? undefined,
    members,
  };
}

/* ------------------------------------------------------------------ */
/* static fallback                                                     */
/* ------------------------------------------------------------------ */

export const staticRoster = (): RosterResult => ({
  teams: TEAMS,
  years: YEARS,
  source: 'static',
});

/* ------------------------------------------------------------------ */
/* fetch                                                               */
/* ------------------------------------------------------------------ */

export async function fetchPublicRoster(): Promise<RosterResult> {
  if (!rosterClient) return staticRoster();

  try {
    // explicit public columns — deliberately excludes member_id (the
    // internal portal-account link is not the public's business)
    const { data, error } = await rosterClient
      .from('team_years')
      .select(`id, year, label, status, team_photo_url, created_at,
               team_members(id, team_year_id, name, photo_url, photo_base, object_position,
                            tier, rank, departments, roles, bio, is_alumni, display_order)`)
      .order('year', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      // query succeeded but no years at all → treat as not initialized
      return staticRoster();
    }

    const teams: Record<number, TeamYear> = {};
    for (const yr of data as unknown as Array<TeamYearRow & { team_members: TeamMemberRow[] | null }>) {
      teams[yr.year] = rowsToTeam(yr, (yr.team_members ?? []).map((m) => ({ ...m, member_id: null })));
    }
    return { teams, years: Object.keys(teams).map(Number).sort((a, b) => a - b), source: 'database' };
  } catch (err) {
    console.warn('[roster] database query failed — using static fallback:', err);
    return staticRoster();
  }
}

/* ------------------------------------------------------------------ */
/* photo resolution (shared by public wall + admin console)            */
/* ------------------------------------------------------------------ */

/**
 * Resolve a member's portrait:
 *   1. remote photo_url (admin-entered https URL)
 *   2. local optimized asset stem (photo_base) if that slug exists
 *   3. the honest placeholder (initials — never a fake photo)
 */
export function resolvePortrait(m: Member & { photoUrl?: string }): {
  kind: 'remote' | 'local' | 'placeholder';
  src?: string;
  srcset?: string;
  slug?: string;
} {
  if (m.photoUrl && /^https?:\/\//i.test(m.photoUrl)) {
    return { kind: 'remote', src: m.photoUrl };
  }
  const slug = m.photoBase ?? m.name.trim().replace(/['’]/g, '').replace(/\s+/g, '-').toLowerCase();
  const base = `/assets/team-photos/${slug}`;
  return {
    kind: 'local',
    slug,
    src: `${base}-400.webp`,
    srcset: `${base}-400.webp 400w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`,
  };
}

/* ------------------------------------------------------------------ */
/* import payload builder (admin console, one-time)                    */
/* ------------------------------------------------------------------ */

export function buildImportPayload(): { years: unknown[] } {
  return {
    years: YEARS.map((y) => {
      const t = TEAMS[y];
      return {
        year: y,
        label: t.label,
        status: t.status,
        teamPhotoBase: t.teamPhotoBase ?? null,
        members: t.members.map((m, i) => ({
          name: m.name,
          roles: m.roles,
          departments: m.departments,
          tier: m.tier,
          rank: m.rank ?? null,
          photoBase: m.photoBase ?? null,
          displayOrder: i,
        })),
      };
    }),
  };
}

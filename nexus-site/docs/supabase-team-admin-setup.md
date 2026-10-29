# Team Roster Admin — Setup Guide

This feature adds a secure admin console for managing the public Team
Archive roster, backed by Supabase. **Read this once before touching
the database.**

## Plain-English Cheat Sheet

| Thing | What it is |
|---|---|
| **The console** | A hidden page at `/portal/team-admin.html` (linked from the footer's SYSTEM ACCESS → ADMIN COMMAND). Admins sign in and add/edit/remove people on the public Team page. |
| **Supabase Auth** | The sign-in service. The admin's email+password are checked by Supabase, not by our code. |
| **The allow-list** (`team_admins` table) | A short list of admin accounts. Even with a correct password, a user NOT on this list gets in nowhere. |
| **RLS (Row Level Security)** | The database's own bouncer. It decides who can read/write each table. The website can only edit the roster if the signed-in user is on the allow-list. |
| **The audit trail** | An automatic diary in `audit_logs`. Every add/edit/remove is recorded with who did it. |
| **The one-time import** | A button in the console that copies the current hardcoded roster (2025 & 2026) into the database. Safe to retry; never overwrites a year that already has people. |

## What was added

- `supabase/migrations/001_team_roster_admin.sql` — the database migration
- `portal/team-admin.html` + `src/team-admin.ts` + `public/team-admin.css` — the console
- `src/lib/roster.ts` — shared roster loader (public page + console)
- `src/team-archive.ts` — public Team page now reads the database roster
- `.env.example` — frontend env template
- Footer "ADMIN COMMAND" links on all pages → `/portal/team-admin.html`

## Requirements

- A Supabase project (free tier is fine)
- Node 18+, pnpm (repo uses pnpm)

## Step 1 — Apply the migration

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/001_team_roster_admin.sql`.
3. **Run**. It is additive and repeatable — safe to run on a database
   provisioned from `database-complete.sql` or `portal/database-schema.sql`,
   and safe to re-run if it already ran.

> The migration also enables RLS on `team_members`/`team_years`. The old
> scaffolded schema created those tables WITHOUT RLS — they would have
> been world-writable through the anon key.

## Step 2 — Create the first admin

1. Supabase → **Authentication** → **Users** → **Add user**.
   Enter the admin's email + a strong password. Enable "Auto Confirm User".
2. Copy the user's **UID** (click the user, copy the `id`).
3. SQL Editor → run:

   ```sql
   INSERT INTO team_admins (auth_user_id, note)
   VALUES ('PASTE-THE-UID-HERE', 'first admin — bootstrap')
   ON CONFLICT (auth_user_id) DO NOTHING;
   ```

To add another admin later: repeat with their UID. To remove an admin:
delete their row from `team_admins` (dashboard only — the table is not
editable from the browser by design).

## Step 3 — Configure Vercel + local dev

Vercel → your project → **Settings** → **Environment Variables**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT-ref.supabase.co` (Supabase → Settings → API → Project URL) |
| `VITE_SUPABASE_ANON_KEY` | the `anon` / `publishable` key (Settings → API). NOT the service-role key. |

Add them for Production (and Preview if you want). Then **redeploy** —
Vite bakes env vars at build time, so a deploy without a new build
won't pick them up.

Local development: copy `.env.example` → `.env.local` and fill in the
same two values.

> **Never** set a `VITE_SUPABASE_SERVICE_ROLE_KEY` or commit any real
> key. The browser may only ever see URL + anon key.

## Step 4 — One-time roster import

1. Sign in at `/portal/team-admin.html` with the admin from Step 2.
2. The console shows the **IMPORT EXISTING ROSTER** card (only appears
   while the database roster is empty).
3. Click **IMPORT STATIC ROSTER**. It imports years 2025 + 2026 from
   `src/data/team-data.ts`, preserving names, roles, tiers, ranks,
   departments, photo stems and order.
4. Verify the public Team page (`/team.html`) — it now reads from the
   database. Add/edit/remove in the console and the public page
   follows on next load.

**Guardrails baked in:** years that already have roster records are
skipped (never overwritten); members already present in a year are
skipped; a partially-completed import is safe to retry.

## How the public page decides what to show

1. Before Supabase is configured / before import → the static roster
   from `src/data/team-data.ts` (the site keeps working).
2. Once a database query succeeds and the DB has roster data → the
   **database is authoritative**. If an admin removes someone, the
   public page shows them gone — it never silently falls back to the
   old static list after a successful query.

## Security notes

- Writes are authorized by RLS policies at the database, not by the
  console UI. Even a tampered browser can't write without an
  allow-listed session.
- `team_admins` is deny-all from the browser; only the Supabase
  dashboard/SQL can manage it.
- Removal runs as a single atomic RPC (`remove_team_member`): roster
  row deleted + linked portal account deactivated + audit entry, in
  one transaction. Portal profiles and attendance history are never
  deleted.
- The console never queries `pin`/`password_hash`; the portal-link
  dropdown uses `list_linkable_members()` (id + name only).

## Known limitation — legacy portal (documented, not fixed here)

`portal/login.html` + `src/lib/supabase.ts` (the OLD attendance
portal) still use the unsafe legacy pattern: client-side
`members.pin` lookup and an `admin_users.password_hash` equality
comparison, with `sessionStorage` role flags for "authorization".
That portal is a separate feature and was intentionally left alone
per the brief — but it is NOT secured. Until it is migrated to
Supabase Auth, treat it as unsafe if a live database exists. Its
tables also lack write-protection policies beyond what
`database-complete.sql` sets.

## Verification performed

- `pnpm type-check` (tsc --noEmit) — pass
- `pnpm build` — pass (all 16 entries)
- Playwright smoke: console unreachable without auth (redirects to
  sign-in view), public Team page renders static roster pre-config,
  DB-authoritative swap verified via a simulated query
- See the QA section of the handoff for the full run-down

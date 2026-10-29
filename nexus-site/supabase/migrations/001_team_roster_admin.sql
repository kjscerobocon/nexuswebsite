-- ============================================================
-- MIGRATION 001 — TEAM ROSTER ADMIN (Supabase)
-- ============================================================
-- Adds a secure admin layer over the public team roster
-- (team_years / team_members) with:
--
--   • team_admins           — explicit allow-list of Supabase Auth
--                             user UUIDs allowed to manage the roster
--   • RLS enabled + policies on team_years / team_members
--                             (the scaffolded schema created these tables
--                              but NEVER enabled RLS on them — they would
--                             be world-writable through the anon key)
--   • team_members.member_id— optional link to an internal portal
--                             account (members.id). Roster records can
--                             exist without one.
--   • audit trail           — trigger writes every roster change to the
--                             existing audit_logs table
--   • remove_team_member()  — atomic removal: roster row deleted,
--                             linked portal account deactivated,
--                             audit entry written, in ONE transaction
--   • list_linkable_members() — safe member list for the admin UI
--                             (id + name only — never pins or hashes)
--
-- ADDITIVE & REPEATABLE: every statement is IF NOT EXISTS / DROP-IF-
-- EXISTS-first. Safe to run on a database provisioned from either
-- database-complete.sql or portal/database-schema.sql, and safe to
-- re-run. It does NOT recreate or truncate anything.
--
-- Apply in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Ensure the public-roster tables exist
-- ------------------------------------------------------------
-- (They come from database-complete.sql §2.1/§2.2. The IF NOT EXISTS
--  guards make this migration self-sufficient on a bare database too.)

CREATE TABLE IF NOT EXISTS team_years (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archive', 'upcoming')),
  team_photo_url TEXT,
  description TEXT,
  achievements TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_year_id UUID NOT NULL REFERENCES team_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  tier TEXT,                -- 'mentor' | 'core' | 'dept' | 'member'
  rank TEXT,                -- 'captain' | 'vice' | 'treasurer' | 'cto' | NULL
  departments TEXT[],       -- DeptKey codes: mech|elec|embed|auto|prm|mentor
  roles TEXT[],             -- free-text designations, display order
  bio TEXT,
  is_alumni BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- `uuid_generate_v4` lives in the extensions schema on some setups.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE INDEX IF NOT EXISTS idx_team_members_year ON team_members(team_year_id);

-- audit_logs exists in database-complete.sql §4.1 but NOT in
-- portal/database-schema.sql — create it if this DB was provisioned
-- from the portal schema only.
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_id UUID,
  actor_type TEXT CHECK (actor_type IN ('member', 'admin', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- The audit trail is dashboard/SQL-editor-only: no browser read or
-- write. RLS enabled with NO policies = deny-all for anon and
-- authenticated. The audit trigger still writes because it runs as a
-- SECURITY DEFINER function owned by the table owner.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 1. ROSTER ↔ PORTAL ACCOUNT LINK
-- ------------------------------------------------------------
-- One nullable FK: a public roster record may exist with no linked
-- internal account, and an internal account may exist with no public
-- roster record. Removal semantics only act on the link when present.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS member_id UUID
    REFERENCES members(id) ON DELETE SET NULL;

-- local portrait asset stem (under /assets/team-photos/) — distinct
-- from photo_url so a full https URL and a bundled asset never clash
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS photo_base TEXT;

-- optional per-member crop, same semantics as Member.objectPosition
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS object_position TEXT;

CREATE INDEX IF NOT EXISTS idx_team_members_member_id
  ON team_members(member_id) WHERE member_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. ADMIN ALLOW-LIST
-- ------------------------------------------------------------
-- Rows here ARE the authorization. No roles, no JWT claims — just
-- "this Supabase Auth user id may manage the roster". RLS policies
-- below check membership with the helper function (SECURITY DEFINER
-- so the check itself cannot be subverted by table-level policies).

CREATE TABLE IF NOT EXISTS team_admins (
  auth_user_id UUID PRIMARY KEY,      -- Supabase Auth users.id
  note TEXT,                          -- who this admin is, added when
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE team_admins ENABLE ROW LEVEL SECURITY;

-- Nobody reads or writes the allow-list from the browser — not even
-- admins. It is managed in the Supabase SQL editor / dashboard only.
DROP POLICY IF EXISTS "team_admins public read" ON team_admins;
DROP POLICY IF EXISTS "team_admins self read" ON team_admins;

-- A signed-in admin may check whether the table has entries (used by
-- the frontend as a liveness probe — never returns rows).

-- helper: is the caller an authorized roster admin?
CREATE OR REPLACE FUNCTION is_team_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_admins WHERE auth_user_id = auth.uid());
$$;

-- helper: is the roster store initialized (any rows at all)?
-- SECURITY DEFINER so the public page can probe "is the DB in charge"
-- without being able to read the allow-list.
CREATE OR REPLACE FUNCTION is_roster_initialized() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM team_members);
$$;

REVOKE ALL ON FUNCTION is_team_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION is_roster_initialized() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_team_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_roster_initialized() TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. RLS ON THE PUBLIC ROSTER
-- ------------------------------------------------------------

ALTER TABLE team_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- everyone (incl. signed-out visitors) can read the roster
DROP POLICY IF EXISTS "roster public read" ON team_years;
CREATE POLICY "roster public read" ON team_years
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "roster public read" ON team_members;
CREATE POLICY "roster public read" ON team_members
  FOR SELECT USING (true);

-- only allow-listed admins can write, and only through their own
-- authenticated session (RLS checks auth.uid() via the helper)
DROP POLICY IF EXISTS "roster admin write" ON team_years;
CREATE POLICY "roster admin write" ON team_years
  FOR INSERT TO authenticated WITH CHECK (is_team_admin());

DROP POLICY IF EXISTS "roster admin update" ON team_years;
CREATE POLICY "roster admin update" ON team_years
  FOR UPDATE TO authenticated USING (is_team_admin());

DROP POLICY IF EXISTS "roster admin delete" ON team_years;
CREATE POLICY "roster admin delete" ON team_years
  FOR DELETE TO authenticated USING (is_team_admin());

DROP POLICY IF EXISTS "roster admin write" ON team_members;
CREATE POLICY "roster admin write" ON team_members
  FOR INSERT TO authenticated WITH CHECK (is_team_admin());

DROP POLICY IF EXISTS "roster admin update" ON team_members;
CREATE POLICY "roster admin update" ON team_members
  FOR UPDATE TO authenticated USING (is_team_admin());

DROP POLICY IF EXISTS "roster admin delete" ON team_members;
CREATE POLICY "roster admin delete" ON team_members
  FOR DELETE TO authenticated USING (is_team_admin());

-- ------------------------------------------------------------
-- 4. AUDIT TRAIL
-- ------------------------------------------------------------
-- Every INSERT / UPDATE / DELETE on team_members is recorded in the
-- existing audit_logs table (actor = the admin's auth uid, old/new
-- values captured). The trigger is SECURITY DEFINER so audit rows can
-- be inserted even though audit_logs itself is deny-all via RLS.

CREATE OR REPLACE FUNCTION team_members_audit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (actor_id, actor_type, action, entity_type, entity_id, new_values)
    VALUES (auth.uid(), 'admin', 'roster.member_added', 'team_members', NEW.id,
            jsonb_build_object('name', NEW.name, 'year_team_id', NEW.team_year_id, 'tier', NEW.tier));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (actor_id, actor_type, action, entity_type, entity_id, old_values, new_values)
    VALUES (auth.uid(), 'admin', 'roster.member_updated', 'team_members', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (actor_id, actor_type, action, entity_type, entity_id, old_values)
    VALUES (auth.uid(), 'admin', 'roster.member_removed', 'team_members', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_members_audit ON team_members;
CREATE TRIGGER trg_team_members_audit
AFTER INSERT OR UPDATE OR DELETE ON team_members
FOR EACH ROW EXECUTE FUNCTION team_members_audit();

-- ------------------------------------------------------------
-- 5. ATOMIC REMOVAL RPC
-- ------------------------------------------------------------
-- remove_team_member(p_member_row_id) does, in one transaction:
--   1. verifies the caller is an allow-listed admin
--   2. deletes the roster row (fires the audit trigger)
--   3. if that row was linked to an internal members account,
--      deactivates it (is_active = false) so it can no longer sign
--      into the portal — the member record and its attendance
--      history are preserved, never deleted
-- Returns JSON: { removed, deactivated_portal, member_name }

CREATE OR REPLACE FUNCTION remove_team_member(p_roster_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row team_members;
  v_deactivated BOOLEAN := false;
BEGIN
  IF NOT is_team_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: caller is not on the team_admins allow-list';
  END IF;

  SELECT * INTO v_row FROM team_members WHERE id = p_roster_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('removed', false, 'reason', 'not_found');
  END IF;

  -- 1. remove from the public roster (audit trigger fires)
  DELETE FROM team_members WHERE id = p_roster_id;

  -- 2. deactivate the linked portal account, if any
  IF v_row.member_id IS NOT NULL THEN
    UPDATE members SET is_active = false, updated_at = NOW()
    WHERE id = v_row.member_id AND is_active = true;
    v_deactivated := (FOUND);
  END IF;

  RETURN jsonb_build_object(
    'removed', true,
    'member_name', v_row.name,
    'deactivated_portal', v_deactivated
  );
END;
$$;

REVOKE ALL ON FUNCTION remove_team_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_team_member(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 6. SAFE MEMBER DIRECTORY FOR THE ADMIN UI
-- ------------------------------------------------------------
-- The legacy login page queries members with SELECT * — which drags
-- pin + password_hash into the browser. This RPC exposes only what
-- the link-dropdown needs: id and name.

CREATE OR REPLACE FUNCTION list_linkable_members()
RETURNS TABLE (id UUID, name TEXT, is_active BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.name, m.is_active FROM members m ORDER BY m.name;
$$;

REVOKE ALL ON FUNCTION list_linkable_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_linkable_members() TO authenticated;

-- ------------------------------------------------------------
-- 7. ONE-TIME ROSTER IMPORT RPC
-- ------------------------------------------------------------
-- import_static_roster(payload JSONB) inserts the static team-data
-- roster (from src/data/team-data.ts) into the database.
--
-- GUARDS:
--   • caller must be an allow-listed admin
--   • years that already have roster records are SKIPPED, never
--     overwritten (payload years are matched by number)
--   • within an imported year, members are matched by lower(name) —
--     an already-present member is skipped, so a partial import can
--     be safely retried
-- Returns per-year summary JSON.

CREATE OR REPLACE FUNCTION import_static_roster(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r_year JSONB;
  v_year INT;
  v_label TEXT;
  v_status TEXT;
  v_photo_base TEXT;
  v_member JSONB;
  v_year_id UUID;
  v_existing INT;
  v_inserted INT := 0;
  v_skipped_members INT := 0;
  v_result JSONB := '[]'::JSONB;
BEGIN
  IF NOT is_team_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  FOR r_year IN SELECT * FROM jsonb_array_elements(p_payload->'years') LOOP
    v_year := (r_year->>'year')::INT;
    v_label := r_year->>'label';
    v_status := r_year->>'status';
    v_photo_base := r_year->>'teamPhotoBase';

    -- skip years that already have roster records
    SELECT COUNT(*) INTO v_existing
    FROM team_members tm JOIN team_years ty ON ty.id = tm.team_year_id
    WHERE ty.year = v_year;

    IF v_existing > 0 THEN
      v_result := v_result || jsonb_build_object(
        'year', v_year, 'status', 'skipped', 'reason', 'year already has roster records'
      );
    ELSE
      -- upsert the year shell (label/status may have been created by hand)
      INSERT INTO team_years (year, label, status, team_photo_url)
      VALUES (v_year,
              COALESCE(v_label, v_year::TEXT),
              CASE COALESCE(v_status, 'archive')
                WHEN 'ACTIVE' THEN 'active'
                WHEN 'IN DEVELOPMENT' THEN 'upcoming'
                ELSE 'archive' END,
              v_photo_base)
      ON CONFLICT (year) DO UPDATE
        SET label = EXCLUDED.label,
            status = EXCLUDED.status,
            team_photo_url = EXCLUDED.team_photo_url
      RETURNING id INTO v_year_id;

      v_inserted := 0;
      FOR v_member IN SELECT * FROM jsonb_array_elements(r_year->'members') LOOP
        -- skip members already present in this year (retry safety)
        IF EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm.team_year_id = v_year_id
            AND lower(trim(tm.name)) = lower(trim(v_member->>'name'))
        ) THEN
          v_skipped_members := v_skipped_members + 1;
          CONTINUE;
        END IF;

        INSERT INTO team_members (
          team_year_id, name, photo_url, tier, rank, departments, roles,
          is_alumni, display_order, photo_base
        ) VALUES (
          v_year_id,
          v_member->>'name',
          v_member->>'photoBase',
          v_member->>'tier',
          NULLIF(v_member->>'rank', '')::TEXT,
          (SELECT array_agg(d) FROM jsonb_array_elements_text(v_member->'departments') d),
          (SELECT array_agg(r) FROM jsonb_array_elements_text(v_member->'roles') r),
          false,
          (v_member->>'displayOrder')::INT,
          v_member->>'photoBase'
        );
        v_inserted := v_inserted + 1;
      END LOOP;

      v_result := v_result || jsonb_build_object(
        'year', v_year, 'status', 'imported', 'inserted', v_inserted
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('results', v_result, 'skipped_members', v_skipped_members);
END;
$$;

REVOKE ALL ON FUNCTION import_static_roster(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_static_roster(JSONB) TO authenticated;

-- ------------------------------------------------------------
-- 8. FIRST ADMIN — how to bootstrap
-- ------------------------------------------------------------
-- The allow-list is intentionally dashboard-managed. To authorize the
-- first admin after creating their Supabase Auth user:
--
--   INSERT INTO team_admins (auth_user_id, note)
--   VALUES ('<paste-auth-uuid-here>', 'initial bootstrap admin')
--   ON CONFLICT (auth_user_id) DO NOTHING;
--
-- See docs/supabase-team-admin-setup.md for the full walkthrough.

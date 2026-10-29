-- ==========================================================================
-- 002 — TERM 2026 IS THE CURRENT GENERATION
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- (eu-west-1 project, same one that ran 001_team_roster_admin.sql)
--
-- What this does (plain English):
--   • 2026 becomes the CURRENT team: label "THE CURRENT MACHINE", status active
--   • 2025 becomes the PREVIOUS team: label "THE PREVIOUS MACHINE", status archive
--   • The Team page opens on 2026 (the site code already defaults to 2026;
--     this fixes the database copy that currently overrides it)
--
-- Safe to re-run — it sets absolute values, no increments.
-- ==========================================================================

UPDATE team_years
SET    label  = 'THE CURRENT MACHINE',
       status = 'active'
WHERE  year = 2026;

UPDATE team_years
SET    label  = 'THE PREVIOUS MACHINE',
       status = 'archive'
WHERE  year = 2025;

-- Sanity check — should show:
--   2025 | THE PREVIOUS MACHINE | archive
--   2026 | THE CURRENT MACHINE  | active
SELECT year, label, status
FROM   team_years
ORDER  BY year;

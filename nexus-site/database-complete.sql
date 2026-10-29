-- ============================================================
-- NEXUS ROBOTICS - COMPLETE DATABASE SCHEMA
-- ============================================================
-- This file contains ALL SQL tables needed for the Nexus Website
-- including both public-facing content and internal portal systems.
--
-- Database: PostgreSQL (Supabase compatible)
-- Author: Nexus Robotics Team
-- Version: 1.0
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- For password hashing

-- ============================================================
-- PART 1: INTERNAL PORTAL SYSTEM
-- ============================================================

-- ------------------------------------------------------------
-- 1.1 DEPARTMENTS TABLE
-- ------------------------------------------------------------
-- Team departments for organizing members
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL UNIQUE,
  description TEXT,
  color_hex TEXT,  -- For UI theming
  display_order INTEGER DEFAULT 0
);

-- Insert departments
INSERT INTO departments (id, name, short_name, description, color_hex, display_order) VALUES
('mech', 'Mechanical', 'MECH', 'Mechanical design and fabrication', '#FF6B6B', 1),
('elec', 'Electronics', 'ELEC', 'Circuit design and electronics', '#4ECDC4', 2),
('embed', 'Embedded Systems', 'EMBED', 'Embedded systems programming', '#45B7D1', 3),
('prog', 'Programming', 'PROG', 'High-level software development', '#96CEB4', 4),
('auto', 'Automation', 'AUTO', 'Automation and control systems', '#FFEAA7', 5),
('mgmt', 'Management', 'MGMT', 'Team management and operations', '#DFE6E9', 6),
('mentor', 'Mentor', 'MENTOR', 'Team mentors and advisors', '#A29BFE', 0)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 1.2 ROLES TABLE
-- ------------------------------------------------------------
-- Team member roles defining hierarchy and responsibilities
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  description TEXT,
  is_leadership BOOLEAN DEFAULT false
);

-- Insert roles
INSERT INTO roles (id, name, display_name, priority, description, is_leadership) VALUES
('admin', 'admin', 'Administrator', 100, 'System administrator with full access', true),
('captain', 'captain', 'Team Captain', 90, 'Overall team leader', true),
('vice_captain', 'vice_captain', 'Vice Captain', 80, 'Second in command', true),
('head', 'head', 'Department Head', 70, 'Leads a specific department', true),
('co_head', 'co_head', 'Co-Head', 60, 'Co-leads a specific department', true),
('treasurer', 'treasurer', 'Treasurer', 50, 'Manages team finances', true),
('member', 'member', 'Team Member', 0, 'Regular team member', false),
('alumni', 'alumni', 'Alumni', -10, 'Former team member', false)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 1.3 MEMBERS TABLE
-- ------------------------------------------------------------
-- Core members table with authentication and profile data
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  pin TEXT NOT NULL,  -- 4-digit PIN for portal check-in
  password_hash TEXT,  -- For full account authentication
  is_active BOOLEAN DEFAULT true,
  profile_image_url TEXT,
  join_date DATE,
  graduation_year INTEGER,
  about_me TEXT,
  skills TEXT[],  -- Array of skills
  github_url TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_pin ON members(pin);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active);
CREATE INDEX IF NOT EXISTS idx_members_graduation_year ON members(graduation_year);

-- ------------------------------------------------------------
-- 1.4 MEMBER DEPARTMENTS JUNCTION TABLE
-- ------------------------------------------------------------
-- Many-to-many relationship between members and departments
CREATE TABLE IF NOT EXISTS member_departments (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,  -- Indicates primary department
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (member_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_member_departments_member ON member_departments(member_id);
CREATE INDEX IF NOT EXISTS idx_member_departments_department ON member_departments(department_id);

-- ------------------------------------------------------------
-- 1.5 MEMBER ROLES JUNCTION TABLE
-- ------------------------------------------------------------
-- Many-to-many relationship between members and roles
CREATE TABLE IF NOT EXISTS member_roles (
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (member_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_member_roles_member ON member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_member_roles_role ON member_roles(role_id);

-- ------------------------------------------------------------
-- 1.6 ADMIN USERS TABLE
-- ------------------------------------------------------------
-- Separate admin authentication for portal management
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,  -- Use bcrypt/argon2
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  is_super_admin BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- ------------------------------------------------------------
-- 1.7 ATTENDANCE TABLE
-- ------------------------------------------------------------
-- Tracks member check-in/check-out events
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('IN', 'OUT')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location TEXT,  -- Workshop, competition, etc.
  notes TEXT,
  device_info TEXT  -- For tracking which kiosk was used
);

-- Indexes for attendance queries
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON attendance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_member_timestamp ON attendance(member_id, timestamp DESC);
-- NOTE: DATE(timestamptz) is not IMMUTABLE (depends on session timezone)
-- and Postgres rejects indexing it (42P17). Even the explicit
-- AT TIME ZONE 'UTC' cast is only STABLE, so wrap it in a helper
-- explicitly marked IMMUTABLE (safe: UTC bucketing never changes).
CREATE OR REPLACE FUNCTION attendance_utc_date(ts timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE AS
$$ SELECT (ts AT TIME ZONE 'UTC')::date $$;

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_utc_date(timestamp));

-- ------------------------------------------------------------
-- 1.8 SESSIONS TABLE
-- ------------------------------------------------------------
-- Active user sessions for authentication
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('member', 'admin')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ------------------------------------------------------------
-- 1.9 PASSWORD RESET TABLE
-- ------------------------------------------------------------
-- Password reset tokens for security
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('member', 'admin')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

-- ============================================================
-- PART 2: PUBLIC WEBSITE CONTENT
-- ============================================================

-- ------------------------------------------------------------
-- 2.1 TEAM YEARS TABLE
-- ------------------------------------------------------------
-- Organizes team data by academic year/competition season
CREATE TABLE IF NOT EXISTS team_years (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,  -- e.g., "2024-25 Season"
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archive', 'upcoming')),
  team_photo_url TEXT,
  description TEXT,
  achievements TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_years_year ON team_years(year);
CREATE INDEX IF NOT EXISTS idx_team_years_status ON team_years(status);

-- ------------------------------------------------------------
-- 2.2 PUBLIC TEAM MEMBERS TABLE
-- ------------------------------------------------------------
-- Public-facing team member profiles (separate from portal members)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  team_year_id UUID NOT NULL REFERENCES team_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  tier TEXT,  -- e.g., "Core", "Associate"
  rank TEXT,  -- e.g., "Captain", "Member"
  departments TEXT[],  -- Array of department codes
  roles TEXT[],  -- Array of role codes
  bio TEXT,
  is_alumni BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_year ON team_members(team_year_id);
CREATE INDEX IF NOT EXISTS idx_team_members_alumni ON team_members(is_alumni);

-- ------------------------------------------------------------
-- 2.3 CAMPAIGNS TABLE
-- ------------------------------------------------------------
-- Campaigns, events, and competitions (NEXUS NOW section)
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('competition', 'event', 'recruitment', 'workshop', 'other')),
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  description TEXT,
  cover_image_url TEXT,
  location TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);

-- ------------------------------------------------------------
-- 2.4 COMPETITIONS TABLE
-- ------------------------------------------------------------
-- Detailed competition information
CREATE TABLE IF NOT EXISTS competitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,  -- e.g., "Sumo", "Line Following", "RoboCup"
  level TEXT,  -- e.g., "National", "International"
  result TEXT,  -- e.g., "1st Place", "Finalist"
  robot_name TEXT,
  description TEXT,
  result_image_url TEXT,
  competition_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitions_campaign ON competitions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_competitions_date ON competitions(competition_date);

-- ------------------------------------------------------------
-- 2.5 OPERATIONS TABLE
-- ------------------------------------------------------------
-- Active team operations and projects
CREATE TABLE IF NOT EXISTS operations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed')),
  start_date DATE,
  target_completion_date DATE,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  icon_name TEXT,  -- For UI display
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);

-- ------------------------------------------------------------
-- 2.6 FIELD LOGS TABLE
-- ------------------------------------------------------------
-- Chronological updates and field logs
CREATE TABLE IF NOT EXISTS field_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  operation_id UUID REFERENCES operations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  log_date DATE NOT NULL,
  image_url TEXT,
  author TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_logs_operation ON field_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_field_logs_date ON field_logs(log_date DESC);

-- ------------------------------------------------------------
-- 2.7 PARTNERS/SPONSORS TABLE
-- ------------------------------------------------------------
-- Partner and sponsor information
CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  partner_class TEXT CHECK (partner_class IN ('FINANCIAL PARTNER', 'MATERIAL PARTNER', 'TECHNOLOGY PARTNER', 'STRATEGIC PARTNER', 'OTHER')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  partnership_start_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partners_class ON partners(partner_class);
CREATE INDEX IF NOT EXISTS idx_partners_active ON partners(is_active);

-- ------------------------------------------------------------
-- 2.8 ROBOTS/SYSTEMS TABLE
-- ------------------------------------------------------------
-- Information about robots built by the team
CREATE TABLE IF NOT EXISTS robots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  category TEXT,  -- e.g., "Sumo", "Line Follower"
  description TEXT,
  photo_url TEXT,
  specifications JSONB,  -- Flexible storage for specs
  team_year_id UUID REFERENCES team_years(id) ON DELETE SET NULL,
  competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
  completion_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_robots_year ON robots(team_year_id);
CREATE INDEX IF NOT EXISTS idx_robots_competition ON robots(competition_id);
CREATE INDEX IF NOT EXISTS idx_robots_category ON robots(category);

-- ------------------------------------------------------------
-- 2.9 GALLERY/ARCHIVE TABLE
-- ------------------------------------------------------------
-- Photo gallery and media archive
CREATE TABLE IF NOT EXISTS gallery (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT CHECK (category IN ('competition', 'workshop', 'event', 'team', 'robot', 'other')),
  tags TEXT[],
  date DATE,
  team_year_id UUID REFERENCES team_years(id) ON DELETE SET NULL,
  photographer TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery(category);
CREATE INDEX IF NOT EXISTS idx_gallery_date ON gallery(date DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_featured ON gallery(is_featured);
CREATE INDEX IF NOT EXISTS idx_gallery_tags ON gallery USING GIN(tags);

-- ------------------------------------------------------------
-- 2.10 SYSTEM CAPABILITIES TABLE
-- ------------------------------------------------------------
-- Technical capabilities and features
CREATE TABLE IF NOT EXISTS system_capabilities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  category TEXT,
  features TEXT[],  -- Array of feature descriptions
  image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_category ON system_capabilities(category);

-- ============================================================
-- PART 3: CONTENT MANAGEMENT
-- ============================================================

-- ------------------------------------------------------------
-- 3.1 PAGES TABLE
-- ------------------------------------------------------------
-- Dynamic page content management
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT,  -- HTML or markdown
  meta_description TEXT,
  meta_keywords TEXT[],
  is_published BOOLEAN DEFAULT false,
  template_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_published ON pages(is_published);

-- ------------------------------------------------------------
-- 3.2 NEWS/BLOG TABLE
-- ------------------------------------------------------------
-- News articles and blog posts
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image_url TEXT,
  author_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  author_name TEXT,
  category TEXT,
  tags TEXT[],
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_slug ON news_articles(slug);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);
CREATE INDEX IF NOT EXISTS idx_news_tags ON news_articles USING GIN(tags);

-- ------------------------------------------------------------
-- 3.3 SETTINGS TABLE
-- ------------------------------------------------------------
-- Site-wide configuration and settings
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  value_type TEXT DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  category TEXT,  -- e.g., 'general', 'contact', 'social'
  description TEXT,
  is_public BOOLEAN DEFAULT false,  -- Whether public API can access
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, value_type, category, description, is_public) VALUES
('site_name', 'NEXUS Robotics', 'string', 'general', 'Site name', true),
('site_description', 'NEXUS Robotics Team - Building the future of robotics', 'string', 'general', 'Site description', true),
('contact_email', 'info@nexusrobotics.org', 'string', 'contact', 'Main contact email', true),
('social_instagram', '', 'string', 'social', 'Instagram handle', true),
('social_twitter', '', 'string', 'social', 'Twitter/X handle', true),
('social_linkedin', '', 'string', 'social', 'LinkedIn URL', true),
('social_youtube', '', 'string', 'social', 'YouTube channel', true),
('recruitment_open', 'false', 'boolean', 'recruitment', 'Whether recruitment is open', true),
('current_year', '2025', 'number', 'general', 'Current team year', true)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 3.4 NOTIFICATIONS TABLE
-- ------------------------------------------------------------
-- User notifications and alerts
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('member', 'admin')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- PART 4: ANALYTICS & AUDIT
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 AUDIT LOG TABLE
-- ------------------------------------------------------------
-- Track important administrative actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_id UUID,
  actor_type TEXT CHECK (actor_type IN ('member', 'admin', 'system')),
  action TEXT NOT NULL,  -- e.g., 'member.created', 'attendance.exported'
  entity_type TEXT,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ------------------------------------------------------------
-- 4.2 ANALYTICS EVENTS TABLE
-- ------------------------------------------------------------
-- Track website and portal usage
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL,  -- e.g., 'page_view', 'login', 'file_download'
  user_id UUID,
  user_type TEXT,
  session_id TEXT,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES (Supabase)
-- ============================================================

-- Enable RLS on sensitive tables
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Public can read reference data
DROP POLICY IF EXISTS "Public read departments" ON departments;
CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read roles" ON roles;
CREATE POLICY "Public read roles" ON roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read settings" ON settings;
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (is_public = true);
DROP POLICY IF EXISTS "Public read campaigns" ON campaigns;
CREATE POLICY "Public read campaigns" ON campaigns FOR SELECT USING (status IN ('upcoming', 'active', 'completed'));
DROP POLICY IF EXISTS "Public read partners" ON partners;
CREATE POLICY "Public read partners" ON partners FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Public read gallery" ON gallery;
CREATE POLICY "Public read gallery" ON gallery FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read team_years" ON team_years;
CREATE POLICY "Public read team_years" ON team_years FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "Public read team_members" ON team_members;
CREATE POLICY "Public read team_members" ON team_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read competitions" ON competitions;
CREATE POLICY "Public read competitions" ON competitions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read operations" ON operations;
CREATE POLICY "Public read operations" ON operations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read field_logs" ON field_logs;
CREATE POLICY "Public read field_logs" ON field_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read robots" ON robots;
CREATE POLICY "Public read robots" ON robots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read system_capabilities" ON system_capabilities;
CREATE POLICY "Public read system_capabilities" ON system_capabilities FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Public read news" ON news_articles;
CREATE POLICY "Public read news" ON news_articles FOR SELECT USING (is_published = true);

-- Service role (backend) can do everything
-- These would be configured in Supabase with service role key

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_operations_updated_at ON operations;
CREATE TRIGGER update_operations_updated_at BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_news_updated_at ON news_articles;
CREATE TRIGGER update_news_updated_at BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get member's current attendance status
CREATE OR REPLACE FUNCTION get_member_status(member_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  last_event TEXT;
BEGIN
  SELECT event_type INTO last_event
  FROM attendance
  WHERE member_id = member_uuid
  ORDER BY timestamp DESC
  LIMIT 1;

  IF last_event IS NULL THEN
    RETURN 'OUTSIDE';
  ELSIF last_event = 'IN' THEN
    RETURN 'IN WORKSHOP';
  ELSE
    RETURN 'OUTSIDE';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total hours today
CREATE OR REPLACE FUNCTION get_hours_today(member_uuid UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_hours NUMERIC;
BEGIN
  WITH paired_events AS (
    SELECT
      a1.timestamp AS in_time,
      (SELECT timestamp
       FROM attendance a2
       WHERE a2.member_id = member_uuid
         AND a2.event_type = 'OUT'
         AND a2.timestamp > a1.timestamp
       ORDER BY a2.timestamp
       LIMIT 1) AS out_time
    FROM attendance a1
    WHERE a1.member_id = member_uuid
      AND a1.event_type = 'IN'
      AND DATE(a1.timestamp) = CURRENT_DATE
  )
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (out_time - in_time)) / 3600), 0)
  INTO total_hours
  FROM paired_events
  WHERE out_time IS NOT NULL;

  RETURN ROUND(total_hours::NUMERIC, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================

-- Active members with their departments and roles
CREATE OR REPLACE VIEW active_members_view AS
SELECT
  m.id,
  m.name,
  m.email,
  m.join_date,
  m.graduation_year,
  m.is_active,
  ARRAY_AGG(DISTINCT d.name) AS departments,
  ARRAY_AGG(DISTINCT r.display_name) AS roles
FROM members m
LEFT JOIN member_departments md ON m.id = md.member_id
LEFT JOIN departments d ON md.department_id = d.id
LEFT JOIN member_roles mr ON m.id = mr.member_id
LEFT JOIN roles r ON mr.role_id = r.id
WHERE m.is_active = true
GROUP BY m.id, m.name, m.email, m.join_date, m.graduation_year, m.is_active;

-- Attendance summary view
CREATE OR REPLACE VIEW attendance_summary_view AS
SELECT
  m.id AS member_id,
  m.name AS member_name,
  DATE(a.timestamp) AS attendance_date,
  COUNT(*) FILTER (WHERE a.event_type = 'IN') AS check_ins,
  COUNT(*) FILTER (WHERE a.event_type = 'OUT') AS check_outs,
  (SELECT get_hours_today(m.id)) AS total_hours
FROM members m
JOIN attendance a ON m.id = a.member_id
GROUP BY m.id, m.name, DATE(a.timestamp)
ORDER BY attendance_date DESC, m.name;

-- ============================================================
-- SAMPLE DATA AND SEEDS
-- ============================================================

-- Default admin user (CHANGE PASSWORD AFTER FIRST LOGIN!)
INSERT INTO admin_users (id, username, password_hash, name, is_super_admin)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2b$12$placeholder_hash_replace_with_real_bcrypt_hash',
  'System Administrator',
  true
) ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- BACKUP AND MAINTENANCE QUERIES
-- ============================================================

-- Archive old attendance (older than 1 year) to separate table
CREATE TABLE IF NOT EXISTS attendance_archive (LIKE attendance INCLUDING ALL);

-- Function to archive old records
CREATE OR REPLACE FUNCTION archive_old_attendance()
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move records older than 1 year
  WITH old_records AS (
    DELETE FROM attendance
    WHERE timestamp < NOW() - INTERVAL '1 year'
    RETURNING *
  )
  INSERT INTO attendance_archive
  SELECT * FROM old_records;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DOCUMENTATION
-- ============================================================

/*
QUICK START GUIDE:

1. Run this entire SQL file in your Supabase SQL Editor

2. Update the default admin password:
   UPDATE admin_users SET password_hash = '<new_bcrypt_hash>' WHERE username = 'admin';

3. Create sample members:
   INSERT INTO members (name, email, pin, join_date, graduation_year)
   VALUES ('Jane Doe', 'jane@example.com', '1234', '2024-09-01', 2027);

   -- Get the member ID and assign departments/roles:
   INSERT INTO member_departments (member_id, department_id, is_primary)
   VALUES ('<uuid>', 'prog', true);

   INSERT INTO member_roles (member_id, role_id)
   VALUES ('<uuid>', 'member');

4. Create a team year:
   INSERT INTO team_years (year, label, status, team_photo_url)
   VALUES (2024, '2024-25 Season', 'active', 'https://example.com/team.jpg');

5. Add partners:
   INSERT INTO partners (name, logo_url, website_url, partner_class, is_active)
   VALUES ('Tech Corp', 'https://example.com/logo.png', 'https://techcorp.com', 'FINANCIAL PARTNER', true);

SECURITY NOTES:
- Use bcrypt/argon2 for password hashing (never store plain text)
- Implement proper RLS policies for production
- Rotate admin credentials regularly
- Use HTTPS for all API communications
- Implement rate limiting on authentication endpoints

BACKUP STRATEGY:
- Use Supabase's automated backups
- Run pg_dump weekly for additional safety
- Export critical data (members, attendance) regularly
*/

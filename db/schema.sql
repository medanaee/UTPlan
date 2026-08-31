-- ============================================================
-- UT-ECE Database Schema for Cloudflare D1 (SQLite)
-- ============================================================

-- 1. USERS & SESSIONS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  student_id TEXT,
  faculty_id TEXT,
  major_id TEXT,
  track_id TEXT,
  entry_year INTEGER,
  entry_semester TEXT,
  passed_course_ids TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- 2. FACULTIES
CREATE TABLE IF NOT EXISTS faculties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 3. MAJORS
CREATE TABLE IF NOT EXISTS majors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  faculty_id TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE CASCADE
);

-- 4. TRACKS
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  major_id TEXT NOT NULL,
  total_units_required INTEGER NOT NULL,
  is_approved_default INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE CASCADE
);

-- 5. VISUAL CATEGORIES
CREATE TABLE IF NOT EXISTS visual_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 6. RULE CATEGORIES
CREATE TABLE IF NOT EXISTS rule_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  track_id TEXT NOT NULL,
  min_units INTEGER NOT NULL,
  max_units INTEGER,
  rule_ast TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- 7. COURSES
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  units INTEGER NOT NULL,
  is_general INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL
);

-- 8. TRACK ASSIGNMENTS
CREATE TABLE IF NOT EXISTS track_assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  visual_category_id TEXT NOT NULL,
  rule_category_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (visual_category_id) REFERENCES visual_categories(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_category_id) REFERENCES rule_categories(id) ON DELETE SET NULL
);

-- 9. PREREQUISITES
CREATE TABLE IF NOT EXISTS prerequisites (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  required_course_id TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (required_course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 10. PROFESSORS
CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  faculty_id TEXT,
  rating REAL,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL
);

-- 11. OFFERINGS
CREATE TABLE IF NOT EXISTS offerings (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  professor_id TEXT NOT NULL,
  term TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  registered INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  exam_date TEXT,
  exam_time TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE
);

-- 12. EVENTS
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (offering_id) REFERENCES offerings(id) ON DELETE CASCADE
);

-- 13. REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  professor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 14. CHARTS
CREATE TABLE IF NOT EXISTS charts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  track_id TEXT NOT NULL,
  is_approved_default INTEGER NOT NULL DEFAULT 0,
  semesters TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_majors_faculty ON majors(faculty_id);
CREATE INDEX IF NOT EXISTS idx_tracks_major ON tracks(major_id);
CREATE INDEX IF NOT EXISTS idx_rule_cats_track ON rule_categories(track_id);
CREATE INDEX IF NOT EXISTS idx_track_assignments_course ON track_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_track_assignments_track ON track_assignments(track_id);
CREATE INDEX IF NOT EXISTS idx_prereqs_course ON prerequisites(course_id);
CREATE INDEX IF NOT EXISTS idx_offerings_course ON offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_events_offering ON events(offering_id);
CREATE INDEX IF NOT EXISTS idx_charts_user ON charts(user_id);
CREATE INDEX IF NOT EXISTS idx_charts_track ON charts(track_id);

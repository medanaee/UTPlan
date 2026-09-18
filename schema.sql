-- Cloudflare D1 Database Schema for UT-ECE Course Planning & Scheduling System
-- UTF-8 SQLite DDL

PRAGMA foreign_keys = ON;

-- 1. Faculties Table
CREATE TABLE IF NOT EXISTS faculties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'super_admin', 'admin', 'user'
  faculty_id TEXT,
  major_id TEXT,
  track_id TEXT,
  entry_semester TEXT, -- e.g. "1402-1"
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_faculty ON users(faculty_id);

-- 3. Majors Table
CREATE TABLE IF NOT EXISTS majors (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);
CREATE INDEX IF NOT EXISTS idx_majors_faculty ON majors(faculty_id);

-- 4. Tracks Table
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  major_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  rules_tree TEXT, -- JSON AST for degree requirements
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (major_id) REFERENCES majors(id)
);
CREATE INDEX IF NOT EXISTS idx_tracks_major ON tracks(major_id);

-- 5. Categories Table (Unified hierarchical category tree with color, per track)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  parent_id TEXT,
  code TEXT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id),
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
CREATE INDEX IF NOT EXISTS idx_categories_track ON categories(track_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);

-- 6. Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  degree_level TEXT NOT NULL DEFAULT 'undergrad', -- 'undergrad' | 'master'
  abbreviation TEXT,
  units INTEGER NOT NULL DEFAULT 3,
  offered_in TEXT NOT NULL DEFAULT 'both', -- 'fall', 'spring', 'both'
  description TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);
CREATE INDEX IF NOT EXISTS idx_courses_faculty ON courses(faculty_id);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_courses_abbreviation ON courses(abbreviation);

-- 7. Prerequisites Table
CREATE TABLE IF NOT EXISTS prerequisites (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  required_course_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'prerequisite', -- 'prerequisite' | 'corequisite' | 'recommended'
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (required_course_id) REFERENCES courses(id),
  UNIQUE(course_id, required_course_id, type)
);
CREATE INDEX IF NOT EXISTS idx_prereq_course ON prerequisites(course_id);
CREATE INDEX IF NOT EXISTS idx_prereq_required ON prerequisites(required_course_id);

-- 8. Track Course Assignments (Associating courses with track categories)
CREATE TABLE IF NOT EXISTS track_course_assignments (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  category_id TEXT,
  FOREIGN KEY (track_id) REFERENCES tracks(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  UNIQUE(track_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_track_courses_track ON track_course_assignments(track_id);
CREATE INDEX IF NOT EXISTS idx_track_courses_course ON track_course_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_track_courses_category ON track_course_assignments(category_id);

-- 10. Professors Table
CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  title TEXT,
  email TEXT,
  links TEXT, -- JSON string for personal website, Google Scholar, etc.
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);
CREATE INDEX IF NOT EXISTS idx_professors_faculty ON professors(faculty_id);
CREATE INDEX IF NOT EXISTS idx_professors_code ON professors(code);
CREATE INDEX IF NOT EXISTS idx_professors_name ON professors(last_name, first_name);

-- 11. Course Offerings Table (Course offering entity)
CREATE TABLE IF NOT EXISTS course_offerings (
  id TEXT PRIMARY KEY,
  code TEXT,
  course_id TEXT NOT NULL,
  description TEXT,
  finalized_semesters TEXT, -- JSON array of string semester codes e.g. ["1403-1", "1404-2", "1405-3"]
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_offerings_course ON course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_offerings_code ON course_offerings(code);

-- 12. Offering Professors Junction Table (Co-teaching / Multi-professors)
CREATE TABLE IF NOT EXISTS offering_professors (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL,
  professor_id TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE,
  FOREIGN KEY (professor_id) REFERENCES professors(id) ON DELETE CASCADE,
  UNIQUE(offering_id, professor_id)
);
CREATE INDEX IF NOT EXISTS idx_offering_prof_offering ON offering_professors(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_prof_professor ON offering_professors(professor_id);

-- 13. Course Events Table (Class schedule & exam slots)
CREATE TABLE IF NOT EXISTS course_events (
  id TEXT PRIMARY KEY,
  code TEXT,
  offering_id TEXT NOT NULL,
  term TEXT NOT NULL,
  location TEXT,
  exam_date TEXT,
  exam_start_time TEXT,
  exam_end_time TEXT,
  is_user_custom INTEGER NOT NULL DEFAULT 0,
  user_id TEXT,
  global_event_id TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id)
);
CREATE INDEX IF NOT EXISTS idx_events_code ON course_events(code);
CREATE INDEX IF NOT EXISTS idx_events_offering ON course_events(offering_id);
CREATE INDEX IF NOT EXISTS idx_events_term ON course_events(term);
CREATE INDEX IF NOT EXISTS idx_events_deleted ON course_events(deleted_at);

-- 14. Course Event Slots Table (Weekly recurring slots)
CREATE TABLE IF NOT EXISTS course_event_slots (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0: Sat, 1: Sun, 2: Mon, 3: Tue, 4: Wed, 5: Thu, 6: Fri
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES course_events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_slots_event ON course_event_slots(event_id);

-- 15. Reviews Table (Course offering & professor reviews)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  target_type TEXT NOT NULL, -- 'professor' | 'offering'
  target_id TEXT NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  student_grade REAL, -- optional passed grade (0 to 20)
  comment TEXT NOT NULL,
  overall_rating REAL NOT NULL DEFAULT 10,
  criteria_ratings TEXT, -- JSON
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

-- 16. Student Charts Table
CREATE TABLE IF NOT EXISTS charts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  waived_course_ids TEXT,
  is_approved_template INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);
CREATE INDEX IF NOT EXISTS idx_charts_user ON charts(user_id);
CREATE INDEX IF NOT EXISTS idx_charts_track ON charts(track_id);

-- 17. Chart Terms Table (Semesters 1 to 12)
CREATE TABLE IF NOT EXISTS chart_terms (
  id TEXT PRIMARY KEY,
  chart_id TEXT NOT NULL,
  term_index INTEGER NOT NULL, -- 1 to 12
  term_label TEXT, -- e.g. "ترم ۱ - پاییز ۱۴۰۲"
  FOREIGN KEY (chart_id) REFERENCES charts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chart_terms_chart ON chart_terms(chart_id);

-- 18. Chart Courses Table (Course assignments in chart semesters)
CREATE TABLE IF NOT EXISTS chart_courses (
  id TEXT PRIMARY KEY,
  term_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  selected_event_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (term_id) REFERENCES chart_terms(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_chart_courses_term ON chart_courses(term_id);
CREATE INDEX IF NOT EXISTS idx_chart_courses_course ON chart_courses(course_id);

-- 19. Offering Resources Table (Course learning resources)
CREATE TABLE IF NOT EXISTS offering_resources (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL,
  title TEXT NOT NULL,
  term TEXT,
  type TEXT NOT NULL, -- 'video' | 'slide' | 'archive'
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_offering_resources_offering ON offering_resources(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_resources_type ON offering_resources(type);

-- 20. Faculty Links Table (Provider/Shared faculties linking)
CREATE TABLE IF NOT EXISTS faculty_links (
  id TEXT PRIMARY KEY,
  target_faculty_id TEXT NOT NULL,
  source_faculty_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (target_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
  FOREIGN KEY (source_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
  UNIQUE(target_faculty_id, source_faculty_id)
);
CREATE INDEX IF NOT EXISTS idx_faculty_links_target ON faculty_links(target_faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_links_source ON faculty_links(source_faculty_id);

-- 21. Review Reactions Table (Emoji reactions on student reviews)
CREATE TABLE IF NOT EXISTS review_reactions (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_id TEXT,
  client_id TEXT,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON review_reactions(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON review_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_client ON review_reactions(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_unique ON review_reactions(review_id, user_id, emoji) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_client_unique ON review_reactions(review_id, client_id, emoji) WHERE user_id IS NULL AND client_id IS NOT NULL;

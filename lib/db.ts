import { env } from "cloudflare:workers";
import type {
  User,
  Faculty,
  Major,
  Track,
  VisualCategory,
  RuleCategory,
  Course,
  PrerequisiteRelation,
  TrackCourseAssignment,
  Professor,
  CourseOffering,
  CourseEvent,
  CourseEventSlot,
  Review,
  StudentChart,
  ChartSemester,
  RuleGroupNode,
} from "./types";
import { hashPassword } from "./auth";

let isD1LogShown = false;

/**
 * Access Cloudflare D1 database binding
 */
export function getD1(): any {
  let db: any = null;

  try {
    if (typeof env !== "undefined" && (env as any)?.ut_ece_db) {
      db = (env as any).ut_ece_db;
    }
  } catch {}

  if (!db && typeof globalThis !== "undefined" && (globalThis as any).ut_ece_db) {
    db = (globalThis as any).ut_ece_db;
  }
  if (!db && typeof process !== "undefined" && (process.env as any)?.ut_ece_db) {
    db = (process.env as any).ut_ece_db;
  }

  if (db && !isD1LogShown) {
    console.log("\x1b[32m✔ [Cloudflare D1]\x1b[0m بایندینگ پایگاه‌داده ut_ece_db با موفقیت متصل شد.");
    isD1LogShown = true;
  }

  return db;
}

// =========================================================================
// IN-MEMORY FALLBACK STORES (For offline dev testing if D1 binding is absent)
// =========================================================================
let usersStore: User[] = [];
let facultiesStore: Faculty[] = [];
let majorsStore: Major[] = [];
let tracksStore: Track[] = [];
let visualCategoriesStore: VisualCategory[] = [];
let ruleCategoriesStore: RuleCategory[] = [];
let coursesStore: Course[] = [];
let prerequisitesStore: PrerequisiteRelation[] = [];
let trackAssignmentsStore: TrackCourseAssignment[] = [];
let professorsStore: Professor[] = [];
let offeringsStore: CourseOffering[] = [];
let eventsStore: CourseEvent[] = [];
let eventSlotsStore: CourseEventSlot[] = [];
let reviewsStore: Review[] = [];
let chartsStore: StudentChart[] = [];
let isFallbackInitialized = false;

export async function initFallbackDevData() {
  if (isFallbackInitialized) return;
  const adminHash = await hashPassword("admin123");
  const studentHash = await hashPassword("student123");

  usersStore = [
    {
      id: "usr_super_admin",
      name: "مدیر ارشد سامانه",
      email: "admin@example.com",
      role: "super_admin",
      passwordHash: adminHash,
      createdAt: new Date().toISOString(),
    },
    {
      id: "usr_student",
      name: "دانشجو نمونه",
      email: "student@example.com",
      role: "user",
      passwordHash: studentHash,
      facultyId: "fac_ece",
      majorId: "maj_ce",
      trackId: "trk_software",
      entrySemester: "1402-1",
      createdAt: new Date().toISOString(),
    },
  ];

  facultiesStore = [
    { id: "fac_ece", name: "دانشکده مهندسی برق و کامپیوتر", code: "ECE", createdAt: new Date().toISOString() },
  ];

  majorsStore = [
    { id: "maj_ce", facultyId: "fac_ece", name: "مهندسی کامپیوتر", code: "CE", createdAt: new Date().toISOString() },
    { id: "maj_ee", facultyId: "fac_ece", name: "مهندسی برق", code: "EE", createdAt: new Date().toISOString() },
  ];

  tracksStore = [
    {
      id: "trk_software",
      majorId: "maj_ce",
      name: "نرم‌افزار",
      code: "SWE",
      rulesTree: { id: "grp_root", type: "GROUP", operator: "AND", children: [] },
      createdAt: new Date().toISOString(),
    },
  ];

  isFallbackInitialized = true;
}

export async function seedDatabase(fullSeed = true) {
  const adminHash = await hashPassword("admin123");
  const studentHash = await hashPassword("student123");
  const now = new Date().toISOString();
  const d1 = getD1();

  if (d1) {
    // 1. Ensure Super Admin Exists
    const existingAdmin = await d1
      .prepare("SELECT id FROM users WHERE LOWER(email) = ?")
      .bind("admin@example.com")
      .first();

    if (!existingAdmin) {
      await d1
        .prepare(
          `INSERT INTO users (id, name, email, password_hash, role, created_at)
           VALUES ('usr_super_admin', 'مدیر ارشد سامانه', 'admin@example.com', ?, 'super_admin', ?)`
        )
        .bind(adminHash, now)
        .run();
    }

    if (!fullSeed) {
      return { success: true, message: "حساب کاربری مدیر ارشد بررسی و ثبت گردید." };
    }

    // 2. Sample Faculty
    await d1
      .prepare(
        `INSERT INTO faculties (id, name, code, created_at)
         VALUES ('fac_ece', 'دانشکده مهندسی برق و کامپیوتر', 'ECE', ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now)
      .run();

    // 3. Sample Majors
    await d1
      .prepare(
        `INSERT INTO majors (id, faculty_id, name, code, created_at)
         VALUES ('maj_ce', 'fac_ece', 'مهندسی کامپیوتر', 'CE', ?),
                ('maj_ee', 'fac_ece', 'مهندسی برق', 'EE', ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now, now)
      .run();

    // 4. Sample Tracks
    const rulesTreeJson = JSON.stringify({ id: "grp_root", type: "GROUP", operator: "AND", children: [] });
    await d1
      .prepare(
        `INSERT INTO tracks (id, major_id, name, code, rules_tree, created_at)
         VALUES ('trk_software', 'maj_ce', 'نرم‌افزار', 'SWE', ?, ?),
                ('trk_hardware', 'maj_ce', 'معماری سیستم‌های کامپیوتری', 'HWE', ?, ?),
                ('trk_ai', 'maj_ce', 'هوش مصنوعی و رباتیک', 'AI', ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(rulesTreeJson, now, rulesTreeJson, now, rulesTreeJson, now)
      .run();

    // 5. Visual Categories
    await d1
      .prepare(
        `INSERT INTO visual_categories (id, track_id, name, color, sort_order, created_at)
         VALUES ('vcat_base', 'trk_software', 'دروس پایه', '#3b82f6', 1, ?),
                ('vcat_core', 'trk_software', 'دروس اصلی', '#10b981', 2, ?),
                ('vcat_spec', 'trk_software', 'دروس تخصصی', '#8b5cf6', 3, ?),
                ('vcat_gen', 'trk_software', 'دروس عمومی', '#f59e0b', 4, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now, now, now, now)
      .run();

    // 6. Rule Categories
    await d1
      .prepare(
        `INSERT INTO rule_categories (id, track_id, parent_id, name, min_credits, created_at)
         VALUES ('rcat_base', 'trk_software', NULL, 'دروس پایه', 20, ?),
                ('rcat_core', 'trk_software', NULL, 'دروس اصلی', 60, ?),
                ('rcat_spec', 'trk_software', NULL, 'دروس تخصصی', 25, ?),
                ('rcat_gen', 'trk_software', NULL, 'دروس عمومی', 22, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now, now, now, now)
      .run();

    // 7. Sample Courses
    const courses = [
      { id: "crs_math1", name: "ریاضی عمومی ۱", code: "MATH101", units: 3, catV: "vcat_base", catR: "rcat_base" },
      { id: "crs_phys1", name: "فیزیک ۱", code: "PHYS101", units: 3, catV: "vcat_base", catR: "rcat_base" },
      { id: "crs_prog", name: "مبانی برنامه‌سازی", code: "PROG101", units: 3, catV: "vcat_base", catR: "rcat_base" },
      { id: "crs_ds", name: "ساختمان داده‌ها", code: "DS201", units: 3, catV: "vcat_core", catR: "rcat_core" },
      { id: "crs_algo", name: "طراحی الگوریتم", code: "ALGO301", units: 3, catV: "vcat_core", catR: "rcat_core" },
      { id: "crs_logic", name: "مدارهای منطقی", code: "LOGIC101", units: 3, catV: "vcat_core", catR: "rcat_core" },
      { id: "crs_arch", name: "معماری کامپیوتر", code: "ARCH201", units: 3, catV: "vcat_core", catR: "rcat_core" },
      { id: "crs_net", name: "شبکه‌های کامپیوتری", code: "NET301", units: 3, catV: "vcat_spec", catR: "rcat_spec" },
      { id: "crs_db", name: "پایگاه داده‌ها", code: "DB201", units: 3, catV: "vcat_core", catR: "rcat_core" },
      { id: "crs_os", name: "سیستم‌های عامل", code: "OS301", units: 3, catV: "vcat_core", catR: "rcat_core" },
      { id: "crs_pers", name: "فارسی عمومی", code: "PERS101", units: 2, catV: "vcat_gen", catR: "rcat_gen" },
      { id: "crs_eng", name: "زبان انگلیسی عمومی", code: "ENG101", units: 2, catV: "vcat_gen", catR: "rcat_gen" },
    ];

    for (const c of courses) {
      await d1
        .prepare(
          `INSERT INTO courses (id, faculty_id, name, code, units, offered_in, description, created_at)
           VALUES (?, 'fac_ece', ?, ?, ?, 'both', '', ?)
           ON CONFLICT(id) DO NOTHING`
        )
        .bind(c.id, c.name, c.code, c.units, now)
        .run();

      await d1
        .prepare(
          `INSERT INTO track_course_assignments (id, track_id, course_id, visual_category_id, rule_category_id)
           VALUES (?, 'trk_software', ?, ?, ?)
           ON CONFLICT(track_id, course_id) DO NOTHING`
        )
        .bind(`assign_trk_software_${c.id}`, c.id, c.catV, c.catR)
        .run();
    }

    // 8. Prerequisites
    await d1
      .prepare(
        `INSERT INTO prerequisites (id, course_id, required_course_id, type)
         VALUES ('pr_1', 'crs_ds', 'crs_prog', 'prerequisite'),
                ('pr_2', 'crs_algo', 'crs_ds', 'prerequisite'),
                ('pr_3', 'crs_arch', 'crs_logic', 'prerequisite'),
                ('pr_4', 'crs_db', 'crs_ds', 'prerequisite'),
                ('pr_5', 'crs_os', 'crs_arch', 'prerequisite')
         ON CONFLICT(course_id, required_course_id, type) DO NOTHING`
      )
      .run();

    // 9. Sample Professors
    const profs = [
      {
        id: "prf_1",
        first_name: "علی",
        last_name: "محمدی",
        name: "دکتر علی محمدی",
        title: "استاد تمام",
        email: "mohammadi@ut.ac.ir",
        links: JSON.stringify({ website: "https://ece.ut.ac.ir/mohammadi", scholar: "https://scholar.google.com" }),
      },
      {
        id: "prf_2",
        first_name: "سارا",
        last_name: "احمدی",
        name: "دکتر سارا احمدی",
        title: "دانشیار",
        email: "s.ahmadi@ut.ac.ir",
        links: JSON.stringify({ website: "https://ece.ut.ac.ir/ahmadi", scholar: "https://scholar.google.com" }),
      },
      {
        id: "prf_3",
        first_name: "رضا",
        last_name: "حسینی",
        name: "دکتر رضا حسینی",
        title: "استادیار",
        email: "hosseini@ut.ac.ir",
        links: JSON.stringify({ website: "https://ece.ut.ac.ir/hosseini" }),
      },
    ];

    for (const p of profs) {
      await d1
        .prepare(
          `INSERT INTO professors (id, faculty_id, first_name, last_name, name, title, email, links, created_at)
           VALUES (?, 'fac_ece', ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`
        )
        .bind(p.id, p.first_name, p.last_name, p.name, p.title, p.email, p.links, now)
        .run();
    }

    // 10. Sample Student User
    await d1
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, faculty_id, major_id, track_id, entry_semester, created_at)
         VALUES ('usr_student', 'دانشجو نمونه', 'student@example.com', ?, 'user', 'fac_ece', 'maj_ce', 'trk_software', '1402-1', ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(studentHash, now)
      .run();

    // 11. Sample Offerings & Events
    await d1
      .prepare(
        `INSERT INTO course_offerings (id, course_id, professor_id, created_at)
         VALUES ('off_prog_1', 'crs_prog', 'prf_1', ?),
                ('off_ds_1', 'crs_ds', 'prf_2', ?),
                ('off_db_1', 'crs_db', 'prf_3', ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now, now, now)
      .run();

    await d1
      .prepare(
        `INSERT INTO course_events (id, offering_id, term, location, exam_date, exam_start_time, exam_end_time, is_user_custom, created_at)
         VALUES ('evt_prog_1', 'off_prog_1', '1403-1', 'دانشکده فنی - کلاس ۱۰۲', '1403/10/22', '08:30', '11:00', 0, ?),
                ('evt_ds_1', 'off_ds_1', '1403-1', 'دانشکده فنی - کلاس ۲۰۴', '1403/10/25', '13:30', '16:00', 0, ?),
                ('evt_db_1', 'off_db_1', '1403-1', 'دانشکده فنی - کلاس ۳۰۱', '1403/10/28', '08:30', '11:00', 0, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now, now, now)
      .run();

    await d1
      .prepare(
        `INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time)
         VALUES ('slot_1', 'evt_prog_1', 0, '10:30', '12:00'),
                ('slot_2', 'evt_prog_1', 2, '10:30', '12:00'),
                ('slot_3', 'evt_ds_1', 1, '08:30', '10:00'),
                ('slot_4', 'evt_ds_1', 3, '08:30', '10:00'),
                ('slot_5', 'evt_db_1', 0, '13:30', '15:00'),
                ('slot_6', 'evt_db_1', 2, '13:30', '15:00')
         ON CONFLICT(id) DO NOTHING`
      )
      .run();

    // 12. Approved Default Chart
    await d1
      .prepare(
        `INSERT INTO charts (id, user_id, track_id, title, is_approved_template, created_at, updated_at)
         VALUES ('ch_approved_swe', 'usr_super_admin', 'trk_software', 'چارت مصوب کارشناسی مهندسی نرم‌افزار', 1, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(now, now)
      .run();

    // Terms 1 and 2
    await d1
      .prepare(
        `INSERT INTO chart_terms (id, chart_id, term_index)
         VALUES ('term_ch_approved_swe_1', 'ch_approved_swe', 1),
                ('term_ch_approved_swe_2', 'ch_approved_swe', 2)
         ON CONFLICT(id) DO NOTHING`
      )
      .run();

    await d1
      .prepare(
        `INSERT INTO chart_courses (id, term_id, course_id, sort_order)
         VALUES ('cc_1', 'term_ch_approved_swe_1', 'crs_math1', 0),
                ('cc_2', 'term_ch_approved_swe_1', 'crs_phys1', 1),
                ('cc_3', 'term_ch_approved_swe_1', 'crs_prog', 2),
                ('cc_4', 'term_ch_approved_swe_1', 'crs_pers', 3),
                ('cc_5', 'term_ch_approved_swe_2', 'crs_ds', 0),
                ('cc_6', 'term_ch_approved_swe_2', 'crs_logic', 1),
                ('cc_7', 'term_ch_approved_swe_2', 'crs_eng', 2)
         ON CONFLICT(id) DO NOTHING`
      )
      .run();

    return { success: true, message: "داده‌های کامل دانشگاهی با موفقیت در دیتابیس D1 ذخیره شدند." };
  }

  await initFallbackDevData();
  return { success: true, message: "داده‌های آزمایشی در حافظه موقت بارگذاری شدند." };
}

// ----------------------------------------------------
// 1. USERS CRUD
// ----------------------------------------------------
export async function findUserByEmail(email: string): Promise<User | null> {
  const cleanEmail = email.trim().toLowerCase();
  const d1 = getD1();
  if (d1) {
    try {
      const row = await d1
        .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
        .bind(cleanEmail)
        .first();
      if (!row) return null;
      const fName = (row as any).first_name || "";
      const lName = (row as any).last_name || "";
      const fullName = (row as any).name || [fName, lName].filter(Boolean).join(" ") || "کاربر";
      return {
        id: (row as any).id,
        firstName: fName || undefined,
        lastName: lName || undefined,
        name: fullName,
        email: (row as any).email,
        role: (row as any).role as any,
        passwordHash: (row as any).password_hash,
        facultyId: (row as any).faculty_id || undefined,
        majorId: (row as any).major_id || undefined,
        trackId: (row as any).track_id || undefined,
        entrySemester: (row as any).entry_semester || undefined,
        avatarUrl: (row as any).avatar_url || undefined,
        createdAt: (row as any).created_at,
      };
    } catch (err) {
      console.error("D1 findUserByEmail error:", err);
    }
  }

  await initFallbackDevData();
  return usersStore.find((u) => u.email.toLowerCase() === cleanEmail) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const row = await d1.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
      if (!row) return null;
      const fName = (row as any).first_name || "";
      const lName = (row as any).last_name || "";
      const fullName = (row as any).name || [fName, lName].filter(Boolean).join(" ") || "کاربر";
      return {
        id: (row as any).id,
        firstName: fName || undefined,
        lastName: lName || undefined,
        name: fullName,
        email: (row as any).email,
        role: (row as any).role as any,
        passwordHash: (row as any).password_hash,
        facultyId: (row as any).faculty_id || undefined,
        majorId: (row as any).major_id || undefined,
        trackId: (row as any).track_id || undefined,
        entrySemester: (row as any).entry_semester || undefined,
        avatarUrl: (row as any).avatar_url || undefined,
        createdAt: (row as any).created_at,
      };
    } catch (err) {
      console.error("D1 findUserById error:", err);
    }
  }

  await initFallbackDevData();
  return usersStore.find((u) => u.id === id) || null;
}

export async function getAllUsers(): Promise<User[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1
        .prepare("SELECT * FROM users ORDER BY created_at DESC")
        .all();
      return (results || []).map((row: any) => {
        const fName = row.first_name || "";
        const lName = row.last_name || "";
        const fullName = row.name || [fName, lName].filter(Boolean).join(" ") || "کاربر";
        return {
          id: row.id,
          firstName: fName || undefined,
          lastName: lName || undefined,
          name: fullName,
          email: row.email,
          role: row.role as any,
          passwordHash: row.password_hash,
          facultyId: row.faculty_id || undefined,
          majorId: row.major_id || undefined,
          trackId: row.track_id || undefined,
          entrySemester: row.entry_semester || undefined,
          avatarUrl: row.avatar_url || undefined,
          createdAt: row.created_at,
        };
      });
    } catch (err) {
      console.error("D1 getAllUsers error:", err);
    }
  }

  await initFallbackDevData();
  return usersStore;
}

export async function createUser(data: {
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  passwordHash: string;
  role?: "super_admin" | "admin" | "user";
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
  avatarUrl?: string;
}): Promise<User> {
  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const cleanEmail = data.email.trim().toLowerCase();
  const role = data.role || "user";
  const now = new Date().toISOString();

  const firstName = (data.firstName || "").trim();
  const lastName = (data.lastName || "").trim();
  const fullName = data.name?.trim() || [firstName, lastName].filter(Boolean).join(" ") || "کاربر";

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO users (id, first_name, last_name, name, email, password_hash, role, faculty_id, major_id, track_id, entry_semester, avatar_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          firstName,
          lastName,
          fullName,
          cleanEmail,
          data.passwordHash,
          role,
          data.facultyId || null,
          data.majorId || null,
          data.trackId || null,
          data.entrySemester || null,
          data.avatarUrl || null,
          now
        )
        .run();
    } catch (err) {
      console.error("D1 createUser error:", err);
      throw err;
    }
  }

  const newUser: User = {
    id,
    firstName,
    lastName,
    name: fullName,
    email: cleanEmail,
    passwordHash: data.passwordHash,
    role,
    facultyId: data.facultyId,
    majorId: data.majorId,
    trackId: data.trackId,
    entrySemester: data.entrySemester,
    avatarUrl: data.avatarUrl,
    createdAt: now,
  };

  usersStore.push(newUser);
  return newUser;
}

export async function updateUserRole(
  userId: string,
  role: "super_admin" | "admin" | "user"
): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, userId).run();
      return true;
    } catch (err) {
      console.error("D1 updateUserRole error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;
  user.role = role;
  return true;
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<User, "firstName" | "lastName" | "name" | "facultyId" | "majorId" | "trackId" | "entrySemester" | "avatarUrl">>
): Promise<User | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const existing = await findUserById(userId);
      if (!existing) return null;

      const updatedFirstName = data.firstName !== undefined ? data.firstName.trim() : (existing.firstName || "");
      const updatedLastName = data.lastName !== undefined ? data.lastName.trim() : (existing.lastName || "");
      const updatedName =
        data.name !== undefined
          ? data.name.trim()
          : [updatedFirstName, updatedLastName].filter(Boolean).join(" ") || existing.name;

      const updatedFaculty = data.facultyId !== undefined ? data.facultyId : (existing.facultyId || null);
      const updatedMajor = data.majorId !== undefined ? data.majorId : (existing.majorId || null);
      const updatedTrack = data.trackId !== undefined ? data.trackId : (existing.trackId || null);
      const updatedSemester = data.entrySemester !== undefined ? data.entrySemester : (existing.entrySemester || null);
      const updatedAvatar = data.avatarUrl !== undefined ? data.avatarUrl : (existing.avatarUrl || null);

      await d1
        .prepare(
          `UPDATE users 
           SET first_name = ?, last_name = ?, name = ?, faculty_id = ?, major_id = ?, track_id = ?, entry_semester = ?, avatar_url = ?
           WHERE id = ?`
        )
        .bind(
          updatedFirstName,
          updatedLastName,
          updatedName,
          updatedFaculty,
          updatedMajor,
          updatedTrack,
          updatedSemester,
          updatedAvatar,
          userId
        )
        .run();

      return await findUserById(userId);
    } catch (err) {
      console.error("D1 updateUserProfile error:", err);
    }
  }

  await initFallbackDevData();
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return null;
  Object.assign(user, data);
  return user;
}

export async function changeUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(newPasswordHash, userId)
        .run();
      return true;
    } catch (err) {
      console.error("D1 changeUserPassword error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  return true;
}

// ----------------------------------------------------
// 2. FACULTIES CRUD
// ----------------------------------------------------
export async function getFaculties(): Promise<Faculty[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1
        .prepare("SELECT * FROM faculties WHERE deleted_at IS NULL ORDER BY name ASC")
        .all();
      return (results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
      }));
    } catch (err) {
      console.error("D1 getFaculties error:", err);
    }
  }

  await initFallbackDevData();
  return facultiesStore.filter((f) => !f.deletedAt);
}

export async function createFaculty(name: string, code: string): Promise<Faculty> {
  const id = `fac_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code.trim().toUpperCase();

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("INSERT INTO faculties (id, name, code, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, name.trim(), cleanCode, now)
        .run();
    } catch (err) {
      console.error("D1 createFaculty error:", err);
      throw err;
    }
  }

  const newFaculty: Faculty = {
    id,
    name: name.trim(),
    code: cleanCode,
    createdAt: now,
    deletedAt: null,
  };
  facultiesStore.push(newFaculty);
  return newFaculty;
}

export async function updateFaculty(id: string, name: string, code: string): Promise<Faculty | null> {
  const cleanCode = code.trim().toUpperCase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE faculties SET name = ?, code = ? WHERE id = ?")
        .bind(name.trim(), cleanCode, id)
        .run();
      const updated = await d1.prepare("SELECT * FROM faculties WHERE id = ?").bind(id).first();
      if (updated) {
        return {
          id: (updated as any).id,
          name: (updated as any).name,
          code: (updated as any).code,
          createdAt: (updated as any).created_at,
          deletedAt: (updated as any).deleted_at || null,
        };
      }
    } catch (err) {
      console.error("D1 updateFaculty error:", err);
    }
  }

  await initFallbackDevData();
  const f = facultiesStore.find((item) => item.id === id);
  if (f) {
    f.name = name.trim();
    f.code = cleanCode;
    return f;
  }
  return null;
}

export async function deleteFaculty(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE faculties SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteFaculty error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const f = facultiesStore.find((item) => item.id === id);
  if (!f) return false;
  f.deletedAt = now;
  return true;
}

// ----------------------------------------------------
// 3. MAJORS CRUD
// ----------------------------------------------------
export async function getMajors(facultyId?: string): Promise<Major[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM majors WHERE deleted_at IS NULL";
      const params: any[] = [];
      if (facultyId) {
        query += " AND faculty_id = ?";
        params.push(facultyId);
      }
      query += " ORDER BY name ASC";
      const { results } = await d1.prepare(query).bind(...params).all();
      return (results || []).map((r: any) => ({
        id: r.id,
        facultyId: r.faculty_id,
        name: r.name,
        code: r.code,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
      }));
    } catch (err) {
      console.error("D1 getMajors error:", err);
    }
  }

  await initFallbackDevData();
  return majorsStore.filter((m) => !m.deletedAt && (!facultyId || m.facultyId === facultyId));
}

export async function createMajor(facultyId: string, name: string, code: string): Promise<Major> {
  const id = `maj_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code.trim().toUpperCase();

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("INSERT INTO majors (id, faculty_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, facultyId, name.trim(), cleanCode, now)
        .run();
    } catch (err) {
      console.error("D1 createMajor error:", err);
      throw err;
    }
  }

  const newMajor: Major = {
    id,
    facultyId,
    name: name.trim(),
    code: cleanCode,
    createdAt: now,
    deletedAt: null,
  };
  majorsStore.push(newMajor);
  return newMajor;
}

export async function updateMajor(id: string, name: string, code: string): Promise<Major | null> {
  const cleanCode = code.trim().toUpperCase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE majors SET name = ?, code = ? WHERE id = ?")
        .bind(name.trim(), cleanCode, id)
        .run();
      const row = await d1.prepare("SELECT * FROM majors WHERE id = ?").bind(id).first();
      if (row) {
        return {
          id: (row as any).id,
          facultyId: (row as any).faculty_id,
          name: (row as any).name,
          code: (row as any).code,
          createdAt: (row as any).created_at,
          deletedAt: (row as any).deleted_at || null,
        };
      }
    } catch (err) {
      console.error("D1 updateMajor error:", err);
    }
  }

  await initFallbackDevData();
  const m = majorsStore.find((item) => item.id === id);
  if (m) {
    m.name = name.trim();
    m.code = cleanCode;
    return m;
  }
  return null;
}

export async function deleteMajor(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE majors SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteMajor error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const m = majorsStore.find((item) => item.id === id);
  if (!m) return false;
  m.deletedAt = now;
  return true;
}

// ----------------------------------------------------
// 4. TRACKS CRUD
// ----------------------------------------------------
export async function getTracks(majorId?: string): Promise<Track[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM tracks WHERE deleted_at IS NULL";
      const params: any[] = [];
      if (majorId) {
        query += " AND major_id = ?";
        params.push(majorId);
      }
      query += " ORDER BY name ASC";
      const { results } = await d1.prepare(query).bind(...params).all();
      return (results || []).map((r: any) => {
        let parsedRules: RuleGroupNode | undefined = undefined;
        if (r.rules_tree) {
          try {
            parsedRules = typeof r.rules_tree === "string" ? JSON.parse(r.rules_tree) : r.rules_tree;
          } catch {
            parsedRules = undefined;
          }
        }
        return {
          id: r.id,
          majorId: r.major_id,
          name: r.name,
          code: r.code,
          rulesTree: parsedRules,
          createdAt: r.created_at,
          deletedAt: r.deleted_at || null,
        };
      });
    } catch (err) {
      console.error("D1 getTracks error:", err);
    }
  }

  await initFallbackDevData();
  return tracksStore.filter((t) => !t.deletedAt && (!majorId || t.majorId === majorId));
}

export async function getTrackById(id: string): Promise<Track | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const r = await d1.prepare("SELECT * FROM tracks WHERE id = ? AND deleted_at IS NULL").bind(id).first();
      if (r) {
        let parsedRules: any = undefined;
        if ((r as any).rules_tree) {
          try {
            parsedRules = typeof (r as any).rules_tree === "string" ? JSON.parse((r as any).rules_tree) : (r as any).rules_tree;
          } catch {
            parsedRules = undefined;
          }
        }
        return {
          id: (r as any).id,
          majorId: (r as any).major_id,
          name: (r as any).name,
          code: (r as any).code,
          rulesTree: parsedRules,
          createdAt: (r as any).created_at,
          deletedAt: (r as any).deleted_at || null,
        };
      }
    } catch (err) {
      console.error("D1 getTrackById error:", err);
    }
  }

  await initFallbackDevData();
  return tracksStore.find((t) => t.id === id && !t.deletedAt) || null;
}

export async function createTrack(
  majorId: string,
  name: string,
  code: string,
  rulesTree?: any
): Promise<Track> {
  const id = `trk_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = code.trim().toUpperCase();
  const rulesJson = rulesTree ? JSON.stringify(rulesTree) : JSON.stringify({ id: "grp_root", type: "GROUP", operator: "AND", children: [] });

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("INSERT INTO tracks (id, major_id, name, code, rules_tree, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, majorId, name.trim(), cleanCode, rulesJson, now)
        .run();
    } catch (err) {
      console.error("D1 createTrack error:", err);
      throw err;
    }
  }

  const newTrack: Track = {
    id,
    majorId,
    name: name.trim(),
    code: cleanCode,
    rulesTree: rulesTree || { id: "grp_root", type: "GROUP", operator: "AND", children: [] },
    createdAt: now,
    deletedAt: null,
  };
  tracksStore.push(newTrack);
  return newTrack;
}

export async function updateTrack(
  id: string,
  name: string,
  code: string,
  rulesTree?: any
): Promise<Track | null> {
  const cleanCode = code.trim().toUpperCase();
  const d1 = getD1();
  if (d1) {
    try {
      if (rulesTree !== undefined) {
        const rulesJson = JSON.stringify(rulesTree);
        await d1
          .prepare("UPDATE tracks SET name = ?, code = ?, rules_tree = ? WHERE id = ?")
          .bind(name.trim(), cleanCode, rulesJson, id)
          .run();
      } else {
        await d1
          .prepare("UPDATE tracks SET name = ?, code = ? WHERE id = ?")
          .bind(name.trim(), cleanCode, id)
          .run();
      }

      const row = await d1.prepare("SELECT * FROM tracks WHERE id = ?").bind(id).first();
      if (row) {
        let parsedRules: any = undefined;
        if ((row as any).rules_tree) {
          try {
            parsedRules = typeof (row as any).rules_tree === "string" ? JSON.parse((row as any).rules_tree) : (row as any).rules_tree;
          } catch {}
        }
        return {
          id: (row as any).id,
          majorId: (row as any).major_id,
          name: (row as any).name,
          code: (row as any).code,
          rulesTree: parsedRules,
          createdAt: (row as any).created_at,
          deletedAt: (row as any).deleted_at || null,
        };
      }
    } catch (err) {
      console.error("D1 updateTrack error:", err);
    }
  }

  await initFallbackDevData();
  const t = tracksStore.find((item) => item.id === id);
  if (t) {
    t.name = name.trim();
    t.code = cleanCode;
    if (rulesTree !== undefined) t.rulesTree = rulesTree;
    return t;
  }
  return null;
}

export async function updateTrackRules(trackId: string, rulesTree: any): Promise<boolean> {
  const rulesJson = JSON.stringify(rulesTree);
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE tracks SET rules_tree = ? WHERE id = ?").bind(rulesJson, trackId).run();
      return true;
    } catch (err) {
      console.error("D1 updateTrackRules error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const t = tracksStore.find((item) => item.id === trackId);
  if (!t) return false;
  t.rulesTree = rulesTree;
  return true;
}

export async function deleteTrack(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE tracks SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteTrack error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const t = tracksStore.find((item) => item.id === id);
  if (!t) return false;
  t.deletedAt = now;
  return true;
}

// ----------------------------------------------------
// 5. VISUAL CATEGORIES (Flat color categories per track)
// ----------------------------------------------------
export async function getVisualCategories(trackId: string): Promise<VisualCategory[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1
        .prepare("SELECT * FROM visual_categories WHERE track_id = ? ORDER BY sort_order ASC")
        .bind(trackId)
        .all();
      return (results || []).map((r: any) => ({
        id: r.id,
        trackId: r.track_id,
        name: r.name,
        color: r.color,
        sortOrder: Number(r.sort_order) || 0,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("D1 getVisualCategories error:", err);
    }
  }

  await initFallbackDevData();
  return visualCategoriesStore
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createVisualCategory(
  trackId: string,
  name: string,
  color: string,
  sortOrder = 0
): Promise<VisualCategory> {
  const id = `vcat_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          "INSERT INTO visual_categories (id, track_id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(id, trackId, name.trim(), color || "#3b82f6", sortOrder, now)
        .run();
    } catch (err) {
      console.error("D1 createVisualCategory error:", err);
      throw err;
    }
  }

  const newCat: VisualCategory = {
    id,
    trackId,
    name: name.trim(),
    color: color || "#3b82f6",
    sortOrder,
    createdAt: now,
  };
  visualCategoriesStore.push(newCat);
  return newCat;
}

export async function deleteVisualCategory(id: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM visual_categories WHERE id = ?").bind(id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteVisualCategory error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const index = visualCategoriesStore.findIndex((c) => c.id === id);
  if (index === -1) return false;
  visualCategoriesStore.splice(index, 1);
  return true;
}

// ----------------------------------------------------
// 6. RULE CATEGORIES (Requirements category tree per track)
// ----------------------------------------------------
export async function getRuleCategories(trackId: string): Promise<RuleCategory[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1
        .prepare("SELECT * FROM rule_categories WHERE track_id = ? ORDER BY sort_order ASC, created_at ASC")
        .bind(trackId)
        .all();
      return (results || []).map((r: any) => ({
        id: r.id,
        trackId: r.track_id,
        parentId: r.parent_id || null,
        name: r.name,
        sortOrder: Number(r.sort_order) || 0,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("D1 getRuleCategories error:", err);
    }
  }

  await initFallbackDevData();
  return ruleCategoriesStore
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export async function createRuleCategory(
  trackId: string,
  name: string,
  parentId?: string | null,
  sortOrder = 0
): Promise<RuleCategory> {
  const id = `rcat_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          "INSERT INTO rule_categories (id, track_id, parent_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(id, trackId, parentId || null, name.trim(), sortOrder, now)
        .run();
    } catch (err) {
      console.error("D1 createRuleCategory error:", err);
      throw err;
    }
  }

  const newCat: RuleCategory = {
    id,
    trackId,
    parentId: parentId || null,
    name: name.trim(),
    sortOrder,
    createdAt: now,
  };
  ruleCategoriesStore.push(newCat);
  return newCat;
}

export async function deleteRuleCategory(id: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM rule_categories WHERE id = ?").bind(id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteRuleCategory error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const index = ruleCategoriesStore.findIndex((c) => c.id === id);
  if (index === -1) return false;
  ruleCategoriesStore.splice(index, 1);
  return true;
}

// ----------------------------------------------------
// 7. TRACK COURSE ASSIGNMENTS
// ----------------------------------------------------
export async function getTrackAssignments(trackId: string): Promise<TrackCourseAssignment[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const query = `
        SELECT a.id, a.track_id, a.course_id, a.visual_category_id, a.rule_category_id,
               c.name AS course_name, c.code AS course_code, c.units AS course_units
        FROM track_course_assignments a
        LEFT JOIN courses c ON a.course_id = c.id
        WHERE a.track_id = ?
      `;
      const { results } = await d1.prepare(query).bind(trackId).all();
      return (results || []).map((r: any) => ({
        id: r.id,
        trackId: r.track_id,
        courseId: r.course_id,
        visualCategoryId: r.visual_category_id || null,
        ruleCategoryId: r.rule_category_id || null,
        courseName: r.course_name || "نامشخص",
        courseCode: r.course_code || "---",
        units: Number(r.course_units) || 3,
      }));
    } catch (err) {
      console.error("D1 getTrackAssignments error:", err);
    }
  }

  await initFallbackDevData();
  return trackAssignmentsStore
    .filter((a) => a.trackId === trackId)
    .map((a) => {
      const crs = coursesStore.find((c) => c.id === a.courseId);
      return {
        ...a,
        courseName: crs?.name || "نامشخص",
        courseCode: crs?.code || "---",
        units: crs?.units || 3,
      };
    });
}

export async function assignCourseToCategories(
  trackId: string,
  courseId: string,
  visualCategoryId?: string | null,
  ruleCategoryId?: string | null
): Promise<TrackCourseAssignment> {
  const id = `assign_${trackId}_${courseId}`;
  const d1 = getD1();
  if (d1) {
    try {
      const upsertSql = `
        INSERT INTO track_course_assignments (id, track_id, course_id, visual_category_id, rule_category_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(track_id, course_id) DO UPDATE SET
          visual_category_id = excluded.visual_category_id,
          rule_category_id = excluded.rule_category_id
      `;
      await d1
        .prepare(upsertSql)
        .bind(id, trackId, courseId, visualCategoryId || null, ruleCategoryId || null)
        .run();
    } catch (err) {
      console.error("D1 assignCourseToCategories error:", err);
    }
  }

  const existing = trackAssignmentsStore.find((a) => a.trackId === trackId && a.courseId === courseId);
  if (existing) {
    if (visualCategoryId !== undefined) existing.visualCategoryId = visualCategoryId;
    if (ruleCategoryId !== undefined) existing.ruleCategoryId = ruleCategoryId;
    return existing;
  }

  const newAssignment: TrackCourseAssignment = {
    id,
    trackId,
    courseId,
    visualCategoryId: visualCategoryId || null,
    ruleCategoryId: ruleCategoryId || null,
  };
  trackAssignmentsStore.push(newAssignment);
  return newAssignment;
}

export async function bulkAssignTrackCourses(
  trackId: string,
  assignments: { courseId: string; visualCategoryId?: string | null; ruleCategoryId?: string | null }[]
): Promise<boolean> {
  for (const item of assignments) {
    await assignCourseToCategories(trackId, item.courseId, item.visualCategoryId, item.ruleCategoryId);
  }
  return true;
}

// ----------------------------------------------------
// 8. COURSES & PREREQUISITES CRUD
// ----------------------------------------------------
export async function getCourses(facultyId?: string, trackId?: string): Promise<Course[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM courses WHERE deleted_at IS NULL";
      const params: any[] = [];
      if (facultyId) {
        query += " AND faculty_id = ?";
        params.push(facultyId);
      }
      query += " ORDER BY name ASC";
      const { results: courseRows } = await d1.prepare(query).bind(...params).all();
      const coursesList = courseRows || [];

      // Fetch all prereqs
      const prereqsQuery = `
        SELECT p.id, p.course_id, p.required_course_id, p.type,
               c.name AS required_course_name, c.code AS required_course_code
        FROM prerequisites p
        LEFT JOIN courses c ON p.required_course_id = c.id
      `;
      const { results: prereqRows } = await d1.prepare(prereqsQuery).all();
      const prereqsList = prereqRows || [];

      // Fetch track assignments
      let assignmentsList: any[] = [];
      if (trackId) {
        const { results: assignRows } = await d1
          .prepare("SELECT * FROM track_course_assignments WHERE track_id = ?")
          .bind(trackId)
          .all();
        assignmentsList = assignRows || [];
      } else {
        const { results: assignRows } = await d1.prepare("SELECT * FROM track_course_assignments").all();
        assignmentsList = assignRows || [];
      }

      return coursesList.map((c: any) => {
        const prereqs = prereqsList
          .filter((p: any) => p.course_id === c.id)
          .map((p: any) => ({
            id: p.id,
            courseId: p.course_id,
            requiredCourseId: p.required_course_id,
            type: p.type as any,
            requiredCourseName: p.required_course_name || "نامشخص",
            requiredCourseCode: p.required_course_code || "---",
          }));

        const assignments = assignmentsList
          .filter((a: any) => a.course_id === c.id)
          .map((a: any) => ({
            id: a.id,
            trackId: a.track_id,
            courseId: a.course_id,
            visualCategoryId: a.visual_category_id || null,
            ruleCategoryId: a.rule_category_id || null,
          }));

        return {
          id: c.id,
          facultyId: c.faculty_id,
          name: c.name,
          code: c.code,
          units: Number(c.units) || 3,
          offeredIn: c.offered_in || "both",
          description: c.description || "",
          createdAt: c.created_at,
          deletedAt: c.deleted_at || null,
          prerequisites: prereqs,
          trackAssignments: assignments,
        };
      });
    } catch (err) {
      console.error("D1 getCourses error:", err);
    }
  }

  await initFallbackDevData();
  const result = coursesStore.filter((c) => !c.deletedAt && (!facultyId || c.facultyId === facultyId));
  return result.map((course) => {
    const prereqs = prerequisitesStore
      .filter((p) => p.courseId === course.id)
      .map((p) => {
        const target = coursesStore.find((c) => c.id === p.requiredCourseId);
        return {
          ...p,
          requiredCourseName: target?.name || "نامشخص",
          requiredCourseCode: target?.code || "---",
        };
      });

    const assignments = trackAssignmentsStore.filter(
      (a) => a.courseId === course.id && (!trackId || a.trackId === trackId)
    );

    return {
      ...course,
      prerequisites: prereqs,
      trackAssignments: assignments,
    };
  });
}

export async function getCourseById(id: string): Promise<Course | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const c = await d1
        .prepare(
          `SELECT c.*, f.name AS faculty_name
           FROM courses c
           LEFT JOIN faculties f ON c.faculty_id = f.id
           WHERE c.id = ? AND c.deleted_at IS NULL`
        )
        .bind(id)
        .first();
      if (!c) return null;

      const { results: prereqRows } = await d1
        .prepare(
          `SELECT p.id, p.course_id, p.required_course_id, p.type,
                  c.name AS required_course_name, c.code AS required_course_code
           FROM prerequisites p
           LEFT JOIN courses c ON p.required_course_id = c.id
           WHERE p.course_id = ?`
        )
        .bind(id)
        .all();

      const { results: depRows } = await d1
        .prepare(
          `SELECT p.id, p.course_id, p.required_course_id, p.type,
                  c.name AS course_name, c.code AS course_code
           FROM prerequisites p
           LEFT JOIN courses c ON p.course_id = c.id
           WHERE p.required_course_id = ? AND c.deleted_at IS NULL`
        )
        .bind(id)
        .all();

      const { results: offeringRows } = await d1
        .prepare(
          `SELECT o.id, o.course_id, o.professor_id, o.created_at,
                  p.name AS professor_name, p.title AS professor_title, p.avatar_url AS professor_avatar
           FROM course_offerings o
           LEFT JOIN professors p ON o.professor_id = p.id
           WHERE o.course_id = ? AND o.deleted_at IS NULL`
        )
        .bind(id)
        .all();

      const { results: assignRows } = await d1
        .prepare("SELECT * FROM track_course_assignments WHERE course_id = ?")
        .bind(id)
        .all();

      return {
        id: (c as any).id,
        facultyId: (c as any).faculty_id,
        facultyName: (c as any).faculty_name || undefined,
        name: (c as any).name,
        code: (c as any).code,
        units: Number((c as any).units) || 3,
        offeredIn: (c as any).offered_in || "both",
        description: (c as any).description || "",
        createdAt: (c as any).created_at,
        deletedAt: (c as any).deleted_at || null,
        prerequisites: (prereqRows || []).map((p: any) => ({
          id: p.id,
          courseId: p.course_id,
          requiredCourseId: p.required_course_id,
          type: p.type as any,
          requiredCourseName: p.required_course_name || "نامشخص",
          requiredCourseCode: p.required_course_code || "---",
        })),
        dependentCourses: (depRows || []).map((d: any) => ({
          id: d.id,
          courseId: d.course_id,
          courseName: d.course_name || "نامشخص",
          courseCode: d.course_code || "---",
          type: d.type as any,
        })),
        offerings: (offeringRows || []).map((o: any) => ({
          id: o.id,
          courseId: o.course_id,
          professorId: o.professor_id,
          professorName: o.professor_name || "نامشخص",
          professorTitle: o.professor_title || undefined,
          createdAt: o.created_at,
          deletedAt: null,
        })),
        trackAssignments: (assignRows || []).map((a: any) => ({
          id: a.id,
          trackId: a.track_id,
          courseId: a.course_id,
          visualCategoryId: a.visual_category_id || null,
          ruleCategoryId: a.rule_category_id || null,
        })),
      };
    } catch (err) {
      console.error("D1 getCourseById error:", err);
    }
  }

  await initFallbackDevData();
  const course = coursesStore.find((c) => c.id === id && !c.deletedAt);
  if (!course) return null;

  const fac = facultiesStore.find((f) => f.id === course.facultyId);

  const prereqs = prerequisitesStore
    .filter((p) => p.courseId === course.id)
    .map((p) => {
      const target = coursesStore.find((c) => c.id === p.requiredCourseId);
      return {
        ...p,
        requiredCourseName: target?.name || "نامشخص",
        requiredCourseCode: target?.code || "---",
      };
    });

  const deps = prerequisitesStore
    .filter((p) => p.requiredCourseId === course.id)
    .map((p) => {
      const target = coursesStore.find((c) => c.id === p.courseId);
      return {
        id: p.id,
        courseId: p.courseId,
        courseName: target?.name || "نامشخص",
        courseCode: target?.code || "---",
        type: p.type,
      };
    });

  const offs = offeringsStore
    .filter((o) => o.courseId === course.id && !o.deletedAt)
    .map((o) => {
      const prof = professorsStore.find((p) => p.id === o.professorId);
      return {
        ...o,
        professorName: prof?.name || "نامشخص",
        professorTitle: prof?.title || undefined,
      };
    });

  return {
    ...course,
    facultyName: fac?.name || undefined,
    prerequisites: prereqs,
    dependentCourses: deps,
    offerings: offs,
    trackAssignments: trackAssignmentsStore.filter((a) => a.courseId === course.id),
  };
}

export async function createCourse(data: {
  facultyId: string;
  name: string;
  code: string;
  units: number;
  offeredIn?: "fall" | "spring" | "both";
  description?: string;
  trackId?: string;
  visualCategoryId?: string;
  ruleCategoryId?: string;
}): Promise<Course> {
  const id = `crs_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const cleanCode = data.code.trim().toUpperCase();
  const units = Number(data.units) || 3;
  const offeredIn = data.offeredIn || "both";

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO courses (id, faculty_id, name, code, units, offered_in, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, data.facultyId, data.name.trim(), cleanCode, units, offeredIn, data.description || "", now)
        .run();

      if (data.trackId) {
        await assignCourseToCategories(data.trackId, id, data.visualCategoryId, data.ruleCategoryId);
      }
    } catch (err) {
      console.error("D1 createCourse error:", err);
      throw err;
    }
  }

  const newCourse: Course = {
    id,
    facultyId: data.facultyId,
    name: data.name.trim(),
    code: cleanCode,
    units,
    offeredIn,
    description: data.description || "",
    createdAt: now,
    deletedAt: null,
  };
  coursesStore.push(newCourse);
  return newCourse;
}

export async function updateCourse(
  id: string,
  data: Partial<Pick<Course, "name" | "code" | "units" | "offeredIn" | "description" | "facultyId">> & {
    trackId?: string;
    visualCategoryId?: string;
    ruleCategoryId?: string;
  }
): Promise<Course | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const existing = await getCourseById(id);
      if (!existing) return null;

      const name = data.name !== undefined ? data.name.trim() : existing.name;
      const code = data.code !== undefined ? data.code.trim().toUpperCase() : existing.code;
      const units = data.units !== undefined ? Number(data.units) : existing.units;
      const offeredIn = data.offeredIn !== undefined ? data.offeredIn : existing.offeredIn;
      const description = data.description !== undefined ? data.description : (existing.description || "");
      const facultyId = data.facultyId !== undefined ? data.facultyId : existing.facultyId;

      await d1
        .prepare(
          `UPDATE courses
           SET name = ?, code = ?, units = ?, offered_in = ?, description = ?, faculty_id = ?
           WHERE id = ?`
        )
        .bind(name, code, units, offeredIn, description, facultyId, id)
        .run();

      if (data.trackId) {
        await assignCourseToCategories(data.trackId, id, data.visualCategoryId, data.ruleCategoryId);
      }

      return await getCourseById(id);
    } catch (err) {
      console.error("D1 updateCourse error:", err);
    }
  }

  await initFallbackDevData();
  const course = coursesStore.find((c) => c.id === id && !c.deletedAt);
  if (!course) return null;

  if (data.name) course.name = data.name.trim();
  if (data.code) course.code = data.code.trim().toUpperCase();
  if (data.units !== undefined) course.units = Number(data.units);
  if (data.offeredIn) course.offeredIn = data.offeredIn;
  if (data.description !== undefined) course.description = data.description;
  if (data.facultyId) course.facultyId = data.facultyId;

  if (data.trackId) {
    await assignCourseToCategories(data.trackId, id, data.visualCategoryId, data.ruleCategoryId);
  }

  return course;
}

export async function deleteCourse(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE courses SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteCourse error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const c = coursesStore.find((item) => item.id === id);
  if (!c) return false;
  c.deletedAt = now;
  return true;
}

// ----------------------------------------------------
// 9. PREREQUISITES MANAGEMENT
// ----------------------------------------------------
export async function getPrerequisites(courseId?: string): Promise<PrerequisiteRelation[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = `
        SELECT p.id, p.course_id, p.required_course_id, p.type,
               c.name AS required_course_name, c.code AS required_course_code
        FROM prerequisites p
        LEFT JOIN courses c ON p.required_course_id = c.id
      `;
      const params: any[] = [];
      if (courseId) {
        query += " WHERE p.course_id = ?";
        params.push(courseId);
      }
      const { results } = await d1.prepare(query).bind(...params).all();
      return (results || []).map((p: any) => ({
        id: p.id,
        courseId: p.course_id,
        requiredCourseId: p.required_course_id,
        type: p.type as any,
        requiredCourseName: p.required_course_name || "نامشخص",
        requiredCourseCode: p.required_course_code || "---",
      }));
    } catch (err) {
      console.error("D1 getPrerequisites error:", err);
    }
  }

  await initFallbackDevData();
  return prerequisitesStore.filter((p) => !courseId || p.courseId === courseId);
}

export async function getAllPrerequisites(): Promise<{ courseId: string; requiredCourseId: string; type: string }[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1.prepare("SELECT course_id, required_course_id, type FROM prerequisites").all();
      return (results || []).map((r: any) => ({
        courseId: r.course_id,
        requiredCourseId: r.required_course_id,
        type: r.type,
      }));
    } catch (err) {
      console.error("D1 getAllPrerequisites error:", err);
    }
  }

  await initFallbackDevData();
  return prerequisitesStore.map((p) => ({
    courseId: p.courseId,
    requiredCourseId: p.requiredCourseId,
    type: p.type,
  }));
}

export async function addPrerequisite(
  courseId: string,
  requiredCourseId: string,
  type: "prerequisite" | "corequisite" = "prerequisite"
): Promise<PrerequisiteRelation> {
  const id = `pr_${crypto.randomUUID().slice(0, 8)}`;
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO prerequisites (id, course_id, required_course_id, type)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(course_id, required_course_id, type) DO NOTHING`
        )
        .bind(id, courseId, requiredCourseId, type)
        .run();
    } catch (err) {
      console.error("D1 addPrerequisite error:", err);
    }
  }

  const existing = prerequisitesStore.find(
    (p) => p.courseId === courseId && p.requiredCourseId === requiredCourseId
  );
  if (existing) {
    existing.type = type;
    return existing;
  }

  const newPrereq: PrerequisiteRelation = {
    id,
    courseId,
    requiredCourseId,
    type,
  };
  prerequisitesStore.push(newPrereq);
  return newPrereq;
}

export async function removePrerequisite(id: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM prerequisites WHERE id = ?").bind(id).run();
      return true;
    } catch (err) {
      console.error("D1 removePrerequisite error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const idx = prerequisitesStore.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  prerequisitesStore.splice(idx, 1);
  return true;
}

// ----------------------------------------------------
// 10. PROFESSORS CRUD
// ----------------------------------------------------
export async function getProfessors(facultyId?: string): Promise<Professor[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM professors WHERE deleted_at IS NULL";
      const params: any[] = [];
      if (facultyId) {
        query += " AND faculty_id = ?";
        params.push(facultyId);
      }
      query += " ORDER BY name ASC";
      const { results } = await d1.prepare(query).bind(...params).all();
      return (results || []).map((p: any) => {
        let links: any = undefined;
        if (p.links) {
          try {
            links = typeof p.links === "string" ? JSON.parse(p.links) : p.links;
          } catch {
            links = undefined;
          }
        }
        return {
          id: p.id,
          facultyId: p.faculty_id,
          code: p.code || undefined,
          firstName: p.first_name || undefined,
          lastName: p.last_name || undefined,
          name: p.name,
          avatarUrl: p.avatar_url || "",
          title: p.title || "استاد تمام",
          email: p.email || "",
          links,
          createdAt: p.created_at,
          deletedAt: p.deleted_at || null,
        };
      });
    } catch (err) {
      console.error("D1 getProfessors error:", err);
    }
  }

  await initFallbackDevData();
  return professorsStore.filter((p) => !p.deletedAt && (!facultyId || p.facultyId === facultyId));
}

export async function getProfessorById(id: string): Promise<Professor | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const p = await d1
        .prepare(
          `SELECT p.*, f.name AS faculty_name
           FROM professors p
           LEFT JOIN faculties f ON p.faculty_id = f.id
           WHERE p.id = ? AND p.deleted_at IS NULL`
        )
        .bind(id)
        .first();
      if (!p) return null;

      let links: any = undefined;
      if ((p as any).links) {
        try {
          links = typeof (p as any).links === "string" ? JSON.parse((p as any).links) : (p as any).links;
        } catch {}
      }

      // Offerings taught by this professor
      const { results: offRows } = await d1
        .prepare(
          `SELECT o.id, o.course_id, o.professor_id, o.created_at,
                  c.name AS course_name, c.code AS course_code, c.units AS course_units
           FROM course_offerings o
           JOIN courses c ON o.course_id = c.id
           WHERE o.professor_id = ? AND o.deleted_at IS NULL`
        )
        .bind(id)
        .all();

      // Review stats
      const { results: revRows } = await d1
        .prepare("SELECT overall_rating FROM reviews WHERE target_type = 'professor' AND target_id = ? AND deleted_at IS NULL")
        .bind(id)
        .all();

      const revCount = revRows?.length || 0;
      const avg =
        revCount > 0
          ? (revRows || []).reduce((sum: number, r: any) => sum + Number(r.overall_rating), 0) / revCount
          : 10;

      return {
        id: (p as any).id,
        facultyId: (p as any).faculty_id,
        code: (p as any).code || undefined,
        facultyName: (p as any).faculty_name || "دانشکده مهندسی برق و کامپیوتر",
        firstName: (p as any).first_name || undefined,
        lastName: (p as any).last_name || undefined,
        name: (p as any).name,
        avatarUrl: (p as any).avatar_url || "",
        title: (p as any).title || "استاد تمام",
        email: (p as any).email || "",
        links,
        offerings: (offRows || []).map((o: any) => ({
          id: o.id,
          courseId: o.course_id,
          professorId: o.professor_id,
          courseName: o.course_name,
          courseCode: o.course_code,
          courseUnits: Number(o.course_units) || 3,
          createdAt: o.created_at,
          deletedAt: null,
        })),
        reviewsCount: revCount,
        averageRating: Number(avg.toFixed(1)),
        createdAt: (p as any).created_at,
        deletedAt: (p as any).deleted_at || null,
      };
    } catch (err) {
      console.error("D1 getProfessorById error:", err);
    }
  }

  await initFallbackDevData();
  const p = professorsStore.find((item) => item.id === id && !item.deletedAt);
  if (!p) return null;

  const fac = facultiesStore.find((f) => f.id === p.facultyId);
  const offs = offeringsStore
    .filter((o) => o.professorId === id && !o.deletedAt)
    .map((o) => {
      const c = coursesStore.find((crs) => crs.id === o.courseId);
      return {
        ...o,
        courseName: c?.name,
        courseCode: c?.code,
        courseUnits: c?.units,
      };
    });

  const revs = reviewsStore.filter((r) => r.targetType === "professor" && r.targetId === id && !r.deletedAt);
  const avg = revs.length > 0 ? revs.reduce((sum, r) => sum + r.overallRating, 0) / revs.length : 10;

  return {
    ...p,
    facultyName: fac?.name || "دانشکده مهندسی برق و کامپیوتر",
    offerings: offs,
    reviewsCount: revs.length,
    averageRating: Number(avg.toFixed(1)),
  };
}

export async function createProfessor(data: {
  facultyId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  email?: string;
  avatarUrl?: string;
  links?: Professor["links"];
}): Promise<Professor> {
  const id = `prf_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const firstName = data.firstName?.trim() || "";
  const lastName = data.lastName?.trim() || "";
  const fullName = data.name?.trim() || [firstName, lastName].filter(Boolean).join(" ") || "استاد";
  const linksJson = data.links ? JSON.stringify(data.links) : null;

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO professors (id, faculty_id, first_name, last_name, name, title, email, avatar_url, links, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          data.facultyId,
          firstName || null,
          lastName || null,
          fullName,
          data.title || "استاد تمام",
          data.email || "",
          data.avatarUrl || "",
          linksJson,
          now
        )
        .run();
    } catch (err) {
      console.error("D1 createProfessor error:", err);
      throw err;
    }
  }

  const newProf: Professor = {
    id,
    facultyId: data.facultyId,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    name: fullName,
    title: data.title || "استاد تمام",
    email: data.email || "",
    avatarUrl: data.avatarUrl || "",
    links: data.links,
    createdAt: now,
    deletedAt: null,
  };
  professorsStore.push(newProf);
  return newProf;
}

export async function updateProfessor(
  id: string,
  data: Partial<Pick<Professor, "firstName" | "lastName" | "name" | "title" | "email" | "avatarUrl" | "facultyId" | "links">>
): Promise<Professor | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const existing = await getProfessorById(id);
      if (!existing) return null;

      const firstName = data.firstName !== undefined ? data.firstName.trim() : (existing.firstName || "");
      const lastName = data.lastName !== undefined ? data.lastName.trim() : (existing.lastName || "");
      let name = data.name !== undefined ? data.name.trim() : existing.name;
      if (data.name === undefined && (data.firstName !== undefined || data.lastName !== undefined)) {
        name = [firstName, lastName].filter(Boolean).join(" ") || name;
      }
      const title = data.title !== undefined ? data.title : existing.title;
      const email = data.email !== undefined ? data.email : existing.email;
      const avatarUrl = data.avatarUrl !== undefined ? data.avatarUrl : existing.avatarUrl;
      const facultyId = data.facultyId !== undefined ? data.facultyId : existing.facultyId;
      const links = data.links !== undefined ? data.links : existing.links;
      const linksJson = links ? JSON.stringify(links) : null;

      await d1
        .prepare(
          `UPDATE professors
           SET first_name = ?, last_name = ?, name = ?, title = ?, email = ?, avatar_url = ?, faculty_id = ?, links = ?
           WHERE id = ?`
        )
        .bind(
          firstName || null,
          lastName || null,
          name,
          title || "استاد تمام",
          email || "",
          avatarUrl || "",
          facultyId,
          linksJson,
          id
        )
        .run();

      return await getProfessorById(id);
    } catch (err) {
      console.error("D1 updateProfessor error:", err);
    }
  }

  await initFallbackDevData();
  const p = professorsStore.find((item) => item.id === id && !item.deletedAt);
  if (!p) return null;

  if (data.firstName !== undefined) p.firstName = data.firstName.trim();
  if (data.lastName !== undefined) p.lastName = data.lastName.trim();

  if (data.name !== undefined) {
    p.name = data.name.trim();
  } else if (data.firstName !== undefined || data.lastName !== undefined) {
    const f = p.firstName || "";
    const l = p.lastName || "";
    p.name = [f, l].filter(Boolean).join(" ") || p.name;
  }

  if (data.title !== undefined) p.title = data.title;
  if (data.email !== undefined) p.email = data.email;
  if (data.avatarUrl !== undefined) p.avatarUrl = data.avatarUrl;
  if (data.facultyId) p.facultyId = data.facultyId;
  if (data.links !== undefined) p.links = data.links;
  return p;
}

export async function deleteProfessor(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE professors SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteProfessor error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const p = professorsStore.find((item) => item.id === id);
  if (!p) return false;
  p.deletedAt = now;
  return true;
}

// ----------------------------------------------------
// 11. COURSE OFFERINGS CRUD (Course + Professor)
// ----------------------------------------------------
export async function getOfferings(filter?: {
  courseId?: string;
  professorId?: string;
  facultyId?: string;
}): Promise<CourseOffering[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = `
        SELECT o.id, o.code, o.course_id, o.professor_id, o.created_at, o.deleted_at,
               c.name AS course_name, c.code AS course_code, c.units AS course_units, c.faculty_id AS course_faculty_id,
               p.name AS professor_name, p.title AS professor_title, p.avatar_url AS professor_avatar_url
        FROM course_offerings o
        JOIN courses c ON o.course_id = c.id
        JOIN professors p ON o.professor_id = p.id
        WHERE o.deleted_at IS NULL
      `;
      const params: any[] = [];
      if (filter?.courseId) {
        query += " AND o.course_id = ?";
        params.push(filter.courseId);
      }
      if (filter?.professorId) {
        query += " AND o.professor_id = ?";
        params.push(filter.professorId);
      }
      if (filter?.facultyId) {
        query += " AND c.faculty_id = ?";
        params.push(filter.facultyId);
      }
      query += " ORDER BY c.name ASC";

      const { results } = await d1.prepare(query).bind(...params).all();
      return (results || []).map((r: any) => ({
        id: r.id,
        code: r.code || undefined,
        courseId: r.course_id,
        professorId: r.professor_id,
        createdAt: r.created_at,
        deletedAt: r.deleted_at || null,
        courseName: r.course_name,
        courseCode: r.course_code,
        courseUnits: Number(r.course_units) || 3,
        professorName: r.professor_name,
        professorTitle: r.professor_title,
        professorAvatarUrl: r.professor_avatar_url,
      }));
    } catch (err) {
      console.error("D1 getOfferings error:", err);
    }
  }

  await initFallbackDevData();
  let list = offeringsStore.filter((o) => !o.deletedAt);
  if (filter?.courseId) list = list.filter((o) => o.courseId === filter.courseId);
  if (filter?.professorId) list = list.filter((o) => o.professorId === filter.professorId);
  return list;
}

export async function getOfferingById(id: string): Promise<CourseOffering | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const query = `
        SELECT o.id, o.code, o.course_id, o.professor_id, o.created_at, o.deleted_at,
               c.name AS course_name, c.code AS course_code, c.units AS course_units, c.description AS course_description, c.faculty_id AS course_faculty_id,
               f.name AS faculty_name,
               p.name AS professor_name, p.title AS professor_title, p.avatar_url AS professor_avatar_url, p.email AS professor_email
        FROM course_offerings o
        JOIN courses c ON o.course_id = c.id
        LEFT JOIN faculties f ON c.faculty_id = f.id
        JOIN professors p ON o.professor_id = p.id
        WHERE o.id = ? AND o.deleted_at IS NULL
      `;
      const row = await d1.prepare(query).bind(id).first();
      if (!row) return null;

      const events = await getEvents({ offeringId: id });

      // Review stats
      const { results: reviewRows } = await d1
        .prepare("SELECT overall_rating FROM reviews WHERE target_type = 'offering' AND target_id = ? AND deleted_at IS NULL")
        .bind(id)
        .all();

      const revCount = reviewRows?.length || 0;
      const avgRating =
        revCount > 0
          ? (reviewRows || []).reduce((sum: number, r: any) => sum + Number(r.overall_rating), 0) / revCount
          : 0;

      return {
        id: (row as any).id,
        code: (row as any).code || undefined,
        courseId: (row as any).course_id,
        professorId: (row as any).professor_id,
        createdAt: (row as any).created_at,
        deletedAt: (row as any).deleted_at || null,
        courseName: (row as any).course_name,
        courseCode: (row as any).course_code,
        courseUnits: Number((row as any).course_units) || 3,
        courseDescription: (row as any).course_description || "",
        facultyId: (row as any).course_faculty_id,
        facultyName: (row as any).faculty_name || "دانشکده مهندسی برق و کامپیوتر",
        professorName: (row as any).professor_name,
        professorTitle: (row as any).professor_title,
        professorAvatarUrl: (row as any).professor_avatar_url,
        professorEmail: (row as any).professor_email,
        events,
        reviewsCount: revCount,
        averageRating: Number(avgRating.toFixed(1)),
      };
    } catch (err) {
      console.error("D1 getOfferingById error:", err);
    }
  }

  await initFallbackDevData();
  const o = offeringsStore.find((item) => item.id === id && !item.deletedAt);
  if (!o) return null;

  const crs = coursesStore.find((c) => c.id === o.courseId);
  const prof = professorsStore.find((p) => p.id === o.professorId);
  const fac = facultiesStore.find((f) => f.id === crs?.facultyId);
  const events = eventsStore.filter((e) => e.offeringId === id && !e.isUserCustom);
  const revs = reviewsStore.filter((r) => r.targetType === "offering" && r.targetId === id && !r.deletedAt);
  const avg = revs.length > 0 ? revs.reduce((sum, r) => sum + r.overallRating, 0) / revs.length : 0;

  return {
    ...o,
    courseName: crs?.name,
    courseCode: crs?.code,
    courseUnits: crs?.units,
    courseDescription: crs?.description,
    facultyId: crs?.facultyId,
    facultyName: fac?.name || "دانشکده مهندسی برق و کامپیوتر",
    professorName: prof?.name,
    professorTitle: prof?.title,
    professorAvatarUrl: prof?.avatarUrl,
    professorEmail: prof?.email,
    events,
    reviewsCount: revs.length,
    averageRating: Number(avg.toFixed(1)),
  };
}

export async function createOffering(
  courseIdOrData: string | { courseId: string; professorId: string; code?: string; id?: string },
  professorIdArg?: string,
  codeArg?: string
): Promise<CourseOffering> {
  const courseId = typeof courseIdOrData === "object" ? courseIdOrData.courseId : courseIdOrData;
  const professorId = typeof courseIdOrData === "object" ? courseIdOrData.professorId : professorIdArg!;
  const code =
    typeof courseIdOrData === "object"
      ? (courseIdOrData.code?.trim().toUpperCase() || `OFF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
      : (codeArg?.trim().toUpperCase() || `OFF-${crypto.randomUUID().slice(0, 6).toUpperCase()}`);
  const id =
    typeof courseIdOrData === "object" && courseIdOrData.id
      ? courseIdOrData.id.trim()
      : `off_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("INSERT INTO course_offerings (id, code, course_id, professor_id, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, code, courseId, professorId, now)
        .run();

      const offs = await getOfferings();
      const created = offs.find((o) => o.id === id);
      return (
        created || {
          id,
          code,
          courseId,
          professorId,
          createdAt: now,
          deletedAt: null,
        }
      );
    } catch (err) {
      console.error("D1 createOffering error:", err);
    }
  }

  await initFallbackDevData();
  const newOffering: CourseOffering = {
    id,
    code,
    courseId,
    professorId,
    createdAt: now,
    deletedAt: null,
  };
  offeringsStore.push(newOffering);
  return newOffering;
}

export async function updateOffering(
  id: string,
  data: { courseId?: string; professorId?: string }
): Promise<CourseOffering | null> {
  const d1 = getD1();
  if (d1) {
    try {
      if (data.courseId && data.professorId) {
        await d1
          .prepare("UPDATE course_offerings SET course_id = ?, professor_id = ? WHERE id = ?")
          .bind(data.courseId, data.professorId, id)
          .run();
      } else if (data.courseId) {
        await d1
          .prepare("UPDATE course_offerings SET course_id = ? WHERE id = ?")
          .bind(data.courseId, id)
          .run();
      } else if (data.professorId) {
        await d1
          .prepare("UPDATE course_offerings SET professor_id = ? WHERE id = ?")
          .bind(data.professorId, id)
          .run();
      }

      const offs = await getOfferings();
      const updated = offs.find((o) => o.id === id);
      return updated || null;
    } catch (err) {
      console.error("D1 updateOffering error:", err);
      return null;
    }
  }

  await initFallbackDevData();
  const o = offeringsStore.find((item) => item.id === id);
  if (!o) return null;
  if (data.courseId) o.courseId = data.courseId;
  if (data.professorId) o.professorId = data.professorId;
  return o;
}

export async function deleteOffering(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE course_offerings SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteOffering error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const o = offeringsStore.find((item) => item.id === id);
  if (!o) return false;
  o.deletedAt = now;
  return true;
}

// ----------------------------------------------------
// 12. COURSE EVENTS & SLOTS (Weekly schedule & exam dates)
// ----------------------------------------------------
export async function getEvents(
  filterOrTerm?: string | {
    offeringId?: string;
    term?: string;
    facultyId?: string;
    courseId?: string;
    userId?: string;
    customOnly?: boolean;
  }
): Promise<CourseEvent[]> {
  const term = typeof filterOrTerm === "string" ? filterOrTerm : filterOrTerm?.term;
  const offeringId = typeof filterOrTerm === "object" ? filterOrTerm?.offeringId : undefined;
  const facultyId = typeof filterOrTerm === "object" ? filterOrTerm?.facultyId : undefined;
  const courseId = typeof filterOrTerm === "object" ? filterOrTerm?.courseId : undefined;
  const userId = typeof filterOrTerm === "object" ? filterOrTerm?.userId : undefined;
  const customOnly = typeof filterOrTerm === "object" ? Boolean(filterOrTerm?.customOnly) : false;

  const d1 = getD1();
  if (d1) {
    try {
      let query = `
        SELECT e.id, e.offering_id, e.term, e.location, e.exam_date, e.exam_start_time, e.exam_end_time,
               e.is_user_custom, e.user_id, e.global_event_id, e.created_at,
               c.id AS course_id, c.name AS course_name, c.code AS course_code, c.units AS course_units,
               p.id AS professor_id, p.name AS professor_name, p.title AS professor_title, p.avatar_url AS professor_avatar_url
        FROM course_events e
        JOIN course_offerings o ON e.offering_id = o.id
        JOIN courses c ON o.course_id = c.id
        JOIN professors p ON o.professor_id = p.id
        WHERE o.deleted_at IS NULL
      `;
      const params: any[] = [];
      if (term) {
        query += " AND e.term = ?";
        params.push(term);
      }
      if (offeringId) {
        query += " AND e.offering_id = ?";
        params.push(offeringId);
      }
      if (courseId) {
        query += " AND o.course_id = ?";
        params.push(courseId);
      }
      if (facultyId) {
        query += " AND c.faculty_id = ?";
        params.push(facultyId);
      }

      if (customOnly) {
        query += " AND e.is_user_custom = 1";
      } else if (userId) {
        query += " AND (e.is_user_custom = 0 OR e.user_id = ?)";
        params.push(userId);
      } else {
        query += " AND e.is_user_custom = 0";
      }

      const { results: eventRows } = await d1.prepare(query).bind(...params).all();
      const eventsList = eventRows || [];

      // Fetch event slots
      const { results: slotRows } = await d1.prepare("SELECT * FROM course_event_slots").all();
      const slotsList = slotRows || [];

      return eventsList.map((e: any) => {
        const slots = slotsList
          .filter((s: any) => s.event_id === e.id)
          .map((s: any) => ({
            id: s.id,
            eventId: s.event_id,
            dayOfWeek: Number(s.day_of_week),
            startTime: s.start_time,
            endTime: s.end_time,
          }));

        return {
          id: e.id,
          offeringId: e.offering_id,
          term: e.term,
          location: e.location || "",
          examDate: e.exam_date || "",
          examStartTime: e.exam_start_time || "",
          examEndTime: e.exam_end_time || "",
          isUserCustom: Boolean(e.is_user_custom),
          userId: e.user_id || null,
          globalEventId: e.global_event_id || null,
          createdAt: e.created_at,
          courseId: e.course_id,
          courseName: e.course_name,
          courseCode: e.course_code,
          courseUnits: Number(e.course_units) || 3,
          professorId: e.professor_id,
          professorName: e.professor_name,
          professorTitle: e.professor_title,
          professorAvatarUrl: e.professor_avatar_url,
          slots,
        };
      });
    } catch (err) {
      console.error("D1 getEvents error:", err);
    }
  }

  await initFallbackDevData();
  let list = eventsStore;
  if (term) list = list.filter((e) => e.term === term);
  if (offeringId) list = list.filter((e) => e.offeringId === offeringId);
  return list;
}

export async function createEvent(data: {
  offeringId: string;
  term: string;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  isUserCustom?: boolean;
  userId?: string | null;
  slots: { dayOfWeek: number; startTime: string; endTime: string }[];
}): Promise<CourseEvent> {
  const eventId = `evt_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO course_events (id, offering_id, term, location, exam_date, exam_start_time, exam_end_time, is_user_custom, user_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          eventId,
          data.offeringId,
          data.term,
          data.location || "",
          data.examDate || "",
          data.examStartTime || "",
          data.examEndTime || "",
          data.isUserCustom ? 1 : 0,
          data.userId || null,
          now
        )
        .run();

      for (const slot of data.slots || []) {
        const slotId = `slot_${crypto.randomUUID().slice(0, 8)}`;
        await d1
          .prepare("INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
          .bind(slotId, eventId, slot.dayOfWeek, slot.startTime, slot.endTime)
          .run();
      }

      const evts = await getEvents({ offeringId: data.offeringId, userId: data.userId || undefined });
      const full = evts.find((e) => e.id === eventId);
      if (full) return full;
    } catch (err) {
      console.error("D1 createEvent error:", err);
      throw err;
    }
  }

  const createdSlots: CourseEventSlot[] = (data.slots || []).map((s) => ({
    id: `slot_${crypto.randomUUID().slice(0, 8)}`,
    eventId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  const newEvent: CourseEvent = {
    id: eventId,
    offeringId: data.offeringId,
    term: data.term,
    location: data.location || "",
    examDate: data.examDate || "",
    examStartTime: data.examStartTime || "",
    examEndTime: data.examEndTime || "",
    isUserCustom: Boolean(data.isUserCustom),
    userId: data.userId || null,
    createdAt: now,
    slots: createdSlots,
  };
  eventsStore.push(newEvent);
  return newEvent;
}

export async function createCustomUserEvent(data: {
  userId: string;
  offeringId: string;
  term: string;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  slots: { dayOfWeek: number; startTime: string; endTime: string }[];
}): Promise<CourseEvent> {
  const created = await createEvent({
    offeringId: data.offeringId,
    term: data.term,
    location: data.location || "",
    examDate: data.examDate || "",
    examStartTime: data.examStartTime || "",
    examEndTime: data.examEndTime || "",
    isUserCustom: true,
    userId: data.userId,
    slots: data.slots,
  });

  const evts = await getEvents({ offeringId: data.offeringId, userId: data.userId });
  const fullEvt = evts.find((e) => e.id === created.id);
  return fullEvt || created;
}

export async function promoteCustomEventToGlobal(eventId: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE course_events SET is_user_custom = 0, user_id = NULL WHERE id = ?")
        .bind(eventId)
        .run();
      return true;
    } catch (err) {
      console.error("D1 promoteCustomEventToGlobal error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const evt = eventsStore.find((e) => e.id === eventId);
  if (!evt) return false;
  evt.isUserCustom = false;
  evt.userId = null;
  return true;
}

export async function updateEvent(
  id: string,
  data: Partial<CourseEvent> & { slots?: { dayOfWeek: number; startTime: string; endTime: string }[] }
): Promise<CourseEvent | null> {
  const d1 = getD1();
  if (d1) {
    try {
      if (
        data.offeringId !== undefined ||
        data.location !== undefined ||
        data.examDate !== undefined ||
        data.examStartTime !== undefined ||
        data.examEndTime !== undefined
      ) {
        await d1
          .prepare(
            `UPDATE course_events
             SET offering_id = COALESCE(?, offering_id),
                 location = COALESCE(?, location),
                 exam_date = COALESCE(?, exam_date),
                 exam_start_time = COALESCE(?, exam_start_time),
                 exam_end_time = COALESCE(?, exam_end_time)
             WHERE id = ?`
          )
          .bind(
            data.offeringId || null,
            data.location !== undefined ? data.location : null,
            data.examDate !== undefined ? data.examDate : null,
            data.examStartTime !== undefined ? data.examStartTime : null,
            data.examEndTime !== undefined ? data.examEndTime : null,
            id
          )
          .run();
      }

      if (data.slots) {
        await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(id).run();
        for (const slot of data.slots) {
          const slotId = `slot_${crypto.randomUUID().slice(0, 8)}`;
          await d1
            .prepare("INSERT INTO course_event_slots (id, event_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)")
            .bind(slotId, id, slot.dayOfWeek, slot.startTime, slot.endTime)
            .run();
        }
      }

      const evts = await getEvents({ eventId: id });
      if (evts.length > 0) return evts[0];
    } catch (err) {
      console.error("D1 updateEvent error:", err);
    }
  }

  await initFallbackDevData();
  const evt = eventsStore.find((item) => item.id === id);
  if (!evt) return null;
  if (data.offeringId !== undefined) evt.offeringId = data.offeringId;
  if (data.location !== undefined) evt.location = data.location;
  if (data.examDate !== undefined) evt.examDate = data.examDate;
  if (data.examStartTime !== undefined) evt.examStartTime = data.examStartTime;
  if (data.examEndTime !== undefined) evt.examEndTime = data.examEndTime;
  if (data.slots) {
    evt.slots = data.slots.map((s) => ({
      id: `slot_${crypto.randomUUID().slice(0, 8)}`,
      eventId: id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }
  return evt;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(id).run();
      await d1.prepare("DELETE FROM course_events WHERE id = ?").bind(id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteEvent error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const idx = eventsStore.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  eventsStore.splice(idx, 1);
  return true;
}

// ----------------------------------------------------
// 13. CHARTS & SEMESTERS (Student Plans & Approved Templates)
// ----------------------------------------------------
export async function getCharts(userId?: string, trackId?: string): Promise<StudentChart[]> {
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM charts WHERE 1=1";
      const params: any[] = [];
      if (userId) {
        query += " AND (user_id = ? OR is_approved_template = 1)";
        params.push(userId);
      }
      if (trackId) {
        query += " AND track_id = ?";
        params.push(trackId);
      }
      query += " ORDER BY created_at DESC";

      const { results: chartRows } = await d1.prepare(query).bind(...params).all();
      const chartsList = chartRows || [];

      // Fetch all terms and courses for these charts
      const { results: termRows } = await d1.prepare("SELECT * FROM chart_terms ORDER BY term_index ASC").all();
      const { results: courseRows } = await d1.prepare("SELECT * FROM chart_courses ORDER BY sort_order ASC").all();

      const termsList = termRows || [];
      const chartCoursesList = courseRows || [];

      return chartsList.map((c: any) => {
        const terms = termsList.filter((t: any) => t.chart_id === c.id);
        const semesters: ChartSemester[] = terms.map((t: any) => {
          const courseEventsMap: Record<string, string> = {};
          const coursesInTerm = chartCoursesList
            .filter((cc: any) => cc.term_id === t.id)
            .map((cc: any) => {
              if (cc.selected_event_id) {
                courseEventsMap[cc.course_id] = cc.selected_event_id;
              }
              return cc.course_id;
            });

          return {
            semesterNumber: Number(t.term_index) || 1,
            courseIds: coursesInTerm,
            courseEventsMap,
          };
        });

        return {
          id: c.id,
          userId: c.user_id,
          trackId: c.track_id,
          title: c.title,
          isApprovedDefault: Boolean(c.is_approved_template),
          semesters,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
      });
    } catch (err) {
      console.error("D1 getCharts error:", err);
    }
  }

  await initFallbackDevData();
  let list = chartsStore;
  if (userId) list = list.filter((c) => c.userId === userId || c.isApprovedDefault);
  if (trackId) list = list.filter((c) => c.trackId === trackId);
  return list;
}

export async function getApprovedTrackCharts(trackId?: string): Promise<StudentChart[]> {
  const charts = await getCharts(undefined, trackId);
  return charts.filter((c) => c.isApprovedDefault);
}

export async function getApprovedTrackChart(trackId: string): Promise<StudentChart | null> {
  const approved = await getApprovedTrackCharts(trackId);
  return approved[0] || null;
}

export async function setPrimaryApprovedChart(chartId: string, trackId?: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      if (trackId) {
        await d1.prepare("UPDATE charts SET is_approved_template = 0 WHERE track_id = ?").bind(trackId).run();
      }
      await d1.prepare("UPDATE charts SET is_approved_template = 1 WHERE id = ?").bind(chartId).run();
      return true;
    } catch (err) {
      console.error("D1 setPrimaryApprovedChart error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  chartsStore.forEach((c) => {
    if (!trackId || c.trackId === trackId) {
      c.isApprovedDefault = c.id === chartId;
    }
  });
  return true;
}

export async function cloneChart(chartId: string, newUserId: string, title?: string): Promise<StudentChart | null> {
  const source = await getChartById(chartId);
  if (!source) return null;

  return await createChart({
    userId: newUserId,
    trackId: source.trackId,
    title: title || `${source.title} (کپی)`,
    isApprovedDefault: false,
    semesters: source.semesters,
  });
}

export async function getChartById(id: string): Promise<StudentChart | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const c = await d1.prepare("SELECT * FROM charts WHERE id = ?").bind(id).first();
      if (!c) return null;

      const { results: termRows } = await d1
        .prepare("SELECT * FROM chart_terms WHERE chart_id = ? ORDER BY term_index ASC")
        .bind(id)
        .all();

      const { results: courseRows } = await d1
        .prepare(
          `SELECT cc.* FROM chart_courses cc
           JOIN chart_terms ct ON cc.term_id = ct.id
           WHERE ct.chart_id = ?
           ORDER BY cc.sort_order ASC`
        )
        .bind(id)
        .all();

      const terms = termRows || [];
      const courses = courseRows || [];

      const semesters: ChartSemester[] = terms.map((t: any) => {
        const courseEventsMap: Record<string, string> = {};
        const courseIds = courses
          .filter((cc: any) => cc.term_id === t.id)
          .map((cc: any) => {
            if (cc.selected_event_id) {
              courseEventsMap[cc.course_id] = cc.selected_event_id;
            }
            return cc.course_id;
          });

        return {
          semesterNumber: Number(t.term_index) || 1,
          courseIds,
          courseEventsMap,
        };
      });

      return {
        id: (c as any).id,
        userId: (c as any).user_id,
        trackId: (c as any).track_id,
        title: (c as any).title,
        isApprovedDefault: Boolean((c as any).is_approved_template),
        semesters,
        createdAt: (c as any).created_at,
        updatedAt: (c as any).updated_at,
      };
    } catch (err) {
      console.error("D1 getChartById error:", err);
    }
  }

  await initFallbackDevData();
  return chartsStore.find((c) => c.id === id) || null;
}

export async function createChart(data: {
  userId: string;
  trackId: string;
  title: string;
  isApprovedDefault?: boolean;
  semesters?: ChartSemester[];
}): Promise<StudentChart> {
  const chartId = `ch_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const isApproved = data.isApprovedDefault ? 1 : 0;

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO charts (id, user_id, track_id, title, is_approved_template, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(chartId, data.userId, data.trackId, data.title, isApproved, now, now)
        .run();

      const semesters = data.semesters || [];
      for (const s of semesters) {
        const termId = `term_${chartId}_${s.semesterNumber}`;
        await d1
          .prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)")
          .bind(termId, chartId, s.semesterNumber)
          .run();

        let order = 0;
        for (const courseId of s.courseIds || []) {
          const ccId = `cc_${crypto.randomUUID().slice(0, 8)}`;
          const selectedEventId = s.courseEventsMap?.[courseId] || null;
          await d1
            .prepare(
              "INSERT INTO chart_courses (id, term_id, course_id, selected_event_id, sort_order) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(ccId, termId, courseId, selectedEventId, order++)
            .run();
        }
      }
    } catch (err) {
      console.error("D1 createChart error:", err);
      throw err;
    }
  }

  const newChart: StudentChart = {
    id: chartId,
    userId: data.userId,
    trackId: data.trackId,
    title: data.title,
    isApprovedDefault: Boolean(data.isApprovedDefault),
    semesters: data.semesters || [],
    createdAt: now,
    updatedAt: now,
  };
  chartsStore.push(newChart);
  return newChart;
}

export async function updateChart(
  id: string,
  data: Partial<StudentChart>
): Promise<StudentChart | null> {
  const now = new Date().toISOString();
  const d1 = getD1();

  if (d1) {
    try {
      if (data.title !== undefined || data.trackId !== undefined || data.isApprovedDefault !== undefined) {
        await d1
          .prepare(
            `UPDATE charts
             SET title = COALESCE(?, title),
                 track_id = COALESCE(?, track_id),
                 is_approved_template = COALESCE(?, is_approved_template),
                 updated_at = ?
             WHERE id = ?`
          )
          .bind(
            data.title || null,
            data.trackId || null,
            data.isApprovedDefault !== undefined ? (data.isApprovedDefault ? 1 : 0) : null,
            now,
            id
          )
          .run();
      }

      if (data.semesters) {
        // Clear old terms and chart courses
        const { results: existingTerms } = await d1
          .prepare("SELECT id FROM chart_terms WHERE chart_id = ?")
          .bind(id)
          .all();

        for (const t of existingTerms || []) {
          await d1.prepare("DELETE FROM chart_courses WHERE term_id = ?").bind((t as any).id).run();
        }
        await d1.prepare("DELETE FROM chart_terms WHERE chart_id = ?").bind(id).run();

        // Re-insert terms
        for (const s of data.semesters) {
          const termId = `term_${id}_${s.semesterNumber}`;
          await d1
            .prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)")
            .bind(termId, id, s.semesterNumber)
            .run();

          let order = 0;
          for (const courseId of s.courseIds || []) {
            const ccId = `cc_${crypto.randomUUID().slice(0, 8)}`;
            const selectedEventId = s.courseEventsMap?.[courseId] || null;
            await d1
              .prepare(
                "INSERT INTO chart_courses (id, term_id, course_id, selected_event_id, sort_order) VALUES (?, ?, ?, ?, ?)"
              )
              .bind(ccId, termId, courseId, selectedEventId, order++)
              .run();
          }
        }
      }

      return await getChartById(id);
    } catch (err) {
      console.error("D1 updateChart error:", err);
    }
  }

  await initFallbackDevData();
  const ch = chartsStore.find((item) => item.id === id);
  if (!ch) return null;
  if (data.title !== undefined) ch.title = data.title.trim();
  if (data.isApprovedDefault !== undefined) ch.isApprovedDefault = data.isApprovedDefault;
  if (data.semesters !== undefined) ch.semesters = data.semesters;
  ch.updatedAt = now;
  return ch;
}

export async function updateChartCourseEvent(
  chartId: string,
  termIndex: number,
  courseId: string,
  selectedEventId: string | null
): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      const term = await d1
        .prepare("SELECT id FROM chart_terms WHERE chart_id = ? AND term_index = ?")
        .bind(chartId, termIndex)
        .first();

      if (!term) return false;

      await d1
        .prepare("UPDATE chart_courses SET selected_event_id = ? WHERE term_id = ? AND course_id = ?")
        .bind(selectedEventId, (term as any).id, courseId)
        .run();

      await d1.prepare("UPDATE charts SET updated_at = ? WHERE id = ?").bind(new Date().toISOString(), chartId).run();
      return true;
    } catch (err) {
      console.error("D1 updateChartCourseEvent error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const c = chartsStore.find((item) => item.id === chartId);
  if (!c) return false;
  const s = c.semesters.find((sem) => sem.semesterNumber === termIndex);
  if (!s) return false;
  if (!s.courseEventsMap) s.courseEventsMap = {};
  if (selectedEventId) {
    s.courseEventsMap[courseId] = selectedEventId;
  } else {
    delete s.courseEventsMap[courseId];
  }
  return true;
}

export async function deleteChart(id: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id = ?)")
        .bind(id)
        .run();
      await d1.prepare("DELETE FROM chart_terms WHERE chart_id = ?").bind(id).run();
      await d1.prepare("DELETE FROM charts WHERE id = ?").bind(id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteChart error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const idx = chartsStore.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  chartsStore.splice(idx, 1);
  return true;
}

// ----------------------------------------------------
// 14. REVIEWS CRUD
// ----------------------------------------------------
export async function getReviews(targetType: "professor" | "offering", targetId: string): Promise<Review[]> {
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1
        .prepare(
          `SELECT r.*, u.name AS author_name 
           FROM reviews r
           LEFT JOIN users u ON r.user_id = u.id
           WHERE r.target_type = ? AND r.target_id = ? AND r.deleted_at IS NULL
           ORDER BY r.created_at DESC`
        )
        .bind(targetType, targetId)
        .all();

      return (results || []).map((r: any) => {
        let criteriaRatings: any = undefined;
        if (r.criteria_ratings) {
          try {
            criteriaRatings = typeof r.criteria_ratings === "string" ? JSON.parse(r.criteria_ratings) : r.criteria_ratings;
          } catch {}
        }
        return {
          id: r.id,
          userId: r.user_id || null,
          targetType: r.target_type as any,
          targetId: r.target_id,
          isAnonymous: Boolean(r.is_anonymous),
          comment: r.comment,
          authorName: r.is_anonymous ? "دانشجوی دانشگاه تهران" : (r.author_name || "کاربر سامانه"),
          overallRating: Number(r.overall_rating) || 10,
          criteriaRatings,
          studentGrade: r.student_grade !== null && r.student_grade !== undefined ? Number(r.student_grade) : null,
          createdAt: r.created_at,
          deletedAt: r.deleted_at || null,
        };
      });
    } catch (err) {
      console.error("D1 getReviews error:", err);
    }
  }

  await initFallbackDevData();
  return reviewsStore.filter((r) => r.targetType === targetType && r.targetId === targetId && !r.deletedAt);
}

export async function createReview(data: {
  userId?: string | null;
  targetType: "professor" | "offering";
  targetId: string;
  isAnonymous?: boolean;
  comment: string;
  overallRating: number;
  criteriaRatings?: Record<string, number>;
  studentGrade?: number | null;
}): Promise<Review> {
  const id = `rev_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const criteriaJson = data.criteriaRatings ? JSON.stringify(data.criteriaRatings) : null;
  const isAnon = data.isAnonymous ? 1 : 0;
  const grade = data.studentGrade !== undefined && data.studentGrade !== null ? Number(data.studentGrade) : null;

  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `INSERT INTO reviews (id, user_id, target_type, target_id, is_anonymous, comment, overall_rating, criteria_ratings, student_grade, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          data.userId || null,
          data.targetType,
          data.targetId,
          isAnon,
          data.comment.trim(),
          data.overallRating,
          criteriaJson,
          grade,
          now
        )
        .run();
    } catch (err) {
      console.error("D1 createReview error:", err);
      throw err;
    }
  }

  const newRev: Review = {
    id,
    userId: data.userId || null,
    targetType: data.targetType,
    targetId: data.targetId,
    isAnonymous: Boolean(data.isAnonymous),
    comment: data.comment.trim(),
    overallRating: data.overallRating,
    criteriaRatings: data.criteriaRatings,
    studentGrade: grade,
    createdAt: now,
    deletedAt: null,
  };
  reviewsStore.push(newRev);
  return newRev;
}

export async function deleteReview(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("UPDATE reviews SET deleted_at = ? WHERE id = ?").bind(now, id).run();
      return true;
    } catch (err) {
      console.error("D1 deleteReview error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const r = reviewsStore.find((item) => item.id === id);
  if (!r) return false;
  r.deletedAt = now;
  return true;
}

export async function getReviewById(id: string): Promise<Review | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const r = await d1
        .prepare(
          `SELECT r.*, u.name AS author_name 
           FROM reviews r
           LEFT JOIN users u ON r.user_id = u.id
           WHERE r.id = ? AND r.deleted_at IS NULL`
        )
        .bind(id)
        .first();
      if (!r) return null;

      let criteriaRatings: any = undefined;
      if ((r as any).criteria_ratings) {
        try {
          criteriaRatings =
            typeof (r as any).criteria_ratings === "string"
              ? JSON.parse((r as any).criteria_ratings)
              : (r as any).criteria_ratings;
        } catch {}
      }

      return {
        id: (r as any).id,
        userId: (r as any).user_id || null,
        targetType: (r as any).target_type as any,
        targetId: (r as any).target_id,
        isAnonymous: Boolean((r as any).is_anonymous),
        comment: (r as any).comment,
        authorName: (r as any).is_anonymous ? "دانشجوی دانشگاه تهران" : ((r as any).author_name || "کاربر سامانه"),
        overallRating: Number((r as any).overall_rating) || 10,
        criteriaRatings,
        studentGrade: (r as any).student_grade !== null && (r as any).student_grade !== undefined ? Number((r as any).student_grade) : null,
        createdAt: (r as any).created_at,
        deletedAt: (r as any).deleted_at || null,
      };
    } catch (err) {
      console.error("D1 getReviewById error:", err);
    }
  }

  await initFallbackDevData();
  return reviewsStore.find((r) => r.id === id && !r.deletedAt) || null;
}

export async function updateReview(
  id: string,
  data: {
    comment?: string;
    isAnonymous?: boolean;
    criteriaRatings?: Record<string, number>;
    overallRating?: number;
    studentGrade?: number | null;
  }
): Promise<Review | null> {
  const d1 = getD1();
  if (d1) {
    try {
      const existing = await getReviewById(id);
      if (!existing) return null;

      const comment = data.comment !== undefined ? data.comment.trim() : existing.comment;
      const isAnon = data.isAnonymous !== undefined ? (data.isAnonymous ? 1 : 0) : existing.isAnonymous ? 1 : 0;
      const criteriaJson =
        data.criteriaRatings !== undefined
          ? JSON.stringify(data.criteriaRatings)
          : existing.criteriaRatings
          ? JSON.stringify(existing.criteriaRatings)
          : null;
      const overallRating = data.overallRating !== undefined ? data.overallRating : existing.overallRating;
      const grade = data.studentGrade !== undefined ? (data.studentGrade !== null ? Number(data.studentGrade) : null) : existing.studentGrade ?? null;

      await d1
        .prepare(
          `UPDATE reviews 
           SET comment = ?, is_anonymous = ?, criteria_ratings = ?, overall_rating = ?, student_grade = ?
           WHERE id = ?`
        )
        .bind(comment, isAnon, criteriaJson, overallRating, grade, id)
        .run();

      return await getReviewById(id);
    } catch (err) {
      console.error("D1 updateReview error:", err);
    }
  }

  await initFallbackDevData();
  const r = reviewsStore.find((item) => item.id === id && !item.deletedAt);
  if (!r) return null;
  if (data.comment !== undefined) r.comment = data.comment.trim();
  if (data.isAnonymous !== undefined) r.isAnonymous = data.isAnonymous;
  if (data.criteriaRatings !== undefined) r.criteriaRatings = data.criteriaRatings;
  if (data.overallRating !== undefined) r.overallRating = data.overallRating;
  if (data.studentGrade !== undefined) r.studentGrade = data.studentGrade;
  return r;
}

// ----------------------------------------------------
// 15. TRACK STRUCTURE & RULES DEEP CLONER
// ----------------------------------------------------
export async function cloneTrackStructure(
  sourceTrackId: string,
  targetTrackId: string,
  options: {
    cloneVisualCategories?: boolean;
    cloneRuleCategories?: boolean;
    cloneRulesTree?: boolean;
    cloneAssignments?: boolean;
  } = {
    cloneVisualCategories: true,
    cloneRuleCategories: true,
    cloneRulesTree: true,
    cloneAssignments: true,
  }
): Promise<{
  success: boolean;
  message: string;
  stats: {
    visualCategoriesCloned: number;
    ruleCategoriesCloned: number;
    assignmentsCloned: number;
    rulesTreeCloned: boolean;
  };
}> {
  try {
    const stats = {
      visualCategoriesCloned: 0,
      ruleCategoriesCloned: 0,
      assignmentsCloned: 0,
      rulesTreeCloned: false,
    };

    const visualCatMap = new Map<string, string>(); // oldVcatId -> newVcatId
    const ruleCatMap = new Map<string, string>(); // oldRcatId -> newRcatId

    // 1. Clone Visual Categories
    if (options.cloneVisualCategories) {
      const sourceVCats = await getVisualCategories(sourceTrackId);
      for (const vcat of sourceVCats) {
        const newVCat = await createVisualCategory(
          targetTrackId,
          vcat.name,
          vcat.color,
          vcat.sortOrder
        );
        visualCatMap.set(vcat.id, newVCat.id);
        stats.visualCategoriesCloned++;
      }
    }

    // 2. Clone Rule Categories (preserves hierarchy)
    if (options.cloneRuleCategories) {
      const sourceRCats = await getRuleCategories(sourceTrackId);
      
      // Multi-pass creation to ensure parent IDs exist in map
      const remaining = [...sourceRCats];
      let iterations = 0;
      while (remaining.length > 0 && iterations < 20) {
        iterations++;
        const toRemove: number[] = [];

        for (let i = 0; i < remaining.length; i++) {
          const rcat = remaining[i];
          if (!rcat.parentId) {
            // Root category
            const newRCat = await createRuleCategory(
              targetTrackId,
              rcat.name,
              rcat.minCredits,
              null
            );
            ruleCatMap.set(rcat.id, newRCat.id);
            toRemove.push(i);
            stats.ruleCategoriesCloned++;
          } else if (ruleCatMap.has(rcat.parentId)) {
            // Child category whose parent is already created
            const newParentId = ruleCatMap.get(rcat.parentId)!;
            const newRCat = await createRuleCategory(
              targetTrackId,
              rcat.name,
              rcat.minCredits,
              newParentId
            );
            ruleCatMap.set(rcat.id, newRCat.id);
            toRemove.push(i);
            stats.ruleCategoriesCloned++;
          }
        }

        // Remove processed in reverse
        for (let j = toRemove.length - 1; j >= 0; j--) {
          remaining.splice(toRemove[j], 1);
        }
      }

      // Any remaining orphaned categories
      for (const rcat of remaining) {
        const newRCat = await createRuleCategory(
          targetTrackId,
          rcat.name,
          rcat.minCredits,
          null
        );
        ruleCatMap.set(rcat.id, newRCat.id);
        stats.ruleCategoriesCloned++;
      }
    }

    // 3. Clone Rules Tree AST with Deep ID Re-mapping
    if (options.cloneRulesTree) {
      const sourceTrack = await getTrackById(sourceTrackId);
      if (sourceTrack?.rulesTree) {
        const remapNode = (node: any): any => {
          if (!node || typeof node !== "object") return node;

          if (Array.isArray(node)) {
            return node.map(remapNode);
          }

          const cloned = { ...node };

          // Replace Rule Category ID if present
          if (cloned.categoryId && ruleCatMap.has(cloned.categoryId)) {
            cloned.categoryId = ruleCatMap.get(cloned.categoryId);
          }
          if (cloned.ruleCategoryId && ruleCatMap.has(cloned.ruleCategoryId)) {
            cloned.ruleCategoryId = ruleCatMap.get(cloned.ruleCategoryId);
          }

          // Replace Visual Category ID if present
          if (cloned.visualCategoryId && visualCatMap.has(cloned.visualCategoryId)) {
            cloned.visualCategoryId = visualCatMap.get(cloned.visualCategoryId);
          }

          // Recursive children / sub-rules
          if (Array.isArray(cloned.children)) {
            cloned.children = cloned.children.map(remapNode);
          }
          if (Array.isArray(cloned.rules)) {
            cloned.rules = cloned.rules.map(remapNode);
          }
          if (Array.isArray(cloned.items)) {
            cloned.items = cloned.items.map(remapNode);
          }

          return cloned;
        };

        const remappedTree = remapNode(sourceTrack.rulesTree);
        await updateTrackRules(targetTrackId, remappedTree);
        stats.rulesTreeCloned = true;
      }
    }

    // 4. Clone Course Assignments
    if (options.cloneAssignments) {
      const sourceAssignments = await getTrackAssignments(sourceTrackId);
      for (const a of sourceAssignments) {
        const newVisualId = a.visualCategoryId ? visualCatMap.get(a.visualCategoryId) || null : null;
        const newRuleId = a.ruleCategoryId ? ruleCatMap.get(a.ruleCategoryId) || null : null;

        await assignCourseToCategories(targetTrackId, a.courseId, newVisualId, newRuleId);
        stats.assignmentsCloned++;
      }
    }

    return {
      success: true,
      message: `ساختار با موفقیت کپی و با شناسه‌های جدید همگام شد.`,
      stats,
    };
  } catch (error: any) {
    console.error("cloneTrackStructure error:", error);
    return {
      success: false,
      message: error?.message || "خطا در کپی ساختار گرایش",
      stats: {
        visualCategoriesCloned: 0,
        ruleCategoriesCloned: 0,
        assignmentsCloned: 0,
        rulesTreeCloned: false,
      },
    };
  }
}

export async function deleteCoursesByFaculty(facultyId: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `DELETE FROM prerequisites 
           WHERE course_id IN (SELECT id FROM courses WHERE faculty_id = ?) 
              OR required_course_id IN (SELECT id FROM courses WHERE faculty_id = ?)`
        )
        .bind(facultyId, facultyId)
        .run();

      await d1
        .prepare(
          `DELETE FROM track_course_assignments 
           WHERE course_id IN (SELECT id FROM courses WHERE faculty_id = ?)`
        )
        .bind(facultyId)
        .run();

      await d1
        .prepare("DELETE FROM courses WHERE faculty_id = ?")
        .bind(facultyId)
        .run();

      return true;
    } catch (err) {
      console.error("D1 deleteCoursesByFaculty error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const toDeleteIds = new Set(coursesStore.filter((c) => c.facultyId === facultyId).map((c) => c.id));
  coursesStore = coursesStore.filter((c) => !toDeleteIds.has(c.id));
  prerequisitesStore = prerequisitesStore.filter(
    (p) => !toDeleteIds.has(p.courseId) && !toDeleteIds.has(p.requiredCourseId)
  );
  trackAssignmentsStore = trackAssignmentsStore.filter((a) => !toDeleteIds.has(a.courseId));
  return true;
}

export async function deleteProfessorsByFaculty(facultyId: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `DELETE FROM reviews 
           WHERE (target_type = 'professor' AND target_id IN (SELECT id FROM professors WHERE faculty_id = ?))
              OR (target_type = 'offering' AND target_id IN (SELECT id FROM course_offerings WHERE professor_id IN (SELECT id FROM professors WHERE faculty_id = ?)))`
        )
        .bind(facultyId, facultyId)
        .run();

      await d1
        .prepare(
          `DELETE FROM course_offerings 
           WHERE professor_id IN (SELECT id FROM professors WHERE faculty_id = ?)`
        )
        .bind(facultyId)
        .run();

      await d1
        .prepare("DELETE FROM professors WHERE faculty_id = ?")
        .bind(facultyId)
        .run();

      return true;
    } catch (err) {
      console.error("D1 deleteProfessorsByFaculty error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const profIdsToDelete = new Set(professorsStore.filter((p) => p.facultyId === facultyId).map((p) => p.id));
  professorsStore = professorsStore.filter((p) => !profIdsToDelete.has(p.id));
  offeringsStore = offeringsStore.filter((o) => !profIdsToDelete.has(o.professorId));
  return true;
}

export async function deleteOfferingsByFaculty(facultyId: string): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare(
          `DELETE FROM reviews 
           WHERE target_type = 'offering' AND target_id IN (
             SELECT o.id FROM course_offerings o
             JOIN courses c ON o.course_id = c.id
             WHERE c.faculty_id = ?
           )`
        )
        .bind(facultyId)
        .run();

      await d1
        .prepare(
          `DELETE FROM course_events 
           WHERE offering_id IN (
             SELECT o.id FROM course_offerings o
             JOIN courses c ON o.course_id = c.id
             WHERE c.faculty_id = ?
           )`
        )
        .bind(facultyId)
        .run();

      await d1
        .prepare(
          `DELETE FROM course_offerings 
           WHERE course_id IN (SELECT id FROM courses WHERE faculty_id = ?)`
        )
        .bind(facultyId)
        .run();

      return true;
    } catch (err) {
      console.error("D1 deleteOfferingsByFaculty error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  const facultyCourseIds = new Set(coursesStore.filter((c) => c.facultyId === facultyId).map((c) => c.id));
  const offIdsToDelete = new Set(offeringsStore.filter((o) => facultyCourseIds.has(o.courseId)).map((o) => o.id));
  offeringsStore = offeringsStore.filter((o) => !offIdsToDelete.has(o.id));
  eventsStore = eventsStore.filter((e) => !offIdsToDelete.has(e.offeringId));
  return true;
}

export async function reorderVisualCategories(items: { id: string; sortOrder: number }[]): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      const stmts = items.map((item) =>
        d1.prepare("UPDATE visual_categories SET sort_order = ? WHERE id = ?").bind(item.sortOrder, item.id)
      );
      await d1.batch(stmts);
      return true;
    } catch (err) {
      console.error("D1 reorderVisualCategories error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  items.forEach((item) => {
    const cat = visualCategoriesStore.find((c) => c.id === item.id);
    if (cat) cat.sortOrder = item.sortOrder;
  });
  visualCategoriesStore.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return true;
}

export async function reorderRuleCategories(
  items: { id: string; sortOrder: number; parentId?: string | null }[]
): Promise<boolean> {
  const d1 = getD1();
  if (d1) {
    try {
      const stmts = items.map((item) => {
        if (item.parentId !== undefined) {
          return d1
            .prepare("UPDATE rule_categories SET sort_order = ?, parent_id = ? WHERE id = ?")
            .bind(item.sortOrder, item.parentId || null, item.id);
        }
        return d1.prepare("UPDATE rule_categories SET sort_order = ? WHERE id = ?").bind(item.sortOrder, item.id);
      });
      await d1.batch(stmts);
      return true;
    } catch (err) {
      console.error("D1 reorderRuleCategories error:", err);
      return false;
    }
  }

  await initFallbackDevData();
  items.forEach((item) => {
    const cat = ruleCategoriesStore.find((c) => c.id === item.id);
    if (cat) {
      cat.sortOrder = item.sortOrder;
      if (item.parentId !== undefined) cat.parentId = item.parentId || null;
    }
  });
  ruleCategoriesStore.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return true;
}

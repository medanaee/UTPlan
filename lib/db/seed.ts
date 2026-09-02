import { hashPassword } from "../auth";
import { getD1 } from "./client";

export async function seedDatabase(fullSeed = true) {
  const adminHash = await hashPassword("admin123");
  const studentHash = await hashPassword("student123");
  const now = new Date().toISOString();
  const d1 = getD1();

  if (!d1) {
    throw new Error("پایگاه‌داده D1 در دسترس نیست.");
  }

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
      `INSERT INTO visual_categories (id, track_id, code, name, color, sort_order, created_at)
       VALUES ('vcat_base', 'trk_software', 'VCAT-BASE', 'دروس پایه', '#3b82f6', 1, ?),
              ('vcat_core', 'trk_software', 'VCAT-CORE', 'دروس اصلی', '#10b981', 2, ?),
              ('vcat_spec', 'trk_software', 'VCAT-SPEC', 'دروس تخصصی', '#8b5cf6', 3, ?),
              ('vcat_gen', 'trk_software', 'VCAT-GEN', 'دروس عمومی', '#f59e0b', 4, ?)
       ON CONFLICT(id) DO NOTHING`
    )
    .bind(now, now, now, now)
    .run();

  // 6. Rule Categories
  await d1
    .prepare(
      `INSERT INTO rule_categories (id, track_id, parent_id, code, name, sort_order, created_at)
       VALUES ('rcat_base', 'trk_software', NULL, 'RCAT-BASE', 'دروس پایه', 1, ?),
              ('rcat_core', 'trk_software', NULL, 'RCAT-CORE', 'دروس اصلی', 2, ?),
              ('rcat_spec', 'trk_software', NULL, 'RCAT-SPEC', 'دروس تخصصی', 3, ?),
              ('rcat_gen', 'trk_software', NULL, 'RCAT-GEN', 'دروس عمومی', 4, ?)
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
        `INSERT INTO professors (id, faculty_id, first_name, last_name, title, email, links, created_at)
         VALUES (?, 'fac_ece', ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO NOTHING`
      )
      .bind(p.id, p.first_name, p.last_name, p.title, p.email, p.links, now)
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
      `INSERT INTO course_offerings (id, course_id, created_at)
       VALUES ('off_prog_1', 'crs_prog', ?),
              ('off_ds_1', 'crs_ds', ?),
              ('off_db_1', 'crs_db', ?)
       ON CONFLICT(id) DO NOTHING`
    )
    .bind(now, now, now)
    .run();

  await d1
    .prepare(
      `INSERT INTO offering_professors (id, offering_id, professor_id, is_primary, created_at)
       VALUES ('op_prog_1_prf_1', 'off_prog_1', 'prf_1', 1, ?),
              ('op_ds_1_prf_2', 'off_ds_1', 'prf_2', 1, ?),
              ('op_db_1_prf_3', 'off_db_1', 'prf_3', 1, ?)
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

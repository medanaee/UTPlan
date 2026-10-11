import { DatabaseSync } from "node:sqlite";
import process from "node:process";

const dbPath = process.argv[2] || "./data/app.sqlite";
const db = new DatabaseSync(dbPath);
const sourcePage = "https://ece.ut.ac.ir/%DA%86%D8%A7%D8%B1%D8%AA-%DA%A9%D9%84%DB%8C%D9%87-%DA%AF%D8%B1%D8%A7%DB%8C%D8%B4-%D9%87%D8%A7-%D9%88-%D8%AF%D8%B1%D9%88%D8%B3-%D9%BE%DB%8C%D8%B4%D9%86%D9%87%D8%A7%D8%AF%DB%8C";

const normalize = (value) => String(value || "")
  .replace(/[يى]/g, "ی")
  .replace(/ك/g, "ک")
  .replace(/[ۀة]/g, "ه")
  .replace(/[‌\u200c]/g, " ")
  .replace(/[()،,:؛/\\-]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const ceCommon = [
  ["مبانی کامپیوتر و برنامه‌نویسی", "فیزیک ۱", "ریاضی ۱"],
  ["ریاضی ۲", "معادلات دیفرانسیل", "فیزیک ۲", "برنامه‌نویسی پیشرفته", "ریاضیات گسسته"],
  ["آمار و احتمال مهندسی", "مدارهای الکتریکی (کامپیوتر)", "سیستم‌های دیجیتال ۱ (مدارمنطقی)", "ساختمان داده و الگوریتم"],
  ["ریاضیات مهندسی", "آز مدار و اندازه‌گیری", "سیستم‌های دیجیتال ۲ (معماری کامپیوتر)", "آز سیستم‌های دیجیتال ۱ (آز مدار منطقی)", "نظریه زبان‌ها و ماشین‌ها", "طراحی الگوریتم", "کارگاه کامپیوتر"],
  ["سیگنال‌ها و سیستم‌ها", "سیستم‌های عامل", "طراحی کامپیوتری سیستم‌های دیجیتالی", "هوش مصنوعی", "آز سیستم‌های دیجیتال ۲ (آز معماری کامپیوتر)"],
];

const eeCommon = [
  ["مبانی کامپیوتر و برنامه‌نویسی", "فیزیک ۱", "ریاضی ۱", "مبانی مهندسی برق"],
  ["ریاضی ۲", "معادلات دیفرانسیل", "فیزیک ۲", "کارگاه برق"],
  ["آمار و احتمال مهندسی", "مدارهای الکتریکی ۱ (برق)", "اقتصاد مهندسی", "الکترومغاطیس"],
  ["ریاضیات مهندسی", "مدارهای الکتریکی ۲ (برق)", "الکترونیک ۱", "آز مدار و اندازه‌گیری"],
  ["سیگنال‌ها و سیستم‌ها", "ماشین های الکتریکی ۱", "آز ماشین های الکتریکی ۱", "سیستم‌های دیجیتال ۱ (مدارمنطقی)"],
];

const withCommon = (common, specialized) => [...common, ...specialized];

const charts = [
  {
    track: "نرم افزار",
    title: "دروس پیشنهادی کارشناسی مهندسی کامپیوتر ـ تمرکز سیستم‌های نرم‌افزاری (شهریور ۱۴۰۳)",
    terms: withCommon(ceCommon, [
      ["تحلیل و طراحی سیستم‌ها (نرم ۱)", "پایگاه داده", "شبکه‌های کامپیوتری", "طراحی کامپایلر و زبان‌های برنامه‌نویسی", "زبان انگلیسی عمومی"],
      ["آزمون نرم‌افزار", "آز پایگاه داده", "مدیریت و کنترل پروژه فناوری اطلاعات", "مهندسی نرم‌افزار (نرم ۲)", "مبانی امنیت شبکه های کامپیوتری", "زبان انگلیسی تخصصی"],
      ["سیستم‌های نهفته بی‌درنگ", "مهندسی اینترنت", "روش پژوهش و ارائه", "آز شبکه‌های کامپیوتری", "پروژه"],
    ]),
  },
  {
    track: "سخت افزار",
    title: "دروس پیشنهادی کارشناسی مهندسی کامپیوتر ـ تمرکز طراحی دیجیتال و معماری کامپیوتر (شهریور ۱۴۰۳)",
    terms: withCommon(ceCommon, [
      ["برنامه‌نویسی موازی", "طراحی سخت‌افزار برای کاربردهای هوش مصنوعی", "شبکه‌های کامپیوتری", "روش پژوهش و ارائه"],
      ["طراحی مدارهای مجتمع دیجیتال از RTL تا GDSII", "طراحی و مدل‌سازی با زبان‌های سخت‌افزاری", "سامانه‌های سایبرفیزیکی و اینترنت اشیاء", "طراحی کامپایلر و زبان‌های برنامه‌نویسی"],
      ["مبانی رایانش توزیع‌شده", "آز شبکه‌های کامپیوتری", "سیستم‌های نهفته بی‌درنگ", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
  {
    track: "سیستم های دیجیتال",
    title: "دروس پیشنهادی کارشناسی مهندسی کامپیوتر ـ تمرکز سیستم‌های دیجیتال (شهریور ۱۴۰۳)",
    terms: withCommon(ceCommon, [
      ["طراحی در سطح سیستم", "طراحی سیستم‌های نهفته مبتنی بر FPGA", "مبانی الگوریتم‌های طراحی سیستم‌های دیجیتال", "آز سیستم‌های دیجیتال ۲ (آز معماری کامپیوتر)"],
      ["طراحی سیستم‌های نهفته مبتنی بر هسته", "شبیه‌سازی شی‌گرای سیستم‌های الکترونیکی", "طراحی کامپیوتری سیستم‌های دیجیتالی", "آز سیستم‌های کنترل دیجیتال"],
      ["درستی‌سنجی مدل‌های HDL", "درستی‌سنجی و عیب‌یابی سیستم‌های دیجیتال", "ساخت و آزمون سیستم‌های نهفته ASIC", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
  {
    track: "شبکه و سیستم‌ها",
    title: "دروس پیشنهادی کارشناسی مهندسی کامپیوتر ـ تمرکز سیستم و شبکه (شهریور ۱۴۰۳)",
    terms: withCommon(ceCommon, [
      ["شبکه‌های کامپیوتری", "انتقال داده", "مبانی امنیت شبکه های کامپیوتری", "سیستم‌های عامل"],
      ["شبکه‌های کامپیوتری پیشرفته", "امنیت شبکه پیشرفته", "آز شبکه‌های کامپیوتری", "رمزنگاری"],
      ["مبانی شبکه‌های بی‌ سیم", "شبکه‌های مخابرات داده", "شبکه‌های میان‌ارتباطی", "روش پژوهش و ارائه", "پروژه"],
    ]),
  },
  {
    track: "فناوری اطلاعات (IT)",
    title: "دروس پیشنهادی کارشناسی مهندسی کامپیوتر ـ تمرکز فناوری اطلاعات (شهریور ۱۴۰۳)",
    terms: withCommon(ceCommon, [
      ["مبانی فناوری اطلاعات", "پایگاه داده", "مهندسی اینترنت", "مبانی تجارت الکترونیکی"],
      ["مدیریت و کنترل پروژه فناوری اطلاعات", "آز پایگاه داده", "شبکه‌های کامپیوتری", "امنیت شبکه پیشرفته"],
      ["مبانی رایانش توزیع‌شده", "سامانه‌های سایبرفیزیکی و اینترنت اشیاء", "روش پژوهش و ارائه", "پروژه", "زبان انگلیسی تخصصی"],
    ]),
  },
  {
    track: "الکترونیک",
    title: "دروس پیشنهادی کارشناسی مهندسی برق ـ تمرکز الکترونیک (شهریور ۱۴۰۳)",
    terms: withCommon(eeCommon, [
      ["مدارهای مخابراتی", "طراحی بر اساس ریزپردازنده", "پردازش سیگنال دیجیتال", "آز مدارهای مخابراتی"],
      ["فیلتر و سنتز مدار", "آز طراحی بر اساس ریزپردازنده", "آز الکترونیک صنعتی", "آز سیستم‌های کنترل خطی", "زبان انگلیسی تخصصی"],
      ["آز الکترونیک ۳", "الکترونیک صنعتی", "آز سیستم‌های دیجیتال ۲ (آز معماری کامپیوتر)", "پروژه"],
    ]),
  },
  {
    track: "مهندسی پزشکی",
    title: "دروس پیشنهادی کارشناسی مهندسی برق ـ تمرکز بیوالکتریک (شهریور ۱۴۰۳)",
    terms: withCommon(eeCommon, [
      ["مبانی فیزیک پزشکی", "اصول تصویرنگاری پزشکی", "مدل‌سازی محاسباتی سیستم های فیزیولوژی", "فیزیولوژی و آناتومی"],
      ["تجهیزات عمومی بیمارستانی و کلینیک های پزشکی", "آز سیگنال‌های حیاتی", "آز سیستم‌های دیجیتال ۲ (آز معماری کامپیوتر)", "آز ماشین های الکتریکی ۱"],
      ["پردازش سیگنالهای بیولوژیکی", "سیستمهای تصویرگر پزشکی", "مبانی مهندسی پزشکی", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
  {
    track: "سیستم های دیجیتال",
    title: "دروس پیشنهادی کارشناسی مهندسی برق ـ تمرکز سیستم‌های دیجیتال (شهریور ۱۴۰۳)",
    terms: withCommon(eeCommon, [
      ["طراحی در سطح سیستم", "طراحی سیستم‌های نهفته مبتنی بر FPGA", "مبانی الگوریتم‌های طراحی سیستم‌های دیجیتال", "آز سیستم‌های دیجیتال ۲ (آز معماری کامپیوتر)"],
      ["طراحی سیستم‌های نهفته مبتنی بر هسته", "شبیه‌سازی شی‌گرای سیستم‌های الکترونیکی", "طراحی کامپیوتری سیستم‌های دیجیتالی", "آز سیستم‌های کنترل دیجیتال"],
      ["الکترونیک دیجیتال", "درستی‌سنجی مدل‌های HDL", "آز ماشین های الکتریکی ۱", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
  {
    track: "قدرت",
    title: "دروس پیشنهادی کارشناسی مهندسی برق ـ تمرکز قدرت (شهریور ۱۴۰۳)",
    terms: withCommon(eeCommon, [
      ["آز ماشین های الکتریکی ۲", "آز تحلیل سیستم‌های انرژی الکتریکی", "تحلیل سیستم‌های انرژی الکتریکی ۱", "آز ماشین های الکتریکی ۱"],
      ["طرح پست فشار قوی و پروژه", "رله و حفاظت سیستم‌ها", "تحلیل سیستم‌های انرژی الکتریکی ۲", "الکترونیک صنعتی"],
      ["آز رله و حفاظت سیستم‌ها", "عایق‌ها و فشار قوی", "آز عایق‌ها و فشار قوی", "آز سیستم‌های کنترل خطی", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
  {
    track: "کنترل",
    title: "دروس پیشنهادی کارشناسی مهندسی برق ـ تمرکز کنترل (شهریور ۱۴۰۳)",
    terms: withCommon(eeCommon, [
      ["مبانی مهندسی مکاترونیک", "ابزار دقیق", "اتوماسیون صنعتی", "آز سیستم‌های کنترل خطی"],
      ["اصول کنترل مدرن", "کنترل بهینه", "یادگیری ماشین", "آز الکترونیک صنعتی"],
      ["بهینه‌سازی پیشرفته / محدب", "سیستمهای فازی (مباحث ویژه در کنترل ۱)", "هوش مصنوعی پیشرفته در کنترل و رباتیک (مباحث ویژه در کنترل ۱)", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
  {
    track: "مخابرات",
    title: "دروس پیشنهادی کارشناسی مهندسی برق ـ تمرکز مخابرات (شهریور ۱۴۰۳)",
    terms: withCommon(eeCommon, [
      ["پردازش سیگنال دیجیتال", "مدارهای مخابراتی", "آز مدارهای مخابراتی", "آنتن ۱"],
      ["مایکروویو", "آز مایکروویو", "مخابرات دیجیتال", "آز مخابرات دیجیتال"],
      ["آنتن ۲", "سیستم های مخابرات نوری", "آز آنتن ۱", "زبان انگلیسی تخصصی", "پروژه"],
    ]),
  },
];

// The source page contains separate PDFs for the two degree families and their
// concentrations. The importer is intentionally strict: a missing course name
// aborts the transaction instead of silently creating an incomplete official chart.
const courseRows = db.prepare("SELECT id, name FROM courses WHERE deleted_at IS NULL").all();
const courseByName = new Map(courseRows.map((row) => [normalize(row.name), row.id]));
const aliases = new Map([
  [normalize("آز طراحی سیستم‌های نهفته مبتنی بر هسته"), normalize("طراحی سیستم‌های نهفته مبتنی بر هسته")],
  [normalize("مبانی شبکه‌های بی‌ سیم"), normalize("مبانی شبکه‌های بی سیم")],
  [normalize("مدل‌سازی محاسباتی سیستم های فیزیولوژی"), normalize("مدل سازی محاسباتی سیستم های فیزیولوژی")],
  [normalize("آز عایق‌ها و فشار قوی"), normalize("آز عایق‌ها و فشارقوی")],
]);

function resolveCourse(name) {
  const key = normalize(name);
  return courseByName.get(key) || courseByName.get(aliases.get(key)) || null;
}

const unresolved = [];
for (const chart of charts) {
  chart.terms.flat().forEach((name) => {
    if (!resolveCourse(name)) unresolved.push(`${chart.track}: ${name}`);
  });
}
if (unresolved.length) {
  console.error("Unresolved official-chart courses:");
  for (const item of unresolved) console.error(`- ${item}`);
  process.exit(1);
}

const admin = db.prepare("SELECT id FROM users WHERE role IN ('super_admin', 'admin') ORDER BY created_at LIMIT 1").get();
if (!admin?.id) throw new Error("No admin user is available for official charts");

const trackRows = db.prepare("SELECT id, name FROM tracks WHERE deleted_at IS NULL").all();
const trackByName = new Map(trackRows.map((row) => [normalize(row.name), row.id]));
const now = new Date().toISOString();

db.exec("BEGIN IMMEDIATE");
try {
  for (const chart of charts) {
    const trackId = trackByName.get(normalize(chart.track));
    if (!trackId) throw new Error(`Track not found: ${chart.track}`);

    const existing = db.prepare("SELECT id FROM charts WHERE track_id = ? AND is_approved_template = 1 ORDER BY created_at LIMIT 1").get(trackId);
    const chartId = existing?.id || `ch_official_${normalize(chart.track).replace(/[^a-z0-9]+/g, "_")}`;

    db.prepare(
      `INSERT INTO charts (id, user_id, track_id, title, description, waived_course_ids, is_approved_template, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', 1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, track_id=excluded.track_id, title=excluded.title,
       description=excluded.description, is_approved_template=1, updated_at=excluded.updated_at`
    ).run(chartId, admin.id, trackId, chart.title, sourcePage, now, now);

    db.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id = ?)").run(chartId);
    db.prepare("DELETE FROM chart_terms WHERE chart_id = ?").run(chartId);

    chart.terms.forEach((courses, index) => {
      const termNumber = index + 1;
      const termId = `term_${chartId}_${termNumber}`;
      db.prepare("INSERT INTO chart_terms (id, chart_id, term_index) VALUES (?, ?, ?)").run(termId, chartId, termNumber);
      courses.forEach((name, sortOrder) => {
        db.prepare("INSERT INTO chart_courses (id, term_id, course_id, sort_order) VALUES (?, ?, ?, ?)")
          .run(`cc_${chartId}_${termNumber}_${sortOrder}`, termId, resolveCourse(name), sortOrder);
      });
    });
    console.log(`Imported ${chart.track}: ${chart.terms.flat().length} courses`);
  }
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

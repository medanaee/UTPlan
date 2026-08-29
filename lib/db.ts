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
} from "./types";
import { hashPassword } from "./auth";

/**
 * In-memory stores for fallback and development
 */
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

export function getD1(): any {
  if (typeof globalThis !== "undefined" && (globalThis as any).ut_ece_db) {
    return (globalThis as any).ut_ece_db;
  }
  if (typeof process !== "undefined" && (process.env as any)?.ut_ece_db) {
    return (process.env as any).ut_ece_db;
  }
  return null;
}

let isInitialized = false;

export async function seedDevData() {
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
      role: "student",
      passwordHash: studentHash,
      facultyId: "fac_ece",
      majorId: "maj_ce",
      trackId: "trk_software",
      entrySemester: "1402-1",
      createdAt: new Date().toISOString(),
    },
  ];

  facultiesStore = [
    {
      id: "fac_ece",
      name: "دانشکده مهندسی برق و کامپیوتر",
      code: "ECE",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "fac_mech",
      name: "دانشکده مهندسی مکانیک",
      code: "MECH",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  majorsStore = [
    {
      id: "maj_ce",
      facultyId: "fac_ece",
      name: "مهندسی کامپیوتر",
      code: "CE",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "maj_ee",
      facultyId: "fac_ece",
      name: "مهندسی برق",
      code: "EE",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  tracksStore = [
    {
      id: "trk_software",
      majorId: "maj_ce",
      name: "نرم‌افزار و هوش مصنوعی",
      code: "CE_SW",
      rulesTree: {
        id: "root_and",
        type: "AND",
        title: "قوانین فارغ‌التحصیلی نرم‌افزار",
        children: [
          {
            id: "rule_total",
            type: "MIN_UNITS",
            title: "حداقل کل واحدهای دوره",
            minUnits: 140,
          },
          {
            id: "rule_core",
            type: "MIN_UNITS",
            title: "حداقل واحدهای تخصصی و اصلی",
            categoryId: "rcat_core",
            minUnits: 60,
          },
          {
            id: "rule_base",
            type: "MIN_UNITS",
            title: "حداقل واحدهای پایه",
            categoryId: "rcat_base",
            minUnits: 20,
          },
          {
            id: "rule_gen",
            type: "MIN_UNITS",
            title: "حداقل واحدهای عمومی",
            categoryId: "rcat_gen",
            minUnits: 22,
          },
        ],
      },
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "trk_hardware",
      majorId: "maj_ce",
      name: "سخت‌افزار و سیستم‌های دیجیتال",
      code: "CE_HW",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  visualCategoriesStore = [
    {
      id: "vcat_gen",
      trackId: "trk_software",
      name: "دروس عمومی",
      color: "#f59e0b",
      sortOrder: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: "vcat_base",
      trackId: "trk_software",
      name: "دروس پایه",
      color: "#3b82f6",
      sortOrder: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: "vcat_core",
      trackId: "trk_software",
      name: "دروس اصلی و تخصصی",
      color: "#8b5cf6",
      sortOrder: 2,
      createdAt: new Date().toISOString(),
    },
    {
      id: "vcat_elective",
      trackId: "trk_software",
      name: "دروس اختیاری و کارگاه‌ها",
      color: "#10b981",
      sortOrder: 3,
      createdAt: new Date().toISOString(),
    },
  ];

  ruleCategoriesStore = [
    {
      id: "rcat_total",
      trackId: "trk_software",
      name: "کل دروس دوره کارشناسی",
      minCredits: 140,
      parentId: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "rcat_gen",
      trackId: "trk_software",
      name: "دروس عمومی",
      minCredits: 22,
      parentId: "rcat_total",
      createdAt: new Date().toISOString(),
    },
    {
      id: "rcat_base",
      trackId: "trk_software",
      name: "دروس پایه",
      minCredits: 20,
      parentId: "rcat_total",
      createdAt: new Date().toISOString(),
    },
    {
      id: "rcat_core",
      trackId: "trk_software",
      name: "دروس اصلی و تخصصی",
      minCredits: 60,
      parentId: "rcat_total",
      createdAt: new Date().toISOString(),
    },
    {
      id: "rcat_elective",
      trackId: "trk_software",
      name: "دروس اختیاری تخصصی",
      minCredits: 16,
      parentId: "rcat_total",
      createdAt: new Date().toISOString(),
    },
  ];

  coursesStore = [
    {
      id: "crs_math1",
      facultyId: "fac_ece",
      name: "ریاضی عمومی ۱",
      code: "MATH101",
      units: 3,
      offeredIn: "both",
      description: "حساب دیفرانسیل و انتگرال توابع یک‌متغیره",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_math2",
      facultyId: "fac_ece",
      name: "ریاضی عمومی ۲",
      code: "MATH102",
      units: 3,
      offeredIn: "both",
      description: "حساب دیفرانسیل و انتگرال توابع چندمتغیره و برداری",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_phys1",
      facultyId: "fac_ece",
      name: "فیزیک ۱ (مکانیک)",
      code: "PHYS101",
      units: 3,
      offeredIn: "both",
      description: "مکانیک کلاسیک و دینامیک نیوتنی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_phys2",
      facultyId: "fac_ece",
      name: "فیزیک ۲ (الکتریسیته و مغناطیس)",
      code: "PHYS102",
      units: 3,
      offeredIn: "both",
      description: "میدان‌های الکتریکی و مغناطیسی و امواج الکترومغناطیس",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_prog",
      facultyId: "fac_ece",
      name: "مبانی برنامه‌سازی",
      code: "CS101",
      units: 3,
      offeredIn: "both",
      description: "آشنایی با الگوریتم‌ها و برنامه‌نویسی به زبان C/C++",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_ap",
      facultyId: "fac_ece",
      name: "برنامه‌سازی پیشرفته",
      code: "CS102",
      units: 3,
      offeredIn: "both",
      description: "برنامه‌نویسی شیءگرا و طراحی الگوها با Java/C++",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_ds",
      facultyId: "fac_ece",
      name: "ساختمان داده‌ها و الگوریتم‌ها",
      code: "CS201",
      units: 3,
      offeredIn: "both",
      description: "آرایه، لیست پیوندی، درخت، گراف و تحلیل مرتبه پیچیدگی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_algo",
      facultyId: "fac_ece",
      name: "طراحی الگوریتم‌ها",
      code: "CS301",
      units: 3,
      offeredIn: "both",
      description: "الگوریتم‌های حریصانه، برنامه‌ریزی پویا و تقسیم و حل",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_logic",
      facultyId: "fac_ece",
      name: "مدارهای منطقی",
      code: "CE201",
      units: 3,
      offeredIn: "both",
      description: "جبر بولی، گیت‌ها، مدارهای ترکیبی و ترتیبی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_arch",
      facultyId: "fac_ece",
      name: "معماری کامپیوتر",
      code: "CE301",
      units: 3,
      offeredIn: "both",
      description: "ساختار پردازنده، حافظه، گذرگاه‌ها و دستورالعمل‌های اسمبلی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_os",
      facultyId: "fac_ece",
      name: "سیستم‌های عامل",
      code: "CS302",
      units: 3,
      offeredIn: "both",
      description: "مدیریت پردازه‌ها، حافظه، ریسمان‌ها، قفل‌ها و سیستم فایل",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_net",
      facultyId: "fac_ece",
      name: "شبکه‌های کامپیوتری",
      code: "CS303",
      units: 3,
      offeredIn: "both",
      description: "مدل OSI، پروتکل‌های اینترنت TCP/IP و مسیریابی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_db",
      facultyId: "fac_ece",
      name: "پایگاه داده‌ها",
      code: "CS304",
      units: 3,
      offeredIn: "both",
      description: "مدل رابطه‌ای، SQL، نرمال‌سازی و تراکنش‌ها",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_ai",
      facultyId: "fac_ece",
      name: "هوش مصنوعی",
      code: "CS401",
      units: 3,
      offeredIn: "both",
      description: "جستجو در فضای حالت، منطق، یادگیری و سیستم‌های خبره",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_ml",
      facultyId: "fac_ece",
      name: "یادگیری ماشین",
      code: "CS402",
      units: 3,
      offeredIn: "both",
      description: "رگرسیون، دسته‌بندی، خوشه‌بندی و شبکه‌های عصبی عمیق",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_se",
      facultyId: "fac_ece",
      name: "مهندسی نرم‌افزار",
      code: "CS403",
      units: 3,
      offeredIn: "both",
      description: "متدولوژی‌های چابک، معماری نرم‌افزار و تست سیستم",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_persian",
      facultyId: "fac_ece",
      name: "فارسی عمومی",
      code: "GEN101",
      units: 2,
      offeredIn: "both",
      description: "نگارش و ادبیات فارسی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_english",
      facultyId: "fac_ece",
      name: "زبان انگلیسی عمومی",
      code: "GEN102",
      units: 2,
      offeredIn: "both",
      description: "گرامر و درک مطلب زبان انگلیسی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_islam1",
      facultyId: "fac_ece",
      name: "اندیشه اسلامی ۱",
      code: "GEN103",
      units: 2,
      offeredIn: "both",
      description: "مبانی معرفتی و اندیشه اسلامی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "crs_pe1",
      facultyId: "fac_ece",
      name: "تربیت بدنی ۱",
      code: "GEN104",
      units: 1,
      offeredIn: "both",
      description: "آمادگی جسمانی و ورزش عمومی",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  prerequisitesStore = [
    { id: "pr_1", courseId: "crs_math2", requiredCourseId: "crs_math1", type: "prerequisite" },
    { id: "pr_2", courseId: "crs_phys2", requiredCourseId: "crs_phys1", type: "prerequisite" },
    { id: "pr_3", courseId: "crs_ap", requiredCourseId: "crs_prog", type: "prerequisite" },
    { id: "pr_4", courseId: "crs_ds", requiredCourseId: "crs_ap", type: "prerequisite" },
    { id: "pr_5", courseId: "crs_algo", requiredCourseId: "crs_ds", type: "prerequisite" },
    { id: "pr_6", courseId: "crs_arch", requiredCourseId: "crs_logic", type: "prerequisite" },
    { id: "pr_7", courseId: "crs_os", requiredCourseId: "crs_ds", type: "prerequisite" },
    { id: "pr_8", courseId: "crs_os", requiredCourseId: "crs_arch", type: "prerequisite" },
    { id: "pr_9", courseId: "crs_net", requiredCourseId: "crs_os", type: "prerequisite" },
    { id: "pr_10", courseId: "crs_db", requiredCourseId: "crs_ds", type: "prerequisite" },
    { id: "pr_11", courseId: "crs_ai", requiredCourseId: "crs_algo", type: "prerequisite" },
    { id: "pr_12", courseId: "crs_ml", requiredCourseId: "crs_ai", type: "prerequisite" },
    { id: "pr_13", courseId: "crs_se", requiredCourseId: "crs_db", type: "corequisite" },
  ];

  trackAssignmentsStore = [
    { id: "as_1", trackId: "trk_software", courseId: "crs_math1", visualCategoryId: "vcat_base", ruleCategoryId: "rcat_base" },
    { id: "as_2", trackId: "trk_software", courseId: "crs_math2", visualCategoryId: "vcat_base", ruleCategoryId: "rcat_base" },
    { id: "as_3", trackId: "trk_software", courseId: "crs_phys1", visualCategoryId: "vcat_base", ruleCategoryId: "rcat_base" },
    { id: "as_4", trackId: "trk_software", courseId: "crs_phys2", visualCategoryId: "vcat_base", ruleCategoryId: "rcat_base" },
    { id: "as_5", trackId: "trk_software", courseId: "crs_prog", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_6", trackId: "trk_software", courseId: "crs_ap", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_7", trackId: "trk_software", courseId: "crs_ds", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_8", trackId: "trk_software", courseId: "crs_algo", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_9", trackId: "trk_software", courseId: "crs_logic", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_10", trackId: "trk_software", courseId: "crs_arch", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_11", trackId: "trk_software", courseId: "crs_os", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_12", trackId: "trk_software", courseId: "crs_net", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_13", trackId: "trk_software", courseId: "crs_db", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_14", trackId: "trk_software", courseId: "crs_ai", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_15", trackId: "trk_software", courseId: "crs_ml", visualCategoryId: "vcat_elective", ruleCategoryId: "rcat_elective" },
    { id: "as_16", trackId: "trk_software", courseId: "crs_se", visualCategoryId: "vcat_core", ruleCategoryId: "rcat_core" },
    { id: "as_17", trackId: "trk_software", courseId: "crs_persian", visualCategoryId: "vcat_gen", ruleCategoryId: "rcat_gen" },
    { id: "as_18", trackId: "trk_software", courseId: "crs_english", visualCategoryId: "vcat_gen", ruleCategoryId: "rcat_gen" },
    { id: "as_19", trackId: "trk_software", courseId: "crs_islam1", visualCategoryId: "vcat_gen", ruleCategoryId: "rcat_gen" },
    { id: "as_20", trackId: "trk_software", courseId: "crs_pe1", visualCategoryId: "vcat_gen", ruleCategoryId: "rcat_gen" },
  ];

  professorsStore = [
    {
      id: "prf_rezvani",
      facultyId: "fac_ece",
      name: "دکتر سارا رضوانی",
      title: "استاد تمام",
      email: "s.rezvani@ut.ac.ir",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "prf_mohammadi",
      facultyId: "fac_ece",
      name: "دکتر علی محمدی",
      title: "دانشیار",
      email: "a.mohammadi@ut.ac.ir",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "prf_hosseini",
      facultyId: "fac_ece",
      name: "دکتر مریم حسینی",
      title: "استادیار",
      email: "m.hosseini@ut.ac.ir",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "prf_kazemi",
      facultyId: "fac_ece",
      name: "دکتر بهزاد کاظمی",
      title: "استادیار",
      email: "b.kazemi@ut.ac.ir",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  offeringsStore = [
    { id: "off_1", courseId: "crs_ds", professorId: "prf_rezvani", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_2", courseId: "crs_prog", professorId: "prf_mohammadi", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_3", courseId: "crs_os", professorId: "prf_hosseini", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_4", courseId: "crs_ai", professorId: "prf_kazemi", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_5", courseId: "crs_db", professorId: "prf_rezvani", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_6", courseId: "crs_math1", professorId: "prf_mohammadi", createdAt: new Date().toISOString(), deletedAt: null },
  ];

  eventsStore = [
    {
      id: "evt_1",
      offeringId: "off_1",
      term: "1403-1",
      groupCode: "01",
      capacity: 45,
      location: "دانشکده برق و کامپیوتر - کلاس ۱۰۱",
      examDate: "1403/10/22",
      examStartTime: "08:30",
      examEndTime: "11:00",
      isUserCustom: false,
      slots: [
        { id: "slt_1_1", eventId: "evt_1", dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
        { id: "slt_1_2", eventId: "evt_1", dayOfWeek: 2, startTime: "10:30", endTime: "12:00" },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "evt_2",
      offeringId: "off_2",
      term: "1403-1",
      groupCode: "01",
      capacity: 50,
      location: "دانشکده برق و کامپیوتر - سایت محاسبات",
      examDate: "1403/10/25",
      examStartTime: "13:30",
      examEndTime: "16:00",
      isUserCustom: false,
      slots: [
        { id: "slt_2_1", eventId: "evt_2", dayOfWeek: 1, startTime: "08:00", endTime: "09:30" },
        { id: "slt_2_2", eventId: "evt_2", dayOfWeek: 3, startTime: "08:00", endTime: "09:30" },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "evt_3",
      offeringId: "off_3",
      term: "1403-1",
      groupCode: "01",
      capacity: 40,
      location: "دانشکده برق و کامپیوتر - کلاس ۱۰۳",
      examDate: "1403/10/28",
      examStartTime: "08:30",
      examEndTime: "11:00",
      isUserCustom: false,
      slots: [
        { id: "slt_3_1", eventId: "evt_3", dayOfWeek: 0, startTime: "13:30", endTime: "15:00" },
        { id: "slt_3_2", eventId: "evt_3", dayOfWeek: 4, startTime: "13:30", endTime: "15:00" },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: "evt_4",
      offeringId: "off_4",
      term: "1403-1",
      groupCode: "01",
      capacity: 35,
      location: "دانشکده برق و کامپیوتر - کلاس ۱۰۴",
      examDate: "1403/11/01",
      examStartTime: "08:30",
      examEndTime: "11:00",
      isUserCustom: false,
      slots: [
        { id: "slt_4_1", eventId: "evt_4", dayOfWeek: 1, startTime: "10:30", endTime: "12:00" },
        { id: "slt_4_2", eventId: "evt_4", dayOfWeek: 3, startTime: "10:30", endTime: "12:00" },
      ],
      createdAt: new Date().toISOString(),
    },
  ];

  chartsStore = [
    {
      id: "chart_approved_ce_sw",
      userId: "usr_super_admin",
      trackId: "trk_software",
      title: "چارت مصوب کارشناسی مهندسی کامپیوتر (گرایش نرم‌افزار)",
      isApprovedDefault: true,
      description: "برنامه درسی مصوب شورای آموزشی دانشگاه تهران جهت هدایت تحصیلی دانشجویان ورودی جدید",
      semesters: [
        { semesterNumber: 1, courseIds: ["crs_math1", "crs_phys1", "crs_prog", "crs_persian", "crs_pe1"] },
        { semesterNumber: 2, courseIds: ["crs_math2", "crs_phys2", "crs_ap", "crs_english", "crs_islam1"] },
        { semesterNumber: 3, courseIds: ["crs_ds", "crs_logic"] },
        { semesterNumber: 4, courseIds: ["crs_algo", "crs_arch", "crs_db"] },
        { semesterNumber: 5, courseIds: ["crs_os", "crs_se"] },
        { semesterNumber: 6, courseIds: ["crs_net", "crs_ai"] },
        { semesterNumber: 7, courseIds: ["crs_ml"] },
        { semesterNumber: 8, courseIds: [] },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];
}

export async function initDatabase() {
  if (isInitialized) return;

  const isDev = process.env.NODE_ENV !== "production" || !getD1();
  if (isDev) {
    await seedDevData();
  } else {
    const adminHash = await hashPassword("admin123");
    usersStore = [
      {
        id: "usr_super_admin",
        name: "مدیر ارشد سامانه",
        email: "admin@example.com",
        role: "super_admin",
        passwordHash: adminHash,
        createdAt: new Date().toISOString(),
      },
    ];

    facultiesStore = [];
    majorsStore = [];
    tracksStore = [];
    visualCategoriesStore = [];
    ruleCategoriesStore = [];
    coursesStore = [];
    trackAssignmentsStore = [];
    prerequisitesStore = [];
    professorsStore = [];
    offeringsStore = [];
    eventsStore = [];
    chartsStore = [];
  }

  isInitialized = true;
}

// ----------------------------------------------------
// USERS CRUD
// ----------------------------------------------------
export async function findUserByEmail(email: string): Promise<User | null> {
  await initDatabase();
  return usersStore.find((u) => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
}

export async function findUserById(id: string): Promise<User | null> {
  await initDatabase();
  return usersStore.find((u) => u.id === id) || null;
}

export async function getAllUsers(): Promise<User[]> {
  await initDatabase();
  return usersStore;
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: "super_admin" | "admin" | "user";
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
}): Promise<User> {
  await initDatabase();
  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const newUser: User = {
    id,
    name: data.name,
    email: data.email.trim().toLowerCase(),
    passwordHash: data.passwordHash,
    role: data.role || "user",
    facultyId: data.facultyId,
    majorId: data.majorId,
    trackId: data.trackId,
    entrySemester: data.entrySemester,
    createdAt: new Date().toISOString(),
  };
  usersStore.push(newUser);
  return newUser;
}

export async function updateUserRole(userId: string, role: "super_admin" | "admin" | "user"): Promise<boolean> {
  await initDatabase();
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;
  user.role = role;
  return true;
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Pick<User, "name" | "facultyId" | "majorId" | "trackId" | "entrySemester" | "avatarUrl">>
): Promise<User | null> {
  await initDatabase();
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return null;
  Object.assign(user, data);
  return user;
}

export async function changeUserPassword(userId: string, newPasswordHash: string): Promise<boolean> {
  await initDatabase();
  const user = usersStore.find((u) => u.id === userId);
  if (!user) return false;
  user.passwordHash = newPasswordHash;
  return true;
}

// ----------------------------------------------------
// FACULTIES CRUD
// ----------------------------------------------------
export async function getFaculties(): Promise<Faculty[]> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      const { results } = await d1.prepare("SELECT * FROM faculties ORDER BY name ASC").all<any>();
      return results.map((r) => ({ id: r.id, name: r.name, code: r.code, createdAt: r.created_at, deletedAt: null }));
    } catch (err) {
      console.error("D1 getFaculties error:", err);
    }
  }
  return facultiesStore.filter((f) => !f.deletedAt);
}

export async function createFaculty(name: string, code: string): Promise<Faculty> {
  await initDatabase();
  const id = `fac_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("INSERT INTO faculties (id, name, code, created_at) VALUES (?, ?, ?, ?)").bind(id, name, code.toUpperCase(), now).run();
    } catch (err) {
      console.error("D1 createFaculty error:", err);
    }
  }
  const newFaculty: Faculty = {
    id,
    name,
    code: code.toUpperCase(),
    createdAt: now,
    deletedAt: null,
  };
  facultiesStore.push(newFaculty);
  return newFaculty;
}

export async function updateFaculty(id: string, name: string, code: string): Promise<Faculty | null> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE faculties SET name = ?, code = ?, updated_at = ? WHERE id = ?")
        .bind(name, code.toUpperCase(), new Date().toISOString(), id)
        .run();
    } catch (err) {
      console.error("D1 updateFaculty error:", err);
    }
  }
  const f = facultiesStore.find((item) => item.id === id);
  if (f) {
    f.name = name;
    f.code = code.toUpperCase();
    return f;
  }
  return { id, name, code: code.toUpperCase(), createdAt: new Date().toISOString(), deletedAt: null };
}

export async function deleteFaculty(id: string): Promise<boolean> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM faculties WHERE id = ?").bind(id).run();
    } catch (err) {
      console.error("D1 deleteFaculty error:", err);
    }
  }
  const f = facultiesStore.find((item) => item.id === id);
  if (!f) return false;
  f.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// MAJORS CRUD
// ----------------------------------------------------
export async function getMajors(facultyId?: string): Promise<Major[]> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM majors";
      const params = [];
      if (facultyId) {
        query += " WHERE faculty_id = ?";
        params.push(facultyId);
      }
      query += " ORDER BY name ASC";
      const { results } = await d1.prepare(query).bind(...params).all<any>();
      return results.map((r) => ({ id: r.id, facultyId: r.faculty_id, name: r.name, code: r.code, createdAt: r.created_at, deletedAt: null }));
    } catch (err) {
      console.error("D1 getMajors error:", err);
    }
  }
  return majorsStore.filter((m) => !m.deletedAt && (!facultyId || m.facultyId === facultyId));
}

export async function createMajor(facultyId: string, name: string, code: string): Promise<Major> {
  await initDatabase();
  const id = `maj_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("INSERT INTO majors (id, faculty_id, name, code, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, facultyId, name, code.toUpperCase(), now).run();
    } catch (err) {
      console.error("D1 createMajor error:", err);
    }
  }
  const newMajor: Major = {
    id,
    facultyId,
    name,
    code: code.toUpperCase(),
    createdAt: now,
    deletedAt: null,
  };
  majorsStore.push(newMajor);
  return newMajor;
}

export async function updateMajor(id: string, name: string, code: string): Promise<Major | null> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE majors SET name = ?, code = ?, updated_at = ? WHERE id = ?")
        .bind(name, code.toUpperCase(), new Date().toISOString(), id)
        .run();
    } catch (err) {
      console.error("D1 updateMajor error:", err);
    }
  }
  const m = majorsStore.find((item) => item.id === id);
  if (m) {
    m.name = name;
    m.code = code.toUpperCase();
    return m;
  }
  return null;
}

export async function deleteMajor(id: string): Promise<boolean> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM majors WHERE id = ?").bind(id).run();
    } catch (err) {
      console.error("D1 deleteMajor error:", err);
    }
  }
  const m = majorsStore.find((item) => item.id === id);
  if (!m) return false;
  m.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// TRACKS CRUD
// ----------------------------------------------------
export async function getTracks(majorId?: string): Promise<Track[]> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      let query = "SELECT * FROM tracks";
      const params = [];
      if (majorId) {
        query += " WHERE major_id = ?";
        params.push(majorId);
      }
      query += " ORDER BY name ASC";
      const { results } = await d1.prepare(query).bind(...params).all<any>();
      return results.map((r) => ({
        id: r.id,
        majorId: r.major_id,
        name: r.name,
        code: r.code,
        totalUnitsRequired: r.total_units_required,
        isApprovedDefault: Boolean(r.is_approved_default),
        createdAt: r.created_at,
        deletedAt: null,
      }));
    } catch (err) {
      console.error("D1 getTracks error:", err);
    }
  }
  return tracksStore.filter((t) => !t.deletedAt && (!majorId || t.majorId === majorId));
}

export async function createTrack(majorId: string, name: string, code: string, rulesTree?: any): Promise<Track> {
  await initDatabase();
  const id = `trk_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("INSERT INTO tracks (id, major_id, name, code, total_units_required, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, majorId, name, code.toUpperCase(), 140, now)
        .run();
    } catch (err) {
      console.error("D1 createTrack error:", err);
    }
  }
  const newTrack: Track = {
    id,
    majorId,
    name,
    code: code.toUpperCase(),
    rulesTree: rulesTree || { type: "AND", children: [] },
    createdAt: now,
    deletedAt: null,
  };
  tracksStore.push(newTrack);
  return newTrack;
}

export async function updateTrack(id: string, name: string, code: string, rulesTree?: any): Promise<Track | null> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1
        .prepare("UPDATE tracks SET name = ?, code = ?, updated_at = ? WHERE id = ?")
        .bind(name, code.toUpperCase(), new Date().toISOString(), id)
        .run();
    } catch (err) {
      console.error("D1 updateTrack error:", err);
    }
  }
  const t = tracksStore.find((item) => item.id === id);
  if (t) {
    t.name = name;
    t.code = code.toUpperCase();
    if (rulesTree !== undefined) t.rulesTree = rulesTree;
    return t;
  }
  return null;
}

export async function updateTrackRules(trackId: string, rulesTree: any): Promise<boolean> {
  await initDatabase();
  const t = tracksStore.find((item) => item.id === trackId);
  if (!t) return false;
  t.rulesTree = rulesTree;
  return true;
}

export async function deleteTrack(id: string): Promise<boolean> {
  await initDatabase();
  const d1 = getD1();
  if (d1) {
    try {
      await d1.prepare("DELETE FROM tracks WHERE id = ?").bind(id).run();
    } catch (err) {
      console.error("D1 deleteTrack error:", err);
    }
  }
  const t = tracksStore.find((item) => item.id === id);
  if (!t) return false;
  t.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// CATEGORIES (VISUAL & RULE)
// ----------------------------------------------------
export async function getVisualCategories(trackId: string): Promise<VisualCategory[]> {
  await initDatabase();
  return visualCategoriesStore
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function createVisualCategory(trackId: string, name: string, color: string, sortOrder = 0): Promise<VisualCategory> {
  await initDatabase();
  const newCat: VisualCategory = {
    id: `vcat_${crypto.randomUUID().slice(0, 8)}`,
    trackId,
    name,
    color,
    sortOrder,
    createdAt: new Date().toISOString(),
  };
  visualCategoriesStore.push(newCat);
  return newCat;
}

export async function deleteVisualCategory(id: string): Promise<boolean> {
  await initDatabase();
  const index = visualCategoriesStore.findIndex((c) => c.id === id);
  if (index === -1) return false;
  visualCategoriesStore.splice(index, 1);
  return true;
}

export async function getRuleCategories(trackId: string): Promise<RuleCategory[]> {
  await initDatabase();
  return ruleCategoriesStore.filter((c) => c.trackId === trackId);
}

export async function createRuleCategory(trackId: string, name: string, minCredits = 0, parentId?: string | null): Promise<RuleCategory> {
  await initDatabase();
  const newCat: RuleCategory = {
    id: `rcat_${crypto.randomUUID().slice(0, 8)}`,
    trackId,
    parentId: parentId || null,
    name,
    minCredits,
    createdAt: new Date().toISOString(),
  };
  ruleCategoriesStore.push(newCat);
  return newCat;
}

export async function deleteRuleCategory(id: string): Promise<boolean> {
  await initDatabase();
  const index = ruleCategoriesStore.findIndex((c) => c.id === id);
  if (index === -1) return false;
  ruleCategoriesStore.splice(index, 1);
  return true;
}

// ----------------------------------------------------
// TRACK COURSE ASSIGNMENTS (COURSE TO CATEGORY)
// ----------------------------------------------------
export async function getTrackAssignments(trackId: string): Promise<TrackCourseAssignment[]> {
  await initDatabase();
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
  await initDatabase();
  const existing = trackAssignmentsStore.find((a) => a.trackId === trackId && a.courseId === courseId);
  if (existing) {
    if (visualCategoryId !== undefined) existing.visualCategoryId = visualCategoryId;
    if (ruleCategoryId !== undefined) existing.ruleCategoryId = ruleCategoryId;
    return existing;
  }

  const newAssignment: TrackCourseAssignment = {
    id: `assign_${trackId}_${courseId}`,
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
  await initDatabase();
  for (const item of assignments) {
    await assignCourseToCategories(trackId, item.courseId, item.visualCategoryId, item.ruleCategoryId);
  }
  return true;
}

// ----------------------------------------------------
// COURSES & PREREQUISITES CRUD
// ----------------------------------------------------
export async function getCourses(facultyId?: string, trackId?: string): Promise<Course[]> {
  await initDatabase();
  let result = coursesStore.filter((c) => !c.deletedAt && (!facultyId || c.facultyId === facultyId));

  // Populate prerequisites and track assignments
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
  await initDatabase();
  const course = coursesStore.find((c) => c.id === id && !c.deletedAt);
  if (!course) return null;

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

  return {
    ...course,
    prerequisites: prereqs,
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
  await initDatabase();
  const id = `crs_${crypto.randomUUID().slice(0, 8)}`;
  const newCourse: Course = {
    id,
    facultyId: data.facultyId,
    name: data.name,
    code: data.code.toUpperCase(),
    units: Number(data.units) || 3,
    offeredIn: data.offeredIn || "both",
    description: data.description || "",
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };

  coursesStore.push(newCourse);

  // Optional track assignment
  if (data.trackId) {
    trackAssignmentsStore.push({
      id: `assign_${id}`,
      trackId: data.trackId,
      courseId: id,
      visualCategoryId: data.visualCategoryId || null,
      ruleCategoryId: data.ruleCategoryId || null,
    });
  }

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
  await initDatabase();
  const course = coursesStore.find((c) => c.id === id && !c.deletedAt);
  if (!course) return null;

  if (data.name) course.name = data.name;
  if (data.code) course.code = data.code.toUpperCase();
  if (data.units !== undefined) course.units = Number(data.units);
  if (data.offeredIn) course.offeredIn = data.offeredIn;
  if (data.description !== undefined) course.description = data.description;
  if (data.facultyId) course.facultyId = data.facultyId;

  if (data.trackId) {
    const existing = trackAssignmentsStore.find((a) => a.courseId === id && a.trackId === data.trackId);
    if (existing) {
      if (data.visualCategoryId !== undefined) existing.visualCategoryId = data.visualCategoryId;
      if (data.ruleCategoryId !== undefined) existing.ruleCategoryId = data.ruleCategoryId;
    } else {
      trackAssignmentsStore.push({
        id: `assign_${id}_${data.trackId}`,
        trackId: data.trackId,
        courseId: id,
        visualCategoryId: data.visualCategoryId || null,
        ruleCategoryId: data.ruleCategoryId || null,
      });
    }
  }

  return course;
}

export async function deleteCourse(id: string): Promise<boolean> {
  await initDatabase();
  const c = coursesStore.find((item) => item.id === id);
  if (!c) return false;
  c.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// PREREQUISITES MANAGEMENT
// ----------------------------------------------------
export async function getPrerequisites(courseId?: string): Promise<PrerequisiteRelation[]> {
  await initDatabase();
  return prerequisitesStore.filter((p) => !courseId || p.courseId === courseId);
}

export async function getAllPrerequisites(): Promise<{ courseId: string; requiredCourseId: string; type: string }[]> {
  await initDatabase();
  return prerequisitesStore;
}

export async function addPrerequisite(
  courseId: string,
  requiredCourseId: string,
  type: "prerequisite" | "corequisite" = "prerequisite"
): Promise<PrerequisiteRelation> {
  await initDatabase();

  // Check if exists
  const existing = prerequisitesStore.find(
    (p) => p.courseId === courseId && p.requiredCourseId === requiredCourseId
  );
  if (existing) {
    existing.type = type;
    return existing;
  }

  const newPrereq: PrerequisiteRelation = {
    id: `pr_${crypto.randomUUID().slice(0, 8)}`,
    courseId,
    requiredCourseId,
    type,
  };
  prerequisitesStore.push(newPrereq);
  return newPrereq;
}

export async function removePrerequisite(id: string): Promise<boolean> {
  await initDatabase();
  const idx = prerequisitesStore.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  prerequisitesStore.splice(idx, 1);
  return true;
}

// ----------------------------------------------------
// PROFESSORS CRUD
// ----------------------------------------------------
export async function getProfessors(facultyId?: string): Promise<Professor[]> {
  await initDatabase();
  return professorsStore.filter((p) => !p.deletedAt && (!facultyId || p.facultyId === facultyId));
}

export async function createProfessor(data: {
  facultyId: string;
  name: string;
  title?: string;
  email?: string;
  avatarUrl?: string;
}): Promise<Professor> {
  await initDatabase();
  const newProf: Professor = {
    id: `prf_${crypto.randomUUID().slice(0, 8)}`,
    facultyId: data.facultyId,
    name: data.name,
    title: data.title || "استاد",
    email: data.email || "",
    avatarUrl: data.avatarUrl || "",
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  professorsStore.push(newProf);
  return newProf;
}

export async function updateProfessor(
  id: string,
  data: Partial<Pick<Professor, "name" | "title" | "email" | "avatarUrl" | "facultyId">>
): Promise<Professor | null> {
  await initDatabase();
  const p = professorsStore.find((item) => item.id === id && !item.deletedAt);
  if (!p) return null;
  if (data.name) p.name = data.name;
  if (data.title !== undefined) p.title = data.title;
  if (data.email !== undefined) p.email = data.email;
  if (data.avatarUrl !== undefined) p.avatarUrl = data.avatarUrl;
  if (data.facultyId) p.facultyId = data.facultyId;
  return p;
}

export async function deleteProfessor(id: string): Promise<boolean> {
  await initDatabase();
  const p = professorsStore.find((item) => item.id === id);
  if (!p) return false;
  p.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// COURSE OFFERINGS CRUD (اتصال درس و استاد)
// ----------------------------------------------------
export async function getOfferings(filter?: {
  courseId?: string;
  professorId?: string;
  facultyId?: string;
}): Promise<CourseOffering[]> {
  await initDatabase();
  let list = offeringsStore.filter((o) => !o.deletedAt);

  if (filter?.courseId) {
    list = list.filter((o) => o.courseId === filter.courseId);
  }
  if (filter?.professorId) {
    list = list.filter((o) => o.professorId === filter.professorId);
  }
  if (filter?.facultyId) {
    list = list.filter((o) => {
      const course = coursesStore.find((c) => c.id === o.courseId);
      return !course || course.facultyId === filter.facultyId;
    });
  }

  return list.map((off) => {
    const course = coursesStore.find((c) => c.id === off.courseId);
    const prof = professorsStore.find((p) => p.id === off.professorId);
    return {
      ...off,
      courseName: course?.name || "نامشخص",
      courseCode: course?.code || "",
      courseUnits: course?.units || 3,
      professorName: prof?.name || "نامشخص",
      professorTitle: prof?.title || "استاد",
      professorAvatarUrl: prof?.avatarUrl,
    };
  });
}

export async function createOffering(data: {
  courseId: string;
  professorId: string;
}): Promise<CourseOffering> {
  await initDatabase();
  const existing = offeringsStore.find(
    (o) => o.courseId === data.courseId && o.professorId === data.professorId && !o.deletedAt
  );
  if (existing) {
    const course = coursesStore.find((c) => c.id === existing.courseId);
    const prof = professorsStore.find((p) => p.id === existing.professorId);
    return {
      ...existing,
      courseName: course?.name || "",
      courseCode: course?.code || "",
      courseUnits: course?.units || 3,
      professorName: prof?.name || "",
      professorTitle: prof?.title || "",
      professorAvatarUrl: prof?.avatarUrl,
    };
  }

  const newOffering: CourseOffering = {
    id: `off_${crypto.randomUUID().slice(0, 8)}`,
    courseId: data.courseId,
    professorId: data.professorId,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  offeringsStore.push(newOffering);
  const course = coursesStore.find((c) => c.id === newOffering.courseId);
  const prof = professorsStore.find((p) => p.id === newOffering.professorId);
  return {
    ...newOffering,
    courseName: course?.name || "",
    courseCode: course?.code || "",
    courseUnits: course?.units || 3,
    professorName: prof?.name || "",
    professorTitle: prof?.title || "",
    professorAvatarUrl: prof?.avatarUrl,
  };
}

export async function deleteOffering(id: string): Promise<boolean> {
  await initDatabase();
  const off = offeringsStore.find((o) => o.id === id);
  if (!off) return false;
  off.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// COURSE EVENTS & SLOTS CRUD (رویداد کلاسی ترم، گروه، زمان‌بندی و امتحان)
// ----------------------------------------------------
export async function getEvents(filter?: {
  offeringId?: string;
  term?: string;
  userId?: string | null;
  facultyId?: string;
}): Promise<CourseEvent[]> {
  await initDatabase();
  let list = eventsStore;

  if (filter?.offeringId) {
    list = list.filter((e) => e.offeringId === filter.offeringId);
  }
  if (filter?.term) {
    list = list.filter((e) => e.term === filter.term);
  }
  if (filter?.userId !== undefined) {
    list = list.filter((e) => e.userId === filter.userId);
  }
  if (filter?.facultyId) {
    list = list.filter((e) => {
      const offering = offeringsStore.find((o) => o.id === e.offeringId);
      const course = offering ? coursesStore.find((c) => c.id === offering.courseId) : null;
      return !course || course.facultyId === filter.facultyId;
    });
  }

  return list.map((evt) => {
    const offering = offeringsStore.find((o) => o.id === evt.offeringId);
    const course = offering ? coursesStore.find((c) => c.id === offering.courseId) : null;
    const prof = offering ? professorsStore.find((p) => p.id === offering.professorId) : null;
    return {
      ...evt,
      courseName: course?.name,
      courseCode: course?.code,
      courseUnits: course?.units,
      professorName: prof?.name,
      professorTitle: prof?.title,
    };
  });
}

export async function createEvent(data: {
  offeringId: string;
  term: string;
  groupCode?: string;
  capacity?: number;
  location?: string;
  examDate?: string;
  examStartTime?: string;
  examEndTime?: string;
  isUserCustom?: boolean;
  userId?: string | null;
  slots?: { dayOfWeek: number; startTime: string; endTime: string }[];
}): Promise<CourseEvent> {
  await initDatabase();
  const eventId = `evt_${crypto.randomUUID().slice(0, 8)}`;
  const slots: CourseEventSlot[] = (data.slots || []).map((s) => ({
    id: `slt_${crypto.randomUUID().slice(0, 8)}`,
    eventId,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  const newEvent: CourseEvent = {
    id: eventId,
    offeringId: data.offeringId,
    term: data.term || "1403-1",
    groupCode: data.groupCode || "01",
    capacity: data.capacity !== undefined ? data.capacity : 40,
    location: data.location || "",
    examDate: data.examDate || "",
    examStartTime: data.examStartTime || "",
    examEndTime: data.examEndTime || "",
    isUserCustom: data.isUserCustom || false,
    userId: data.userId || null,
    globalEventId: null,
    createdAt: new Date().toISOString(),
    slots,
  };

  eventsStore.push(newEvent);
  const offering = offeringsStore.find((o) => o.id === newEvent.offeringId);
  const course = offering ? coursesStore.find((c) => c.id === offering.courseId) : null;
  const prof = offering ? professorsStore.find((p) => p.id === offering.professorId) : null;
  return {
    ...newEvent,
    courseName: course?.name,
    courseCode: course?.code,
    courseUnits: course?.units,
    professorName: prof?.name,
    professorTitle: prof?.title,
  };
}

export async function updateEvent(
  id: string,
  data: Partial<CourseEvent> & { slots?: { dayOfWeek: number; startTime: string; endTime: string }[] }
): Promise<CourseEvent | null> {
  await initDatabase();
  const evt = eventsStore.find((e) => e.id === id);
  if (!evt) return null;

  if (data.offeringId !== undefined) evt.offeringId = data.offeringId;
  if (data.groupCode !== undefined) evt.groupCode = data.groupCode;
  if (data.capacity !== undefined) evt.capacity = data.capacity;
  if (data.location !== undefined) evt.location = data.location;
  if (data.term !== undefined) evt.term = data.term;
  if (data.examDate !== undefined) evt.examDate = data.examDate;
  if (data.examStartTime !== undefined) evt.examStartTime = data.examStartTime;
  if (data.examEndTime !== undefined) evt.examEndTime = data.examEndTime;

  if (data.slots !== undefined) {
    evt.slots = data.slots.map((s) => ({
      id: `slt_${crypto.randomUUID().slice(0, 8)}`,
      eventId: id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }

  const offering = offeringsStore.find((o) => o.id === evt.offeringId);
  const course = offering ? coursesStore.find((c) => c.id === offering.courseId) : null;
  const prof = offering ? professorsStore.find((p) => p.id === offering.professorId) : null;
  return {
    ...evt,
    courseName: course?.name,
    courseCode: course?.code,
    courseUnits: course?.units,
    professorName: prof?.name,
    professorTitle: prof?.title,
  };
}

export async function deleteEvent(id: string): Promise<boolean> {
  await initDatabase();
  const idx = eventsStore.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  eventsStore.splice(idx, 1);
  return true;
}

// ----------------------------------------------------
// STUDENT CHARTS CRUD
// ----------------------------------------------------

export async function getCharts(userId?: string): Promise<StudentChart[]> {
  await initDatabase();
  if (!userId) {
    return chartsStore;
  }
  // Return user's private charts + official approved default charts
  return chartsStore.filter((c) => c.userId === userId || c.isApprovedDefault);
}

export async function getChartById(id: string): Promise<StudentChart | null> {
  await initDatabase();
  const chart = chartsStore.find((c) => c.id === id);
  return chart ? JSON.parse(JSON.stringify(chart)) : null;
}

export async function getApprovedTrackChart(trackId: string): Promise<StudentChart | null> {
  await initDatabase();
  const primary = chartsStore.find((c) => c.trackId === trackId && c.isApprovedDefault && c.isPrimaryApproved);
  if (primary) return JSON.parse(JSON.stringify(primary));
  const fallback = chartsStore.find((c) => c.trackId === trackId && c.isApprovedDefault);
  return fallback ? JSON.parse(JSON.stringify(fallback)) : null;
}

export async function getApprovedTrackCharts(trackId?: string): Promise<StudentChart[]> {
  await initDatabase();
  const list = chartsStore.filter((c) => c.isApprovedDefault && (!trackId || c.trackId === trackId));
  list.sort((a, b) => (b.isPrimaryApproved ? 1 : 0) - (a.isPrimaryApproved ? 1 : 0));
  return JSON.parse(JSON.stringify(list));
}

export async function setPrimaryApprovedChart(trackId: string, chartId: string): Promise<boolean> {
  await initDatabase();
  let found = false;
  chartsStore.forEach((c) => {
    if (c.trackId === trackId && c.isApprovedDefault) {
      if (c.id === chartId) {
        c.isPrimaryApproved = true;
        c.updatedAt = new Date().toISOString();
        found = true;
      } else {
        c.isPrimaryApproved = false;
      }
    }
  });
  return found;
}

export async function createChart(data: {
  userId: string;
  trackId: string;
  title: string;
  semesters?: ChartSemester[];
  isApprovedDefault?: boolean;
  isPrimaryApproved?: boolean;
}): Promise<StudentChart> {
  await initDatabase();
  const id = `chart_${crypto.randomUUID().slice(0, 8)}`;

  // Default 8 empty semesters if not provided
  const defaultSemesters: ChartSemester[] = Array.from({ length: 8 }, (_, i) => ({
    semesterNumber: i + 1,
    courseIds: [],
  }));

  const existingApprovedForTrack = chartsStore.some(
    (c) => c.trackId === data.trackId && c.isApprovedDefault
  );
  const isPrimary = data.isApprovedDefault
    ? data.isPrimaryApproved ?? !existingApprovedForTrack
    : false;

  if (isPrimary && data.isApprovedDefault) {
    chartsStore.forEach((c) => {
      if (c.trackId === data.trackId && c.isApprovedDefault) {
        c.isPrimaryApproved = false;
      }
    });
  }

  const newChart: StudentChart = {
    id,
    userId: data.userId,
    trackId: data.trackId,
    title: data.title.trim() || "چارت تحصیلی من",
    isApprovedDefault: data.isApprovedDefault || false,
    isPrimaryApproved: isPrimary,
    semesters: data.semesters && data.semesters.length > 0 ? data.semesters : defaultSemesters,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  chartsStore.push(newChart);
  return newChart;
}

export async function updateChart(
  id: string,
  data: Partial<StudentChart>
): Promise<StudentChart | null> {
  await initDatabase();
  const chart = chartsStore.find((c) => c.id === id);
  if (!chart) return null;

  if (data.title !== undefined) chart.title = data.title;
  if (data.trackId !== undefined) chart.trackId = data.trackId;
  if (data.semesters !== undefined) chart.semesters = data.semesters;
  if (data.isApprovedDefault !== undefined) chart.isApprovedDefault = data.isApprovedDefault;

  if (data.isPrimaryApproved && chart.isApprovedDefault) {
    chartsStore.forEach((c) => {
      if (c.trackId === chart.trackId && c.isApprovedDefault) {
        c.isPrimaryApproved = c.id === id;
      }
    });
  } else if (data.isPrimaryApproved !== undefined) {
    chart.isPrimaryApproved = data.isPrimaryApproved;
  }

  chart.updatedAt = new Date().toISOString();

  return JSON.parse(JSON.stringify(chart));
}

export async function deleteChart(id: string, userId?: string): Promise<boolean> {
  await initDatabase();
  const idx = chartsStore.findIndex((c) => {
    if (c.id !== id) return false;
    if (userId && c.userId !== userId && !c.isApprovedDefault) return false;
    return true;
  });

  if (idx === -1) return false;
  chartsStore.splice(idx, 1);
  return true;
}


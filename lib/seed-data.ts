import type {
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
} from "./types";

/**
 * UT-ECE Default Demo Seed Data
 * (دانشکده مهندسی برق و کامپیوتر دانشگاه تهران - مهندسی کامپیوتر)
 */
export function getUTECEDemoSeed() {
  // 1. Faculty
  const facultyId = "fac_ut_ece";
  const faculties: Faculty[] = [
    {
      id: facultyId,
      name: "دانشکده مهندسی برق و کامپیوتر (دانشکده فنی)",
      code: "ECE",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  // 2. Major
  const majorId = "maj_ce";
  const majors: Major[] = [
    {
      id: majorId,
      facultyId: facultyId,
      name: "مهندسی کامپیوتر",
      code: "CE",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  // 3. Track ID
  const trackId = "trk_ce_se";

  // 4. Visual Categories (Flat, colored)
  const catGeneral = "vcat_general";
  const catBasic = "vcat_basic";
  const catCore = "vcat_core";
  const catSpec = "vcat_spec";
  const catElective = "vcat_elective";

  const visualCategories: VisualCategory[] = [
    { id: catGeneral, trackId, name: "دروس عمومی", color: "#64748b", sortOrder: 1, createdAt: new Date().toISOString() },
    { id: catBasic, trackId, name: "علوم پایه", color: "#0ea5e9", sortOrder: 2, createdAt: new Date().toISOString() },
    { id: catCore, trackId, name: "دروس اصلی", color: "#3b82f6", sortOrder: 3, createdAt: new Date().toISOString() },
    { id: catSpec, trackId, name: "دروس تخصصی", color: "#8b5cf6", sortOrder: 4, createdAt: new Date().toISOString() },
    { id: catElective, trackId, name: "دروس اختیاری", color: "#10b981", sortOrder: 5, createdAt: new Date().toISOString() },
  ];

  // 5. Rule Categories (Tree)
  const rcatBasic = "rcat_basic";
  const rcatCore = "rcat_core";
  const rcatSpec = "rcat_spec";
  const rcatGeneral = "rcat_general";

  const ruleCategories: RuleCategory[] = [
    { id: rcatGeneral, trackId, name: "دروس عمومی", minCredits: 22, createdAt: new Date().toISOString() },
    { id: rcatBasic, trackId, name: "علوم پایه", minCredits: 20, createdAt: new Date().toISOString() },
    { id: rcatCore, trackId, name: "دروس اصلی", minCredits: 59, createdAt: new Date().toISOString() },
    { id: rcatSpec, trackId, name: "دروس تخصصی", minCredits: 21, createdAt: new Date().toISOString() },
  ];

  // 3. Tracks
  const tracks: Track[] = [
    {
      id: trackId,
      majorId: majorId,
      name: "نرم‌افزار و سیستم‌ها",
      code: "SE",
      rulesTree: {
        id: "root_rule_tree",
        type: "GROUP",
        operator: "AND",
        children: [
          { id: "r_basic", type: "MIN_CREDITS_IN_CATEGORY", ruleCategoryId: rcatBasic, minCredits: 20 },
          { id: "r_core", type: "MIN_CREDITS_IN_CATEGORY", ruleCategoryId: rcatCore, minCredits: 59 },
          { id: "r_spec", type: "MIN_CREDITS_IN_CATEGORY", ruleCategoryId: rcatSpec, minCredits: 21 },
          { id: "r_general", type: "MIN_CREDITS_IN_CATEGORY", ruleCategoryId: rcatGeneral, minCredits: 22 },
        ],
      },
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  // 6. Courses
  const rawCourses = [
    { id: "crs_math1", name: "ریاضی عمومی ۱", code: "MATH101", units: 3, offeredIn: "both", vcat: catBasic, rcat: rcatBasic },
    { id: "crs_math2", name: "ریاضی عمومی ۲", code: "MATH102", units: 3, offeredIn: "both", vcat: catBasic, rcat: rcatBasic },
    { id: "crs_diff", name: "معادلات دیفرانسیل", code: "MATH201", units: 3, offeredIn: "both", vcat: catBasic, rcat: rcatBasic },
    { id: "crs_phys1", name: "فیزیک ۱ (مکانیک)", code: "PHYS101", units: 3, offeredIn: "both", vcat: catBasic, rcat: rcatBasic },
    { id: "crs_phys2", name: "فیزیک ۲ (الکتریسیته)", code: "PHYS102", units: 3, offeredIn: "both", vcat: catBasic, rcat: rcatBasic },
    { id: "crs_prog", name: "مبانی برنامه‌نویسی", code: "CE101", units: 3, offeredIn: "fall", vcat: catCore, rcat: rcatCore },
    { id: "crs_discrete", name: "ساختمان‌های گسسته", code: "CE102", units: 3, offeredIn: "fall", vcat: catCore, rcat: rcatCore },
    { id: "crs_ap", name: "برنامه‌نویسی پیشرفته", code: "CE201", units: 3, offeredIn: "spring", vcat: catCore, rcat: rcatCore },
    { id: "crs_ds", name: "ساختمان داده‌ها و الگوریتم‌ها", code: "CE202", units: 3, offeredIn: "fall", vcat: catCore, rcat: rcatCore },
    { id: "crs_algo", name: "طراحی الگوریتم‌ها", code: "CE301", units: 3, offeredIn: "spring", vcat: catCore, rcat: rcatCore },
    { id: "crs_logic", name: "مدارهای منطقی", code: "CE203", units: 3, offeredIn: "both", vcat: catCore, rcat: rcatCore },
    { id: "crs_arch", name: "معماری کامپیوتر", code: "CE302", units: 3, offeredIn: "fall", vcat: catCore, rcat: rcatCore },
    { id: "crs_os", name: "سیستم‌های عامل", code: "CE303", units: 3, offeredIn: "both", vcat: catCore, rcat: rcatCore },
    { id: "crs_os_lab", name: "آزمایشگاه سیستم‌های عامل", code: "CE303L", units: 1, offeredIn: "both", vcat: catCore, rcat: rcatCore },
    { id: "crs_network", name: "شبکه‌های کامپیوتری", code: "CE304", units: 3, offeredIn: "spring", vcat: catCore, rcat: rcatCore },
    { id: "crs_db", name: "پایگاه داده‌ها", code: "CE305", units: 3, offeredIn: "fall", vcat: catSpec, rcat: rcatSpec },
    { id: "crs_se", name: "مهندسی نرم‌افزار", code: "CE401", units: 3, offeredIn: "spring", vcat: catSpec, rcat: rcatSpec },
    { id: "crs_ai", name: "هوش مصنوعی", code: "CE402", units: 3, offeredIn: "spring", vcat: catSpec, rcat: rcatSpec },
    { id: "crs_fa", name: "فارسی عمومی", code: "GEN101", units: 3, offeredIn: "both", vcat: catGeneral, rcat: rcatGeneral },
    { id: "crs_en", name: "زبان انگلیسی عمومی", code: "GEN102", units: 3, offeredIn: "both", vcat: catGeneral, rcat: rcatGeneral },
    { id: "crs_islam", name: "اندیشه اسلامی ۱", code: "GEN103", units: 2, offeredIn: "both", vcat: catGeneral, rcat: rcatGeneral },
    { id: "crs_pe1", name: "تربیت بدنی ۱", code: "GEN104", units: 1, offeredIn: "both", vcat: catGeneral, rcat: rcatGeneral },
  ];

  const courses: Course[] = rawCourses.map((c) => ({
    id: c.id,
    facultyId,
    name: c.name,
    code: c.code,
    units: c.units,
    offeredIn: c.offeredIn as "fall" | "spring" | "both",
    description: `سرفصل استاندارد وزارت علوم و دانشگاه تهران برای درس ${c.name}`,
    createdAt: new Date().toISOString(),
    deletedAt: null,
  }));

  const trackAssignments: TrackCourseAssignment[] = rawCourses.map((c) => ({
    id: `assign_${c.id}`,
    trackId,
    courseId: c.id,
    visualCategoryId: c.vcat,
    ruleCategoryId: c.rcat,
  }));

  // 7. Prerequisites & Corequisites
  const prerequisites: PrerequisiteRelation[] = [
    { id: "pr_1", courseId: "crs_math2", requiredCourseId: "crs_math1", type: "prerequisite" },
    { id: "pr_2", courseId: "crs_diff", requiredCourseId: "crs_math2", type: "prerequisite" },
    { id: "pr_3", courseId: "crs_phys1", requiredCourseId: "crs_math1", type: "corequisite" },
    { id: "pr_4", courseId: "crs_phys2", requiredCourseId: "crs_phys1", type: "prerequisite" },
    { id: "pr_5", courseId: "crs_discrete", requiredCourseId: "crs_prog", type: "corequisite" },
    { id: "pr_6", courseId: "crs_ap", requiredCourseId: "crs_prog", type: "prerequisite" },
    { id: "pr_7", courseId: "crs_ds", requiredCourseId: "crs_ap", type: "prerequisite" },
    { id: "pr_8", courseId: "crs_ds", requiredCourseId: "crs_discrete", type: "prerequisite" },
    { id: "pr_9", courseId: "crs_algo", requiredCourseId: "crs_ds", type: "prerequisite" },
    { id: "pr_10", courseId: "crs_logic", requiredCourseId: "crs_prog", type: "prerequisite" },
    { id: "pr_11", courseId: "crs_arch", requiredCourseId: "crs_logic", type: "prerequisite" },
    { id: "pr_12", courseId: "crs_os", requiredCourseId: "crs_ds", type: "prerequisite" },
    { id: "pr_13", courseId: "crs_os", requiredCourseId: "crs_arch", type: "prerequisite" },
    { id: "pr_14", courseId: "crs_os_lab", requiredCourseId: "crs_os", type: "corequisite" },
    { id: "pr_15", courseId: "crs_network", requiredCourseId: "crs_os", type: "prerequisite" },
    { id: "pr_16", courseId: "crs_db", requiredCourseId: "crs_ds", type: "prerequisite" },
    { id: "pr_17", courseId: "crs_se", requiredCourseId: "crs_db", type: "prerequisite" },
    { id: "pr_18", courseId: "crs_ai", requiredCourseId: "crs_algo", type: "prerequisite" },
  ];

  // 8. Professors
  const professors: Professor[] = [
    { id: "prf_1", facultyId, name: "دکتر رامشفر", title: "استاد تمام", email: "rameshfar@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "prf_2", facultyId, name: "دکتر خسروی", title: "دانشیار", email: "khosravi@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "prf_3", facultyId, name: "دکتر صدیقی", title: "استادیار", email: "sedighi@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "prf_4", facultyId, name: "دکتر موحدی", title: "استادیار", email: "movahedi@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
  ];

  // 9. Course Offerings
  const offerings: CourseOffering[] = [
    { id: "off_ds_rameshfar", courseId: "crs_ds", professorId: "prf_1", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_ap_khosravi", courseId: "crs_ap", professorId: "prf_2", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_algo_sedighi", courseId: "crs_algo", professorId: "prf_3", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "off_db_movahedi", courseId: "crs_db", professorId: "prf_4", createdAt: new Date().toISOString(), deletedAt: null },
  ];

  // 10. Course Events & Slots
  const events: CourseEvent[] = [
    {
      id: "evt_ds_1",
      offeringId: "off_ds_rameshfar",
      term: "1403-1",
      groupCode: "01",
      capacity: 45,
      location: "دانشکده فنی - کلاس ۱۰۲",
      examDate: "1403/10/22",
      examStartTime: "08:30",
      examEndTime: "11:00",
      isUserCustom: false,
      userId: null,
      globalEventId: null,
      createdAt: new Date().toISOString(),
      slots: [
        { id: "slt_ds_1", eventId: "evt_ds_1", dayOfWeek: 0, startTime: "10:30", endTime: "12:00" },
        { id: "slt_ds_2", eventId: "evt_ds_1", dayOfWeek: 2, startTime: "10:30", endTime: "12:00" },
      ],
    },
    {
      id: "evt_ap_1",
      offeringId: "off_ap_khosravi",
      term: "1403-1",
      groupCode: "01",
      capacity: 50,
      location: "دانشکده فنی - کلاس ۲۰۴",
      examDate: "1403/10/25",
      examStartTime: "14:00",
      examEndTime: "16:30",
      isUserCustom: false,
      userId: null,
      globalEventId: null,
      createdAt: new Date().toISOString(),
      slots: [
        { id: "slt_ap_1", eventId: "evt_ap_1", dayOfWeek: 1, startTime: "08:00", endTime: "09:30" },
        { id: "slt_ap_2", eventId: "evt_ap_1", dayOfWeek: 3, startTime: "08:00", endTime: "09:30" },
      ],
    },
    {
      id: "evt_algo_1",
      offeringId: "off_algo_sedighi",
      term: "1403-1",
      groupCode: "01",
      capacity: 40,
      location: "دانشکده فنی - تالار ۱",
      examDate: "1403/10/28",
      examStartTime: "09:00",
      examEndTime: "11:30",
      isUserCustom: false,
      userId: null,
      globalEventId: null,
      createdAt: new Date().toISOString(),
      slots: [
        { id: "slt_algo_1", eventId: "evt_algo_1", dayOfWeek: 0, startTime: "13:30", endTime: "15:00" },
        { id: "slt_algo_2", eventId: "evt_algo_1", dayOfWeek: 2, startTime: "13:30", endTime: "15:00" },
      ],
    },
    {
      id: "evt_db_1",
      offeringId: "off_db_movahedi",
      term: "1403-1",
      groupCode: "01",
      capacity: 45,
      location: "دانشکده فنی - کلاس ۱۰۵",
      examDate: "1403/11/02",
      examStartTime: "08:30",
      examEndTime: "11:00",
      isUserCustom: false,
      userId: null,
      globalEventId: null,
      createdAt: new Date().toISOString(),
      slots: [
        { id: "slt_db_1", eventId: "evt_db_1", dayOfWeek: 1, startTime: "10:30", endTime: "12:00" },
        { id: "slt_db_2", eventId: "evt_db_1", dayOfWeek: 3, startTime: "10:30", endTime: "12:00" },
      ],
    },
  ];

  return {
    faculties,
    majors,
    tracks,
    visualCategories,
    ruleCategories,
    courses,
    trackAssignments,
    prerequisites,
    professors,
    offerings,
    events,
  };
}

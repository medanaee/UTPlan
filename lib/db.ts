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

let isInitialized = false;

export async function initDatabase() {
  if (isInitialized) return;

  const adminHash = await hashPassword("admin123");
  const userHash = await hashPassword("user123");

  // Default Users
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
      id: "usr_demo_student",
      name: "دانشجوی کامپیوتر",
      email: "user@example.com",
      role: "user",
      passwordHash: userHash,
      createdAt: new Date().toISOString(),
    },
  ];

  // Auto seed UT-ECE Demo Data
  await seedUTECEDemoData();
  isInitialized = true;
}

/**
 * Seed realistic UT-ECE data (دانشکده برق و کامپیوتر - مهندسی کامپیوتر)
 */
export async function seedUTECEDemoData() {
  // 1. Faculty
  const facultyId = "fac_ut_ece";
  facultiesStore = [
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
  majorsStore = [
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

  visualCategoriesStore = [
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

  ruleCategoriesStore = [
    { id: rcatGeneral, trackId, name: "دروس عمومی", minCredits: 22, createdAt: new Date().toISOString() },
    { id: rcatBasic, trackId, name: "علوم پایه", minCredits: 20, createdAt: new Date().toISOString() },
    { id: rcatCore, trackId, name: "دروس اصلی", minCredits: 59, createdAt: new Date().toISOString() },
    { id: rcatSpec, trackId, name: "دروس تخصصی", minCredits: 21, createdAt: new Date().toISOString() },
  ];

  // 3. Tracks
  tracksStore = [
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

  coursesStore = rawCourses.map((c) => ({
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

  trackAssignmentsStore = rawCourses.map((c) => ({
    id: `assign_${c.id}`,
    trackId,
    courseId: c.id,
    visualCategoryId: c.vcat,
    ruleCategoryId: c.rcat,
  }));

  // 7. Prerequisites & Corequisites
  prerequisitesStore = [
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
  professorsStore = [
    { id: "prf_1", facultyId, name: "دکتر رامشفر", title: "استاد تمام", email: "rameshfar@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "prf_2", facultyId, name: "دکتر خسروی", title: "دانشیار", email: "khosravi@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "prf_3", facultyId, name: "دکتر صدیقی", title: "استادیار", email: "sedighi@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
    { id: "prf_4", facultyId, name: "دکتر موحدی", title: "استادیار", email: "movahedi@ut.ac.ir", createdAt: new Date().toISOString(), deletedAt: null },
  ];

  // 9. Course Offerings
  offeringsStore = [
    {
      id: "off_ds_1",
      courseId: "crs_ds",
      professorId: "prf_1",
      groupCode: "01",
      capacity: 45,
      term: "1403-1",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "off_ap_1",
      courseId: "crs_ap",
      professorId: "prf_2",
      groupCode: "01",
      capacity: 50,
      term: "1403-1",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "off_algo_1",
      courseId: "crs_algo",
      professorId: "prf_3",
      groupCode: "01",
      capacity: 40,
      term: "1403-1",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
    {
      id: "off_db_1",
      courseId: "crs_db",
      professorId: "prf_4",
      groupCode: "01",
      capacity: 45,
      term: "1403-1",
      createdAt: new Date().toISOString(),
      deletedAt: null,
    },
  ];

  // 10. Course Events & Slots
  eventsStore = [
    {
      id: "evt_ds_1",
      offeringId: "off_ds_1",
      term: "1403-1",
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
      offeringId: "off_ap_1",
      term: "1403-1",
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
      offeringId: "off_algo_1",
      term: "1403-1",
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
      offeringId: "off_db_1",
      term: "1403-1",
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

  return { success: true, message: "داده‌های نمونه دانشکده فنی دانشگاه تهران با موفقیت بارگذاری شدند." };
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

// ----------------------------------------------------
// FACULTIES CRUD
// ----------------------------------------------------
export async function getFaculties(): Promise<Faculty[]> {
  await initDatabase();
  return facultiesStore.filter((f) => !f.deletedAt);
}

export async function createFaculty(name: string, code: string): Promise<Faculty> {
  await initDatabase();
  const newFaculty: Faculty = {
    id: `fac_${crypto.randomUUID().slice(0, 8)}`,
    name,
    code: code.toUpperCase(),
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  facultiesStore.push(newFaculty);
  return newFaculty;
}

export async function deleteFaculty(id: string): Promise<boolean> {
  await initDatabase();
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
  return majorsStore.filter((m) => !m.deletedAt && (!facultyId || m.facultyId === facultyId));
}

export async function createMajor(facultyId: string, name: string, code: string): Promise<Major> {
  await initDatabase();
  const newMajor: Major = {
    id: `maj_${crypto.randomUUID().slice(0, 8)}`,
    facultyId,
    name,
    code: code.toUpperCase(),
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  majorsStore.push(newMajor);
  return newMajor;
}

export async function deleteMajor(id: string): Promise<boolean> {
  await initDatabase();
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
  return tracksStore.filter((t) => !t.deletedAt && (!majorId || t.majorId === majorId));
}

export async function createTrack(majorId: string, name: string, code: string, rulesTree?: any): Promise<Track> {
  await initDatabase();
  const newTrack: Track = {
    id: `trk_${crypto.randomUUID().slice(0, 8)}`,
    majorId,
    name,
    code: code.toUpperCase(),
    rulesTree: rulesTree || { type: "AND", children: [] },
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
  tracksStore.push(newTrack);
  return newTrack;
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

export async function deleteProfessor(id: string): Promise<boolean> {
  await initDatabase();
  const p = professorsStore.find((item) => item.id === id);
  if (!p) return false;
  p.deletedAt = new Date().toISOString();
  return true;
}

// ----------------------------------------------------
// COURSE OFFERINGS CRUD
// ----------------------------------------------------
export async function getOfferings(filter?: {
  courseId?: string;
  professorId?: string;
  term?: string;
}): Promise<CourseOffering[]> {
  await initDatabase();
  let list = offeringsStore.filter((o) => !o.deletedAt);

  if (filter?.courseId) {
    list = list.filter((o) => o.courseId === filter.courseId);
  }
  if (filter?.professorId) {
    list = list.filter((o) => o.professorId === filter.professorId);
  }
  if (filter?.term) {
    list = list.filter((o) => o.term === filter.term);
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
    };
  });
}

export async function createOffering(data: {
  courseId: string;
  professorId: string;
  groupCode?: string;
  capacity?: number;
  term?: string;
}): Promise<CourseOffering> {
  await initDatabase();
  const newOffering: CourseOffering = {
    id: `off_${crypto.randomUUID().slice(0, 8)}`,
    courseId: data.courseId,
    professorId: data.professorId,
    groupCode: data.groupCode || "01",
    capacity: data.capacity || 40,
    term: data.term || "1403-1",
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
  };
}

export async function updateOffering(
  id: string,
  data: Partial<CourseOffering>
): Promise<CourseOffering | null> {
  await initDatabase();
  const off = offeringsStore.find((o) => o.id === id && !o.deletedAt);
  if (!off) return null;

  if (data.courseId) off.courseId = data.courseId;
  if (data.professorId) off.professorId = data.professorId;
  if (data.groupCode !== undefined) off.groupCode = data.groupCode;
  if (data.capacity !== undefined) off.capacity = data.capacity;
  if (data.term !== undefined) off.term = data.term;

  const course = coursesStore.find((c) => c.id === off.courseId);
  const prof = professorsStore.find((p) => p.id === off.professorId);
  return {
    ...off,
    courseName: course?.name || "",
    courseCode: course?.code || "",
    courseUnits: course?.units || 3,
    professorName: prof?.name || "",
    professorTitle: prof?.title || "",
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
// COURSE EVENTS & SLOTS CRUD
// ----------------------------------------------------
export async function getEvents(filter?: {
  offeringId?: string;
  term?: string;
  userId?: string | null;
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

  return list.map((evt) => {
    const offering = offeringsStore.find((o) => o.id === evt.offeringId);
    const course = offering ? coursesStore.find((c) => c.id === offering.courseId) : null;
    const prof = offering ? professorsStore.find((p) => p.id === offering.professorId) : null;
    return {
      ...evt,
      courseName: course?.name,
      courseCode: course?.code,
      professorName: prof?.name,
      groupCode: offering?.groupCode,
    };
  });
}

export async function createEvent(data: {
  offeringId: string;
  term?: string;
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
    professorName: prof?.name,
    groupCode: offering?.groupCode,
  };
}

export async function updateEvent(
  id: string,
  data: Partial<CourseEvent> & { slots?: { dayOfWeek: number; startTime: string; endTime: string }[] }
): Promise<CourseEvent | null> {
  await initDatabase();
  const evt = eventsStore.find((e) => e.id === id);
  if (!evt) return null;

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
    professorName: prof?.name,
    groupCode: offering?.groupCode,
  };
}

export async function deleteEvent(id: string): Promise<boolean> {
  await initDatabase();
  const idx = eventsStore.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  eventsStore.splice(idx, 1);
  return true;
}

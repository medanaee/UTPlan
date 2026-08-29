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

import { getUTECEDemoSeed } from "./seed-data";

/**
 * Seed realistic UT-ECE data (دانشکده برق و کامپیوتر - مهندسی کامپیوتر)
 */
export async function seedUTECEDemoData() {
  const seed = getUTECEDemoSeed();

  facultiesStore = seed.faculties;
  majorsStore = seed.majors;
  tracksStore = seed.tracks;
  visualCategoriesStore = seed.visualCategories;
  ruleCategoriesStore = seed.ruleCategories;
  coursesStore = seed.courses;
  trackAssignmentsStore = seed.trackAssignments;
  prerequisitesStore = seed.prerequisites;
  professorsStore = seed.professors;
  offeringsStore = seed.offerings;
  eventsStore = seed.events;
  chartsStore = seed.charts || [];

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
}): Promise<CourseOffering[]> {
  await initDatabase();
  let list = offeringsStore.filter((o) => !o.deletedAt);

  if (filter?.courseId) {
    list = list.filter((o) => o.courseId === filter.courseId);
  }
  if (filter?.professorId) {
    list = list.filter((o) => o.professorId === filter.professorId);
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


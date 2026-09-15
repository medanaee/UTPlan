export type UserRole = "super_admin" | "admin" | "user";

export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string; // e.g. "fall_1402" or "spring_1403"
  avatarUrl?: string;
  createdAt: string;
}

export interface UserSession {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  role: UserRole;
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
  avatarUrl?: string;
}

export interface Faculty {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  deletedAt?: string | null;
  linkedFacultyIds?: string[];
}

export interface FacultyLink {
  id: string;
  targetFacultyId: string;
  sourceFacultyId: string;
  sourceFacultyName?: string;
  sourceFacultyCode?: string;
  createdAt: string;
}

export interface Major {
  id: string;
  facultyId: string;
  name: string;
  code: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Track {
  id: string;
  majorId: string;
  name: string;
  code: string;
  rulesTree?: RuleGroupNode; // JSON AST of degree completion rules
  createdAt: string;
  deletedAt?: string | null;
}

export interface VisualCategory {
  id: string;
  trackId: string;
  code?: string;
  parentId?: string | null; // For hierarchical tree
  name: string;
  color: string; // e.g. "#3b82f6", "#10b981", "#f59e0b"
  sortOrder: number;
  createdAt: string;
  children?: VisualCategory[];
}

export interface RuleCategory {
  id: string;
  trackId: string;
  code?: string;
  parentId?: string | null; // For hierarchical folder tree
  name: string;
  createdAt: string;
}

export type CourseTermOffering = "fall" | "spring" | "both" | "none";
export type DegreeLevel = "undergraduate" | "master";

export interface Course {
  id: string;
  facultyId: string;
  facultyName?: string;
  name: string;
  code: string;
  degreeLevel?: DegreeLevel;
  abbreviation?: string;
  units: number;
  offeredIn: CourseTermOffering;
  description?: string;
  createdAt: string;
  deletedAt?: string | null;
  // Computed / Joined fields
  prerequisites?: PrerequisiteRelation[];
  dependentCourses?: {
    id: string;
    courseId: string;
    courseName: string;
    courseCode: string;
    type: PrerequisiteType;
  }[];
  offerings?: CourseOffering[];
  trackAssignments?: TrackCourseAssignment[];
}

export type PrerequisiteType = "prerequisite" | "corequisite" | "recommended";

export interface PrerequisiteRelation {
  id: string;
  courseId: string;
  requiredCourseId: string;
  type: PrerequisiteType;
  requiredCourseName?: string;
  requiredCourseCode?: string;
}

export interface TrackCourseAssignment {
  id: string;
  trackId: string;
  courseId: string;
  visualCategoryId?: string | null;
  ruleCategoryId?: string | null;
  // Joined fields
  courseName?: string;
  courseCode?: string;
  units?: number;
}

export interface ProfessorLinks {
  website?: string;
  scholar?: string;
  [key: string]: string | undefined;
}

export interface Professor {
  id: string;
  facultyId: string;
  code?: string;
  facultyName?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  avatarUrl?: string;
  title?: string; // e.g. استاد تمام، دانشیار، استادیار
  email?: string;
  links?: ProfessorLinks;
  createdAt: string;
  deletedAt?: string | null;
  // Joined / Computed
  offerings?: CourseOffering[];
  reviewsCount?: number;
  averageRating?: number;
}

export interface OfferingProfessorInfo {
  id: string;
  name: string;
  code?: string;
  title?: string;
  avatarUrl?: string;
  email?: string;
  isPrimary?: boolean;
}

export type OfferingResourceType = "video" | "slide" | "archive";

export interface OfferingResource {
  id: string;
  offeringId: string;
  title: string;
  term?: string; // e.g. "1404-2"
  type: OfferingResourceType;
  url: string;
  createdAt: string;
}

export interface CourseOffering {
  id: string;
  code?: string;
  courseId: string;
  description?: string;
  finalizedSemesters?: string[];
  professorId?: string;
  professorIds?: string[];
  professors?: OfferingProfessorInfo[];
  resources?: OfferingResource[];
  createdAt: string;
  deletedAt?: string | null;
  // Joined
  courseName?: string;
  courseCode?: string;
  courseAbbreviation?: string;
  courseUnits?: number;
  courseDescription?: string;
  facultyId?: string;
  facultyName?: string;
  professorName?: string;
  professorTitle?: string;
  professorAvatarUrl?: string;
  professorEmail?: string;
  events?: CourseEvent[];
  reviewsCount?: number;
  averageRating?: number;
}

export interface ReviewCriteria {
  teaching?: number; // تدریس (1-10)
  grading?: number; // نمره‌دهی (1-10)
  content?: number; // کیفیت محتوا / منابع (1-10)
  difficulty?: number; // سطح دشواری / فشار درسی (1-10)
  behavior?: number; // اخلاق و پاسخگویی (1-10)
  mastery?: number; // تسلط علمی (1-10)
}

export interface ReviewItem {
  id: string;
  userId?: string | null;
  authorName?: string;
  targetType: "professor" | "offering";
  targetId: string;
  isAnonymous: boolean;
  comment: string;
  overallRating: number; // 1-10
  criteriaRatings?: ReviewCriteria;
  studentGrade?: number | null; // e.g. 18.5 out of 20
  createdAt: string;
}

export interface CourseEvent {
  id: string;
  code?: string; // e.g. "EVT-101"
  offeringId: string;
  term: string; // e.g. "1403-1"
  groupCode?: string; // e.g. "01" (legacy fallback)
  capacity?: number; // e.g. 40
  location?: string; // e.g. "دانشکده فنی - کلاس ۱۰۲"
  examDate?: string; // e.g. "1403/10/22"
  examStartTime?: string; // "08:30"
  examEndTime?: string; // "11:00"
  isUserCustom?: boolean;
  userId?: string | null;
  globalEventId?: string | null;
  createdAt: string;
  deletedAt?: string | null;
  // Joined
  courseId?: string;
  courseCode?: string;
  courseName?: string;
  courseUnits?: number;
  facultyId?: string;
  facultyName?: string;
  professorId?: string;
  professorName?: string;
  professorTitle?: string;
  isOfferingDeleted?: boolean;
  // Slots
  slots?: CourseEventSlot[];
}

export interface CourseEventSlot {
  id: string;
  eventId: string;
  dayOfWeek: number; // 0: Sat, 1: Sun, 2: Mon, 3: Tue, 4: Wed
  startTime: string; // "10:30"
  endTime: string; // "12:00"
}

export interface Review {
  id: string;
  userId?: string | null;
  targetType: "professor" | "offering";
  targetId: string;
  isAnonymous: boolean;
  comment: string;
  authorName?: string;
  overallRating: number; // 1-10
  criteriaRatings?: Record<string, number>; // e.g. { teaching: 8, grading: 7, workload: 6 }
  studentGrade?: number | null; // e.g. 18.5 out of 20
  createdAt: string;
  deletedAt?: string | null;
}

// ----------------------------------------------------
// RULE ENGINE & AST TYPES
// ----------------------------------------------------
export type RuleNodeType =
  | "GROUP"
  | "MIN_CREDITS_IN_CATEGORY"
  | "MAX_CREDITS_IN_CATEGORY"
  | "ALL_COURSES_IN_CATEGORY"
  | "EXACT_N_COURSES_IN_CATEGORY"
  | "MIN_TOTAL_CREDITS_BEFORE_COURSE"
  | "MANDATORY_COURSES"
  | "FORBIDDEN_CATEGORY"
  | "FORBIDDEN_ALL_COURSES_IN_CATEGORY"
  | "FORBIDDEN_COURSE"
  | "FORBIDDEN_COURSES";

export interface RuleGroupNode {
  id: string;
  type: "GROUP";
  operator: "AND" | "OR";
  children: RuleNode[];
  description?: string;
}

export interface RuleLeafNode {
  id: string;
  type: Exclude<RuleNodeType, "GROUP">;
  ruleCategoryId?: string;
  minCredits?: number;
  maxCredits?: number;
  exactCount?: number;
  targetCourseId?: string;
  requiredCreditsBefore?: number;
  mandatoryCourseIds?: string[];
  forbiddenCourseIds?: string[];
  description?: string;
}

export type RuleNode = RuleGroupNode | RuleLeafNode;

export interface ValidationIssue {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  termIndex?: number;
  courseId?: string;
  requiredCourseId?: string;
  ruleNodeId?: string;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  requiredCredits?: number;
  maxCredits?: number;
  earnedCredits: number;
  totalCoursesPassed: number;
  isSatisfied: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  isGraduationSatisfied: boolean;
  issues: ValidationIssue[];
  categoryStats: CategoryStat[];
  totalCredits: number;
  termCredits: { termIndex: number; credits: number; isWithinLimits: boolean }[];
}

export interface ChartSemester {
  semesterNumber: number;
  courseIds: string[];
  courseEventsMap?: Record<string, string>; // courseId -> selectedEventId
}

export interface StudentChart {
  id: string;
  userId: string;
  trackId: string;
  title: string;
  isApprovedDefault?: boolean;
  semesters: ChartSemester[];
  waivedCourseIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: UserSession;
}


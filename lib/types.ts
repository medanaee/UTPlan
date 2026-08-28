export type UserRole = "super_admin" | "admin" | "user";

export interface User {
  id: string;
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
  name: string;
  email: string;
  role: UserRole;
  facultyId?: string;
  majorId?: string;
  trackId?: string;
  entrySemester?: string;
}

export interface Faculty {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  deletedAt?: string | null;
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
  name: string;
  color: string; // e.g. "#3b82f6", "#10b981", "#f59e0b"
  sortOrder: number;
  createdAt: string;
}

export interface RuleCategory {
  id: string;
  trackId: string;
  parentId?: string | null; // For hierarchical folder tree
  name: string;
  minCredits?: number;
  createdAt: string;
}

export type CourseTermOffering = "fall" | "spring" | "both";

export interface Course {
  id: string;
  facultyId: string;
  name: string;
  code: string;
  units: number;
  offeredIn: CourseTermOffering;
  description?: string;
  createdAt: string;
  deletedAt?: string | null;
  // Computed / Joined fields
  prerequisites?: PrerequisiteRelation[];
  trackAssignments?: TrackCourseAssignment[];
}

export type PrerequisiteType = "prerequisite" | "corequisite";

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

export interface Professor {
  id: string;
  facultyId: string;
  name: string;
  avatarUrl?: string;
  title?: string; // e.g. استاد تمام، دانشیار، استادیار
  email?: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface CourseOffering {
  id: string;
  courseId: string;
  professorId: string;
  createdAt: string;
  deletedAt?: string | null;
  // Joined
  courseName?: string;
  courseCode?: string;
  courseUnits?: number;
  professorName?: string;
  professorTitle?: string;
  professorAvatarUrl?: string;
}

export interface CourseEvent {
  id: string;
  offeringId: string;
  term: string; // e.g. "1403-1"
  groupCode?: string; // e.g. "01", "02"
  capacity?: number; // e.g. 40
  location?: string; // e.g. "دانشکده فنی - کلاس ۱۰۲"
  examDate?: string; // e.g. "1403/10/22"
  examStartTime?: string; // "08:30"
  examEndTime?: string; // "11:00"
  isUserCustom?: boolean;
  userId?: string | null;
  globalEventId?: string | null;
  createdAt: string;
  // Joined
  courseName?: string;
  courseCode?: string;
  courseUnits?: number;
  professorName?: string;
  professorTitle?: string;
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
  createdAt: string;
  deletedAt?: string | null;
}

// ----------------------------------------------------
// RULE ENGINE & AST TYPES
// ----------------------------------------------------
export type RuleNodeType =
  | "GROUP"
  | "MIN_CREDITS_IN_CATEGORY"
  | "ALL_COURSES_IN_CATEGORY"
  | "EXACT_N_COURSES_IN_CATEGORY"
  | "MIN_TOTAL_CREDITS_BEFORE_COURSE"
  | "MANDATORY_COURSES";

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
  exactCount?: number;
  targetCourseId?: string;
  requiredCreditsBefore?: number;
  mandatoryCourseIds?: string[];
  description?: string;
}

export type RuleNode = RuleGroupNode | RuleLeafNode;

export interface ValidationIssue {
  id: string;
  type: "error" | "warning" | "info";
  message: string;
  termIndex?: number;
  courseId?: string;
  ruleNodeId?: string;
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  requiredCredits?: number;
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

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: UserSession;
}

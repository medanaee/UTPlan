import type {
  RuleNode,
  RuleGroupNode,
  RuleLeafNode,
  Category,
  RuleCategory,
  Course,
  PrerequisiteRelation,
  TrackCourseAssignment,
  ValidationResult,
  ValidationIssue,
  CategoryStat,
} from "./types";

export interface ChartCourseEntry {
  courseId: string;
  termIndex: number;
}

export interface ValidationEngineInput {
  trackId?: string;
  chartCourses: ChartCourseEntry[];
  rulesTree?: RuleGroupNode | null;
  categories?: Category[];
  ruleCategories?: Category[];
  trackAssignments: TrackCourseAssignment[];
  allCourses: Course[];
  prerequisites: PrerequisiteRelation[];
  constraints?: {
    minCreditsPerTerm?: number; // default 12
    maxCreditsPerTerm?: number; // default 20
    maxTerms?: number;          // default 12
  };
  waivedCourseIds?: string[];
  startTerm?: number;
  totalTerms?: number;
}

/**
 * Helper to collect a category ID and all its recursive subcategory IDs
 */
export function getCategoryAndDescendantIds(targetCatId: string, allCategories: Category[]): Set<string> {
  const result = new Set<string>([targetCatId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of allCategories) {
      if (c.parentId && result.has(c.parentId) && !result.has(c.id)) {
        result.add(c.id);
        added = true;
      }
    }
  }
  return result;
}

export interface CategoryMatcher {
  name: string;
  isMatch: (assignedCatId: string | undefined | null) => boolean;
  targetCatIds?: Set<string>;
}

/**
 * Resolves course matching logic and display name for category rules.
 * Supports:
 * - Standard category IDs (matches category and all descendants)
 * - Virtual root uncategorized "__UNCATEGORIZED__" (matches courses with no category)
 * - Virtual folder remaining "__REMAINING__:<parentId>" (matches only courses directly in parent category)
 */
export function resolveCategoryMatcher(
  leafCatId: string | undefined | null,
  allCategories: Category[]
): CategoryMatcher {
  const safeCatId = leafCatId || "";

  if (safeCatId === "__UNCATEGORIZED__") {
    const knownCatIds = new Set(allCategories.map((c) => c.id));
    return {
      name: "دروس بدون دسته‌بندی",
      isMatch: (assignedCatId) => !assignedCatId || !knownCatIds.has(assignedCatId),
    };
  }

  if (safeCatId.startsWith("__REMAINING__:")) {
    const parentId = safeCatId.slice("__REMAINING__:".length);
    const parentCat = allCategories.find((c) => c.id === parentId);
    return {
      name: parentCat ? `${parentCat.name} (دروس مستقیم این پوشه)` : "دروس مستقیم این پوشه",
      isMatch: (assignedCatId) => assignedCatId === parentId,
      targetCatIds: new Set([parentId]),
    };
  }

  const cat = allCategories.find((c) => c.id === safeCatId);
  const targetCatIds = getCategoryAndDescendantIds(safeCatId, allCategories);
  return {
    name: cat ? cat.name : "دسته نامشخص",
    isMatch: (assignedCatId) => !!assignedCatId && targetCatIds.has(assignedCatId),
    targetCatIds,
  };
}

/**
 * Main Chart Validation Engine
 */
export function validateFullChart(input: ValidationEngineInput): ValidationResult {
  const {
    trackId: inputTrackId,
    chartCourses,
    rulesTree,
    categories: inputCategories,
    ruleCategories: inputRuleCategories,
    trackAssignments,
    allCourses,
    prerequisites,
    constraints = {},
    waivedCourseIds = [],
    startTerm = 1,
    totalTerms: inputTotalTerms,
  } = input;

  const ruleCategories = inputCategories || inputRuleCategories || [];

  const waivedSet = new Set<string>(waivedCourseIds);

  const minCredits = constraints.minCreditsPerTerm ?? 12;
  const maxCredits = constraints.maxCreditsPerTerm ?? 24;

  const issues: ValidationIssue[] = [];

  // Map for quick course lookup
  const courseMap = new Map<string, Course>();
  for (const c of allCourses) {
    courseMap.set(c.id, c);
  }

  // Set of valid category IDs for this track's rules
  const validCatIds = new Set(ruleCategories.map((c) => c.id));

  // Map courseId -> assigned categoryId (filtered for the active track)
  const courseToRuleCatMap = new Map<string, string>();
  for (const assign of trackAssignments) {
    if (inputTrackId && assign.trackId && assign.trackId !== inputTrackId) {
      continue;
    }
    const catId = assign.categoryId || assign.ruleCategoryId || assign.visualCategoryId;
    if (catId) {
      // Prioritize categories that belong to the current track's ruleCategories
      if (validCatIds.size === 0 || validCatIds.has(catId) || !courseToRuleCatMap.has(assign.courseId)) {
        courseToRuleCatMap.set(assign.courseId, catId);
      }
    }
  }

  // 1. Calculate Term Credits and Total Credits
  let totalCredits = 0;
  const termCreditsMap = new Map<number, number>();
  const activeTermIndices = new Set<number>();
  const countedCourseIds = new Set<string>();

  for (const entry of chartCourses) {
    const course = courseMap.get(entry.courseId);
    const units = course ? course.units : 3;
    if (!countedCourseIds.has(entry.courseId)) {
      countedCourseIds.add(entry.courseId);
      totalCredits += units;
    }

    const currentTermCredits = termCreditsMap.get(entry.termIndex) || 0;
    termCreditsMap.set(entry.termIndex, currentTermCredits + units);
    activeTermIndices.add(entry.termIndex);
  }

  for (const waivedId of waivedCourseIds) {
    if (!countedCourseIds.has(waivedId)) {
      countedCourseIds.add(waivedId);
      const course = courseMap.get(waivedId);
      totalCredits += course ? course.units : 3;
    }
  }

  const totalTerms = inputTotalTerms ?? (activeTermIndices.size > 0 ? Math.max(...Array.from(activeTermIndices)) : 1);

  // 2. Validate Term Credit Limits (Floor & Ceiling)
  const termCreditsList: { termIndex: number; credits: number; isWithinLimits: boolean }[] = [];

  for (let termIndex = startTerm; termIndex <= totalTerms; termIndex++) {
    const credits = termCreditsMap.get(termIndex) || 0;
    const isLastTerm = termIndex === totalTerms;
    let isWithin = true;

    // Floor check: all terms EXCEPT the last term must have at least minCredits (12)
    if (!isLastTerm && credits < minCredits) {
      isWithin = false;
      issues.push({
        id: `issue_term_floor_${termIndex}`,
        type: "warning",
        message: `تعداد واحدهای ترم ${termIndex} (${credits} واحد) کمتر از حداقل مجاز (${minCredits} واحد) است.`,
        termIndex,
      });
    }

    // Ceiling check
    if (credits > maxCredits) {
      isWithin = false;
      issues.push({
        id: `issue_term_ceiling_${termIndex}`,
        type: "warning",
        message: `تعداد واحدهای ترم ${termIndex} (${credits} واحد) بیشتر از سقف مجاز (${maxCredits} واحد) است.`,
        termIndex,
      });
    }

    termCreditsList.push({
      termIndex,
      credits,
      isWithinLimits: isWithin,
    });
  }

  termCreditsList.sort((a, b) => a.termIndex - b.termIndex);

  // 3. Validate Prerequisites and Corequisites
  const courseTermMap = new Map<string, number>();
  for (const entry of chartCourses) {
    courseTermMap.set(entry.courseId, entry.termIndex);
  }

  for (const entry of chartCourses) {
    const course = courseMap.get(entry.courseId);
    const courseName = course ? course.name : entry.courseId;
    const termC = entry.termIndex;

    // Find all prerequisites for this course
    const coursePrereqs = prerequisites.filter((p) => p.courseId === entry.courseId);

    for (const prereq of coursePrereqs) {
      // If the required course was specifically marked as passed/waived, skip this prereq
      if (waivedSet.has(prereq.requiredCourseId)) {
        continue;
      }

      const targetCourse = courseMap.get(prereq.requiredCourseId);
      const targetName = targetCourse ? targetCourse.name : prereq.requiredCourseId;
      const termP = courseTermMap.get(prereq.requiredCourseId);

      if (termP === undefined) {
        // Prerequisite is not in chart at all
        if (prereq.type === "recommended") {
          issues.push({
            id: `issue_rec_prereq_missing_${entry.courseId}_${prereq.requiredCourseId}`,
            type: "warning",
            message: `درس «${courseName}» دارای پیش‌نیاز پیشنهادی «${targetName}» است که در چارت قرار نگرفته است (اخذ آن اختیاری است اما پیشنهاد می‌شود).`,
            termIndex: termC,
            courseId: entry.courseId,
            requiredCourseId: prereq.requiredCourseId,
          });
        } else {
          issues.push({
            id: `issue_prereq_missing_${entry.courseId}_${prereq.requiredCourseId}`,
            type: "error",
            message: `درس «${courseName}» نیازمند ${prereq.type === "prerequisite" ? "پیش‌نیاز رسمی" : "هم‌نیاز رسمی"} «${targetName}» است که در چارت قرار نگرفته است.`,
            termIndex: termC,
            courseId: entry.courseId,
            requiredCourseId: prereq.requiredCourseId,
          });
        }
      } else {
        if (prereq.type === "prerequisite") {
          if (termP >= termC) {
            issues.push({
              id: `issue_prereq_order_${entry.courseId}_${prereq.requiredCourseId}`,
              type: "error",
              message: `درس «${targetName}» (ترم ${termP}) پیش‌نیاز رسمی «${courseName}» (ترم ${termC}) است و باید حتماً در ترم‌های قبل از آن گذرانده شود.`,
              termIndex: termC,
              courseId: entry.courseId,
              requiredCourseId: prereq.requiredCourseId,
            });
          }
        } else if (prereq.type === "corequisite") {
          if (termP > termC) {
            issues.push({
              id: `issue_coreq_order_${entry.courseId}_${prereq.requiredCourseId}`,
              type: "error",
              message: `درس «${targetName}» (ترم ${termP}) هم‌نیاز رسمی «${courseName}» (ترم ${termC}) است و باید همزمان یا در ترم‌های قبل از آن گذرانده شود.`,
              termIndex: termC,
              courseId: entry.courseId,
              requiredCourseId: prereq.requiredCourseId,
            });
          }
        } else if (prereq.type === "recommended") {
          if (termP >= termC) {
            issues.push({
              id: `issue_rec_prereq_order_${entry.courseId}_${prereq.requiredCourseId}`,
              type: "warning",
              message: `درس «${targetName}» (ترم ${termP}) پیش‌نیاز پیشنهادی و غیررسمی «${courseName}» (ترم ${termC}) است و توصیه می‌شود قبل از آن برداشته شود.`,
              termIndex: termC,
              courseId: entry.courseId,
              requiredCourseId: prereq.requiredCourseId,
            });
          }
        }
      }
    }
  }

  // 4. Validate Course Offering Semesters (Odd / Even / None)
  for (const entry of chartCourses) {
    const course = courseMap.get(entry.courseId);
    if (!course) continue;

    const courseName = course.name || entry.courseId;
    const isOddTerm = entry.termIndex % 2 !== 0; // 1, 3, 5, 7, ...
    const isEvenTerm = entry.termIndex % 2 === 0; // 2, 4, 6, 8, ...

    if (course.offeredIn === "none") {
      issues.push({
        id: `issue_offering_none_${entry.courseId}`,
        type: "error",
        message: `درس «${courseName}» غیرفعال بوده و در هیچ نیمسالی ارائه نمی‌شود؛ امکان اخذ آن در چارت وجود ندارد.`,
        termIndex: entry.termIndex,
        courseId: entry.courseId,
      });
    } else if (course.offeredIn === "fall" && isEvenTerm) {
      issues.push({
        id: `issue_offering_fall_in_even_${entry.courseId}`,
        type: "error",
        message: `درس «${courseName}» فقط در نیمسال‌های فرد (پاییز) ارائه می‌شود، اما در ترم ${entry.termIndex} (ترم زوج) قرار گرفته است.`,
        termIndex: entry.termIndex,
        courseId: entry.courseId,
      });
    } else if (course.offeredIn === "spring" && isOddTerm) {
      issues.push({
        id: `issue_offering_spring_in_odd_${entry.courseId}`,
        type: "error",
        message: `درس «${courseName}» فقط در نیمسال‌های زوج (بهار) ارائه می‌شود، اما در ترم ${entry.termIndex} (ترم فرد) قرار گرفته است.`,
        termIndex: entry.termIndex,
        courseId: entry.courseId,
      });
    }
  }

  // 5. Calculate Category Stats
  const categoryStats: CategoryStat[] = ruleCategories.map((rcat) => {
    const targetCatIds = getCategoryAndDescendantIds(rcat.id, ruleCategories);

    // Find all distinct courses assigned to this category (from chart and waived)
    const takenCourseIds = new Set<string>();
    for (const entry of chartCourses) {
      const assignedCatId = courseToRuleCatMap.get(entry.courseId);
      if (assignedCatId && targetCatIds.has(assignedCatId)) {
        takenCourseIds.add(entry.courseId);
      }
    }
    for (const waivedId of waivedCourseIds) {
      const assignedCatId = courseToRuleCatMap.get(waivedId);
      if (assignedCatId && targetCatIds.has(assignedCatId)) {
        takenCourseIds.add(waivedId);
      }
    }

    let earnedCredits = 0;
    for (const cId of takenCourseIds) {
      const c = courseMap.get(cId);
      earnedCredits += c ? c.units : 3;
    }

    // Extract requirement dynamically from rulesTree if defined
    let required = 0;
    let maxAllowed: number | undefined = undefined;
    if (rulesTree) {
      const findReq = (node: any) => {
        if (!node) return;
        const nodeCatId = node.categoryId || node.ruleCategoryId;
        if (node.type === "MIN_CREDITS_IN_CATEGORY" && nodeCatId === rcat.id) {
          required = node.minCredits || 0;
        }
        if (node.type === "MAX_CREDITS_IN_CATEGORY" && nodeCatId === rcat.id) {
          maxAllowed = node.maxCredits !== undefined ? node.maxCredits : node.minCredits;
        }
        if (
          (node.type === "FORBIDDEN_CATEGORY" || node.type === "FORBIDDEN_ALL_COURSES_IN_CATEGORY") &&
          nodeCatId
        ) {
          if (!nodeCatId.startsWith("__") && getCategoryAndDescendantIds(nodeCatId, ruleCategories).has(rcat.id)) {
            maxAllowed = 0;
          }
        }
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(findReq);
        }
      };
      findReq(rulesTree);
    }

    const minSatisfied = required === 0 || earnedCredits >= required;
    const maxSatisfied = maxAllowed === undefined || earnedCredits <= maxAllowed;
    const isSatisfied = minSatisfied && maxSatisfied;

    return {
      categoryId: rcat.id,
      categoryName: rcat.name,
      requiredCredits: required > 0 ? required : undefined,
      maxCredits: maxAllowed,
      earnedCredits,
      totalCoursesPassed: takenCourseIds.size,
      isSatisfied,
    };
  });

  // Also include stats for virtual categories if referenced in rulesTree
  if (rulesTree) {
    const virtualCatIds = new Set<string>();
    const findVirtualCats = (node: any) => {
      if (!node) return;
      const nodeCatId = node.categoryId || node.ruleCategoryId;
      if (nodeCatId && (nodeCatId === "__UNCATEGORIZED__" || nodeCatId.startsWith("__REMAINING__:"))) {
        virtualCatIds.add(nodeCatId);
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(findVirtualCats);
      }
    };
    findVirtualCats(rulesTree);

    for (const vId of virtualCatIds) {
      const matcher = resolveCategoryMatcher(vId, ruleCategories);
      const takenCourseIds = new Set<string>();
      for (const entry of chartCourses) {
        const assignedCatId = courseToRuleCatMap.get(entry.courseId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(entry.courseId);
        }
      }
      for (const waivedId of waivedCourseIds) {
        const assignedCatId = courseToRuleCatMap.get(waivedId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(waivedId);
        }
      }

      let earnedCredits = 0;
      for (const cId of takenCourseIds) {
        const c = courseMap.get(cId);
        earnedCredits += c ? c.units : 3;
      }

      let required = 0;
      let maxAllowed: number | undefined = undefined;
      const findReq = (node: any) => {
        if (!node) return;
        const nodeCatId = node.categoryId || node.ruleCategoryId;
        if (node.type === "MIN_CREDITS_IN_CATEGORY" && nodeCatId === vId) {
          required = node.minCredits || 0;
        }
        if (node.type === "MAX_CREDITS_IN_CATEGORY" && nodeCatId === vId) {
          maxAllowed = node.maxCredits !== undefined ? node.maxCredits : node.minCredits;
        }
        if (
          (node.type === "FORBIDDEN_CATEGORY" || node.type === "FORBIDDEN_ALL_COURSES_IN_CATEGORY") &&
          nodeCatId === vId
        ) {
          maxAllowed = 0;
        }
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(findReq);
        }
      };
      findReq(rulesTree);

      const minSatisfied = required === 0 || earnedCredits >= required;
      const maxSatisfied = maxAllowed === undefined || earnedCredits <= maxAllowed;
      const isSatisfied = minSatisfied && maxSatisfied;

      categoryStats.push({
        categoryId: vId,
        categoryName: matcher.name,
        requiredCredits: required > 0 ? required : undefined,
        maxCredits: maxAllowed,
        earnedCredits,
        totalCoursesPassed: takenCourseIds.size,
        isSatisfied,
      });
    }
  }

  // 6. Evaluate Rules Tree (Degree Requirements)
  let isGraduationSatisfied = true;

  if (rulesTree && rulesTree.children && rulesTree.children.length > 0) {
    const treeResult = evaluateRuleNode(
      rulesTree,
      chartCourses,
      courseMap,
      courseToRuleCatMap,
      ruleCategories,
      waivedCourseIds,
      trackAssignments,
      inputTrackId
    );

    if (!treeResult.satisfied) {
      isGraduationSatisfied = false;
      issues.push(...treeResult.issues);
    }
  }

  const hasErrors = issues.some((i) => i.type === "error");
  const isValid = !hasErrors && isGraduationSatisfied;

  return {
    isValid,
    isGraduationSatisfied,
    issues,
    categoryStats,
    totalCredits,
    termCredits: termCreditsList,
  };
}

/**
 * Recursive Rule Node Evaluator
 */
function evaluateRuleNode(
  node: RuleNode,
  chartCourses: ChartCourseEntry[],
  courseMap: Map<string, Course>,
  courseToRuleCatMap: Map<string, string>,
  ruleCategories: Category[],
  waivedCourseIds: string[] = [],
  trackAssignments: TrackCourseAssignment[] = [],
  trackId?: string
): { satisfied: boolean; issues: ValidationIssue[] } {
  // 1. Group Node
  if (node.type === "GROUP") {
    const group = node as RuleGroupNode;
    if (!group.children || group.children.length === 0) {
      return { satisfied: true, issues: [] };
    }

    const childResults = group.children.map((child) =>
      evaluateRuleNode(
        child,
        chartCourses,
        courseMap,
        courseToRuleCatMap,
        ruleCategories,
        waivedCourseIds,
        trackAssignments,
        trackId
      )
    );

    if (group.operator === "AND") {
      const allSatisfied = childResults.every((r) => r.satisfied);
      const allIssues = childResults.flatMap((r) => r.issues);
      return { satisfied: allSatisfied, issues: allIssues };
    } else {
      // OR operator
      const anySatisfied = childResults.some((r) => r.satisfied);
      if (anySatisfied) {
        return { satisfied: true, issues: [] };
      } else {
        return {
          satisfied: false,
          issues: [
            {
              id: `issue_or_group_${group.id}`,
              type: "error",
              message: group.description || "حداقل یکی از شروط انتخابی باید برقرار باشد.",
              ruleNodeId: group.id,
            },
          ],
        };
      }
    }
  }

  // 2. Leaf Nodes
  const leaf = node as RuleLeafNode;
  const issues: ValidationIssue[] = [];
  const leafCatId = leaf.categoryId || leaf.ruleCategoryId || "";

  switch (leaf.type) {
    case "MIN_CREDITS_IN_CATEGORY": {
      const matcher = resolveCategoryMatcher(leafCatId, ruleCategories);
      const catName = matcher.name;
      const required = leaf.minCredits || 0;

      const takenCourseIds = new Set<string>();
      for (const entry of chartCourses) {
        const assignedCatId = courseToRuleCatMap.get(entry.courseId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(entry.courseId);
        }
      }
      for (const waivedId of waivedCourseIds) {
        const assignedCatId = courseToRuleCatMap.get(waivedId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(waivedId);
        }
      }

      let earned = 0;
      for (const cId of takenCourseIds) {
        const c = courseMap.get(cId);
        earned += c ? c.units : 3;
      }

      const satisfied = earned >= required;
      if (!satisfied) {
        issues.push({
          id: `issue_leaf_${leaf.id}`,
          type: "error",
          message: `شرط حداقل واحد: در دسته «${catName}» باید حداقل ${required} واحد گذرانده شود (واحدهای فعلی: ${earned}).`,
          ruleNodeId: leaf.id,
        });
      }
      return { satisfied, issues };
    }

    case "MAX_CREDITS_IN_CATEGORY": {
      const matcher = resolveCategoryMatcher(leafCatId, ruleCategories);
      const catName = matcher.name;
      const maxAllowed = leaf.maxCredits !== undefined ? leaf.maxCredits : (leaf.minCredits || 0);

      const takenCourseIds = new Set<string>();
      for (const entry of chartCourses) {
        const assignedCatId = courseToRuleCatMap.get(entry.courseId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(entry.courseId);
        }
      }
      for (const waivedId of waivedCourseIds) {
        const assignedCatId = courseToRuleCatMap.get(waivedId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(waivedId);
        }
      }

      let earned = 0;
      for (const cId of takenCourseIds) {
        const c = courseMap.get(cId);
        earned += c ? c.units : 3;
      }

      const satisfied = earned <= maxAllowed;
      if (!satisfied) {
        issues.push({
          id: `issue_leaf_${leaf.id}`,
          type: "error",
          message: `شرط حداکثر واحد: در دسته «${catName}» حداکثر می‌توان ${maxAllowed} واحد اخذ نمود (واحدهای فعلی اخذ شده: ${earned}).`,
          ruleNodeId: leaf.id,
        });
      }
      return { satisfied, issues };
    }

    case "ALL_COURSES_IN_CATEGORY": {
      const matcher = resolveCategoryMatcher(leafCatId, ruleCategories);
      const catName = matcher.name;

      // Find all courses assigned to this category or matching virtual criterion
      const requiredCourseIds: string[] = [];
      if (trackAssignments && trackAssignments.length > 0) {
        for (const assign of trackAssignments) {
          if (trackId && assign.trackId && assign.trackId !== trackId) {
            continue;
          }
          const assignedCatId = assign.categoryId || assign.ruleCategoryId || assign.visualCategoryId;
          if (matcher.isMatch(assignedCatId)) {
            requiredCourseIds.push(assign.courseId);
          }
        }
      } else {
        courseToRuleCatMap.forEach((catId, courseId) => {
          if (matcher.isMatch(catId)) {
            requiredCourseIds.push(courseId);
          }
        });
      }

      const uniqueRequiredIds = Array.from(new Set(requiredCourseIds));
      const takenCourseIds = new Set([
        ...chartCourses.map((c) => c.courseId),
        ...waivedCourseIds,
      ]);
      const missing = uniqueRequiredIds.filter((id) => !takenCourseIds.has(id));

      const satisfied = missing.length === 0;
      if (!satisfied) {
        const missingNames = missing.map((id) => courseMap.get(id)?.name || id).join("، ");
        issues.push({
          id: `issue_leaf_${leaf.id}`,
          type: "error",
          message: `شرط گذراندن تمام دروس دسته «${catName}»: دروس [${missingNames}] هنوز اخذ نشده‌اند.`,
          ruleNodeId: leaf.id,
        });
      }
      return { satisfied, issues };
    }

    case "EXACT_N_COURSES_IN_CATEGORY": {
      const matcher = resolveCategoryMatcher(leafCatId, ruleCategories);
      const catName = matcher.name;
      const countNeeded = leaf.exactCount || 0;

      const takenCourseIds = new Set<string>();
      for (const entry of chartCourses) {
        const assignedCatId = courseToRuleCatMap.get(entry.courseId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(entry.courseId);
        }
      }
      for (const waivedId of waivedCourseIds) {
        const assignedCatId = courseToRuleCatMap.get(waivedId);
        if (matcher.isMatch(assignedCatId)) {
          takenCourseIds.add(waivedId);
        }
      }

      const takenCount = takenCourseIds.size;
      const satisfied = takenCount === countNeeded;
      if (!satisfied) {
        issues.push({
          id: `issue_leaf_${leaf.id}`,
          type: "error",
          message: `شرط تعداد درس: از دسته «${catName}» باید دقیقاً ${countNeeded} درس انتخاب شود (تعداد فعلی: ${takenCount}).`,
          ruleNodeId: leaf.id,
        });
      }
      return { satisfied, issues };
    }

    case "MIN_TOTAL_CREDITS_BEFORE_COURSE": {
      const targetCourse = courseMap.get(leaf.targetCourseId || "");
      const targetName = targetCourse ? targetCourse.name : "درس مشخص‌شده";
      const requiredBefore = leaf.requiredCreditsBefore || 0;

      const targetEntry = chartCourses.find((c) => c.courseId === leaf.targetCourseId);
      if (!targetEntry) {
        // Course not taken yet, rule is not violated
        return { satisfied: true, issues: [] };
      }

      // Calculate total credits passed before targetEntry.termIndex
      // Waived courses are passed beforehand, so they count towards creditsBefore
      const countedBeforeIds = new Set<string>();
      let creditsBefore = 0;

      for (const waivedId of waivedCourseIds) {
        if (waivedId !== leaf.targetCourseId && !countedBeforeIds.has(waivedId)) {
          countedBeforeIds.add(waivedId);
          const course = courseMap.get(waivedId);
          creditsBefore += course ? course.units : 3;
        }
      }

      for (const c of chartCourses) {
        if (c.termIndex < targetEntry.termIndex && !countedBeforeIds.has(c.courseId)) {
          countedBeforeIds.add(c.courseId);
          const course = courseMap.get(c.courseId);
          creditsBefore += course ? course.units : 3;
        }
      }

      const satisfied = creditsBefore >= requiredBefore;
      if (!satisfied) {
        issues.push({
          id: `issue_leaf_${leaf.id}`,
          type: "error",
          message: `شرط گذراندن پیش‌نیاز واحدی: قبل از اخذ درس «${targetName}» در ترم ${targetEntry.termIndex}، باید حداقل ${requiredBefore} واحد پاس کرده باشید (واحدهای گذرانده‌شده تا قبل این ترم: ${creditsBefore} واحد).`,
          termIndex: targetEntry.termIndex,
          courseId: leaf.targetCourseId,
          ruleNodeId: leaf.id,
        });
      }
      return { satisfied, issues };
    }

    case "MANDATORY_COURSES": {
      const neededIds = leaf.mandatoryCourseIds || [];
      const takenIds = new Set([
        ...chartCourses.map((c) => c.courseId),
        ...waivedCourseIds,
      ]);
      const missing = neededIds.filter((id) => !takenIds.has(id));

      const satisfied = missing.length === 0;
      if (!satisfied) {
        const missingNames = missing.map((id) => courseMap.get(id)?.name || id).join("، ");
        issues.push({
          id: `issue_leaf_${leaf.id}`,
          type: "error",
          message: `دروس اجباری زیر باید حتماً در چارت قرار گیرند: [${missingNames}].`,
          ruleNodeId: leaf.id,
        });
      }
      return { satisfied, issues };
    }

    case "FORBIDDEN_CATEGORY":
    case "FORBIDDEN_ALL_COURSES_IN_CATEGORY": {
      if (!leafCatId) {
        return { satisfied: true, issues: [] };
      }
      const matcher = resolveCategoryMatcher(leafCatId, ruleCategories);
      const catName = matcher.name;

      const forbiddenTakenIds = new Set<string>();
      for (const entry of chartCourses) {
        const assignedCatId = courseToRuleCatMap.get(entry.courseId);
        if (matcher.isMatch(assignedCatId)) {
          forbiddenTakenIds.add(entry.courseId);
        }
      }
      for (const waivedId of waivedCourseIds) {
        const assignedCatId = courseToRuleCatMap.get(waivedId);
        if (matcher.isMatch(assignedCatId)) {
          forbiddenTakenIds.add(waivedId);
        }
      }

      const satisfied = forbiddenTakenIds.size === 0;
      if (!satisfied) {
        for (const violatedId of forbiddenTakenIds) {
          const c = courseMap.get(violatedId);
          const cName = c ? c.name : violatedId;
          const entry = chartCourses.find((e) => e.courseId === violatedId);
          issues.push({
            id: `issue_leaf_${leaf.id}_${violatedId}`,
            type: "error",
            message: `درس «${cName}» متعلق به دسته ممنوعه «${catName}» است و اخذ آن برای این گرایش مجاز نمی‌باشد.`,
            termIndex: entry?.termIndex,
            courseId: violatedId,
            ruleNodeId: leaf.id,
          });
        }
      }
      return { satisfied, issues };
    }

    case "FORBIDDEN_COURSE":
    case "FORBIDDEN_COURSES": {
      const forbiddenIds = new Set<string>();
      if (leaf.targetCourseId) {
        forbiddenIds.add(leaf.targetCourseId);
      }
      if (leaf.forbiddenCourseIds && Array.isArray(leaf.forbiddenCourseIds)) {
        for (const id of leaf.forbiddenCourseIds) {
          if (id) forbiddenIds.add(id);
        }
      }

      if (forbiddenIds.size === 0) {
        return { satisfied: true, issues: [] };
      }

      const takenIds = new Set([
        ...chartCourses.map((c) => c.courseId),
        ...waivedCourseIds,
      ]);

      const violatedIds = Array.from(forbiddenIds).filter((id) => takenIds.has(id));
      const satisfied = violatedIds.length === 0;

      for (const violatedId of violatedIds) {
        const c = courseMap.get(violatedId);
        const cName = c ? c.name : violatedId;
        const entry = chartCourses.find((e) => e.courseId === violatedId);
        issues.push({
          id: `issue_leaf_${leaf.id}_${violatedId}`,
          type: "error",
          message: `درس «${cName}» جزء دروس ممنوعه برای این گرایش است و امکان اخذ آن وجود ندارد.`,
          termIndex: entry?.termIndex,
          courseId: violatedId,
          ruleNodeId: leaf.id,
        });
      }

      return { satisfied, issues };
    }

    default:
      return { satisfied: true, issues: [] };
  }
}

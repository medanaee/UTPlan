import type {
  RuleNode,
  RuleGroupNode,
  RuleLeafNode,
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
  chartCourses: ChartCourseEntry[];
  rulesTree?: RuleGroupNode | null;
  ruleCategories: RuleCategory[];
  trackAssignments: TrackCourseAssignment[];
  allCourses: Course[];
  prerequisites: PrerequisiteRelation[];
  constraints?: {
    minCreditsPerTerm?: number; // default 12
    maxCreditsPerTerm?: number; // default 20
    maxTerms?: number;          // default 12
  };
}

/**
 * Main Chart Validation Engine
 */
export function validateFullChart(input: ValidationEngineInput): ValidationResult {
  const {
    chartCourses,
    rulesTree,
    ruleCategories,
    trackAssignments,
    allCourses,
    prerequisites,
    constraints = {},
  } = input;

  const minCredits = constraints.minCreditsPerTerm ?? 12;
  const maxCredits = constraints.maxCreditsPerTerm ?? 20;

  const issues: ValidationIssue[] = [];

  // Map for quick course lookup
  const courseMap = new Map<string, Course>();
  for (const c of allCourses) {
    courseMap.set(c.id, c);
  }

  // Map courseId -> assigned ruleCategoryId
  const courseToRuleCatMap = new Map<string, string>();
  for (const assign of trackAssignments) {
    if (assign.ruleCategoryId) {
      courseToRuleCatMap.set(assign.courseId, assign.ruleCategoryId);
    }
  }

  // 1. Calculate Term Credits and Total Credits
  let totalCredits = 0;
  const termCreditsMap = new Map<number, number>();
  const activeTermIndices = new Set<number>();

  for (const entry of chartCourses) {
    const course = courseMap.get(entry.courseId);
    const units = course ? course.units : 3;
    totalCredits += units;

    const currentTermCredits = termCreditsMap.get(entry.termIndex) || 0;
    termCreditsMap.set(entry.termIndex, currentTermCredits + units);
    activeTermIndices.add(entry.termIndex);
  }

  const maxActiveTerm = activeTermIndices.size > 0 ? Math.max(...Array.from(activeTermIndices)) : 0;

  // 2. Validate Term Credit Limits (Floor & Ceiling)
  const termCreditsList: { termIndex: number; credits: number; isWithinLimits: boolean }[] = [];

  for (const [termIndex, credits] of termCreditsMap.entries()) {
    const isLastTerm = termIndex === maxActiveTerm;
    let isWithin = true;

    // Floor check (exempt for the last active term)
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
      const targetCourse = courseMap.get(prereq.requiredCourseId);
      const targetName = targetCourse ? targetCourse.name : prereq.requiredCourseId;
      const termP = courseTermMap.get(prereq.requiredCourseId);

      if (termP === undefined) {
        // Prerequisite is not in chart at all
        issues.push({
          id: `issue_prereq_missing_${entry.courseId}_${prereq.requiredCourseId}`,
          type: "error",
          message: `درس «${courseName}» نیازمند ${prereq.type === "prerequisite" ? "پیش‌نیاز" : "هم‌نیاز"} «${targetName}» است که در چارت قرار نگرفته است.`,
          termIndex: termC,
          courseId: entry.courseId,
        });
      } else {
        if (prereq.type === "prerequisite") {
          if (termP >= termC) {
            issues.push({
              id: `issue_prereq_order_${entry.courseId}_${prereq.requiredCourseId}`,
              type: "error",
              message: `درس «${targetName}» (ترم ${termP}) پیش نیاز «${courseName}» (ترم ${termC}) است و باید در ترم‌های قبل از آن گذرانده شود.`,
              termIndex: termC,
              courseId: entry.courseId,
            });
          }
        } else if (prereq.type === "corequisite") {
          if (termP > termC) {
            issues.push({
              id: `issue_coreq_order_${entry.courseId}_${prereq.requiredCourseId}`,
              type: "error",
              message: `درس «${targetName}» (ترم ${termP}) هم نیاز «${courseName}» (ترم ${termC}) است و باید باید همزمان یا قبل از آن گذرانده شود.`,
              termIndex: termC,
              courseId: entry.courseId,
            });
          }
        }
      }
    }
  }

  // 4. Calculate Category Stats
  const categoryStats: CategoryStat[] = ruleCategories.map((rcat) => {
    // Find all courses assigned to this category
    const assignedCourses = chartCourses.filter(
      (entry) => courseToRuleCatMap.get(entry.courseId) === rcat.id
    );

    const earnedCredits = assignedCourses.reduce((sum, entry) => {
      const c = courseMap.get(entry.courseId);
      return sum + (c ? c.units : 3);
    }, 0);

    // Extract requirement dynamically from rulesTree if defined
    let required = 0;
    if (rulesTree) {
      const findReq = (node: any) => {
        if (!node) return;
        if (node.type === "MIN_CREDITS_IN_CATEGORY" && node.ruleCategoryId === rcat.id) {
          required = node.minCredits || 0;
        }
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(findReq);
        }
      };
      findReq(rulesTree);
    }

    const isSatisfied = required === 0 || earnedCredits >= required;

    return {
      categoryId: rcat.id,
      categoryName: rcat.name,
      requiredCredits: required > 0 ? required : undefined,
      earnedCredits,
      totalCoursesPassed: assignedCourses.length,
      isSatisfied,
    };
  });

  // 5. Evaluate Rules Tree (Degree Requirements)
  let isGraduationSatisfied = true;

  if (rulesTree && rulesTree.children && rulesTree.children.length > 0) {
    const treeResult = evaluateRuleNode(
      rulesTree,
      chartCourses,
      courseMap,
      courseToRuleCatMap,
      ruleCategories
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
  ruleCategories: RuleCategory[]
): { satisfied: boolean; issues: ValidationIssue[] } {
  // 1. Group Node
  if (node.type === "GROUP") {
    const group = node as RuleGroupNode;
    if (!group.children || group.children.length === 0) {
      return { satisfied: true, issues: [] };
    }

    const childResults = group.children.map((child) =>
      evaluateRuleNode(child, chartCourses, courseMap, courseToRuleCatMap, ruleCategories)
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

// Helper to collect a category ID and all its recursive subcategory IDs
function getCategoryAndDescendantIds(targetCatId: string, allCategories: RuleCategory[]): Set<string> {
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

// 2. Leaf Nodes
const leaf = node as RuleLeafNode;
const issues: ValidationIssue[] = [];

switch (leaf.type) {
  case "MIN_CREDITS_IN_CATEGORY": {
    const cat = ruleCategories.find((c) => c.id === leaf.ruleCategoryId);
    const catName = cat ? cat.name : "دسته نامشخص";
    const required = leaf.minCredits || 0;
    const targetCatIds = getCategoryAndDescendantIds(leaf.ruleCategoryId, ruleCategories);

    const earned = chartCourses
      .filter((entry) => {
        const assignedCatId = courseToRuleCatMap.get(entry.courseId);
        return assignedCatId && targetCatIds.has(assignedCatId);
      })
      .reduce((sum, entry) => {
        const c = courseMap.get(entry.courseId);
        return sum + (c ? c.units : 3);
      }, 0);

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

  case "ALL_COURSES_IN_CATEGORY": {
    const cat = ruleCategories.find((c) => c.id === leaf.ruleCategoryId);
    const catName = cat ? cat.name : "دسته نامشخص";
    const targetCatIds = getCategoryAndDescendantIds(leaf.ruleCategoryId, ruleCategories);

    // Find all courses assigned to this category or its subcategories
    const requiredCourseIds: string[] = [];
    courseToRuleCatMap.forEach((catId, courseId) => {
      if (targetCatIds.has(catId)) {
        requiredCourseIds.push(courseId);
      }
    });

      const takenCourseIds = new Set(chartCourses.map((c) => c.courseId));
      const missing = requiredCourseIds.filter((id) => !takenCourseIds.has(id));

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
      const cat = ruleCategories.find((c) => c.id === leaf.ruleCategoryId);
      const catName = cat ? cat.name : "دسته نامشخص";
      const countNeeded = leaf.exactCount || 0;

      const takenCount = chartCourses.filter(
        (entry) => courseToRuleCatMap.get(entry.courseId) === leaf.ruleCategoryId
      ).length;

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
      const creditsBefore = chartCourses
        .filter((c) => c.termIndex < targetEntry.termIndex)
        .reduce((sum, c) => {
          const course = courseMap.get(c.courseId);
          return sum + (course ? course.units : 3);
        }, 0);

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
      const takenIds = new Set(chartCourses.map((c) => c.courseId));
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

    default:
      return { satisfied: true, issues: [] };
  }
}

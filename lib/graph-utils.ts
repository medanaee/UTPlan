/**
 * Cycle detection algorithms for Course Prerequisite & Corequisite DAGs.
 * Uses Depth-First Search (DFS) with 3-state node coloring (White, Gray, Black).
 */

export interface Edge {
  from: string; // The course that requires the other (courseId) OR the prerequisite
  to: string;   // The required course (requiredCourseId)
}

/**
 * Check if adding a new prerequisite/corequisite edge (courseId -> requiredCourseId) would create an invalid cycle.
 * In a relation: `courseId` depends on `requiredCourseId`.
 * - "prerequisite": strict temporal dependency (requiredCourse must be passed strictly before course: termP < termC).
 * - "corequisite": simultaneous or earlier dependency (termP <= termC).
 *
 * An invalid cycle is one that contains at least one "prerequisite" relation,
 * because strict temporal ordering along a cycle (e.g. termA < termB <= termA) is impossible.
 * In contrast, pure "corequisite" cycles (termA <= termB <= termA => termA == termB) are valid
 * mutual corequisites and represent courses that must be taken concurrently in the same semester.
 */
export function wouldCreatePrerequisiteCycle(
  existingPrerequisites: { courseId: string; requiredCourseId: string; type?: string }[],
  newPrerequisite: { courseId: string; requiredCourseId: string; type?: string }
): boolean {
  const { courseId: u, requiredCourseId: v, type: newType } = newPrerequisite;

  // Self-dependency is an immediate invalid cycle
  if (u === v) {
    return true;
  }

  // Recommended relations are advisory only and never cause a blocking hard cycle
  if (newType === "recommended") {
    return false;
  }

  const isStrict = (type?: string) => type !== "corequisite" && type !== "recommended";
  const newIsStrict = isStrict(newType);

  // Build adjacency list: node -> array of { to: string, isStrict: boolean }
  const adj = new Map<string, { to: string; isStrict: boolean }[]>();

  for (const edge of existingPrerequisites) {
    // Ignore advisory recommended relations for hard cycle enforcement
    if (edge.type === "recommended") continue;

    if (!adj.has(edge.courseId)) {
      adj.set(edge.courseId, []);
    }
    adj.get(edge.courseId)!.push({
      to: edge.requiredCourseId,
      isStrict: isStrict(edge.type),
    });
  }

  // We want to detect if there is a path from `v` to `u` such that the combined cycle
  // (the path from v to u plus the new edge u -> v) contains at least one strict prerequisite edge.
  const visitedStrict = new Set<string>();
  const visitedNonStrict = new Set<string>();

  const queue: { node: string; hasStrict: boolean }[] = [
    { node: v, hasStrict: newIsStrict },
  ];

  while (queue.length > 0) {
    const { node: curr, hasStrict } = queue.shift()!;

    // If we reached `u` with at least one strict edge on the cycle, it is an impossible cycle
    if (curr === u && hasStrict) {
      return true;
    }

    if (hasStrict) {
      if (visitedStrict.has(curr)) continue;
      visitedStrict.add(curr);
    } else {
      if (visitedNonStrict.has(curr)) continue;
      visitedNonStrict.add(curr);
    }

    const edges = adj.get(curr) || [];
    for (const edge of edges) {
      const nextHasStrict = hasStrict || edge.isStrict;
      if (nextHasStrict && visitedStrict.has(edge.to)) continue;
      if (!nextHasStrict && visitedNonStrict.has(edge.to)) continue;

      queue.push({
        node: edge.to,
        hasStrict: nextHasStrict,
      });
    }
  }

  return false;
}

/**
 * Detect all cycles in a general directed graph
 */
export function detectGraphCycle(
  courseIds: string[],
  edges: { courseId: string; requiredCourseId: string }[]
): boolean {
  const adj = new Map<string, string[]>();
  for (const id of courseIds) {
    adj.set(id, []);
  }
  for (const edge of edges) {
    if (adj.has(edge.courseId)) {
      adj.get(edge.courseId)!.push(edge.requiredCourseId);
    }
  }

  // 0: unvisited (white), 1: visiting (gray), 2: visited (black)
  const state = new Map<string, number>();
  for (const id of courseIds) {
    state.set(id, 0);
  }

  function dfs(node: string): boolean {
    state.set(node, 1); // Mark as visiting

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor) || 0;
      if (neighborState === 1) {
        return true; // Found cycle!
      }
      if (neighborState === 0) {
        if (dfs(neighbor)) return true;
      }
    }

    state.set(node, 2); // Mark as fully visited
    return false;
  }

  for (const id of courseIds) {
    if ((state.get(id) || 0) === 0) {
      if (dfs(id)) return true;
    }
  }

  return false;
}

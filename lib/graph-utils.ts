/**
 * Cycle detection algorithms for Course Prerequisite & Corequisite DAGs.
 * Uses Depth-First Search (DFS) with 3-state node coloring (White, Gray, Black).
 */

export interface Edge {
  from: string; // The course that requires the other (courseId) OR the prerequisite
  to: string;   // The required course (requiredCourseId)
}

/**
 * Check if adding a new prerequisite edge (courseId -> requiredCourseId) would create a cycle.
 * In a prerequisite relation: `courseId` depends on `requiredCourseId`.
 * Dependency direction: `courseId` -> `requiredCourseId`.
 * A cycle occurs if there is already a path from `requiredCourseId` to `courseId`.
 */
export function wouldCreatePrerequisiteCycle(
  existingPrerequisites: { courseId: string; requiredCourseId: string }[],
  newPrerequisite: { courseId: string; requiredCourseId: string }
): boolean {
  const { courseId, requiredCourseId } = newPrerequisite;

  // Self-dependency is an immediate cycle
  if (courseId === requiredCourseId) {
    return true;
  }

  // Build adjacency list where edge is A -> B (A requires B)
  const adj = new Map<string, string[]>();

  for (const edge of existingPrerequisites) {
    if (!adj.has(edge.courseId)) {
      adj.set(edge.courseId, []);
    }
    adj.get(edge.courseId)!.push(edge.requiredCourseId);
  }

  // Check if we can already reach `courseId` starting from `requiredCourseId`
  const visited = new Set<string>();
  const queue = [requiredCourseId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === courseId) {
      return true; // Found a path back to courseId -> would create a cycle!
    }

    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = adj.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
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

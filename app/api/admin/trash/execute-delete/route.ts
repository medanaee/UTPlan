import { apiResponseJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { getD1, logAdminAction } from "@/lib/db";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface ResolutionAction {
  conflictId: string;
  relationType:
    | "offering"
    | "prerequisite"
    | "track_assignment"
    | "chart_course"
    | "event"
    | "offering_professor"
    | "student_event_selection"
    | "faculty_major"
    | "faculty_course"
    | "faculty_professor"
    | "faculty_user"
    | "major_track"
    | "major_user"
    | "track_chart"
    | "track_user";
  dependentEntityType: string;
  dependentEntityId: string;
  action: "replace" | "cascade_delete" | "unlink" | "trash_delete";
  replacementId?: string;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body: any = await request.json();
    const rawItems: Array<{ type: string; id: string }> =
      body?.rootItems || (body?.rootEntityType && body?.rootEntityId ? [{ type: body.rootEntityType, id: body.rootEntityId }] : []);

    const resolutions: ResolutionAction[] = body?.resolutions || [];

    if (rawItems.length === 0) {
      return apiResponseJson({ success: false, message: "هیچ موجودیتی برای حذف مشخص نشده است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return apiResponseJson({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    const stmts: any[] = [];

    // 1. Process all resolutions in batch
    for (const res of resolutions) {
      // A. Offering
      if (res.relationType === "offering") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE course_offerings SET course_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else if (res.action === "cascade_delete" || res.action === "trash_delete") {
          stmts.push(
            d1.prepare("DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id = ?)").bind(res.dependentEntityId),
            d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM course_events WHERE offering_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM offering_professors WHERE offering_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM offering_resources WHERE offering_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM reviews WHERE target_type = 'offering' AND target_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM course_offerings WHERE id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // B. Prerequisite
      else if (res.relationType === "prerequisite") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE prerequisites SET required_course_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("DELETE FROM prerequisites WHERE id = ?").bind(res.dependentEntityId));
        }
      }

      // C. Track Assignment (either by course or by track)
      else if (res.relationType === "track_assignment") {
        if (res.action === "replace" && res.replacementId) {
          if (res.dependentEntityType === "course") {
            stmts.push(d1.prepare("UPDATE track_course_assignments SET course_id = ? WHERE id = ? OR course_id = ?").bind(res.replacementId, res.dependentEntityId, res.dependentEntityId));
          } else {
            stmts.push(d1.prepare("UPDATE track_course_assignments SET track_id = ? WHERE id = ? OR track_id = ?").bind(res.replacementId, res.dependentEntityId, res.dependentEntityId));
          }
        } else {
          stmts.push(d1.prepare("DELETE FROM track_course_assignments WHERE id = ? OR track_id = ? OR course_id = ?").bind(res.dependentEntityId, res.dependentEntityId, res.dependentEntityId));
        }
      }

      // D. Chart Course
      else if (res.relationType === "chart_course") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE chart_courses SET course_id = ? WHERE course_id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("DELETE FROM chart_courses WHERE course_id = ?").bind(res.dependentEntityId));
        }
      }

      // E. Offering Professor
      else if (res.relationType === "offering_professor") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE offering_professors SET professor_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("DELETE FROM offering_professors WHERE id = ?").bind(res.dependentEntityId));
        }
      }

      // F. Event
      else if (res.relationType === "event") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE course_events SET offering_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else if (res.action === "cascade_delete" || res.action === "trash_delete") {
          stmts.push(
            d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(res.dependentEntityId),
            d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM course_events WHERE id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // G. Student Event Selection
      else if (res.relationType === "student_event_selection") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE chart_courses SET selected_event_id = ? WHERE selected_event_id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id = ?").bind(res.dependentEntityId));
        }
      }

      // H. Faculty Major
      else if (res.relationType === "faculty_major") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE majors SET faculty_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(
            d1.prepare("UPDATE users SET major_id = NULL, track_id = NULL WHERE major_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM track_course_assignments WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM visual_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM rule_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)))").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?))").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM tracks WHERE major_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM majors WHERE id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // I. Faculty Course
      else if (res.relationType === "faculty_course") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE courses SET faculty_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(
            d1.prepare("DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id = ?))").bind(res.dependentEntityId),
            d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id = ?))").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM offering_professors WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM offering_resources WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM reviews WHERE target_type = 'offering' AND target_id IN (SELECT id FROM course_offerings WHERE course_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM course_offerings WHERE course_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM prerequisites WHERE course_id = ? OR required_course_id = ?").bind(res.dependentEntityId, res.dependentEntityId),
            d1.prepare("DELETE FROM track_course_assignments WHERE course_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM chart_courses WHERE course_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM courses WHERE id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // J. Faculty Professor
      else if (res.relationType === "faculty_professor") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE professors SET faculty_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(
            d1.prepare("DELETE FROM offering_professors WHERE professor_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM reviews WHERE target_type = 'professor' AND target_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM professors WHERE id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // K. Faculty User
      else if (res.relationType === "faculty_user") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE users SET faculty_id = ? WHERE faculty_id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("UPDATE users SET faculty_id = NULL WHERE faculty_id = ?").bind(res.dependentEntityId));
        }
      }

      // L. Major Track
      else if (res.relationType === "major_track") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE tracks SET major_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(
            d1.prepare("UPDATE users SET track_id = NULL WHERE track_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM track_course_assignments WHERE track_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM visual_categories WHERE track_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM rule_categories WHERE track_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?))").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM charts WHERE track_id = ?").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM tracks WHERE id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // M. Major User
      else if (res.relationType === "major_user") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE users SET major_id = ? WHERE major_id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("UPDATE users SET major_id = NULL, track_id = NULL WHERE major_id = ?").bind(res.dependentEntityId));
        }
      }

      // N. Track Chart
      else if (res.relationType === "track_chart") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE charts SET track_id = ? WHERE track_id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(
            d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?))").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?)").bind(res.dependentEntityId),
            d1.prepare("DELETE FROM charts WHERE track_id = ?").bind(res.dependentEntityId)
          );
        }
      }

      // O. Track User
      else if (res.relationType === "track_user") {
        if (res.action === "replace" && res.replacementId) {
          stmts.push(d1.prepare("UPDATE users SET track_id = ? WHERE track_id = ?").bind(res.replacementId, res.dependentEntityId));
        } else {
          stmts.push(d1.prepare("UPDATE users SET track_id = NULL WHERE track_id = ?").bind(res.dependentEntityId));
        }
      }
    }

    // 2. Group root items by entity type for batch deletion
    // Order of deletion MUST be topologically from leaf entities to root entities:
    // 1. event -> 2. offering -> 3. course -> 4. professor -> 5. track -> 6. major -> 7. faculty
    const itemsByType: Record<string, string[]> = {
      event: [],
      offering: [],
      course: [],
      professor: [],
      track: [],
      major: [],
      faculty: [],
      physical_faculty: [],
    };

    for (const it of rawItems) {
      if (itemsByType[it.type]) {
        itemsByType[it.type].push(it.id);
      }
    }

    // 1. Batch delete events (leaf)
    if (itemsByType.event.length > 0) {
      for (const chunk of chunkArray(itemsByType.event, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`DELETE FROM course_event_slots WHERE event_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM course_events WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 2. Batch delete offerings (depends on courses and professors)
    if (itemsByType.offering.length > 0) {
      for (const chunk of chunkArray(itemsByType.offering, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM course_events WHERE offering_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_professors WHERE offering_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_resources WHERE offering_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM reviews WHERE target_type = 'offering' AND target_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM course_offerings WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 3. Batch delete courses (depends on faculties; offerings & prerequisites depend on courses)
    if (itemsByType.course.length > 0) {
      for (const chunk of chunkArray(itemsByType.course, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          // Defensive cascading cleanup of any offerings/events of these courses
          d1.prepare(`DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_professors WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_resources WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM reviews WHERE target_type = 'offering' AND target_id IN (SELECT id FROM course_offerings WHERE course_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM course_offerings WHERE course_id IN (${placeholders})`).bind(...chunk),
          // Clean course connections
          d1.prepare(`DELETE FROM prerequisites WHERE course_id IN (${placeholders}) OR required_course_id IN (${placeholders})`).bind(...chunk, ...chunk),
          d1.prepare(`DELETE FROM track_course_assignments WHERE course_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_courses WHERE course_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM courses WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 4. Batch delete professors (depends on faculties; offering_professors depends on professors)
    if (itemsByType.professor.length > 0) {
      for (const chunk of chunkArray(itemsByType.professor, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`DELETE FROM offering_professors WHERE professor_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM reviews WHERE target_type = 'professor' AND target_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM professors WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 5. Batch delete tracks (depends on majors)
    if (itemsByType.track.length > 0) {
      for (const chunk of chunkArray(itemsByType.track, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`UPDATE users SET track_id = NULL WHERE track_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM track_course_assignments WHERE track_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM visual_categories WHERE track_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM rule_categories WHERE track_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM charts WHERE track_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM tracks WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 6. Batch delete majors (depends on faculties)
    if (itemsByType.major.length > 0) {
      for (const chunk of chunkArray(itemsByType.major, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`UPDATE users SET track_id = NULL WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM track_course_assignments WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM visual_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM rule_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders}))))`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM tracks WHERE major_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`UPDATE users SET major_id = NULL WHERE major_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM majors WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 7. Batch delete faculties (root)
    if (itemsByType.faculty.length > 0) {
      for (const chunk of chunkArray(itemsByType.faculty, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`UPDATE users SET track_id = NULL WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM track_course_assignments WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM visual_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM rule_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders})))))`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders}))))`).bind(...chunk),
          d1.prepare(`DELETE FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM tracks WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`UPDATE users SET major_id = NULL WHERE major_id IN (SELECT id FROM majors WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM majors WHERE faculty_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders}))))`).bind(...chunk),
          d1.prepare(`UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders}))))`).bind(...chunk),
          d1.prepare(`DELETE FROM course_events WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_professors WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_resources WHERE offering_id IN (SELECT id FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM reviews WHERE target_type = 'offering' AND target_id IN (SELECT id FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders})))`).bind(...chunk),
          d1.prepare(`DELETE FROM course_offerings WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM prerequisites WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders})) OR required_course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders}))`).bind(...chunk, ...chunk),
          d1.prepare(`DELETE FROM track_course_assignments WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM chart_courses WHERE course_id IN (SELECT id FROM courses WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM courses WHERE faculty_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM offering_professors WHERE professor_id IN (SELECT id FROM professors WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM reviews WHERE target_type = 'professor' AND target_id IN (SELECT id FROM professors WHERE faculty_id IN (${placeholders}))`).bind(...chunk),
          d1.prepare(`DELETE FROM professors WHERE faculty_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM faculty_links WHERE target_faculty_id IN (${placeholders}) OR source_faculty_id IN (${placeholders})`).bind(...chunk, ...chunk),
          d1.prepare(`UPDATE users SET faculty_id = NULL WHERE faculty_id IN (${placeholders})`).bind(...chunk),
          d1.prepare(`DELETE FROM faculties WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 8. Batch delete physical_faculties (independent)
    if (itemsByType.physical_faculty.length > 0) {
      for (const chunk of chunkArray(itemsByType.physical_faculty, 50)) {
        const placeholders = chunk.map(() => "?").join(",");
        stmts.push(
          d1.prepare(`DELETE FROM physical_faculties WHERE id IN (${placeholders})`).bind(...chunk)
        );
      }
    }

    // 3. Execute all statements in Cloudflare D1 batch chunks
    if (stmts.length > 0) {
      try {
        await d1.prepare("PRAGMA foreign_keys = OFF;").run();
      } catch (e) {
        // Continue if environment restricts direct PRAGMA; topological order handles it cleanly
      }

      try {
        const batchChunks = chunkArray(stmts, 100);
        for (const bChunk of batchChunks) {
          await d1.batch(bChunk);
        }
      } finally {
        try {
          await d1.prepare("PRAGMA foreign_keys = ON;").run();
        } catch (e) {
          // ignore
        }
      }
    }

    await logAdminAction({
      userId: auth.user!.id,
      userName: auth.user!.name,
      userEmail: auth.user!.email,
      action: "DELETE",
      entityType: "trash",
      entityName: `${rawItems.length} مورد حذف فیزیکی`,
      details: { items: rawItems, resolutionsCount: resolutions.length },
    });

    return apiResponseJson({
      success: true,
      message: `${rawItems.length} مورد با موفقیت به همراه تمام وابستگی‌های تعیین‌شده حذف فیزیکی شدند.`,
      deletedCount: rawItems.length,
    });
  } catch (err: any) {
    console.error("Execute bulk delete error:", err);
    return apiResponseJson({ success: false, message: "خطا در اجرای عملیات حذف گروهی: " + err?.message }, { status: 500 });
  }
}

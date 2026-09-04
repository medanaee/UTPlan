import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminSession(request);
    if (!auth.authorized) return auth.response! as NextResponse;

    const body = await request.json();
    const rawItems: Array<{ type: string; id: string }> =
      body?.rootItems || (body?.rootEntityType && body?.rootEntityId ? [{ type: body.rootEntityType, id: body.rootEntityId }] : []);

    const resolutions: ResolutionAction[] = body?.resolutions || [];

    if (rawItems.length === 0) {
      return NextResponse.json({ success: false, message: "هیچ موجودیتی برای حذف مشخص نشده است." }, { status: 400 });
    }

    const d1 = getD1();
    if (!d1) {
      return NextResponse.json({ success: false, message: "پایگاه داده در دسترس نیست." }, { status: 500 });
    }

    // 1. Process all resolutions in the queue
    for (const res of resolutions) {
      // A. Offering
      if (res.relationType === "offering") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE course_offerings SET course_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else if (res.action === "cascade_delete" || res.action === "trash_delete") {
          await d1.prepare("DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM course_events WHERE offering_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM offering_professors WHERE offering_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM offering_resources WHERE offering_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM reviews WHERE target_type = 'offering' AND target_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM course_offerings WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // B. Prerequisite
      else if (res.relationType === "prerequisite") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE prerequisites SET required_course_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("DELETE FROM prerequisites WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // C. Track Assignment (either by course or by track)
      else if (res.relationType === "track_assignment") {
        if (res.action === "replace" && res.replacementId) {
          // If replacing for a course
          if (res.dependentEntityType === "course") {
            await d1.prepare("UPDATE track_course_assignments SET course_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
          } else {
            // Replacing for a track
            await d1.prepare("UPDATE track_course_assignments SET track_id = ? WHERE track_id = ?").bind(res.replacementId, res.dependentEntityId).run();
          }
        } else {
          // Cascade delete
          if (res.dependentEntityType === "track_assignment") {
            await d1.prepare("DELETE FROM track_course_assignments WHERE track_id = ?").bind(res.dependentEntityId).run();
          } else {
            await d1.prepare("DELETE FROM track_course_assignments WHERE id = ?").bind(res.dependentEntityId).run();
          }
        }
      }

      // D. Chart Course
      else if (res.relationType === "chart_course") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE chart_courses SET course_id = ? WHERE course_id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("DELETE FROM chart_courses WHERE course_id = ?").bind(res.dependentEntityId).run();
        }
      }

      // E. Offering Professor
      else if (res.relationType === "offering_professor") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE offering_professors SET professor_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("DELETE FROM offering_professors WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // F. Event
      else if (res.relationType === "event") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE course_events SET offering_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else if (res.action === "cascade_delete" || res.action === "trash_delete") {
          await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM course_events WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // G. Student Event Selection
      else if (res.relationType === "student_event_selection") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE chart_courses SET selected_event_id = ? WHERE selected_event_id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id = ?").bind(res.dependentEntityId).run();
        }
      }

      // H. Faculty Major
      else if (res.relationType === "faculty_major") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE majors SET faculty_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("UPDATE users SET major_id = NULL, track_id = NULL WHERE major_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM track_course_assignments WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM visual_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM rule_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)))").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?))").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM tracks WHERE major_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM majors WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // I. Faculty Course
      else if (res.relationType === "faculty_course") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE courses SET faculty_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("DELETE FROM prerequisites WHERE course_id = ? OR required_course_id = ?").bind(res.dependentEntityId, res.dependentEntityId).run();
          await d1.prepare("DELETE FROM track_course_assignments WHERE course_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM chart_courses WHERE course_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM courses WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // J. Faculty Professor
      else if (res.relationType === "faculty_professor") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE professors SET faculty_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("DELETE FROM offering_professors WHERE professor_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM reviews WHERE target_type = 'professor' AND target_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM professors WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // K. Faculty User
      else if (res.relationType === "faculty_user") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE users SET faculty_id = ? WHERE faculty_id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("UPDATE users SET faculty_id = NULL WHERE faculty_id = ?").bind(res.dependentEntityId).run();
        }
      }

      // L. Major Track
      else if (res.relationType === "major_track") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE tracks SET major_id = ? WHERE id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("UPDATE users SET track_id = NULL WHERE track_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM track_course_assignments WHERE track_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM visual_categories WHERE track_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM rule_categories WHERE track_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?))").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM charts WHERE track_id = ?").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM tracks WHERE id = ?").bind(res.dependentEntityId).run();
        }
      }

      // M. Major User
      else if (res.relationType === "major_user") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE users SET major_id = ? WHERE major_id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("UPDATE users SET major_id = NULL, track_id = NULL WHERE major_id = ?").bind(res.dependentEntityId).run();
        }
      }

      // N. Track Chart
      else if (res.relationType === "track_chart") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE charts SET track_id = ? WHERE track_id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?))").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?)").bind(res.dependentEntityId).run();
          await d1.prepare("DELETE FROM charts WHERE track_id = ?").bind(res.dependentEntityId).run();
        }
      }

      // O. Track User
      else if (res.relationType === "track_user") {
        if (res.action === "replace" && res.replacementId) {
          await d1.prepare("UPDATE users SET track_id = ? WHERE track_id = ?").bind(res.replacementId, res.dependentEntityId).run();
        } else {
          await d1.prepare("UPDATE users SET track_id = NULL WHERE track_id = ?").bind(res.dependentEntityId).run();
        }
      }
    }

    // 2. Finally hard-delete all root items
    for (const item of rawItems) {
      const rootEntityType = item.type;
      const rootEntityId = item.id;

      if (rootEntityType === "faculty") {
        await d1.prepare("DELETE FROM faculty_links WHERE target_faculty_id = ? OR source_faculty_id = ?").bind(rootEntityId, rootEntityId).run();
        await d1.prepare("UPDATE users SET faculty_id = NULL WHERE faculty_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM faculties WHERE id = ?").bind(rootEntityId).run();
      } else if (rootEntityType === "major") {
        await d1.prepare("UPDATE users SET major_id = NULL, track_id = NULL WHERE major_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM track_course_assignments WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM visual_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM rule_categories WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)))").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?))").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM charts WHERE track_id IN (SELECT id FROM tracks WHERE major_id = ?)").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM tracks WHERE major_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM majors WHERE id = ?").bind(rootEntityId).run();
      } else if (rootEntityType === "track") {
        await d1.prepare("DELETE FROM track_course_assignments WHERE track_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM visual_categories WHERE track_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM rule_categories WHERE track_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM chart_courses WHERE term_id IN (SELECT id FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?))").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM chart_terms WHERE chart_id IN (SELECT id FROM charts WHERE track_id = ?)").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM charts WHERE track_id = ?").bind(rootEntityId).run();
        await d1.prepare("UPDATE users SET track_id = NULL WHERE track_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM tracks WHERE id = ?").bind(rootEntityId).run();
      } else if (rootEntityType === "course") {
        await d1.prepare("DELETE FROM prerequisites WHERE course_id = ? OR required_course_id = ?").bind(rootEntityId, rootEntityId).run();
        await d1.prepare("DELETE FROM track_course_assignments WHERE course_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM chart_courses WHERE course_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM courses WHERE id = ?").bind(rootEntityId).run();
      } else if (rootEntityType === "professor") {
        await d1.prepare("DELETE FROM offering_professors WHERE professor_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM reviews WHERE target_type = 'professor' AND target_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM professors WHERE id = ?").bind(rootEntityId).run();
      } else if (rootEntityType === "offering") {
        await d1.prepare("DELETE FROM course_event_slots WHERE event_id IN (SELECT id FROM course_events WHERE offering_id = ?)").bind(rootEntityId).run();
        await d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id IN (SELECT id FROM course_events WHERE offering_id = ?)").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM course_events WHERE offering_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM offering_professors WHERE offering_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM offering_resources WHERE offering_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM reviews WHERE target_type = 'offering' AND target_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM course_offerings WHERE id = ?").bind(rootEntityId).run();
      } else if (rootEntityType === "event") {
        await d1.prepare("DELETE FROM course_event_slots WHERE event_id = ?").bind(rootEntityId).run();
        await d1.prepare("UPDATE chart_courses SET selected_event_id = NULL WHERE selected_event_id = ?").bind(rootEntityId).run();
        await d1.prepare("DELETE FROM course_events WHERE id = ?").bind(rootEntityId).run();
      }
    }

    return NextResponse.json({
      success: true,
      message: `${rawItems.length} مورد با موفقیت به همراه تمام وابستگی‌های تعیین‌شده حذف فیزیکی شدند.`,
      deletedCount: rawItems.length,
    });
  } catch (err: any) {
    console.error("Execute bulk delete error:", err);
    return NextResponse.json({ success: false, message: "خطا در اجرای عملیات حذف گروهی: " + err?.message }, { status: 500 });
  }
}

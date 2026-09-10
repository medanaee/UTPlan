import { NextRequest, NextResponse } from "next/server";
import { getCourses } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const facultyId = searchParams.get("facultyId") || undefined;
    const directOnly = searchParams.get("directOnly") !== "false";

    // When exporting courses for a specific faculty, only export courses directly belonging to that faculty (no linked faculties)
    const courses = await getCourses(facultyId, undefined, directOnly);
    const exportCourses = facultyId && directOnly ? courses.filter((c) => c.facultyId === facultyId) : courses;

    const exportData = exportCourses.map((course) => {
      const prereqCodes: string[] = [];
      const coreqCodes: string[] = [];
      const recommendedCodes: string[] = [];

      (course.prerequisites || []).forEach((p) => {
        const code =
          (p.requiredCourseCode && p.requiredCourseCode !== "---"
            ? p.requiredCourseCode
            : p.requiredCourseName) || "";
        if (code) {
          if (p.type === "corequisite") {
            coreqCodes.push(code);
          } else if (p.type === "recommended") {
            recommendedCodes.push(code);
          } else {
            prereqCodes.push(code);
          }
        }
      });

      return {
        code: course.code,
        abbreviation: course.abbreviation || undefined,
        name: course.name,
        units: course.units || 3,
        offeredIn: course.offeredIn || "both",
        description: course.description || "",
        prerequisites: prereqCodes,
        corequisites: coreqCodes,
        recommendedPrerequisites: recommendedCodes,
      };
    });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="courses-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Courses export error:", error);
    return NextResponse.json({ success: false, message: "خطا در استخراج دروس" }, { status: 500 });
  }
}

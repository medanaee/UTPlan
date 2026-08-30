import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { CourseDirectory } from "@/components/courses/course-directory";
import { getCourses, getFaculties } from "@/lib/db";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "جستجوی دروس و پیش‌نیازها | سامانه چارت دانشگاه تهران",
  description: "کاتالوگ جامع دروس، زنجیره پیش‌نیازها، هم‌نیازها و اساتید ارائه‌دهنده دانشکده فنی",
};

export default async function CoursesPage() {
  const [courses, faculties] = await Promise.all([
    getCourses(),
    getFaculties(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs">در حال بارگذاری دروس...</span>
            </div>
          }
        >
          <CourseDirectory
            initialCourses={courses}
            initialFaculties={faculties}
          />
        </Suspense>
      </main>
    </div>
  );
}

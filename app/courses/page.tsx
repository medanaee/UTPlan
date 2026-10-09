import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { CourseDirectory } from "@/components/courses/course-directory";

export const metadata = {
  title: "جستجوی دروس و پیش‌نیازها | سامانه چارت دانشگاه تهران",
  description: "کاتالوگ جامع دروس، زنجیره پیش‌نیازها، هم‌نیازها و اساتید ارائه‌دهنده دانشکده فنی",
};

export default async function CoursesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense>
          <CourseDirectory />
        </Suspense>
      </main>
    </div>
  );
}

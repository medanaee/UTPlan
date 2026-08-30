import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { CourseDetailView } from "@/components/courses/course-detail-view";
import { getCourseById } from "@/lib/db";

interface CourseDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const course = await getCourseById(id);
  if (!course) return { title: "درس یافت نشد" };

  return {
    title: `${course.name} (${course.code}) | شناسنامه و پیش‌نیازهای درس`,
    description: course.description || `مشخصات، پیش‌نیازها و اساتید ارائه‌دهنده درس ${course.name}`,
  };
}

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;
  const course = await getCourseById(id);

  if (!course) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <CourseDetailView course={course} />
      </main>
    </div>
  );
}

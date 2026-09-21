import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { PhysicalFacultyDetailView } from "@/components/physical-faculties/physical-faculty-detail-view";
import { getPhysicalFacultyById } from "@/lib/db";

interface PhysicalFacultyDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PhysicalFacultyDetailPageProps) {
  const { id } = await params;
  const faculty = await getPhysicalFacultyById(id);
  if (!faculty) return { title: "دانشکده یافت نشد" };

  return {
    title: `${faculty.name} | موقعیت مکانی و نقشه`,
    description: faculty.address || faculty.description || `اطلاعات و نقشه ${faculty.name}`,
  };
}

export default async function PhysicalFacultyDetailPage({ params }: PhysicalFacultyDetailPageProps) {
  const { id } = await params;
  const faculty = await getPhysicalFacultyById(id);

  if (!faculty) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <PhysicalFacultyDetailView faculty={faculty} />
      </main>
    </div>
  );
}

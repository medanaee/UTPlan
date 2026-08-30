import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ProfessorDetailView } from "@/components/professors/professor-detail-view";
import { getProfessorById } from "@/lib/db";

interface ProfessorDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProfessorDetailPageProps) {
  const { id } = await params;
  const professor = await getProfessorById(id);
  if (!professor) return { title: "استاد یافت نشد" };

  return {
    title: `${professor.title || "استاد"} ${professor.name} | پروفایل، دروس و نظرات`,
    description: `مشخصات، دروس ارائه‌شده و نظرات و ارزیابی‌های دانشجویان درباره ${professor.name}`,
  };
}

export default async function ProfessorDetailPage({ params }: ProfessorDetailPageProps) {
  const { id } = await params;
  const professor = await getProfessorById(id);

  if (!professor) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <ProfessorDetailView professor={professor} />
      </main>
    </div>
  );
}

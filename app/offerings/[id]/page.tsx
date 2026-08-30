import { notFound } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { OfferingDetailView } from "@/components/offerings/offering-detail-view";
import { getOfferingById } from "@/lib/db";

interface OfferingDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OfferingDetailPageProps) {
  const { id } = await params;
  const offering = await getOfferingById(id);
  if (!offering) return { title: "ارائه یافت نشد" };

  return {
    title: `ارائه ${offering.courseName} با ${offering.professorName} | نظرات و زمان‌بندی`,
    description: `برنامه کلاسی و امتحانی، امتیازات و نظرات دانشجویان در خصوص ارائه ${offering.courseName} توسط ${offering.professorName}`,
  };
}

export default async function OfferingDetailPage({ params }: OfferingDetailPageProps) {
  const { id } = await params;
  const offering = await getOfferingById(id);

  if (!offering) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <OfferingDetailView offering={offering} />
      </main>
    </div>
  );
}

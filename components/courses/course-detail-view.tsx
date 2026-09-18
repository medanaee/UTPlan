"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Layers,
  Users,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Info,
  Sparkles,
  Share2,
  GraduationCap,
  FileText,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Course, Faculty } from "@/lib/types";

interface CourseDetailViewProps {
  course: Course;
}

export function CourseDetailView({ course }: CourseDetailViewProps) {
  const router = useRouter();
  const [copied, setCopied] = React.useState(false);

  const formatTermOffered = (term?: string) => {
    switch (term) {
      case "fall":
        return { label: "ارائه در نیمسال اول (مهر)", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
      case "spring":
        return { label: "ارائه در نیمسال دوم (بهمن)", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
      default:
        return { label: "ارائه در هر دو نیمسال (مهر و بهمن)", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" };
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const termInfo = formatTermOffered(course.offeredIn);
  const prereqs = (course.prerequisites || []).filter((p) => p.type === "prerequisite");
  const coreqs = (course.prerequisites || []).filter((p) => p.type === "corequisite");
  const recommendedPrereqs = (course.prerequisites || []).filter((p) => p.type === "recommended");
  const deps = course.dependentCourses || [];
  const offerings = course.offerings || [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 font-medium">
          <Link href="/" className="hover:text-foreground transition-colors">
            خانه
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-50" />
          <Link href="/courses" className="hover:text-foreground transition-colors">
            جستجوی دروس
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rotate-180 opacity-50" />
          <span className="text-foreground font-bold">{course.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 gap-1.5 text-xs shadow-2xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>لینک کپی شد</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>اشتراک‌گذاری</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/courses")}
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>بازگشت به کاتالوگ دروس</span>
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background to-background p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-bold px-3 py-1 bg-background/80">
                کد درس: {course.code}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  course.degreeLevel === "master"
                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                    : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                }`}
              >
                مقطع {course.degreeLevel === "master" ? "کارشناسی ارشد" : "کارشناسی"}
              </Badge>
              <Badge variant="secondary" className="text-xs font-bold px-3 py-1">
                {course.units} واحد تحصیلی
              </Badge>
              <Badge className={`text-xs font-semibold px-3 py-1 rounded-full border ${termInfo.color}`}>
                {termInfo.label}
              </Badge>
            </div>

            {/* Course Title */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                {course.name}
              </h1>
              {course.abbreviation && (
                <Badge variant="outline" className="text-sm font-bold px-2.5 py-0.5 text-primary border-primary/30 bg-primary/5">
                  {course.abbreviation}
                </Badge>
              )}
            </div>

            {/* Faculty Name */}
            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 font-medium">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span>{course.facultyName || "دانشکده مهندسی برق و کامپیوتر"}</span>
            </p>
          </div>

          {/* Quick Stats Box */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <div className="rounded-xl border border-border/80 p-3 text-center min-w-18.75 shadow-2xs">
              <span className="text-lg font-extrabold text-foreground block">{prereqs.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">پیش‌نیاز</span>
            </div>
            <div className="rounded-xl border border-border/80 p-3 text-center min-w-18.75 shadow-2xs">
              <span className="text-lg font-extrabold text-foreground block">{coreqs.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">هم‌نیاز</span>
            </div>
            <div className="rounded-xl border border-border/80 p-3 text-center min-w-18.75 shadow-2x">
              <span className="text-lg font-extrabold text-foreground block">{recommendedPrereqs.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">پیش‌نیاز پیشنهادی</span>
            </div>
            <div className="rounded-xl border border-border/80 p-3 text-center min-w-18.75 shadow-2xs">
              <span className="text-lg font-extrabold text-foreground block">{deps.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">درس وابسته</span>
            </div>
            <div className="rounded-xl border border-border/80 p-3 text-center min-w-18.75 shadow-2xs">
              <span className="text-lg font-extrabold text-foreground block">{offerings.length}</span>
              <span className="text-[10px] text-muted-foreground font-medium">استاد ارائه</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right 2 Columns: Core Info & Dependencies */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description & Syllabus Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                معرفی، سرفصل و توضیحات درس
              </CardTitle>
            </CardHeader>
            <CardContent>
              {course.description ? (
                <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {course.description}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground/80 bg-muted/20 rounded-xl border border-dashed">
                  توضیحات تکمیلی یا سرفصل رسمی برای این درس ثبت نشده است.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prerequisites, Corequisites & Recommended Prerequisites */}

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4`}>
            {/* Prerequisites */}
            <Card className="border-amber-500/30 bg-linear-to-b from-amber-500/5 to-transparent shadow-xs">
              <CardHeader className="pb-3 border-b border-amber-500/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>پیش‌نیاز ({prereqs.length})</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-medium border-amber-500/30 text-amber-600">
                    الزامی
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {prereqs.length > 0 ? (
                  prereqs.map((p) => (
                    <Link
                      key={p.id}
                      href={`/courses/${p.requiredCourseId}`}
                      className="group flex items-center justify-between p-3 rounded-xl border border-amber-500/30 hover:border-amber-500 hover:shadow-xs transition-all text-xs"
                    >
                      <div className="space-y-0.5 truncate flex-1 min-w-0 pr-1">
                        <span className="font-bold block truncate transition-colors">
                          {p.requiredCourseName}
                        </span>
                        <span className=" text-[10px] text-muted-foreground font-mono">
                          {p.requiredCourseCode}
                        </span>
                      </div>
                      <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-all shrink-0" />
                    </Link>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground/70 italic">
                    این درس پیش‌نیاز رسمی ندارد.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Corequisites */}
            <Card className="border-blue-500/30 bg-linear-to-b from-blue-500/5 to-transparent shadow-xs">
              <CardHeader className="pb-3 border-b border-blue-500/20">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <Layers className="h-4 w-4 shrink-0" />
                    <span>هم‌نیاز ({coreqs.length})</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-medium border-blue-500/30 text-blue-600">
                    همزمان/قبلی
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {coreqs.length > 0 ? (
                  coreqs.map((c) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.requiredCourseId}`}
                      className="group flex items-center justify-between p-3 rounded-xl border border-blue-500/30 hover:border-blue-500 hover:shadow-xs transition-all text-xs"
                    >
                      <div className="space-y-0.5 truncate flex-1 min-w-0 pr-1">
                        <span className="font-bold block truncate transition-colors">
                          {c.requiredCourseName}
                        </span>
                        <span className=" text-[10px] text-muted-foreground font-mono">
                          {c.requiredCourseCode}
                        </span>
                      </div>
                      <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-all shrink-0" />
                    </Link>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground/70 italic">
                    فاقد هم‌نیاز رسمی
                  </div>
                )}
              </CardContent>
            </Card>

          </div>


          <Card className="border-emerald-500/30 bg-linear-to-b from-emerald-500/5 to-transparent shadow-xs">
            <CardHeader className="pb-3 border-b border-emerald-500/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>پیش نیاز های پیشنهادی ({recommendedPrereqs.length})</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-medium border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                  توصیه‌شده
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {recommendedPrereqs.length > 0 ? (
                recommendedPrereqs.map((r) => (
                  <Link
                    key={r.id}
                    href={`/courses/${r.requiredCourseId}`}
                    className="group flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-card hover:border-emerald-500 hover:shadow-xs transition-all text-xs"
                  >
                    <div className="space-y-0.5 truncate flex-1 min-w-0 pr-1">
                      <span className="font-bold block truncate group-hover:text-primary transition-colors">
                        {r.requiredCourseName}
                      </span>
                      <span className=" text-[10px] text-muted-foreground font-mono">
                        {r.requiredCourseCode}
                      </span>
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all shrink-0" />
                  </Link>))) : (
                <div className="py-6 text-center text-xs text-muted-foreground/70 italic">
                  این درس پیش‌نیاز پیشنهادی ندارد.
                </div>)}

            </CardContent>
          </Card>


          {/* Reverse Prerequisites: "این درس پیش‌نیاز چه دروسی است؟" */}
          <Card className="border-purple-500/30 bg-linear-to-b from-purple-500/5 to-transparent shadow-xs">
            <CardHeader className="pb-3 border-b border-purple-500/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  این درس پیش‌نیاز/هم‌نیاز کدام دروس است؟ ({deps.length})
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">دروس وابسته به این درس در چارت</span>
              </div>
            </CardHeader>
            <CardContent>
              {deps.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deps.map((d) => (
                    <Link
                      key={d.id}
                      href={`/courses/${d.courseId}`}
                      className="group flex items-center justify-between p-3 rounded-xl border border-purple-500/30 hover:border-purple-500 hover:shadow-xs transition-all text-xs"
                    >
                      <div className="space-y-1 truncate flex-1 min-w-0 pr-1">
                        <span className="font-bold block truncate transition-colors">
                          {d.courseName}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className=" text-[10px] font-mono">
                            {d.courseCode}
                          </Badge>
                          <span className="text-[10px] text-purple-600 font-semibold">
                            {d.type === "prerequisite"
                              ? "پیش‌نیاز"
                              : d.type === "corequisite"
                                ? "هم‌نیاز"
                                : "پیش‌نیاز پیشنهادی"}
                          </span>
                        </div>
                      </div>
                      <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-all shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground/70 italic">
                  هیچ درسی به عنوان پیش‌نیاز وابسته به این درس تعریف نشده است (درس پایانی یا اختیاری).
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Left 1 Column: Professors & Quick Academic Guide */}
        <div className="space-y-6">
          {/* Professors Card */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                اساتید و ارائه‌دهندگان درس
              </CardTitle>
              <CardDescription className="text-xs">
                اساتیدی که این درس را در دانشکده ارائه می‌دهند.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {offerings.length > 0 ? (
                offerings.map((off) => (
                  <Link
                    key={off.id}
                    href={`/offerings/${off.id}`}
                    className="group flex items-center justify-between p-3 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xs transition-all text-xs"
                  >
                    <div className="flex items-center gap-3 truncate flex-1 min-w-0 pr-1">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {off.professorName?.[0] || "ا"}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-xs block truncate group-hover:text-primary transition-colors text-foreground">
                          {off.professorName}
                        </span>
                        {off.professorTitle && (
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {off.professorTitle}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0 mr-2" />
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground/70 bg-muted/20 rounded-xl border border-dashed">
                  هنوز استادی برای ارائه این درس تعریف نشده است.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Guide Note */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Info className="h-4 w-4 shrink-0" />
              <span>راهنمای اخذ واحد</span>
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              رعایت پیش‌نیازها و هم‌نیازهای اعلام‌شده در چارت تحصیلی برای جلوگیری از حذف دروس توسط آموزش دانشکده در پایان نیمسال الزامی است.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

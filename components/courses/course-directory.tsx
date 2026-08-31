"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Building2,
  BookMarked,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Course, Faculty, UserSession } from "@/lib/types";
import { Download, Upload } from "lucide-react";

interface CourseDirectoryProps {
  initialCourses?: Course[];
  initialFaculties?: Faculty[];
}

export function CourseDirectory({
  initialCourses = [],
  initialFaculties = [],
}: CourseDirectoryProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [faculties, setFaculties] = useState<Faculty[]>(initialFaculties);
  const [loading, setLoading] = useState(initialCourses.length === 0);

  const [search, setSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState<string>("all");
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedOfferedIn, setSelectedOfferedIn] = useState<string>("all");
  const [selectedUnits, setSelectedUnits] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [coursesRes, facultiesRes] = await Promise.all([
          fetch("/api/courses").then((r) => r.json()),
          fetch("/api/faculties").then((r) => r.json()),
        ]);

        if (coursesRes.success) setCourses(coursesRes.data);
        if (facultiesRes.success) setFaculties(facultiesRes.data);
      } catch (err) {
        console.error("Error loading course directory data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated) setCurrentUser(d.user);
      })
      .catch(() => {});

    if (initialCourses.length === 0) {
      loadData();
    }
  }, [initialCourses.length]);

  // Filtered list
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        search.trim() === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase());

      const matchesFaculty =
        selectedFaculty === "all" || c.facultyId === selectedFaculty;

      const matchesOffered =
        selectedOfferedIn === "all" ||
        c.offeredIn === selectedOfferedIn ||
        c.offeredIn === "both";

      const matchesUnits =
        selectedUnits === "all" || String(c.units) === selectedUnits;

      return matchesSearch && matchesFaculty && matchesOffered && matchesUnits;
    });
  }, [courses, search, selectedFaculty, selectedOfferedIn, selectedUnits]);

  const formatTermOffered = (term?: string) => {
    switch (term) {
      case "fall":
        return { label: "ترم فرد", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
      case "spring":
        return { label: "ترم زوج", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
      case "none":
        return { label: "عدم ارائه", color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30" };
      default:
        return { label: "هر دو ترم", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background to-background p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <BookOpen className="h-3.5 w-3.5" />
            <span>شناسنامه و کاتالوگ جامع دروس</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            جستجو و اطلاعات پیش‌نیاز دروس
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            در این بخش می‌توانید مشخصات دروس، زنجیره پیش‌نیازها و هم‌نیازها، دروسی که وابسته به این درس هستند و اساتید ارائه‌دهنده هر درس را مشاهده و بررسی کنید.
          </p>
        </div>


      </div>

      {/* Search & Filters Card */}
      <Card className="border border-border/80 shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام یا کد درس (مثلاً: ریاضی عمومی، AP، CE201)..."
                className="pr-9 text-xs h-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  پاک کردن
                </button>
              )}
            </div>

            {/* Faculty Filter */}
            <div className="w-full md:w-56">
              <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                <SelectTrigger className="w-full text-xs h-9">
                  <SelectValue placeholder="فیلتر دانشکده" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all" className="text-xs">
                      همه دانشکده‌ها ({courses.length})
                    </SelectItem>
                    {faculties.map((f) => {
                      const count = courses.filter((c) => c.facultyId === f.id).length;
                      return (
                        <SelectItem key={f.id} value={f.id} className="text-xs">
                          {f.name} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Offered In Semester */}
            <div className="w-full md:w-44">
              <Select value={selectedOfferedIn} onValueChange={setSelectedOfferedIn}>
                <SelectTrigger className="w-full text-xs h-9">
                  <SelectValue placeholder="ترم ارائه" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all" className="text-xs">
                      همه ترم‌ها
                    </SelectItem>
                    <SelectItem value="fall" className="text-xs">
                      ترم مهر (پاییز)
                    </SelectItem>
                    <SelectItem value="spring" className="text-xs">
                      ترم بهمن (بهار)
                    </SelectItem>
                    <SelectItem value="both" className="text-xs">
                      ارائه در هر دو ترم
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Units Filter */}
            <div className="w-full md:w-36">
              <Select value={selectedUnits} onValueChange={setSelectedUnits}>
                <SelectTrigger className="w-full text-xs h-9">
                  <SelectValue placeholder="تعداد واحد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all" className="text-xs">
                      همه واحدها
                    </SelectItem>
                    <SelectItem value="1" className="text-xs">
                      ۱ واحدی
                    </SelectItem>
                    <SelectItem value="2" className="text-xs">
                      ۲ واحدی
                    </SelectItem>
                    <SelectItem value="3" className="text-xs">
                      ۳ واحدی
                    </SelectItem>
                    <SelectItem value="4" className="text-xs">
                      ۴ واحدی
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters / Result stats */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-muted-foreground">
            <span>
              نمایش <strong className="text-foreground">{filteredCourses.length}</strong> درس از مجموع {courses.length} درس ثبت‌شده
            </span>
            {(search || selectedFaculty !== "all" || selectedOfferedIn !== "all" || selectedUnits !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedFaculty("all");
                  setSelectedOfferedIn("all");
                  setSelectedUnits("all");
                }}
                className="h-6 text-[11px] text-primary"
              >
                بازنشانی فیلترها
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs">در حال بارگذاری لیست دروس...</span>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl border-dashed border-border/80 p-8 space-y-3">
          <BookMarked className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">هیچ درسی با این مشخصات یافت نشد</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عبارت جستجو یا فیلترهای اعمال‌شده را تغییر دهید تا دروس مرتبط نمایش داده شوند.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const fac = faculties.find((f) => f.id === course.facultyId);
            const termInfo = formatTermOffered(course.offeredIn);

            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="group relative rounded-2xl border border-border/70 bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header: Code & Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className=" text-xs font-bold px-2 py-0.5 bg-muted/60">
                      {course.code}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        {course.units} واحد
                      </Badge>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${termInfo.color}`}>
                        {termInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Course Title & Faculty */}
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-1">
                        {course.name}
                      </h3>
                      {course.abbreviation && (
                        <Badge variant="outline" className="text-xs font-medium px-1.5 py-0 text-primary border-primary/30 bg-primary/5">
                          {course.abbreviation}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Building2 className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate">{fac?.name || "دانشکده مهندسی برق و کامپیوتر"}</span>
                    </p>
                  </div>

                  {/* Description preview */}
                  {course.description && (
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  )}

                  {/* Prerequisites Preview */}
                  {course.prerequisites && course.prerequisites.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
                      {course.prerequisites.map((p) => (
                        <span
                          key={p.id}
                          className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                            p.type === "prerequisite"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                              : p.type === "corequisite"
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                              : "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20"
                          }`}
                        >
                          {p.type === "prerequisite"
                            ? "پیش‌نیاز:"
                            : p.type === "corequisite"
                            ? "هم‌نیاز:"
                            : "پیشنهادی:"}{" "}
                          {p.requiredCourseName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Action */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-primary font-semibold">
                  <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                    مشاهده صفحه کامل و پیش‌نیازها
                  </span>
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}

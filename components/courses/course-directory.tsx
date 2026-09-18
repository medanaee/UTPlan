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
  SlidersHorizontal,
  X,
  ChevronDown,
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
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { searchCourses } from "@/lib/search/persian-search";
import { fetchJson } from "@/lib/api-client";

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
  const [selectedFaculty, setSelectedFaculty] = usePersistedState<string>("ut_ece_public_faculty", "all");
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedOfferedIn, setSelectedOfferedIn] = usePersistedState<string>("ut_ece_courses_offered_in", "all");
  const [selectedUnits, setSelectedUnits] = usePersistedState<string>("ut_ece_courses_units", "all");
  const [selectedDegreeLevel, setSelectedDegreeLevel] = usePersistedState<string>("ut_ece_courses_degree_level", "all");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedFaculty !== "all") count++;
    if (selectedDegreeLevel !== "all") count++;
    if (selectedOfferedIn !== "all") count++;
    if (selectedUnits !== "all") count++;
    return count;
  }, [selectedFaculty, selectedDegreeLevel, selectedOfferedIn, selectedUnits]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [coursesRes, facultiesRes] = await Promise.all([
          fetchJson("/api/courses"),
          fetchJson("/api/faculties"),
        ]);

        if (coursesRes.success) setCourses(coursesRes.data);
        if (facultiesRes.success) setFaculties(facultiesRes.data);
      } catch (err) {
        console.error("Error loading course directory data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchJson("/api/auth/me")
      .then((d) => {
        if (d.authenticated) setCurrentUser(d.user);
      })
      .catch(() => {});

    if (initialCourses.length === 0) {
      loadData();
    }
  }, [initialCourses.length]);

  // Filtered and intelligently ranked list
  const filteredCourses = useMemo(() => {
    // 1. Filter by category dropdowns first
    const baseFiltered = courses.filter((c) => {
      const matchesFaculty =
        selectedFaculty === "all" || c.facultyId === selectedFaculty;

      const matchesDegree =
        selectedDegreeLevel === "all" ||
        (c.degreeLevel || "undergrad") === selectedDegreeLevel;

      const matchesOffered =
        selectedOfferedIn === "all" ||
        c.offeredIn === selectedOfferedIn ||
        c.offeredIn === "both";

      const matchesUnits =
        selectedUnits === "all" || String(c.units) === selectedUnits;

      return matchesFaculty && matchesDegree && matchesOffered && matchesUnits;
    });

    // 2. Intelligently search and rank by search query
    return searchCourses(baseFiltered, search);
  }, [courses, search, selectedFaculty, selectedDegreeLevel, selectedOfferedIn, selectedUnits]);

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
      {/* Header Banner with Centered Hero Search */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-primary/5 to-background/50 p-6 sm:p-10 shadow-xs text-center">
        {/* Subtle decorative glow circle in the background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-2.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            جستجو و اطلاعات پیش‌نیاز دروس
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            در این بخش می‌توانید مشخصات دروس، زنجیره پیش‌نیازها و هم‌نیازها، دروسی که وابسته به این درس هستند و اساتید ارائه‌دهنده هر درس را مشاهده و بررسی کنید.
          </p>
        </div>

        {/* Centered Translucent Search Box with Soft Glow */}
        <div className="relative z-10 max-w-2xl mx-auto mt-6">
          <div className="group relative flex items-center w-full rounded-2xl border border-border/80 bg-background/60 backdrop-blur-md shadow-xs transition-all duration-300 focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/15 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.18)] dark:focus-within:shadow-[0_0_35px_rgba(59,130,246,0.25)]">
            <Search className="h-5 w-5 text-muted-foreground mr-3.5 ml-1.5 shrink-0 transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی هوشمند درس، کد یا مخفف (مثلاً: ریاضی عمومی، سیستم عامل، AP)..."
              className="w-full bg-transparent py-3 pr-1 pl-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />

            {/* Clear Search Button */}
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0 ml-1.5 cursor-pointer"
                title="پاک کردن متن جستجو"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Filters Button */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsFiltersOpen((prev) => !prev)}
              className={`ml-1.5 my-1.5 h-9 rounded-lg px-3 gap-1.5 text-xs font-semibold shrink-0 transition-all border cursor-pointer ${
                isFiltersOpen || activeFilterCount > 0
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border/60 hover:bg-muted/70 text-muted-foreground"
              }`}
              title="فیلترهای پیشرفته"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xs:inline">فیلترها</span>
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full"
                >
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown
                className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                  isFiltersOpen ? "rotate-180" : ""
                }`}
              />
            </Button>
          </div>

          {/* Expandable Filter Tray */}
          {isFiltersOpen && (
            <div className="mt-3 p-4 rounded-2xl border border-border/80 bg-background/80 backdrop-blur-md shadow-xs animate-in fade-in-50 slide-in-from-top-2 duration-200 text-right space-y-3.5">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                  فیلترهای پیشرفته دروس
                </span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFaculty("all");
                      setSelectedDegreeLevel("all");
                      setSelectedOfferedIn("all");
                      setSelectedUnits("all");
                    }}
                    className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    پاک کردن فیلترها
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {/* Faculty Filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block text-right">
                    دانشکده
                  </label>
                  <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                    <SelectTrigger className="w-full text-xs h-8.5 rounded-lg bg-background/60">
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

                {/* Degree Level Filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block text-right">
                    مقطع تحصیلی
                  </label>
                  <Select value={selectedDegreeLevel} onValueChange={setSelectedDegreeLevel}>
                    <SelectTrigger className="w-full text-xs h-8.5 rounded-lg bg-background/60">
                      <SelectValue placeholder="مقطع تحصیلی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all" className="text-xs">
                          همه مقاطع ({courses.length})
                        </SelectItem>
                        <SelectItem value="undergrad" className="text-xs">
                          کارشناسی ({courses.filter((c) => (c.degreeLevel || "undergrad") === "undergrad").length})
                        </SelectItem>
                        <SelectItem value="master" className="text-xs">
                          کارشناسی ارشد ({courses.filter((c) => c.degreeLevel === "master").length})
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Offered In Semester */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block text-right">
                    نیمسال ارائه
                  </label>
                  <Select value={selectedOfferedIn} onValueChange={setSelectedOfferedIn}>
                    <SelectTrigger className="w-full text-xs h-8.5 rounded-lg bg-background/60">
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
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block text-right">
                    تعداد واحد
                  </label>
                  <Select value={selectedUnits} onValueChange={setSelectedUnits}>
                    <SelectTrigger className="w-full text-xs h-8.5 rounded-lg bg-background/60">
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
            </div>
          )}
        </div>
      </div>

      {/* Result stats & Reset */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2 pt-0.5">
        <span>
          نمایش <strong className="text-foreground">{filteredCourses.length}</strong> درس از مجموع {courses.length} درس ثبت‌شده
        </span>

        {(search || activeFilterCount > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedFaculty("all");
              setSelectedDegreeLevel("all");
              setSelectedOfferedIn("all");
              setSelectedUnits("all");
            }}
            className="h-6 text-[11px] text-primary hover:bg-primary/10 rounded-md cursor-pointer"
          >
            بازنشانی همه فیلترها و جستجو
          </Button>
        )}
      </div>

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
                    <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-muted/60">
                      {course.code}
                    </Badge>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold px-1.5 py-0.5 border ${
                          course.degreeLevel === "master"
                            ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                            : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                        }`}
                      >
                        {course.degreeLevel === "master" ? "کارشناسی ارشد" : "کارشناسی"}
                      </Badge>
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

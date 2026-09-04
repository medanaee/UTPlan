"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  Search,
  Building2,
  Users,
  BookOpen,
  Star,
  MessageSquare,
  ArrowLeft,
  Calendar,
  Sparkles,
  Loader2,
  Clock,
  SlidersHorizontal,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CourseOffering, Faculty } from "@/lib/types";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { searchCourses } from "@/lib/search/persian-search";

interface OfferingDirectoryProps {
  initialOfferings?: CourseOffering[];
  initialFaculties?: Faculty[];
}

export function OfferingDirectory({
  initialOfferings = [],
  initialFaculties = [],
}: OfferingDirectoryProps) {
  const [offerings, setOfferings] = useState<CourseOffering[]>(initialOfferings);
  const [faculties, setFaculties] = useState<Faculty[]>(initialFaculties);
  const [loading, setLoading] = useState(initialOfferings.length === 0);

  const [search, setSearch] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = usePersistedState<string>("ut_ece_public_faculty", "all");
  const [selectedUnits, setSelectedUnits] = usePersistedState<string>("ut_ece_public_offering_units", "all");

  const activeFilterCount =
    (selectedFaculty !== "all" ? 1 : 0) +
    (selectedUnits !== "all" ? 1 : 0);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [offRes, facRes] = await Promise.all([
          fetch("/api/offerings").then((r) => r.json()),
          fetch("/api/faculties").then((r) => r.json()),
        ]);

        if (offRes.success) setOfferings(offRes.data);
        if (facRes.success) setFaculties(facRes.data);
      } catch (err) {
        console.error("Error loading offerings directory:", err);
      } finally {
        setLoading(false);
      }
    }

    if (initialOfferings.length === 0) {
      loadData();
    }
  }, [initialOfferings.length]);

  const filteredOfferings = useMemo(() => {
    // 1. Filter by category dropdowns first
    const baseFiltered = offerings.filter((o) => {
      const matchesFaculty =
        selectedFaculty === "all" || o.facultyId === selectedFaculty;

      const matchesUnits =
        selectedUnits === "all" ||
        String(o.courseUnits ?? 3) === selectedUnits;

      return matchesFaculty && matchesUnits;
    });

    // 2. Prepare searchable representation for Persian smart search
    const searchable = baseFiltered.map((o) => {
      const profNames =
        o.professors && o.professors.length > 0
          ? o.professors.map((p) => p.name).join(" ")
          : o.professorName || "";

      return {
        ...o,
        name: `${o.courseName || ""} ${profNames}`.trim(),
        code: o.courseCode || o.code || "",
        abbreviation: o.courseAbbreviation || "",
      };
    });

    // 3. Intelligently search and rank by search query
    return searchCourses(searchable, search);
  }, [offerings, search, selectedFaculty, selectedUnits]);

  return (
    <div className="space-y-6">
      {/* Header Banner with Centered Hero Search */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-primary/5 to-background/50 p-6 sm:p-10 shadow-xs text-center">
        {/* Subtle decorative glow circle in the background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-2.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            دایرکتوری ارائه‌ها و تبادل نظر دانشجویان
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            در این بخش می‌توانید ارائه‌های مختلف دروس توسط اساتید دانشکده را جستجو کرده، زمان‌بندی‌های کلاسی را مشاهده کنید و نظرات و تجربیات دانشجویان را درباره هر ارائه بخوانید.
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
              placeholder="جستجوی هوشمند نام درس، کد درس یا نام استاد..."
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
              size="sm"
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
                  فیلترهای پیشرفته ارائه‌ها
                </span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFaculty("all");
                      setSelectedUnits("all");
                    }}
                    className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    پاک کردن فیلترها
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                          همه دانشکده‌ها ({offerings.length})
                        </SelectItem>
                        {faculties.map((f) => {
                          const count = offerings.filter((o) => o.facultyId === f.id).length;
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
          نمایش <strong className="text-foreground">{filteredOfferings.length}</strong> ارائه از مجموع {offerings.length} ارائه تعریف‌شده
        </span>
        {(search || activeFilterCount > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedFaculty("all");
              setSelectedUnits("all");
            }}
            className="h-6 text-[11px] text-primary cursor-pointer hover:bg-primary/10"
          >
            بازنشانی فیلترها
          </Button>
        )}
      </div>

      {/* Offerings Grid - Flat & Clean Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs">در حال بارگذاری ارائه‌ها...</span>
        </div>
      ) : filteredOfferings.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl border-dashed border-border/80 p-8 space-y-3">
          <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">هیچ ارائه‌ای با این مشخصات یافت نشد</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عبارت جستجو یا فیلتر دانشکده را تغییر دهید تا ارائه‌های مرتبط نمایش داده شوند.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOfferings.map((off) => {
            const profsList =
              off.professors && off.professors.length > 0
                ? off.professors
                : off.professorName
                ? off.professorName.split(" و ").map((name, idx) => ({
                    id: idx === 0 ? off.professorId : `p_${idx}`,
                    name: name.trim(),
                    title: idx === 0 ? off.professorTitle : undefined,
                    avatarUrl: idx === 0 ? off.professorAvatarUrl : undefined,
                    isPrimary: idx === 0,
                  }))
                : [];

            return (
              <Link
                key={off.id}
                href={`/offerings/${off.id}`}
                className="group relative rounded-2xl border border-border/70 bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Header: Course Code & Units */}
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-muted/60">
                      {off.courseCode || "---"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {off.courseUnits || 3} واحد
                    </Badge>
                  </div>

                  {/* Course Name */}
                  <div>
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-1">
                      {off.courseName}
                    </h3>
                  </div>

                  {/* Professors Grid - 2 Columns */}
                  {profsList.length === 0 ? (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/50 text-muted-foreground text-xs">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span>استاد تعیین نشده</span>
                    </div>
                  ) : (
                    <div className={profsList.length > 1 ? "grid grid-cols-2 gap-2" : "space-y-1.5"}>
                      {profsList.map((p, pIdx) => {
                        const isLastOdd =
                          profsList.length % 2 !== 0 &&
                          pIdx === profsList.length - 1 &&
                          profsList.length > 1;

                        return (
                          <div
                            key={p.id || pIdx}
                            className={`flex items-center gap-2 p-2 rounded-xl bg-muted/30 border border-border/50 group-hover:border-primary/20 transition-colors ${
                              isLastOdd ? "col-span-2" : ""
                            }`}
                          >
                            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                              {p.avatarUrl ? (
                                <img
                                  src={p.avatarUrl}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{p.name?.[0] || "ا"}</span>
                              )}
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-xs truncate text-foreground">
                                  {p.name}
                                </span>
                                {p.isPrimary && profsList.length > 1 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 font-normal text-primary border-primary/30 bg-primary/5 shrink-0"
                                  >
                                    اصلی
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground block truncate">
                                {p.title || "استاد مدرس"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Card Footer: Action & Review indicator */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-primary font-semibold">
                  <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    مشاهده صفحه ارائه و نظرات
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

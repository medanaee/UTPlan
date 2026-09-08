"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Building2,
  Star,
  ArrowLeft,
  Loader2,
  Mail,
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
import type { Professor, Faculty } from "@/lib/types";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { searchCourses } from "@/lib/search/persian-search";
import { fetchJson } from "@/lib/api-client";

interface ProfessorDirectoryProps {
  initialProfessors?: Professor[];
  initialFaculties?: Faculty[];
}

export function ProfessorDirectory({
  initialProfessors = [],
  initialFaculties = [],
}: ProfessorDirectoryProps) {
  const [professors, setProfessors] = useState<Professor[]>(initialProfessors);
  const [faculties, setFaculties] = useState<Faculty[]>(initialFaculties);
  const [loading, setLoading] = useState(initialProfessors.length === 0);

  const [search, setSearch] = useState("");
  const [selectedFaculty, setSelectedFaculty] = usePersistedState<string>("ut_ece_public_faculty", "all");
  const [selectedTitle, setSelectedTitle] = usePersistedState<string>("ut_ece_public_prof_title", "all");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Extract unique academic titles from professors list
  const availableTitles = useMemo(() => {
    const set = new Set<string>();
    professors.forEach((p) => {
      if (p.title && p.title.trim()) set.add(p.title.trim());
    });
    return Array.from(set).sort();
  }, [professors]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedFaculty !== "all") count++;
    if (selectedTitle !== "all") count++;
    return count;
  }, [selectedFaculty, selectedTitle]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profRes, facRes] = await Promise.all([
          fetchJson("/api/professors"),
          fetchJson("/api/faculties"),
        ]);

        if (profRes.success) setProfessors(profRes.data);
        if (facRes.success) setFaculties(facRes.data);
      } catch (err) {
        console.error("Error loading professors directory:", err);
      } finally {
        setLoading(false);
      }
    }

    if (initialProfessors.length === 0) {
      loadData();
    }
  }, [initialProfessors.length]);

  const filteredProfessors = useMemo(() => {
    // 1. Filter by dropdowns (Faculty & Academic Title)
    const base = professors.filter((p) => {
      const matchesFaculty =
        selectedFaculty === "all" || p.facultyId === selectedFaculty;
      const matchesTitle =
        selectedTitle === "all" || (p.title && p.title.trim() === selectedTitle);
      return matchesFaculty && matchesTitle;
    });

    // 2. Intelligent Persian search
    if (!search.trim()) return base;

    const searchable = base.map((p) => ({
      ...p,
      name: p.name,
      code: p.code || "",
      abbreviation: p.title || "",
    }));

    return searchCourses(searchable, search);
  }, [professors, search, selectedFaculty, selectedTitle]);

  return (
    <div className="space-y-6">
      {/* Header Banner with Centered Hero Search */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-primary/5 to-background/50 p-6 sm:p-10 shadow-xs text-center">
        {/* Subtle decorative glow circle in the background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-2.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            جستجو و بررسی مشخصات اساتید
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            مشخصات اساتید دانشکده فنی، دروس ارائه‌شده، سوابق علمی و نظرات و امتیازات دانشجویان را مشاهده و بررسی نمایید.
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
              placeholder="جستجوی نام یا مرتبه علمی استاد..."
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
                  فیلترهای اساتید
                </span>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFaculty("all");
                      setSelectedTitle("all");
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
                          همه دانشکده‌ها ({professors.length})
                        </SelectItem>
                        {faculties.map((f) => {
                          const count = professors.filter((p) => p.facultyId === f.id).length;
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

                {/* Academic Title Filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground block text-right">
                    مرتبه علمی
                  </label>
                  <Select value={selectedTitle} onValueChange={setSelectedTitle}>
                    <SelectTrigger className="w-full text-xs h-8.5 rounded-lg bg-background/60">
                      <SelectValue placeholder="مرتبه علمی" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all" className="text-xs">
                          همه مرتبه‌ها
                        </SelectItem>
                        {availableTitles.map((t) => {
                          const count = professors.filter((p) => p.title === t).length;
                          return (
                            <SelectItem key={t} value={t} className="text-xs">
                              {t} ({count})
                            </SelectItem>
                          );
                        })}
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
          نمایش <strong className="text-foreground">{filteredProfessors.length}</strong> استاد از مجموع {professors.length} استاد ثبت‌شده
        </span>
        {(search || activeFilterCount > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedFaculty("all");
              setSelectedTitle("all");
            }}
            className="h-6 text-[11px] text-primary hover:bg-primary/10 rounded-md cursor-pointer"
          >
            بازنشانی همه فیلترها و جستجو
          </Button>
        )}
      </div>

      {/* Professors Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-xs">در حال بارگذاری اساتید...</span>
        </div>
      ) : filteredProfessors.length === 0 ? (
        <div className="text-center py-16 border rounded-2xl border-dashed border-border/80 p-8 space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">استادی با این مشخصات یافت نشد</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عبارت جستجو یا فیلتر دانشکده را تغییر دهید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProfessors.map((prof) => {
            const fac = faculties.find((f) => f.id === prof.facultyId);
            return (
              <Link
                key={prof.id}
                href={`/professors/${prof.id}`}
                className="group relative rounded-2xl border border-border/70 bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Avatar + Details */}
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 overflow-hidden">
                      {prof.avatarUrl ? (
                        <img
                          src={prof.avatarUrl}
                          alt={prof.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{prof.name[0] || "ا"}</span>
                      )}
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                          {prof.name}
                        </h3>
                        {prof.code && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono h-4 font-normal text-muted-foreground shrink-0">
                            {prof.code}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block truncate">
                        {prof.title || "استاد تمام"}
                      </span>
                    </div>
                  </div>

                  {/* Faculty & Email */}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0 opacity-60" />
                      <span className="truncate">{fac?.name || "دانشکده مهندسی برق و کامپیوتر"}</span>
                    </p>
                    {prof.email && (
                      <p className="flex items-center gap-1.5  text-[11px] truncate">
                        <Mail className="h-3 w-3 text-muted-foreground shrink-0 opacity-60" />
                        <span className="truncate">{prof.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-primary font-semibold">
                  <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    مشاهده پروفایل، دروس و نظرات
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

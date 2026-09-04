"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Building2,
  BookOpen,
  Star,
  MessageSquare,
  ArrowLeft,
  GraduationCap,
  Loader2,
  Mail,
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
import type { Professor, Faculty } from "@/lib/types";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [profRes, facRes] = await Promise.all([
          fetch("/api/professors").then((r) => r.json()),
          fetch("/api/faculties").then((r) => r.json()),
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
    return professors.filter((p) => {
      const searchLower = search.toLowerCase().trim();
      const matchesSearch =
        searchLower === "" ||
        p.name.toLowerCase().includes(searchLower) ||
        (p.code || "").toLowerCase().includes(searchLower) ||
        (p.title || "").toLowerCase().includes(searchLower) ||
        (p.email || "").toLowerCase().includes(searchLower);

      const matchesFaculty =
        selectedFaculty === "all" || p.facultyId === selectedFaculty;

      return matchesSearch && matchesFaculty;
    });
  }, [professors, search, selectedFaculty]);

  return (
    <div className="space-y-6">
      {/* Header Banner - Flat & Minimal */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background to-background p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Users className="h-3.5 w-3.5" />
            <span>بانک اطلاعاتی اساتید و اعضای هیئت علمی</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            جستجو و بررسی مشخصات اساتید
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            در این بخش می‌توانید لیست اساتید دانشکده فنی را مشاهده کرده، دروسی که تدریس می‌کنند را بررسی کنید و نظرات و امتیازات دانشجویان را مشاهده نمایید.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <Card className="border border-border/80 shadow-xs">
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام یا مرتبه علمی استاد..."
                className="pr-9 text-xs h-7"
                icon={<Search className="h-4 w-4 text-muted-foreground" />}
              />
            </div>

            {/* Faculty Filter */}
            <div className="w-full md:w-64">
              <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                <SelectTrigger className="w-full text-xs h-9">
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
          </div>

          {/* Stats & Reset */}
          <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-muted-foreground">
            <span>
              نمایش <strong className="text-foreground">{filteredProfessors.length}</strong> استاد از مجموع {professors.length} استاد ثبت‌شده
            </span>
            {(search || selectedFaculty !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedFaculty("all");
                }}
                className="h-6 text-[11px] text-primary"
              >
                بازنشانی فیلترها
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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

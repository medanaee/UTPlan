"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, CheckSquare, Square, Loader2, Sparkles, Scale } from "lucide-react";
import type { Course } from "@/lib/types";

interface CategoryCourseAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  type: "visual" | "rule";
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  allCourses: Course[];
  currentAssignedCourseIds: string[];
  onSuccess: () => void;
}

export function CategoryCourseAssignDialog({
  open,
  onOpenChange,
  trackId,
  type,
  categoryId,
  categoryName,
  categoryColor,
  allCourses,
  currentAssignedCourseIds,
  onSuccess,
}: CategoryCourseAssignDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentAssignedCourseIds));
      setSearch("");
    }
  }, [open, currentAssignedCourseIds]);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q))
    );
  }, [allCourses, search]);

  const toggleCourse = (courseId: string) => {
    const next = new Set(selectedIds);
    if (next.has(courseId)) {
      next.delete(courseId);
    } else {
      next.add(courseId);
    }
    setSelectedIds(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredCourses.forEach((c) => next.add(c.id));
    setSelectedIds(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredCourses.forEach((c) => next.delete(c.id));
    setSelectedIds(next);
  };

  const selectedCoursesList = useMemo(() => {
    return allCourses.filter((c) => selectedIds.has(c.id));
  }, [allCourses, selectedIds]);

  const totalUnits = useMemo(() => {
    return selectedCoursesList.reduce((sum, c) => sum + (c.units || 3), 0);
  }, [selectedCoursesList]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/tracks/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_category_courses",
          trackId,
          type,
          categoryId,
          courseIds: Array.from(selectedIds),
        }),
      }).then((r) => r.json());

      if (res.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        alert(res.message || "خطا در ذخیره دروس این دسته");
      }
    } catch (err: any) {
      alert("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            {type === "visual" ? (
              <div
                className="h-5 w-5 rounded-full border shadow-2xs shrink-0"
                style={{ backgroundColor: categoryColor || "#3b82f6" }}
              />
            ) : (
              <Scale className="h-5 w-5 text-primary shrink-0" />
            )}
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>تخصیص دروس به «{categoryName}»</span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {type === "visual" ? "دسته بصری چارت" : "دسته قوانین آموزشی"}
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            دروس مورد نظر را با تیک زدن انتخاب کنید تا در این دسته‌بندی قرار گیرند.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar & Search */}
        <div className="p-3 border-b bg-background space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="جستجوی نام درس یا کد درس..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllFiltered}
                className="h-8 text-xs gap-1 shadow-2xs font-normal"
              >
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                انتخاب همه
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAllFiltered}
                className="h-8 text-xs gap-1 shadow-2xs font-normal"
              >
                <Square className="h-3.5 w-3.5 text-muted-foreground" />
                لغو همه
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              نمایش <b className="text-foreground">{filteredCourses.length}</b> درس از مجموع {allCourses.length} درس دانشکده
            </span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-primary">
                {selectedIds.size} درس انتخاب‌شده
              </span>
              <span>•</span>
              <span className="font-semibold text-foreground">
                {totalUnits} واحد
              </span>
            </div>
          </div>
        </div>

        {/* Course List Scrollable */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px] max-h-[360px]">
          {filteredCourses.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p>درسی با این مشخصات یافت نشد.</p>
            </div>
          ) : (
            filteredCourses.map((c) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => toggleCourse(c.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-2xs"
                      : "border-border/60 bg-card hover:bg-muted/30 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 rounded accent-primary cursor-pointer"
                    />
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-2">
                        <span>{c.name}</span>
                        {c.code && (
                          <Badge variant="outline" className="text-[10px] font-mono font-normal">
                            {c.code}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {c.units} واحد • {c.offeredIn === "both" ? "هردو ترم" : c.offeredIn === "fall" ? "ترم پاییز" : "ترم بهار"}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant={isSelected ? "default" : "secondary"}
                    className="text-[10px] font-normal"
                  >
                    {isSelected ? "تخصیص داده شده" : "تخصیص نیافته"}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-3 border-t bg-muted/20 flex flex-row items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              مجموع: <b className="text-foreground">{selectedIds.size}</b> درس (<b className="text-primary">{totalUnits}</b> واحد)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              انصراف
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="h-8 text-xs font-bold gap-1.5 px-4"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                "تایید و ذخیره تخصیص"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

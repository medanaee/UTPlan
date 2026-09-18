"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  BookOpen,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
  Scale,
  Link2,
  CheckCircle2,
  Filter,
  RotateCcw,
} from "lucide-react";
import type { Course } from "@/lib/types";
import { searchCourses } from "@/lib/search/persian-search";
import { cn } from "@/lib/utils";
import { postJson } from "@/lib/api-client";

export interface OtherCategoryAssignmentInfo {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
}

interface CategoryCourseAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackId: string;
  type?: "visual" | "rule" | "category";
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  allCourses: Course[];
  currentAssignedCourseIds: string[];
  currentFacultyId?: string;
  otherCategoryAssignments?: Record<string, OtherCategoryAssignmentInfo>;
  onSuccess: (updatedAssignments?: any[]) => void;
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
  currentFacultyId,
  otherCategoryAssignments,
  onSuccess,
}: CategoryCourseAssignDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterDegree, setFilterDegree] = useState<string>("all");
  const [filterUnits, setFilterUnits] = useState<string>("all");
  const [filterOffered, setFilterOffered] = useState<string>("all");
  const [isSaving, setIsSaving] = useState(false);
  const lastClickedIdRef = useRef<string | null>(null);
  const lastActionRef = useRef<"select" | "deselect">("select");
  const lastShiftRef = useRef(false);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(currentAssignedCourseIds));
      setSearch("");
      setFilterDegree("all");
      setFilterUnits("all");
      setFilterOffered("all");
      lastClickedIdRef.current = null;
      lastActionRef.current = "select";
      lastShiftRef.current = false;
    }
  }, [open, currentAssignedCourseIds]);

  const { filteredCourses, otherCategoryCount } = useMemo(() => {
    let matched = searchCourses(allCourses, search);

    if (filterDegree !== "all") {
      matched = matched.filter((c) => (c.degreeLevel || "undergrad") === filterDegree);
    }
    if (filterUnits !== "all") {
      if (filterUnits === "5+") {
        matched = matched.filter((c) => (c.units || 3) >= 5);
      } else {
        const uNum = Number(filterUnits);
        matched = matched.filter((c) => (c.units || 3) === uNum);
      }
    }
    if (filterOffered !== "all") {
      matched = matched.filter((c) => (c.offeredIn || "both") === filterOffered);
    }

    if (!otherCategoryAssignments || Object.keys(otherCategoryAssignments).length === 0) {
      return { filteredCourses: matched, otherCategoryCount: 0 };
    }

    const normalCourses: Course[] = [];
    const otherCatCourses: Course[] = [];

    for (const c of matched) {
      if (otherCategoryAssignments[c.id]) {
        otherCatCourses.push(c);
      } else {
        normalCourses.push(c);
      }
    }

    return {
      filteredCourses: [...normalCourses, ...otherCatCourses],
      otherCategoryCount: otherCatCourses.length,
    };
  }, [allCourses, search, filterDegree, filterUnits, filterOffered, otherCategoryAssignments]);

  const handleCourseToggle = (courseId: string, index: number, isShift = false) => {
    if (isShift) {
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
    }

    const next = new Set(selectedIds);
    const isCurrentlySelected = selectedIds.has(courseId);

    if (isShift && lastClickedIdRef.current) {
      const anchorIndex = filteredCourses.findIndex((c) => c.id === lastClickedIdRef.current);

      if (anchorIndex !== -1 && anchorIndex !== index) {
        const startIndex = Math.min(anchorIndex, index);
        const endIndex = Math.max(anchorIndex, index);
        const shouldSelect = lastActionRef.current === "select" || !isCurrentlySelected;

        for (let i = startIndex; i <= endIndex; i++) {
          const item = filteredCourses[i];
          if (item) {
            if (shouldSelect) {
              next.add(item.id);
            } else {
              next.delete(item.id);
            }
          }
        }

        setSelectedIds(next);
        lastClickedIdRef.current = courseId;
        lastActionRef.current = shouldSelect ? "select" : "deselect";
        return;
      }
    }

    if (isCurrentlySelected) {
      next.delete(courseId);
      lastActionRef.current = "deselect";
    } else {
      next.add(courseId);
      lastActionRef.current = "select";
    }

    lastClickedIdRef.current = courseId;
    setSelectedIds(next);
  };

  const toggleCourse = (courseId: string) => {
    const idx = filteredCourses.findIndex((c) => c.id === courseId);
    handleCourseToggle(courseId, idx === -1 ? 0 : idx, false);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredCourses.forEach((c) => next.add(c.id));
    setSelectedIds(next);
    lastClickedIdRef.current = null;
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredCourses.forEach((c) => next.delete(c.id));
    setSelectedIds(next);
    lastClickedIdRef.current = null;
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
      const res = await postJson("/api/tracks/assignments", {
        action: "assign_category_courses",
        trackId,
        categoryId,
        courseIds: Array.from(selectedIds),
      });

      if (res.success) {
        onSuccess(res.data);
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
            <div
              className="h-5 w-5 rounded-full border shadow-2xs shrink-0"
              style={{ backgroundColor: categoryColor || "#3b82f6" }}
            />
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>تخصیص دروس به «{categoryName}»</span>
              <Badge variant="outline" className="text-xs font-normal">
                دسته‌ها
              </Badge>
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            دروس مورد نظر را انتخاب کنید تا در این دسته‌بندی قرار گیرند.
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

          {/* Filters Row: Degree Level, Units, Offering Semester */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/50">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
              <Filter className="h-3 w-3" />
              <span>فیلترها:</span>
            </div>

            <Select value={filterDegree} onValueChange={(val) => val && setFilterDegree(val)}>
              <SelectTrigger className="h-7 text-[11px] w-[110px] bg-muted/30">
                <SelectValue placeholder="مقطع" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">همه مقاطع</SelectItem>
                  <SelectItem value="undergrad">کارشناسی</SelectItem>
                  <SelectItem value="master">کارشناسی ارشد</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={filterUnits} onValueChange={(val) => val && setFilterUnits(val)}>
              <SelectTrigger className="h-7 text-[11px] w-[105px] bg-muted/30">
                <SelectValue placeholder="واحد" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">همه واحدها</SelectItem>
                  <SelectItem value="1">۱ واحد</SelectItem>
                  <SelectItem value="2">۲ واحد</SelectItem>
                  <SelectItem value="3">۳ واحد</SelectItem>
                  <SelectItem value="4">۴ واحد</SelectItem>
                  <SelectItem value="5+">۵ واحد و بیشتر</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select value={filterOffered} onValueChange={(val) => val && setFilterOffered(val)}>
              <SelectTrigger className="h-7 text-[11px] w-[125px] bg-muted/30">
                <SelectValue placeholder="نیمسال ارائه" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">همه نیمسال‌ها</SelectItem>
                  <SelectItem value="both">هردو ترم</SelectItem>
                  <SelectItem value="fall">فقط پاییز</SelectItem>
                  <SelectItem value="spring">فقط بهار</SelectItem>
                  <SelectItem value="none">عدم ارائه</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {(filterDegree !== "all" || filterUnits !== "all" || filterOffered !== "all") && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterDegree("all");
                  setFilterUnits("all");
                  setFilterOffered("all");
                }}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                حذف فیلترها
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>
                نمایش <b className="text-foreground">{filteredCourses.length}</b> درس از مجموع {allCourses.length} درس مجاز دانشکده و لینک‌ها
              </span>
              {otherCategoryCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30 font-normal"
                >
                  {otherCategoryCount} درس در دسته‌های دیگر
                </Badge>
              )}
            </div>
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
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-55 max-h-90">
          {filteredCourses.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
              <BookOpen className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p>درسی با این مشخصات یافت نشد.</p>
            </div>
          ) : (
            filteredCourses.map((c, index) => {
              const isSelected = selectedIds.has(c.id);
              const isLinked = Boolean(currentFacultyId && c.facultyId && c.facultyId !== currentFacultyId);
              const otherCatInfo = otherCategoryAssignments?.[c.id];
              const isInOtherCat = Boolean(otherCatInfo);
              const isFirstOtherCat =
                isInOtherCat &&
                (index === 0 || !otherCategoryAssignments?.[filteredCourses[index - 1]?.id]);

              return (
                <React.Fragment key={c.id}>
                  {isFirstOtherCat && (
                    <div className="pt-3 pb-1 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <div className="h-px bg-emerald-500/20 flex-1" />
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-500/10 rounded-lg border border-emerald-500/25 text-[11px]">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        دروس تخصیص‌یافته به سایر دسته‌های این گرایش ({otherCategoryCount} درس)
                      </span>
                      <div className="h-px bg-emerald-500/20 flex-1" />
                    </div>
                  )}

                  <div
                    onClick={(e) => handleCourseToggle(c.id, index, e.shiftKey)}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                      isInOtherCat
                        ? isSelected
                          ? "border-emerald-500/50 bg-emerald-500/15 dark:bg-emerald-950/40 ring-1 ring-emerald-500/40 shadow-2xs"
                          : "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                        : isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-2xs"
                        : "border-border/60 bg-card hover:bg-muted/30 hover:border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          lastShiftRef.current = e.shiftKey;
                        }}
                        onCheckedChange={() => {
                          handleCourseToggle(c.id, index, lastShiftRef.current);
                          lastShiftRef.current = false;
                        }}
                        className={
                          isInOtherCat && isSelected
                            ? "data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                            : undefined
                        }
                      />
                      <div>
                        <div className="font-bold text-foreground flex items-center flex-wrap gap-1.5">
                          <span>{c.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium px-1.5 py-0 ${
                              c.degreeLevel === "master"
                                ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                            }`}
                          >
                            {c.degreeLevel === "master" ? "ارشد" : "کارشناسی"}
                          </Badge>
                          {isLinked && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-normal"
                            >
                              <Link2 className="h-2.5 w-2.5" />
                              {c.facultyName || "لینک‌شده"}
                            </Badge>
                          )}
                          {c.abbreviation && (
                            <Badge variant="outline" className="text-xs font-mono font-medium text-primary border-primary/30 bg-primary/5">
                              {c.abbreviation}
                            </Badge>
                          )}
                          {c.code && (
                            <Badge variant="outline" className="text-xs font-mono font-normal">
                              {c.code}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {c.units} واحد • {c.offeredIn === "both" ? "هردو ترم" : c.offeredIn === "fall" ? "ترم پاییز" : c.offeredIn === "spring" ? "ترم بهار" : "عدم ارائه"}
                          {isLinked && ` • لینک‌شده از ${c.facultyName || "دانشکده دیگر"}`}
                        </div>
                      </div>
                    </div>

                    {isInOtherCat ? (
                      <Badge
                        variant="outline"
                        className={
                          isSelected
                            ? "text-xs font-medium bg-emerald-600 text-white border-emerald-600"
                            : "text-xs font-normal bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                        }
                      >
                        {isSelected ? "تخصیص به این دسته" : `در «${otherCatInfo?.categoryName}»`}
                      </Badge>
                    ) : (
                      <Badge
                        variant={isSelected ? "default" : "secondary"}
                        className="text-xs font-normal"
                      >
                        {isSelected ? "تخصیص داده شده" : "تخصیص نیافته"}
                      </Badge>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Fixed Custom Footer - Clean RTL layout without standard DialogFooter conflict */}
        <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span>
              مجموع: <b className="text-foreground font-bold">{selectedIds.size}</b> درس (<b className="text-primary font-bold">{totalUnits}</b> واحد)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-xs"
            >
              انصراف
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
              className="h-8 px-4 text-xs font-bold gap-1.5"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

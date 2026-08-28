"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Save,
  Check,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type {
  Course,
  VisualCategory,
  RuleCategory,
  TrackCourseAssignment,
} from "@/lib/types";

interface CourseCategoryManagerProps {
  trackId: string;
  trackName: string;
  courses: Course[];
  visualCategories: VisualCategory[];
  ruleCategories: RuleCategory[];
  onAssignmentsUpdated?: () => void;
}

export function CourseCategoryManager({
  trackId,
  trackName,
  courses,
  visualCategories,
  ruleCategories,
  onAssignmentsUpdated,
}: CourseCategoryManagerProps) {
  const [assignments, setAssignments] = useState<Map<string, { vcatId?: string; rcatId?: string }>>(
    new Map()
  );
  const [search, setSearch] = useState("");
  const [filterVcat, setFilterVcat] = useState<string>("all");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Bulk action states
  const [bulkVcat, setBulkVcat] = useState<string>("");
  const [bulkRcat, setBulkRcat] = useState<string>("");

  // Load existing track assignments
  useEffect(() => {
    if (!trackId) return;

    async function loadAssignments() {
      try {
        const res = await fetch(`/api/tracks/assignments?trackId=${trackId}`).then((r) => r.json());
        if (res.success && Array.isArray(res.data)) {
          const map = new Map<string, { vcatId?: string; rcatId?: string }>();
          for (const item of res.data as TrackCourseAssignment[]) {
            map.set(item.courseId, {
              vcatId: item.visualCategoryId || undefined,
              rcatId: item.ruleCategoryId || undefined,
            });
          }
          setAssignments(map);
        }
      } catch (e) {
        console.error("Load assignments error:", e);
      }
    }

    loadAssignments();
    setSelectedCourseIds(new Set());
  }, [trackId]);

  const handleUpdateCourseAssignment = (
    courseId: string,
    field: "vcatId" | "rcatId",
    value: string
  ) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      const current = next.get(courseId) || {};
      next.set(courseId, {
        ...current,
        [field]: value || undefined,
      });
      return next;
    });
  };

  const toggleSelectCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleSelectAll = (filtered: Course[]) => {
    if (selectedCourseIds.size === filtered.length) {
      setSelectedCourseIds(new Set());
    } else {
      setSelectedCourseIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const applyBulkAssign = () => {
    if (selectedCourseIds.size === 0) return;

    setAssignments((prev) => {
      const next = new Map(prev);
      selectedCourseIds.forEach((courseId) => {
        const current = next.get(courseId) || {};
        next.set(courseId, {
          vcatId: bulkVcat !== "" ? (bulkVcat === "none" ? undefined : bulkVcat) : current.vcatId,
          rcatId: bulkRcat !== "" ? (bulkRcat === "none" ? undefined : bulkRcat) : current.rcatId,
        });
      });
      return next;
    });

    setSelectedCourseIds(new Set());
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = Array.from(assignments.entries()).map(([courseId, data]) => ({
        courseId,
        visualCategoryId: data.vcatId || null,
        ruleCategoryId: data.rcatId || null,
      }));

      const res = await fetch("/api/tracks/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId,
          assignments: payload,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSavedSuccess(true);
        if (onAssignmentsUpdated) onAssignmentsUpdated();
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Save assignments error:", e);
    } finally {
      setSaving(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());

    const currentVcat = assignments.get(c.id)?.vcatId;
    const matchesVcat =
      filterVcat === "all" ||
      (filterVcat === "unassigned" && !currentVcat) ||
      currentVcat === filterVcat;

    return matchesSearch && matchesVcat;
  });

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">
                تخصیص دروس به دسته‌ها در گرایش: «{trackName}»
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              هر درس را به یک دسته بصری (برای نمایش با رنگ اختصاصی در سایدبار) و یک دسته قوانین (جهت
              محاسبه سقف و کف واحدها در موتور شروط) متصل کنید.
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={saving}
            className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
          >
            {savedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                تغییرات ذخیره شد
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات دسته‌بندی"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Filter and Search controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Input
                placeholder="جستجوی درس..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 max-w-[200px] text-xs pr-8"
              />
              <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            </div>

            <select
              value={filterVcat}
              onChange={(e) => setFilterVcat(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-muted-foreground focus:ring-1 focus:ring-primary"
            >
              <option value="all">تمام دسته‌ها</option>
              <option value="unassigned">دروس دسته‌بندی‌نشده</option>
              {visualCategories.map((vc) => (
                <option key={vc.id} value={vc.id}>
                  {vc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Assign Panel */}
          {selectedCourseIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-1.5 text-xs">
              <span className="font-semibold text-primary px-1">
                {selectedCourseIds.size} درس انتخاب شده:
              </span>

              <select
                value={bulkVcat}
                onChange={(e) => setBulkVcat(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">دسته بصری...</option>
                <option value="none">بدون دسته</option>
                {visualCategories.map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    {vc.name}
                  </option>
                ))}
              </select>

              <select
                value={bulkRcat}
                onChange={(e) => setBulkRcat(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">دسته قوانین...</option>
                <option value="none">بدون دسته</option>
                {ruleCategories.map((rc) => (
                  <option key={rc.id} value={rc.id}>
                    {rc.name}
                  </option>
                ))}
              </select>

              <Button size="sm" onClick={applyBulkAssign} className="h-7 text-xs px-2.5">
                اعمال
              </Button>
            </div>
          )}
        </div>

        {/* Table of courses with assignments */}
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-2.5 px-3 text-right w-10">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(filteredCourses)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {selectedCourseIds.size === filteredCourses.length && filteredCourses.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">نام درس و کد</th>
                <th className="py-2.5 px-3 text-right w-20">واحد</th>
                <th className="py-2.5 px-3 text-right">دسته بصری (رنگی سایدبار چارت)</th>
                <th className="py-2.5 px-3 text-right">دسته قوانین (موتور شروط فارغ‌التحصیلی)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredCourses.map((course) => {
                const isSelected = selectedCourseIds.has(course.id);
                const currentVcatId = assignments.get(course.id)?.vcatId || "";
                const currentRcatId = assignments.get(course.id)?.rcatId || "";
                const currentVcat = visualCategories.find((vc) => vc.id === currentVcatId);

                return (
                  <tr
                    key={course.id}
                    className={`transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSelectCourse(course.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground">{course.name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{course.code}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {course.units} واحد
                      </Badge>
                    </td>

                    {/* Visual Category Dropdown */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {currentVcat && (
                          <span
                            className="h-3 w-3 rounded-full border shadow-2xs shrink-0"
                            style={{ backgroundColor: currentVcat.color }}
                          />
                        )}
                        <select
                          value={currentVcatId}
                          onChange={(e) =>
                            handleUpdateCourseAssignment(course.id, "vcatId", e.target.value)
                          }
                          className="h-8 w-full max-w-[200px] rounded-md border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-primary"
                        >
                          <option value="">-- بدون دسته بصری --</option>
                          {visualCategories.map((vc) => (
                            <option key={vc.id} value={vc.id}>
                              {vc.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Rule Category Dropdown */}
                    <td className="py-2.5 px-3">
                      <select
                        value={currentRcatId}
                        onChange={(e) =>
                          handleUpdateCourseAssignment(course.id, "rcatId", e.target.value)
                        }
                        className="h-8 w-full max-w-[220px] rounded-md border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-primary"
                      >
                        <option value="">-- بدون دسته قوانین --</option>
                        {ruleCategories.map((rc) => (
                          <option key={rc.id} value={rc.id}>
                            {rc.name} {rc.minCredits ? `(حداقل ${rc.minCredits} واحد)` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}

              {filteredCourses.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                    هیچ درسی با این مشخصات یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Save,
  Check,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPicker } from "./category-picker";
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
      const cleanVal = value === "none" || value === "" ? undefined : value;
      next.set(courseId, {
        ...current,
        [field]: cleanVal,
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
        onAssignmentsUpdated?.();
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Save assignments error:", e);
    } finally {
      setSaving(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (filterVcat === "all") return true;
    if (filterVcat === "unassigned") {
      const a = assignments.get(c.id);
      return !a?.vcatId;
    }
    const a = assignments.get(c.id);
    return a?.vcatId === filterVcat;
  });

  const visualCategoryFilterItems = [
    { value: "all", label: "همه دسته‌ها" },
    { value: "unassigned", label: "تخصیص‌نیافته" },
    ...visualCategories.map((vc) => ({ value: vc.id, label: vc.name })),
  ];

  const bulkVisualCategoryItems = [
    { value: "none", label: "بدون دسته بصری" },
    ...visualCategories.map((vc) => ({ value: vc.id, label: vc.name })),
  ];

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs">
      <CardHeader className="pb-4 sm:pb-5 border-b border-border/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">
                تخصیص دسته‌ها به دروس گرایش ({trackName})
              </CardTitle>
              <CardDescription className="text-xs">
                تعیین دسته بصری (رنگ در چارت) و دسته قوانین (سلسله‌مراتب شبیه‌ساز) برای هر درس
              </CardDescription>
            </div>
          </div>

          <Button
            onClick={handleSaveAll}
            disabled={saving}
            size="sm"
            className="h-8 gap-1.5 text-xs shadow-2xs font-semibold"
          >
            {savedSuccess ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>ذخیره شد</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? "در حال ذخیره..." : "ذخیره تمام تغییرات"}</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-5 space-y-4">
        {/* Filter & Bulk Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-48 sm:w-60">
              <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="جستجوی درس..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pr-8 text-xs"
              />
            </div>

            {/* Filter by Visual Category */}
            <Select
              items={visualCategoryFilterItems}
              value={filterVcat}
              onValueChange={(val) => val && setFilterVcat(val)}
            >
              <SelectTrigger size="sm" className="h-8 text-xs min-w-[130px]">
                <SelectValue placeholder="فیلتر دسته بصری..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {visualCategoryFilterItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Assign Controls */}
          {selectedCourseIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-muted/60 p-1.5 px-3 rounded-xl border border-primary/20 text-xs animate-in fade-in">
              <span className="font-semibold text-primary">
                {selectedCourseIds.size} درس انتخاب شده:
              </span>

              <Select
                items={bulkVisualCategoryItems}
                value={bulkVcat}
                onValueChange={(val) => val && setBulkVcat(val)}
              >
                <SelectTrigger size="sm" className="h-7 min-w-[120px] text-xs bg-background">
                  <SelectValue placeholder="دسته بصری..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">بدون دسته بصری</SelectItem>
                    {visualCategories.map((vc) => (
                      <SelectItem key={vc.id} value={vc.id}>
                        {vc.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <CategoryPicker
                categories={ruleCategories}
                value={bulkRcat === "none" || !bulkRcat ? null : bulkRcat}
                onChange={(val) => setBulkRcat(val || "none")}
                placeholder="دسته قوانین..."
                triggerClassName="h-7 min-w-[150px] text-xs bg-background"
              />

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
                  <Checkbox
                    checked={
                      selectedCourseIds.size === filteredCourses.length && filteredCourses.length > 0
                    }
                    onCheckedChange={() => toggleSelectAll(filteredCourses)}
                  />
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
                const currentVcatId = assignments.get(course.id)?.vcatId || "none";
                const currentRcatId = assignments.get(course.id)?.rcatId || "none";
                const currentVcat = visualCategories.find((vc) => vc.id === currentVcatId);

                return (
                  <tr
                    key={course.id}
                    className={`transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectCourse(course.id)}
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-foreground text-sm">{course.name}</div>
                      <div className="text-[10px] text-muted-foreground">{course.code}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px]">
                        {course.units} واحد
                      </Badge>
                    </td>

                    {/* Visual Category Select */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        {currentVcat && (
                          <span
                            className="h-3 w-3 rounded-full border shadow-2xs shrink-0"
                            style={{ backgroundColor: currentVcat.color }}
                          />
                        )}
                        <Select
                          items={[
                            { value: "none", label: "-- بدون دسته بصری --" },
                            ...visualCategories.map((vc) => ({ value: vc.id, label: vc.name })),
                          ]}
                          value={currentVcatId}
                          onValueChange={(val) =>
                            val && handleUpdateCourseAssignment(course.id, "vcatId", val)
                          }
                        >
                          <SelectTrigger className="h-8 w-full max-w-[200px]">
                            <SelectValue placeholder="-- انتخاب دسته بصری --" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="none">-- بدون دسته بصری --</SelectItem>
                              {visualCategories.map((vc) => (
                                <SelectItem key={vc.id} value={vc.id}>
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ backgroundColor: vc.color }}
                                    />
                                    <span>{vc.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>

                    {/* Rule Category Select */}
                    <td className="py-2.5 px-3">
                      <CategoryPicker
                        categories={ruleCategories}
                        value={currentRcatId === "none" || !currentRcatId ? null : currentRcatId}
                        onChange={(val) =>
                          handleUpdateCourseAssignment(course.id, "rcatId", val || "none")
                        }
                        placeholder="-- بدون دسته قوانین --"
                        triggerClassName="h-8 w-full max-w-[220px] text-xs"
                      />
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

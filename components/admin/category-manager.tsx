"use client";

import React, { useState } from "react";
import {
  Layers,
  Building2,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useAdminStore } from "@/lib/stores/admin-store";
import { CourseCategoryManager } from "./course-category-manager";

const COLOR_PRESETS = [
  { name: "آبی", hex: "#3b82f6" },
  { name: "سبز", hex: "#10b981" },
  { name: "زرد", hex: "#f59e0b" },
  { name: "قرمز", hex: "#ef4444" },
  { name: "بنفش", hex: "#8b5cf6" },
  { name: "صورتی", hex: "#ec4899" },
  { name: "نارنجی", hex: "#f97316" },
  { name: "طوسی", hex: "#6b7280" },
];

interface CategoryManagerProps {
  onNavigateToStructure?: () => void;
}

export function CategoryManager({ onNavigateToStructure }: CategoryManagerProps) {
  const {
    faculties,
    majors,
    tracks,
    courses,
    visualCats,
    ruleCats,
    selectedFacultyId,
    selectedMajorId,
    selectedTrackId,
    setVisualCats,
    setRuleCats,
    setTrackAssignments,
    loadTrackDetails,
    setActionMessage,
  } = useAdminStore();

  const [vcatModalOpen, setVcatModalOpen] = useState(false);
  const [rcatModalOpen, setRcatModalOpen] = useState(false);

  const [vcatForm, setVcatForm] = useState({ name: "", color: "#3b82f6", sortOrder: 1 });
  const [rcatForm, setRcatForm] = useState<{ name: string; parentId: string | null }>({
    name: "",
    parentId: null,
  });

  const currentFaculty = faculties.find((f) => f.id === selectedFacultyId);
  const currentMajor = majors.find((m) => m.id === selectedMajorId);
  const currentTrack = tracks.find((t) => t.id === selectedTrackId);

  // Create Visual Category
  const handleCreateVcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "visual",
        trackId: selectedTrackId,
        ...vcatForm,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setVcatModalOpen(false);
      setVcatForm({ name: "", color: "#3b82f6", sortOrder: 1 });
      setActionMessage("دسته بصری جدید با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    }
  };

  // Create Rule Category
  const handleCreateRcat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrackId) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "rule",
        trackId: selectedTrackId,
        ...rcatForm,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setRcatModalOpen(false);
      setRcatForm({ name: "", parentId: null });
      setActionMessage("دسته قوانین با موفقیت اضافه شد.");
      await loadTrackDetails(selectedTrackId);
    }
  };

  const ruleCatParentSelectItems = [
    { value: "none", label: "-- دسته اصلی (بدون والد) --" },
    ...ruleCats.map((rc) => ({
      value: rc.id,
      label: rc.parentId ? `↳ ${rc.name}` : rc.name,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Active Track Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-card p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">گرایش انتخابی شما:</span>
                {currentTrack ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="default" className="text-xs px-2.5 py-0.5 font-bold shadow-xs">
                      {currentTrack.name} ({currentTrack.code})
                    </Badge>
                    {currentMajor && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        رشته: {currentMajor.name}
                      </Badge>
                    )}
                    {currentFaculty && (
                      <Badge variant="outline" className="text-xs px-2 py-0.5">
                        دانشکده: {currentFaculty.name}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-destructive border-destructive/40">
                    گرایشی در بخش ساختار دانشگاه انتخاب نشده است
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                دسته‌های بصری و دسته‌های قوانین برای دروس این گرایش تنظیم می‌شوند.
              </p>
            </div>
          </div>

          {!currentTrack && onNavigateToStructure && (
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateToStructure}
              className="h-8 text-xs gap-1 shadow-2xs"
            >
              <Building2 className="h-3.5 w-3.5" />
              انتخاب در ساختار دانشگاه
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Visual Categories */}
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle className="text-xs font-bold">دسته‌های بصری (رنگی سایدبار چارت)</CardTitle>
              <CardDescription className="text-[11px]">
                این دسته‌ها با رنگ دلخواه در سایدبار ساخت چارت به دانشجو نشان داده می‌شوند.
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!selectedTrackId}
              onClick={() => setVcatModalOpen(true)}
              className="h-7 text-[11px] gap-1"
            >
              <Plus className="h-3 w-3" /> افزودن
            </Button>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {visualCats.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border shadow-xs"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-semibold">{cat.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await fetch(`/api/categories?id=${cat.id}&type=visual`, { method: "DELETE" });
                    const res = await fetch(`/api/categories?trackId=${selectedTrackId}`).then((r) =>
                      r.json()
                    );
                    if (res.success) setVisualCats(res.data.visual);
                  }}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {visualCats.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">دسته‌ای تعریف نشده است.</p>
            )}
          </CardContent>
        </Card>

        {/* Rule Categories (Hierarchical Tree) */}
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div>
              <CardTitle className="text-xs font-bold">دسته‌های قوانین (درختی و تو‌در‌تو)</CardTitle>
              <CardDescription className="text-[11px]">
                تعریف ساختار درختی و دسته‌های والد و زیردسته جهت انتساب دروس و ساخت قوانین فارغ‌التحصیلی
              </CardDescription>
            </div>
            <Button
              size="sm"
              disabled={!selectedTrackId}
              onClick={() => {
                setRcatForm({ name: "", parentId: null });
                setRcatModalOpen(true);
              }}
              className="h-7 text-[11px] gap-1"
            >
              <Plus className="h-3 w-3" /> دسته اصلی
            </Button>
          </CardHeader>
          <CardContent className="p-3 space-y-2.5">
            {(() => {
              const topLevelCats = ruleCats.filter(
                (c) => !c.parentId || !ruleCats.some((p) => p.id === c.parentId)
              );
              const getChildCats = (parentId: string) =>
                ruleCats.filter((c) => c.parentId === parentId);

              if (ruleCats.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    دسته‌ای تعریف نشده است.
                  </p>
                );
              }

              return topLevelCats.map((parentCat) => {
                const children = getChildCats(parentCat.id);

                return (
                  <div
                    key={parentCat.id}
                    className="space-y-1.5 rounded-xl border border-border/70 bg-muted/15 p-2.5"
                  >
                    {/* Parent Category Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="font-bold text-xs text-foreground">
                          {parentCat.name}
                        </span>
                        {children.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5">
                            {children.length} زیردسته
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRcatForm({ name: "", parentId: parentCat.id });
                            setRcatModalOpen(true);
                          }}
                          className="h-6 text-[10px] px-2 gap-1 text-primary hover:bg-primary/10"
                          title="افزودن زیردسته به این دسته"
                        >
                          <Plus className="h-3 w-3" />
                          زیردسته
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            await fetch(`/api/categories?id=${parentCat.id}&type=rule`, {
                              method: "DELETE",
                            });
                            const res = await fetch(
                              `/api/categories?trackId=${selectedTrackId}`
                            ).then((r) => r.json());
                            if (res.success) setRuleCats(res.data.rule);
                          }}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          title="حذف دسته"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Nested Children Subcategories */}
                    {children.length > 0 && (
                      <div className="mr-3.5 pr-2.5 border-r-2 border-primary/30 space-y-1 pt-1">
                        {children.map((childCat) => {
                          const subChildren = getChildCats(childCat.id);
                          return (
                            <div key={childCat.id} className="space-y-1">
                              <div className="flex items-center justify-between rounded-lg bg-background/80 border border-border/50 p-2 text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-muted-foreground text-[10px]">↳</span>
                                  <span className="font-medium text-foreground">
                                    {childCat.name}
                                  </span>
                                  {subChildren.length > 0 && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                                      {subChildren.length} زیردسته
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setRcatForm({ name: "", parentId: childCat.id });
                                      setRcatModalOpen(true);
                                    }}
                                    className="h-5 text-[9px] px-1.5 gap-0.5 text-primary hover:bg-primary/10"
                                    title="افزودن زیردسته"
                                  >
                                    <Plus className="h-2.5 w-2.5" />
                                    زیردسته
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      await fetch(
                                        `/api/categories?id=${childCat.id}&type=rule`,
                                        { method: "DELETE" }
                                      );
                                      const res = await fetch(
                                        `/api/categories?trackId=${selectedTrackId}`
                                      ).then((r) => r.json());
                                      if (res.success) setRuleCats(res.data.rule);
                                    }}
                                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                    title="حذف زیردسته"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>

                              {/* Level 3 Subchildren */}
                              {subChildren.length > 0 && (
                                <div className="mr-3 pr-2 border-r border-border/60 space-y-1">
                                  {subChildren.map((subChild) => (
                                    <div
                                      key={subChild.id}
                                      className="flex items-center justify-between rounded-md bg-muted/40 p-1.5 text-[11px]"
                                    >
                                      <span className="text-muted-foreground">↳ {subChild.name}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                          await fetch(
                                            `/api/categories?id=${subChild.id}&type=rule`,
                                            { method: "DELETE" }
                                          );
                                          const res = await fetch(
                                            `/api/categories?trackId=${selectedTrackId}`
                                          ).then((r) => r.json());
                                          if (res.success) setRuleCats(res.data.rule);
                                        }}
                                        className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Course Category Assignment Manager */}
      {selectedTrackId && (
        <CourseCategoryManager
          trackId={selectedTrackId}
          trackName={tracks.find((t) => t.id === selectedTrackId)?.name || "گرایش انتخابی"}
          courses={courses}
          visualCategories={visualCats}
          ruleCategories={ruleCats}
          onAssignmentsUpdated={async () => {
            const assignRes = await fetch(`/api/tracks/assignments?trackId=${selectedTrackId}`).then(
              (r) => r.json()
            );
            if (assignRes.success) setTrackAssignments(assignRes.data);
          }}
        />
      )}

      {/* Add Visual Category Modal */}
      <Dialog open={vcatModalOpen} onOpenChange={setVcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته بصری رنگی</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateVcat} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام دسته</Label>
              <Input
                required
                placeholder="مثلاً دروس پایه"
                value={vcatForm.name}
                onChange={(e) => setVcatForm({ ...vcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رنگ شاخص:</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    type="button"
                    key={color.hex}
                    onClick={() => setVcatForm({ ...vcatForm, color: color.hex })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform ${
                      vcatForm.color === color.hex ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت دسته بصری
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Rule Category Modal */}
      <Dialog open={rcatModalOpen} onOpenChange={setRcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {rcatForm.parentId ? "افزودن زیردسته قوانین" : "افزودن دسته قوانین اصلی"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              دسته‌های قوانین می‌توانند به صورت درختی و تو‌در‌تو تعریف شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRcat} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">دسته والد (اختیاری):</Label>
              <Select
                items={ruleCatParentSelectItems}
                value={rcatForm.parentId || "none"}
                onValueChange={(val) =>
                  setRcatForm({ ...rcatForm, parentId: val === "none" || !val ? null : val })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="دسته اصلی (بدون والد)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ruleCatParentSelectItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">نام دسته قوانین</Label>
              <Input
                required
                placeholder="مثلاً شبکه‌های کامپیوتری"
                value={rcatForm.name}
                onChange={(e) => setRcatForm({ ...rcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <Button type="submit" size="sm" className="w-full h-8 text-xs">
              ثبت دسته قوانین
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

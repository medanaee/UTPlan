"use client";

import React, { useState } from "react";
import {
  Layers,
  Building2,
  GripVertical,
  Plus,
  Trash2,
  CornerDownLeft,
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
import { CategoryPicker } from "./category-picker";
import { useAdminStore } from "@/lib/stores/admin-store";
import { CourseCategoryManager } from "./course-category-manager";
import { TrackCloneDialog } from "./track-clone-dialog";
import { Copy } from "lucide-react";

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
  const [cloneModalOpen, setCloneModalOpen] = useState(false);

  const [vcatForm, setVcatForm] = useState({ name: "", color: "#3b82f6", sortOrder: 1 });
  const [rcatForm, setRcatForm] = useState<{ name: string; parentId: string | null }>({
    name: "",
    parentId: null,
  });

  
  // Drag and Drop States
  const [draggedVcatIndex, setDraggedVcatIndex] = useState<number | null>(null);
  const [dragOverVcatIndex, setDragOverVcatIndex] = useState<number | null>(null);

  const [draggedRcatId, setDraggedRcatId] = useState<string | null>(null);
  const [dragOverRcatId, setDragOverRcatId] = useState<string | null>(null);

  // Visual Category Reorder Handler
  const handleVcatDrop = async (targetIndex: number) => {
    if (draggedVcatIndex === null || draggedVcatIndex === targetIndex) {
      setDraggedVcatIndex(null);
      setDragOverVcatIndex(null);
      return;
    }

    const updated = [...visualCats];
    const [draggedItem] = updated.splice(draggedVcatIndex, 1);
    updated.splice(targetIndex, 0, draggedItem);
    
    setVisualCats(updated);
    setDraggedVcatIndex(null);
    setDragOverVcatIndex(null);

    try {
      const itemsPayload = updated.map((item, idx) => ({ id: item.id, sortOrder: idx + 1 }));
      await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", type: "visual", items: itemsPayload }),
      });
    } catch (err) {
      console.error("Reorder visual categories error:", err);
    }
  };

  // Rule Category Reorder Handler
  const handleRcatDrop = async (targetCatId: string, parentId: string | null) => {
    if (!draggedRcatId || draggedRcatId === targetCatId) {
      setDraggedRcatId(null);
      setDragOverRcatId(null);
      return;
    }

    // Get sibling list
    const siblings = ruleCats.filter((c) => (c.parentId || null) === parentId);
    const draggedIdx = siblings.findIndex((c) => c.id === draggedRcatId);
    const targetIdx = siblings.findIndex((c) => c.id === targetCatId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedRcatId(null);
      setDragOverRcatId(null);
      return;
    }

    const reorderedSiblings = [...siblings];
    const [draggedItem] = reorderedSiblings.splice(draggedIdx, 1);
    reorderedSiblings.splice(targetIdx, 0, draggedItem);

    // Update global ruleCats list preserving other branches
    const otherCats = ruleCats.filter((c) => (c.parentId || null) !== parentId);
    const newRuleCats = [...otherCats, ...reorderedSiblings];

    setRuleCats(newRuleCats);
    setDraggedRcatId(null);
    setDragOverRcatId(null);

    try {
      const itemsPayload = reorderedSiblings.map((item, idx) => ({
        id: item.id,
        sortOrder: idx + 1,
        parentId: parentId || null,
      }));
      await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", type: "rule", items: itemsPayload }),
      });
    } catch (err) {
      console.error("Reorder rule categories error:", err);
    }
  };

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


  return (
    <div className="space-y-4">
      {/* Active Track Banner */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">گرایش انتخابی:</span>
                {currentTrack ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="default" className="text-xs px-2.5 py-0.5 font-bold shadow-xs">
                      {currentTrack.name}
                    </Badge>
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

          <div className="flex flex-wrap items-center gap-2">
            {currentTrack && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCloneModalOpen(true)}
                className="h-8 text-xs gap-1.5 shadow-2xs"
              >
                <Copy className="h-3.5 w-3.5 text-primary" />
                کپی ساختار از گرایش دیگر
              </Button>
            )}
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
          <CardContent className="px-3 space-y-2">
            {visualCats.map((cat, idx) => (
              <div
                key={cat.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", idx.toString());
                  setDraggedVcatIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverVcatIndex !== idx) setDragOverVcatIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverVcatIndex === idx) setDragOverVcatIndex(null);
                }}
                onDrop={() => handleVcatDrop(idx)}
                onDragEnd={() => {
                  setDraggedVcatIndex(null);
                  setDragOverVcatIndex(null);
                }}
                className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition-all duration-150 select-none cursor-grab active:cursor-grabbing ${
                  draggedVcatIndex === idx
                    ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.98]"
                    : dragOverVcatIndex === idx
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40 -translate-y-0.5"
                    : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
                  <span
                    className="h-4 w-4 rounded-full border shadow-2xs shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-bold text-foreground">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">#{idx + 1}</span>
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
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
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
          <CardContent className="px-3 space-y-2.5">
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

              return topLevelCats.map((parentCat, pIdx) => {
                const children = getChildCats(parentCat.id);

                return (
                  <div
                    key={parentCat.id}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggedRcatId(parentCat.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragOverRcatId !== parentCat.id) setDragOverRcatId(parentCat.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverRcatId === parentCat.id) setDragOverRcatId(null);
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleRcatDrop(parentCat.id, null);
                    }}
                    onDragEnd={() => {
                      setDraggedRcatId(null);
                      setDragOverRcatId(null);
                    }}
                    className={`space-y-1.5 rounded-2xl border p-3 transition-all duration-150 ${
                      draggedRcatId === parentCat.id
                        ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.99]"
                        : dragOverRcatId === parentCat.id
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
                        : "border-border/70 bg-card hover:border-border"
                    }`}
                  >
                    {/* Parent Category Row */}
                    <div className="flex items-center justify-between cursor-grab active:cursor-grabbing">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />
                        <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                        <span className="font-bold text-xs text-foreground">
                          {parentCat.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">#{pIdx + 1}</span>
                        {children.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-normal">
                            {children.length} زیردسته
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
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
                          onClick={async (e) => {
                            e.stopPropagation();
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
                      <div className="mr-3.5 pr-2.5 border-r-2 border-primary/30 space-y-1.5 pt-1">
                        {children.map((childCat, cIdx) => {
                          const subChildren = getChildCats(childCat.id);
                          return (
                            <div
                              key={childCat.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                setDraggedRcatId(childCat.id);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (dragOverRcatId !== childCat.id) setDragOverRcatId(childCat.id);
                              }}
                              onDragLeave={() => {
                                if (dragOverRcatId === childCat.id) setDragOverRcatId(null);
                              }}
                              onDrop={(e) => {
                                e.stopPropagation();
                                handleRcatDrop(childCat.id, parentCat.id);
                              }}
                              onDragEnd={() => {
                                setDraggedRcatId(null);
                                setDragOverRcatId(null);
                              }}
                              className={`space-y-1 rounded-xl border p-2 text-xs transition-all duration-150 cursor-grab active:cursor-grabbing ${
                                draggedRcatId === childCat.id
                                  ? "opacity-40 border-dashed border-primary bg-primary/5"
                                  : dragOverRcatId === childCat.id
                                  ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                                  : "bg-background/90 border-border/60 hover:border-primary/40"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <GripVertical className="h-3 w-3 text-muted-foreground/60 shrink-0 cursor-grab" />
                                  <CornerDownLeft className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                  <span className="font-semibold text-foreground">
                                    {childCat.name}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground font-mono">#{cIdx + 1}</span>
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
                                      <div className="flex items-center gap-1.5">
                                        <CornerDownLeft className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                        <span className="text-muted-foreground">{subChild.name}</span>
                                      </div>
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
        <DialogContent className="sm:max-w-xs" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته بصری چارت</DialogTitle>
            <DialogDescription className="text-xs">
              رنگ و نام این دسته در پیش‌نمایش گرافیکی چارت نمایش داده خواهد شد.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateVcat} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">نام دسته بصری</Label>
              <Input
                required
                placeholder="مثلاً دروس پایه"
                value={vcatForm.name}
                onChange={(e) => setVcatForm({ ...vcatForm, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">رنگ شاخص دسته</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setVcatForm({ ...vcatForm, color: color.hex })}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      vcatForm.color === color.hex
                        ? "ring-2 ring-primary ring-offset-2 scale-110"
                        : "opacity-80 hover:opacity-100"
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

      {/* Rule Category Modal with Drilldown CategoryPicker */}
      <Dialog open={rcatModalOpen} onOpenChange={setRcatModalOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">افزودن دسته قوانین آموزشی</DialogTitle>
            <DialogDescription className="text-xs">
              دسته‌ها به صورت درختی و سلسله‌مراتبی سازمان‌دهی می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRcat} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">دسته والد (اختیاری):</Label>
              <CategoryPicker
                categories={ruleCats}
                value={rcatForm.parentId}
                onChange={(val) => setRcatForm({ ...rcatForm, parentId: val })}
                placeholder="دسته اصلی (بدون والد)"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">نام دسته قوانین:</Label>
              <Input
                required
                placeholder="مثلاً شبکه‌های کامپیوتری"
                value={rcatForm.name}
                onChange={(e) => setRcatForm({ ...rcatForm, name: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full font-semibold">
              ثبت دسته قوانین
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Track Structure Clone Dialog */}
      <TrackCloneDialog
        open={cloneModalOpen}
        onOpenChange={setCloneModalOpen}
        targetTrack={currentTrack || null}
        allTracks={tracks}
        allMajors={majors}
        onSuccess={() => {
          if (selectedTrackId) {
            loadTrackDetails(selectedTrackId);
          }
        }}
      />
    </div>
  );
}

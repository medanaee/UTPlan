"use client";

import React, { useMemo } from "react";
import { GripVertical, CornerDownLeft, BookOpen, Plus, Pencil, Trash2, Eraser, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Course, VisualCategory } from "@/lib/types";

export interface VisualCategoryNodeProps {
  category: VisualCategory;
  depth?: number;
  maxDepth?: number;
  visualCats: VisualCategory[];
  draggedVcatId: string | null;
  dragOverVcatId: string | null;
  selectedTrackId: string | null;
  setDraggedVcatId: (id: string | null) => void;
  setDragOverVcatId: (id: string | null) => void;
  handleVcatDrop: (sourceId: string, targetParentId: string | null) => void;
  handleOpenEditVcat: (cat: VisualCategory) => void;
  setVcatForm: (form: { code: string; name: string; color: string; sortOrder: number; parentId: string | null }) => void;
  setVcatModalOpen: (open: boolean) => void;
  setAssignModal: (data: {
    open: boolean;
    type: "visual" | "rule";
    categoryId: string;
    categoryName: string;
    categoryColor?: string;
  }) => void;
  setVisualCats: (cats: VisualCategory[]) => void;
  getVisualCategoryCourses: (catId: string) => Course[];
  renderCourseChips: (catId: string, type: "visual" | "rule", name: string, color?: string) => React.ReactNode;
  onAssignmentsChanged?: () => Promise<void>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (catId: string) => void;
}

export function VisualCategoryNode({
  category,
  depth = 1,
  maxDepth = 3,
  visualCats,
  draggedVcatId,
  dragOverVcatId,
  selectedTrackId,
  setDraggedVcatId,
  setDragOverVcatId,
  handleVcatDrop,
  handleOpenEditVcat,
  setVcatForm,
  setVcatModalOpen,
  setAssignModal,
  setVisualCats,
  getVisualCategoryCourses,
  renderCourseChips,
  onAssignmentsChanged,
  collapsedIds,
  onToggleCollapse,
}: VisualCategoryNodeProps) {
  const children = visualCats.filter((c) => c.parentId === category.id);
  const assignedCourses = getVisualCategoryCourses(category.id);
  const isExpanded = collapsedIds ? !collapsedIds.has(category.id) : true;

  // Collect all category IDs in this subtree (this category + all its recursive subcategories)
  const subtreeCategoryIds = useMemo(() => {
    const ids: string[] = [category.id];
    const queue = [category.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const cat of visualCats) {
        if (cat.parentId === currentId) {
          ids.push(cat.id);
          queue.push(cat.id);
        }
      }
    }
    return ids;
  }, [category.id, visualCats]);

  // Aggregate all unique courses across the entire subtree (including all subcategories)
  const totalSubtreeCourses = useMemo(() => {
    const courseMap = new Map<string, Course>();
    for (const catId of subtreeCategoryIds) {
      for (const course of getVisualCategoryCourses(catId)) {
        courseMap.set(course.id, course);
      }
    }
    return Array.from(courseMap.values());
  }, [subtreeCategoryIds, getVisualCategoryCourses]);

  const totalSubtreeUnits = useMemo(() => {
    return totalSubtreeCourses.reduce((sum, c) => sum + (c.units || 3), 0);
  }, [totalSubtreeCourses]);

  const roundedClasses =
    {
      1: "rounded-2xl",
      2: "rounded-2xl",
      3: "rounded-lg",
    }[depth] || "rounded-lg";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        setDraggedVcatId(category.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverVcatId !== category.id) setDragOverVcatId(category.id);
      }}
      onDragLeave={() => {
        if (dragOverVcatId === category.id) setDragOverVcatId(null);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        handleVcatDrop(category.id, category.parentId || null);
      }}
      onDragEnd={() => {
        setDraggedVcatId(null);
        setDragOverVcatId(null);
      }}
      className={`${roundedClasses} border border-border/70 bg-card p-4 transition-all duration-150 space-y-3.5 shadow-2xs ${
        draggedVcatId === category.id
          ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.99]"
          : dragOverVcatId === category.id
          ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40"
          : "hover:border-primary/40"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 select-none">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0 cursor-grab active:cursor-grabbing" />
          {depth > 1 && <CornerDownLeft className="h-4 w-4 text-muted-foreground/70 shrink-0" />}
          
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.(category.id);
            }}
            className="p-1 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none"
            title={isExpanded ? "بستن دسته" : "باز کردن دسته"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", !isExpanded && "-rotate-90")} />
          </button>

          <span
            className="h-4 w-4 rounded-full border shadow-2xs shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span
            onClick={() => onToggleCollapse?.(category.id)}
            className="font-bold text-sm text-foreground cursor-pointer hover:text-primary transition-colors"
          >
            {category.name}
          </span>
          {category.code && (
            <Badge
              variant="outline"
              className="text-xs px-1.5 py-0.5 border-primary/40 text-primary bg-primary/5 font-semibold"
            >
              {category.code}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5">
            {totalSubtreeCourses.length} درس ({totalSubtreeUnits} واحد)
          </Badge>
        </div>

        <div className="flex items-center gap-0.5 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setAssignModal({
                open: true,
                type: "visual",
                categoryId: category.id,
                categoryName: category.name,
                categoryColor: category.color,
              })
            }
            className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            تخصیص دروس
          </Button>

          {/* Render subcategory button only if depth is below maxDepth */}
          {depth < maxDepth && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setVcatForm({
                  code: "",
                  name: "",
                  color: category.color || "#3b82f6",
                  sortOrder: visualCats.length + 1,
                  parentId: category.id,
                });
                setVcatModalOpen(true);
              }}
              className="h-8 text-xs px-2 gap-1 text-primary hover:bg-primary/10 font-medium"
              title={`افزودن زیردسته (سطح ${depth + 1})`}
            >
              <Plus className="h-3.5 w-3.5" />
              زیردسته
            </Button>
          )}

          {/* Eraser Button: Clear all assigned courses inside this visual category */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`آیا از حذف تمام دروس داخل دسته بصری «${category.name}» مطمئن هستید؟`)) return;
              await fetch("/api/tracks/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "clear_category_courses",
                  trackId: selectedTrackId,
                  type: "visual",
                  categoryId: category.id,
                }),
              });
              if (onAssignmentsChanged) {
                await onAssignmentsChanged();
              }
            }}
            disabled={assignedCourses.length === 0}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 shrink-0"
            title="پاک کردن تمام دروس این دسته بصری"
          >
            <Eraser className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditVcat(category);
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="ویرایش دسته بصری"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              const confirmMsg =
                depth === 1
                  ? "آیا از حذف دسته بصری «" + category.name + "» و زیردسته‌های آن مطمئن هستید؟"
                  : "آیا از حذف زیردسته «" + category.name + "» مطمئن هستید؟";
              if (!confirm(confirmMsg)) return;
              await fetch("/api/categories?id=" + category.id + "&type=visual", {
                method: "DELETE",
              });
              const res = await fetch("/api/categories?trackId=" + selectedTrackId).then((r) => r.json());
              if (res.success) setVisualCats(res.data.visual);
              if (onAssignmentsChanged) {
                await onAssignmentsChanged();
              }
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            title="حذف دسته بصری"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="pt-2.5 border-t border-border/50">
            {renderCourseChips(category.id, "visual", category.name, category.color)}
          </div>

          {/* Recursive rendering of nested children */}
          {children.length > 0 && depth < maxDepth && (
            <div className="mr-4 pr-4 border-r-2 border-primary/25 space-y-3.5 pt-2">
              {children.map((childCat) => (
                <VisualCategoryNode
                  key={childCat.id}
                  category={childCat}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  visualCats={visualCats}
                  draggedVcatId={draggedVcatId}
                  dragOverVcatId={dragOverVcatId}
                  selectedTrackId={selectedTrackId}
                  setDraggedVcatId={setDraggedVcatId}
                  setDragOverVcatId={setDragOverVcatId}
                  handleVcatDrop={handleVcatDrop}
                  handleOpenEditVcat={handleOpenEditVcat}
                  setVcatForm={setVcatForm}
                  setVcatModalOpen={setVcatModalOpen}
                  setAssignModal={setAssignModal}
                  setVisualCats={setVisualCats}
                  getVisualCategoryCourses={getVisualCategoryCourses}
                  renderCourseChips={renderCourseChips}
                  onAssignmentsChanged={onAssignmentsChanged}
                  collapsedIds={collapsedIds}
                  onToggleCollapse={onToggleCollapse}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

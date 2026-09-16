"use client";

import React, { useMemo } from "react";
import { GripVertical, CornerDownLeft, BookOpen, Plus, Pencil, Trash2, Eraser, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Course, Category } from "@/lib/types";
import { fetchJson, deleteJson } from "@/lib/api-client";

export interface CategoryNodeProps {
  category: Category;
  depth?: number;
  categories: Category[];
  draggedCatId: string | null;
  dragOverCatId: string | null;
  selectedTrackId: string | null;
  setDraggedCatId: (id: string | null) => void;
  setDragOverCatId: (id: string | null) => void;
  handleCatDrop: (sourceId: string, targetParentId: string | null) => void;
  handleOpenEditCat: (cat: Category) => void;
  setCatForm: (form: { code: string; name: string; color: string; parentId: string | null }) => void;
  setCatModalOpen: (open: boolean) => void;
  setAssignModal: (data: {
    open: boolean;
    categoryId: string;
    categoryName: string;
    categoryColor?: string;
  }) => void;
  setCategories: (cats: Category[]) => void;
  getCategoryCourses: (catId: string) => Course[];
  renderCourseChips: (catId: string, name: string, color?: string) => React.ReactNode;
  onAssignmentsChanged?: () => Promise<void>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (catId: string) => void;
}

export function CategoryNode({
  category,
  depth = 1,
  categories,
  draggedCatId,
  dragOverCatId,
  selectedTrackId,
  setDraggedCatId,
  setDragOverCatId,
  handleCatDrop,
  handleOpenEditCat,
  setCatForm,
  setCatModalOpen,
  setAssignModal,
  setCategories,
  getCategoryCourses,
  renderCourseChips,
  onAssignmentsChanged,
  collapsedIds,
  onToggleCollapse,
}: CategoryNodeProps) {
  const children = categories.filter((c) => c.parentId === category.id);
  const assignedCourses = getCategoryCourses(category.id);
  const isExpanded = collapsedIds ? !collapsedIds.has(category.id) : true;
  const categoryColor = category.color || "#3b82f6";

  // Collect all category IDs in this subtree (this category + all its recursive subcategories)
  const subtreeCategoryIds = useMemo(() => {
    const ids: string[] = [category.id];
    const queue = [category.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const cat of categories) {
        if (cat.parentId === currentId) {
          ids.push(cat.id);
          queue.push(cat.id);
        }
      }
    }
    return ids;
  }, [category.id, categories]);

  // Aggregate all unique courses across the entire subtree
  const totalSubtreeCourses = useMemo(() => {
    const courseMap = new Map<string, Course>();
    for (const catId of subtreeCategoryIds) {
      for (const course of getCategoryCourses(catId)) {
        courseMap.set(course.id, course);
      }
    }
    return Array.from(courseMap.values());
  }, [subtreeCategoryIds, getCategoryCourses]);

  const totalSubtreeUnits = useMemo(() => {
    return totalSubtreeCourses.reduce((sum, c) => sum + (c.units || 3), 0);
  }, [totalSubtreeCourses]);

  const roundedClasses =
    {
      1: "rounded-2xl",
      2: "rounded-xl",
      3: "rounded-lg",
    }[depth] || "rounded-lg";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        setDraggedCatId(category.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverCatId !== category.id) setDragOverCatId(category.id);
      }}
      onDragLeave={() => {
        if (dragOverCatId === category.id) setDragOverCatId(null);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        handleCatDrop(category.id, category.parentId || null);
      }}
      onDragEnd={() => {
        setDraggedCatId(null);
        setDragOverCatId(null);
      }}
      className={`${roundedClasses} border border-border/70 bg-card p-4 transition-all duration-150 space-y-3.5 shadow-2xs ${
        draggedCatId === category.id
          ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.99]"
          : dragOverCatId === category.id
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

          {/* Color Indicator */}
          <div
            className="w-3.5 h-3.5 rounded-full shrink-0 border shadow-2xs"
            style={{ backgroundColor: categoryColor }}
            title={`رنگ: ${categoryColor}`}
          />

          <span
            onClick={() => onToggleCollapse?.(category.id)}
            className="font-bold text-sm text-foreground cursor-pointer hover:text-primary transition-colors"
          >
            {category.name}
          </span>
          {category.code && (
            <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-primary/40 text-primary bg-primary/5 font-semibold">
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
                categoryId: category.id,
                categoryName: category.name,
                categoryColor,
              })
            }
            className="h-8 text-xs gap-1.5 shadow-2xs font-medium"
          >
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            تخصیص دروس
          </Button>

          {/* Arbitrary depth: Add subcategory always allowed */}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setCatForm({ code: "", name: "", color: categoryColor, parentId: category.id });
              setCatModalOpen(true);
            }}
            className="h-8 text-xs px-2 gap-1 text-primary hover:bg-primary/10 font-medium"
            title={`افزودن زیردسته (سطح ${depth + 1})`}
          >
            <Plus className="h-3.5 w-3.5" />
            زیردسته
          </Button>

          {/* Eraser Button: Clear all assigned courses */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`آیا از حذف تمام دروس داخل دسته «${category.name}» مطمئن هستید؟`)) return;
              await fetch("/api/tracks/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "clear_category_courses",
                  trackId: selectedTrackId,
                  categoryId: category.id,
                }),
              });
              if (onAssignmentsChanged) {
                await onAssignmentsChanged();
              }
            }}
            disabled={assignedCourses.length === 0}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 shrink-0"
            title="پاک کردن تمام دروس این دسته"
          >
            <Eraser className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditCat(category);
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="ویرایش دسته"
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
                  ? "آیا از حذف دسته «" + category.name + "» و تمام زیردسته‌های آن مطمئن هستید؟"
                  : "آیا از حذف زیردسته «" + category.name + "» مطمئن هستید؟";
              if (!confirm(confirmMsg)) return;
              await deleteJson("/api/categories?id=" + category.id);
              const res = await fetchJson("/api/categories?trackId=" + selectedTrackId);
              if (res.success) {
                const cats = res.data.categories || res.data.items || res.data.rule || [];
                setCategories(cats);
              }
              if (onAssignmentsChanged) {
                await onAssignmentsChanged();
              }
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            title="حذف دسته"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="pt-2.5 border-t border-border/50">
            {renderCourseChips(category.id, category.name, categoryColor)}
          </div>

          {/* Recursive rendering of nested children without depth limit */}
          {children.length > 0 && (
            <div className="mr-4 pr-4 border-r-2 border-primary/25 space-y-3.5 pt-2">
              {children.map((childCat) => (
                <CategoryNode
                  key={childCat.id}
                  category={childCat}
                  depth={depth + 1}
                  categories={categories}
                  draggedCatId={draggedCatId}
                  dragOverCatId={dragOverCatId}
                  selectedTrackId={selectedTrackId}
                  setDraggedCatId={setDraggedCatId}
                  setDragOverCatId={setDragOverCatId}
                  handleCatDrop={handleCatDrop}
                  handleOpenEditCat={handleOpenEditCat}
                  setCatForm={setCatForm}
                  setCatModalOpen={setCatModalOpen}
                  setAssignModal={setAssignModal}
                  setCategories={setCategories}
                  getCategoryCourses={getCategoryCourses}
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

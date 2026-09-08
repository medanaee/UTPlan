"use client";

import React, { useMemo } from "react";
import { GripVertical, CornerDownLeft, BookOpen, Plus, Pencil, Trash2, Eraser, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Course, RuleCategory } from "@/lib/types";
import { fetchJson, deleteJson } from "@/lib/api-client";

export interface RuleCategoryNodeProps {
  category: RuleCategory;
  depth?: number;
  maxDepth?: number;
  ruleCats: RuleCategory[];
  draggedRcatId: string | null;
  dragOverRcatId: string | null;
  selectedTrackId: string | null;
  setDraggedRcatId: (id: string | null) => void;
  setDragOverRcatId: (id: string | null) => void;
  handleRcatDrop: (sourceId: string, targetParentId: string | null) => void;
  handleOpenEditRcat: (cat: RuleCategory) => void;
  setRcatForm: (form: { code: string; name: string; parentId: string | null }) => void;
  setRcatModalOpen: (open: boolean) => void;
  setAssignModal: (data: {
    open: boolean;
    type: "visual" | "rule";
    categoryId: string;
    categoryName: string;
    categoryColor?: string;
  }) => void;
  setRuleCats: (cats: RuleCategory[]) => void;
  getRuleCategoryCourses: (catId: string) => Course[];
  renderCourseChips: (catId: string, type: "visual" | "rule", name: string, color?: string) => React.ReactNode;
  onAssignmentsChanged?: () => Promise<void>;
  collapsedIds?: Set<string>;
  onToggleCollapse?: (catId: string) => void;
}

export function RuleCategoryNode({
  category,
  depth = 1,
  maxDepth = 3,
  ruleCats,
  draggedRcatId,
  dragOverRcatId,
  selectedTrackId,
  setDraggedRcatId,
  setDragOverRcatId,
  handleRcatDrop,
  handleOpenEditRcat,
  setRcatForm,
  setRcatModalOpen,
  setAssignModal,
  setRuleCats,
  getRuleCategoryCourses,
  renderCourseChips,
  onAssignmentsChanged,
  collapsedIds,
  onToggleCollapse,
}: RuleCategoryNodeProps) {
  const children = ruleCats.filter((c) => c.parentId === category.id);
  const assignedCourses = getRuleCategoryCourses(category.id);
  const isExpanded = collapsedIds ? !collapsedIds.has(category.id) : true;

  // Collect all category IDs in this subtree (this category + all its recursive subcategories)
  const subtreeCategoryIds = useMemo(() => {
    const ids: string[] = [category.id];
    const queue = [category.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const cat of ruleCats) {
        if (cat.parentId === currentId) {
          ids.push(cat.id);
          queue.push(cat.id);
        }
      }
    }
    return ids;
  }, [category.id, ruleCats]);

  // Aggregate all unique courses across the entire subtree (including all subcategories)
  const totalSubtreeCourses = useMemo(() => {
    const courseMap = new Map<string, Course>();
    for (const catId of subtreeCategoryIds) {
      for (const course of getRuleCategoryCourses(catId)) {
        courseMap.set(course.id, course);
      }
    }
    return Array.from(courseMap.values());
  }, [subtreeCategoryIds, getRuleCategoryCourses]);

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
        setDraggedRcatId(category.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (dragOverRcatId !== category.id) setDragOverRcatId(category.id);
      }}
      onDragLeave={() => {
        if (dragOverRcatId === category.id) setDragOverRcatId(null);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        handleRcatDrop(category.id, category.parentId || null);
      }}
      onDragEnd={() => {
        setDraggedRcatId(null);
        setDragOverRcatId(null);
      }}
      className={`${roundedClasses} border border-border/70 bg-card p-4 transition-all duration-150 space-y-3.5 shadow-2xs ${
        draggedRcatId === category.id
          ? "opacity-40 border-dashed border-primary bg-primary/5 scale-[0.99]"
          : dragOverRcatId === category.id
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
                type: "rule",
                categoryId: category.id,
                categoryName: category.name,
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
                setRcatForm({ code: "", name: "", parentId: category.id });
                setRcatModalOpen(true);
              }}
              className="h-8 text-xs px-2 gap-1 text-primary hover:bg-primary/10 font-medium"
              title={`افزودن زیردسته (سطح ${depth + 1})`}
            >
              <Plus className="h-3.5 w-3.5" />
              زیردسته
            </Button>
          )}

          {/* Eraser Button: Clear all assigned courses inside this rule category */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`آیا از حذف تمام دروس داخل دسته قوانین «${category.name}» مطمئن هستید؟`)) return;
              await fetch("/api/tracks/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "clear_category_courses",
                  trackId: selectedTrackId,
                  type: "rule",
                  categoryId: category.id,
                }),
              });
              if (onAssignmentsChanged) {
                await onAssignmentsChanged();
              }
            }}
            disabled={assignedCourses.length === 0}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 shrink-0"
            title="پاک کردن تمام دروس این دسته قوانین"
          >
            <Eraser className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenEditRcat(category);
            }}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="ویرایش دسته قوانین"
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
                  ? "آیا از حذف دسته قوانین «" + category.name + "» و زیردسته‌های آن مطمئن هستید؟"
                  : "آیا از حذف زیردسته «" + category.name + "» مطمئن هستید؟";
              if (!confirm(confirmMsg)) return;
              await deleteJson("/api/categories?id=" + category.id + "&type=rule");
              const res = await fetchJson("/api/categories?trackId=" + selectedTrackId);
              if (res.success) setRuleCats(res.data.rule);
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
            {renderCourseChips(category.id, "rule", category.name)}
          </div>

          {/* Recursive rendering of nested children */}
          {children.length > 0 && depth < maxDepth && (
            <div className="mr-4 pr-4 border-r-2 border-primary/25 space-y-3.5 pt-2">
              {children.map((childCat) => (
                <RuleCategoryNode
                  key={childCat.id}
                  category={childCat}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  ruleCats={ruleCats}
                  draggedRcatId={draggedRcatId}
                  dragOverRcatId={dragOverRcatId}
                  selectedTrackId={selectedTrackId}
                  setDraggedRcatId={setDraggedRcatId}
                  setDragOverRcatId={setDragOverRcatId}
                  handleRcatDrop={handleRcatDrop}
                  handleOpenEditRcat={handleOpenEditRcat}
                  setRcatForm={setRcatForm}
                  setRcatModalOpen={setRcatModalOpen}
                  setAssignModal={setAssignModal}
                  setRuleCats={setRuleCats}
                  getRuleCategoryCourses={getRuleCategoryCourses}
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

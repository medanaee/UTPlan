"use client";

import React, { useState, useMemo } from "react";
import type { RuleCategory } from "@/lib/types";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  ChevronDown,
  X,
  Layers,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryPickerProps {
  categories: RuleCategory[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  excludeId?: string; // Exclude category and its descendants (useful for selecting parent)
  className?: string;
  triggerClassName?: string;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  placeholder = "-- انتخاب دسته‌بندی --",
  disabled = false,
  allowClear = true,
  excludeId,
  className,
  triggerClassName,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);

  // Filter out excluded ID and its descendants if specified
  const validCategories = useMemo(() => {
    if (!excludeId) return categories;
    const descendantIds = new Set<string>();

    const findDescendants = (pid: string) => {
      descendantIds.add(pid);
      categories
        .filter((c) => c.parentId === pid)
        .forEach((c) => findDescendants(c.id));
    };

    findDescendants(excludeId);
    return categories.filter((c) => !descendantIds.has(c.id));
  }, [categories, excludeId]);

  // Map category ID to category
  const categoryMap = useMemo(() => {
    const map = new Map<string, RuleCategory>();
    validCategories.forEach((c) => map.set(c.id, c));
    return map;
  }, [validCategories]);

  // Selected Category
  const selectedCategory = value ? categoryMap.get(value) : null;

  // Build breadcrumb path for a category
  const getCategoryPath = (catId: string): string[] => {
    const path: string[] = [];
    let curr: RuleCategory | undefined = categoryMap.get(catId);
    while (curr) {
      path.unshift(curr.name);
      curr = curr.parentId ? categoryMap.get(curr.parentId) : undefined;
    }
    return path;
  };

  // Current navigation breadcrumbs
  const navBreadcrumbs = useMemo(() => {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: "دسته‌های اصلی" }];
    if (!currentParentId) return crumbs;

    let curr: RuleCategory | undefined = categoryMap.get(currentParentId);
    const trail: { id: string; name: string }[] = [];
    while (curr) {
      trail.unshift({ id: curr.id, name: curr.name });
      curr = curr.parentId ? categoryMap.get(curr.parentId) : undefined;
    }
    return [...crumbs, ...trail];
  }, [currentParentId, categoryMap]);

  // Active parent object (if drilled down)
  const currentParent = currentParentId ? categoryMap.get(currentParentId) : null;

  // Categories at current level
  const currentLevelCategories = useMemo(() => {
    return validCategories.filter((c) => (c.parentId || null) === (currentParentId || null));
  }, [validCategories, currentParentId]);

  // Filtered categories when search query is active
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return validCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [validCategories, search]);

  const handleSelect = (catId: string | null) => {
    onChange(catId);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-7 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-1.5 text-xs outline-none transition-colors",
            "hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80",
            !selectedCategory && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <div className="flex items-center gap-2 truncate text-right">
            <Folder className="h-4 w-4 shrink-0 text-primary/70" />
            {selectedCategory ? (
              <span className="truncate font-medium text-foreground">
                {getCategoryPath(selectedCategory.id).join(" › ")}
              </span>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            {allowClear && selectedCategory && !disabled && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(null);
                }}
                className="p-0.5 hover:text-destructive transition-colors rounded-sm"
                title="پاک کردن انتخاب"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-2 sm:w-96 text-xs" dir="rtl">
        {/* Search input */}
        <div className="relative mb-2">
          <Input
            placeholder="جستجوی دسته‌بندی..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pr-8 text-xs"
          />
          <Search className="pointer-events-none absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute left-2.5 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* SEARCH MODE */}
        {search.trim() ? (
          <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
            <p className="px-2 py-1 text-[11px] text-muted-foreground font-semibold">
              نتایج جستجو:
            </p>
            {searchResults.length > 0 ? (
              searchResults.map((cat) => {
                const path = getCategoryPath(cat.id);
                const isSelected = value === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-right text-xs transition-colors",
                      isSelected
                        ? "bg-primary/15 text-primary font-bold"
                        : "hover:bg-muted/40 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="truncate">
                        <div className="font-semibold">{cat.name}</div>
                        {path.length > 1 && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {path.join(" › ")}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-muted-foreground">
                هیچ دسته‌ای با این عنوان یافت نشد.
              </div>
            )}
          </div>
        ) : (
          /* HIERARCHICAL DRILLDOWN NAVIGATION MODE */
          <div className="space-y-1.5">
            {/* Breadcrumb Navigation Bar */}
            <div className="flex items-center justify-between bg-muted/40 rounded-lg p-1.5 text-[11px] border border-border/50">
              <div className="flex items-center gap-1 overflow-x-auto select-none">
                {navBreadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.id || "root"}>
                    {idx > 0 && <ChevronLeft className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <button
                      type="button"
                      onClick={() => setCurrentParentId(crumb.id)}
                      className={cn(
                        "rounded px-1.5 py-0.5 hover:bg-muted font-medium transition-colors truncate max-w-[110px]",
                        idx === navBreadcrumbs.length - 1
                          ? "text-primary font-bold bg-primary/10"
                          : "text-muted-foreground"
                      )}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {currentParentId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const parentOfCurrent = currentParent?.parentId || null;
                    setCurrentParentId(parentOfCurrent);
                  }}
                  className="h-6 text-[10px] px-1.5 gap-1 shrink-0 text-muted-foreground hover:text-foreground"
                  title="بازگشت به سطح قبلی"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>بازگشت</span>
                </Button>
              )}
            </div>

            {/* If currently inside a parent category, allow selecting this parent directly */}
            {currentParent && (
              <div className="flex items-center justify-between p-2 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-1.5 text-xs">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground">انتخاب همین دسته والد:</span>
                  <span className="font-bold text-foreground truncate max-w-[130px]">
                    {currentParent.name}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={value === currentParent.id ? "default" : "outline"}
                  onClick={() => handleSelect(currentParent.id)}
                  className="h-6 text-[10px] px-2"
                >
                  {value === currentParent.id ? "انتخاب شده" : "انتخاب"}
                </Button>
              </div>
            )}

            {/* Items at current level */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
              {allowClear && !currentParentId && (
                <button
                  type="button"
                  onClick={() => handleSelect(null)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-xs transition-colors",
                    !value
                      ? "bg-primary/15 text-primary font-bold"
                      : "hover:bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="italic">-- بدون دسته‌بندی (هیچ‌کدام) --</span>
                  {!value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              )}

              {currentLevelCategories.map((cat) => {
                const hasChildren = validCategories.some((c) => c.parentId === cat.id);
                const isSelected = value === cat.id;
                const childCount = validCategories.filter((c) => c.parentId === cat.id).length;

                return (
                  <div
                    key={cat.id}
                    className={cn(
                      "flex items-center justify-between gap-1.5 rounded-lg p-1 transition-colors border",
                      isSelected
                        ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                        : "border-transparent hover:bg-muted/30 text-foreground"
                    )}
                  >
                    {/* If it has children, clicking the main area navigates into it */}
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => setCurrentParentId(cat.id)}
                        className="flex-1 flex items-center justify-between gap-2 px-2 py-1 text-right text-xs rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FolderOpen className="h-4 w-4 text-primary/80 shrink-0" />
                          <span className="font-semibold truncate">{cat.name}</span>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-normal">
                            {childCount} زیردسته
                          </Badge>
                        </div>
                        <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ) : (
                      /* Leaf category: clicking directly selects */
                      <button
                        type="button"
                        onClick={() => handleSelect(cat.id)}
                        className="flex-1 flex items-center justify-between gap-2 px-2 py-1 text-right text-xs rounded-md"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="h-4 w-4 text-muted-foreground/80 shrink-0" />
                          <span className="truncate">{cat.name}</span>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      </button>
                    )}

                    {/* If it has children, provide a direct select button too */}
                    {hasChildren && (
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleSelect(cat.id)}
                        className={cn(
                          "h-6 text-[10px] px-2 shrink-0 shadow-2xs",
                          isSelected ? "" : "text-muted-foreground hover:text-foreground"
                        )}
                        title="انتخاب مستقیم این دسته"
                      >
                        {isSelected ? "انتخاب شده" : "انتخاب"}
                      </Button>
                    )}
                  </div>
                );
              })}

              {currentLevelCategories.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  زیردسته‌ای در این بخش وجود ندارد.
                </div>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

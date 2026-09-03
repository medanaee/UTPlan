"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Loader2,
  Link2,
  Split,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import type { TrashItem } from "@/app/api/admin/trash/route";
import type { ConflictItem } from "@/app/api/admin/trash/check-dependencies/route";

interface DependencyResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TrashItem | null;
  onSuccess?: () => void;
}

interface ResolvedConflictState {
  action: "replace" | "cascade_delete" | "unlink";
  replacementId?: string;
  spawnedConflictIds?: string[];
}

export function DependencyResolutionDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: DependencyResolutionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [queue, setQueue] = useState<ConflictItem[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ResolvedConflictState>>({});
  const [safeDirect, setSafeDirect] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial dependencies
  useEffect(() => {
    if (!open || !item) {
      setQueue([]);
      setResolutions({});
      setSafeDirect(false);
      setError(null);
      return;
    }

    async function loadInitialDependencies() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/admin/trash/check-dependencies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: item!.type,
            entityId: item!.id,
          }),
        }).then((r) => r.json());

        if (res.success) {
          setSafeDirect(res.safeToDeleteDirectly);
          setQueue(res.dependencies || []);

          // Prepopulate default actions
          const initMap: Record<string, ResolvedConflictState> = {};
          for (const dep of res.dependencies || []) {
            initMap[dep.id] = {
              action: dep.allowedActions.includes("replace") ? "replace" : dep.allowedActions[0],
              replacementId: dep.replacementCandidates?.[0]?.id || undefined,
            };
          }
          setResolutions(initMap);
        } else {
          setError(res.message || "خطا در استعلام وابستگی‌ها");
        }
      } catch (err: any) {
        setError("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
      } finally {
        setLoading(false);
      }
    }

    loadInitialDependencies();
  }, [open, item]);

  // Handle user selecting an action for a conflict
  const handleActionChange = async (
    conflict: ConflictItem,
    newAction: "replace" | "cascade_delete" | "unlink"
  ) => {
    const prevResolution = resolutions[conflict.id];

    // If changing away from cascade_delete, remove any previously spawned child conflicts
    if (prevResolution?.action === "cascade_delete" && newAction !== "cascade_delete" && prevResolution.spawnedConflictIds?.length) {
      const idsToRemove = new Set(prevResolution.spawnedConflictIds);
      setQueue((prevQueue) => prevQueue.filter((c) => !idsToRemove.has(c.id)));
      setResolutions((prevRes) => {
        const next = { ...prevRes };
        for (const id of idsToRemove) {
          delete next[id];
        }
        return next;
      });
    }

    // Update current resolution
    setResolutions((prev) => ({
      ...prev,
      [conflict.id]: {
        ...prev[conflict.id],
        action: newAction,
        replacementId:
          newAction === "replace"
            ? prev[conflict.id]?.replacementId || conflict.replacementCandidates?.[0]?.id
            : undefined,
      },
    }));

    // If cascade_delete was chosen and this item requires cascading inspection, query its children and append to queue
    if (newAction === "cascade_delete" && conflict.requiresCascadeInspection) {
      try {
        const res = await fetch("/api/admin/trash/check-dependencies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: conflict.dependentEntityType,
            entityId: conflict.dependentEntityId,
          }),
        }).then((r) => r.json());

        if (res.success && res.dependencies && res.dependencies.length > 0) {
          const childDependencies: ConflictItem[] = res.dependencies;
          const spawnedIds = childDependencies.map((d) => d.id);

          setQueue((prevQueue) => {
            const existingIds = new Set(prevQueue.map((c) => c.id));
            const newItems = childDependencies.filter((c) => !existingIds.has(c.id));
            return [...prevQueue, ...newItems];
          });

          setResolutions((prevRes) => {
            const next = { ...prevRes };
            next[conflict.id] = {
              ...next[conflict.id],
              spawnedConflictIds: spawnedIds,
            };
            for (const c of childDependencies) {
              if (!next[c.id]) {
                next[c.id] = {
                  action: c.allowedActions.includes("replace") ? "replace" : c.allowedActions[0],
                  replacementId: c.replacementCandidates?.[0]?.id || undefined,
                };
              }
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Cascade inspection error:", err);
      }
    }
  };

  const handleReplacementChange = (conflictId: string, replacementId: string) => {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: {
        ...prev[conflictId],
        replacementId,
      },
    }));
  };

  // Check if all items in queue are resolved
  const isAllResolved =
    queue.length === 0 ||
    queue.every((c) => {
      const res = resolutions[c.id];
      if (!res) return false;
      if (res.action === "replace") {
        return Boolean(res.replacementId);
      }
      return true;
    });

  const handleExecuteDelete = async () => {
    if (!item) return;

    try {
      setExecuting(true);
      setError(null);

      const formattedResolutions = queue.map((c) => {
        const res = resolutions[c.id];
        return {
          conflictId: c.id,
          relationType: c.relationType,
          dependentEntityType: c.dependentEntityType,
          dependentEntityId: c.dependentEntityId,
          action: res?.action || "unlink",
          replacementId: res?.replacementId,
        };
      });

      const res = await fetch("/api/admin/trash/execute-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootEntityType: item.type,
          rootEntityId: item.id,
          resolutions: formattedResolutions,
        }),
      }).then((r) => r.json());

      if (res.success) {
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        setError(res.message || "خطا در اجرای عملیات حذف");
      }
    } catch (err: any) {
      setError("خطا در برقراری ارتباط با سرور: " + (err?.message || "نامشخص"));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] sm:w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5 shrink-0" />
            <span>حذف نهایی فیزیکی و رفع وابستگی‌ها</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            حذف دائمی رکورد از پایگاه داده و مدیریت زنجیره‌ای ارجاعات و موجودیت‌های وابسته
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4 pt-1 overflow-hidden">
            {/* Target Root Entity Card */}
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-2 overflow-hidden">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                  <Badge variant="destructive" className="text-[10px] font-mono shrink-0">
                    {item.code || item.type}
                  </Badge>
                  <span className="font-bold text-foreground text-xs break-words">
                    {item.title}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 border-destructive/30 text-destructive">
                  مورد هدف حذف
                </Badge>
              </div>
              {item.details && (
                <p className="text-[11px] text-muted-foreground break-all leading-relaxed">
                  {item.details}
                </p>
              )}
            </div>

            {/* Loading Spinner */}
            {loading && (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                <span className="text-xs text-muted-foreground block">
                  در حال استعلام و ردگیری وابستگی‌های این موجودیت در تمامی جداول پایگاه داده...
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {/* Safe to delete directly banner */}
            {!loading && safeDirect && queue.length === 0 && (
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 overflow-hidden">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>این موجودیت هیچ‌گونه وابستگی یا ارجاع فعالی ندارد.</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
                  می‌توانید با اطمینان کامل آن را به صورت فیزیکی از دیتابیس پاک کنید. این عملیات غیرقابل بازگشت خواهد بود.
                </p>
              </div>
            )}

            {/* Conflict Resolution Queue */}
            {!loading && queue.length > 0 && (
              <div className="space-y-3 overflow-hidden">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>{queue.length} مورد وابستگی</strong> شناسایی شد. لطفاً نحوه مواجهه با هر وابستگی را تعیین کنید:
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/40 text-amber-700 dark:text-amber-400">
                    صف تصمیم‌گیری
                  </Badge>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {queue.map((conflict, idx) => {
                    const currentRes = resolutions[conflict.id] || { action: "replace" };
                    const hasReplaceOption = conflict.allowedActions.includes("replace");
                    const hasCascadeOption = conflict.allowedActions.includes("cascade_delete");
                    const hasUnlinkOption = conflict.allowedActions.includes("unlink");

                    const candidateItems = (conflict.replacementCandidates || []).map((cand) => ({
                      value: cand.id,
                      label: cand.label,
                      badge: cand.code,
                      keywords: [cand.label, cand.code || ""],
                    }));

                    return (
                      <div
                        key={conflict.id}
                        className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2.5 shadow-2xs transition-all overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-foreground break-words">
                              {conflict.dependentEntityName}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                            {conflict.relationType}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
                          {conflict.description}
                        </p>

                        {/* Action choices */}
                        <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-[11px] font-medium text-muted-foreground">اقدام مورد نظر:</span>

                          {hasReplaceOption && (
                            <button
                              type="button"
                              onClick={() => handleActionChange(conflict, "replace")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                                currentRes.action === "replace"
                                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                                  : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                              }`}
                            >
                              <Link2 className="h-3 w-3" />
                              <span>جایگزینی با موجودیت دیگر</span>
                            </button>
                          )}

                          {hasCascadeOption && (
                            <button
                              type="button"
                              onClick={() => handleActionChange(conflict, "cascade_delete")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                                currentRes.action === "cascade_delete"
                                  ? "bg-destructive text-destructive-foreground border-destructive shadow-2xs"
                                  : "bg-muted/40 text-muted-foreground border-border hover:text-destructive"
                              }`}
                            >
                              <Split className="h-3 w-3" />
                              <span>حذف خود این وابستگی</span>
                            </button>
                          )}

                          {hasUnlinkOption && (
                            <button
                              type="button"
                              onClick={() => handleActionChange(conflict, "unlink")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                                currentRes.action === "unlink"
                                  ? "bg-secondary text-secondary-foreground border-secondary-foreground/30 shadow-2xs"
                                  : "bg-muted/40 text-muted-foreground border-border hover:text-foreground"
                              }`}
                            >
                              <span>قطع پیوند (Unlink)</span>
                            </button>
                          )}
                        </div>

                        {/* If Action is REPLACE: Searchable Combobox */}
                        {currentRes.action === "replace" && (
                          <div className="space-y-1.5 pt-1.5 border-t border-border/40">
                            <span className="text-[10px] font-semibold text-muted-foreground block">
                              انتخاب موجودیت جایگزین:
                            </span>
                            {candidateItems.length > 0 ? (
                              <Combobox
                                items={candidateItems}
                                value={currentRes.replacementId || ""}
                                onChange={(val) => handleReplacementChange(conflict.id, val)}
                                placeholder="انتخاب موجودیت جایگزین..."
                                searchPlaceholder="جستجوی موجودیت جایگزین (نام یا کد)..."
                                emptyText="هیچ موردی یافت نشد."
                                className="w-full h-8 text-xs bg-background"
                              />
                            ) : (
                              <span className="text-[11px] text-destructive block">
                                هیچ گزینه جایگزین فعالی در سیستم یافت نشد. لطفاً گزینه حذف را انتخاب کنید.
                              </span>
                            )}
                          </div>
                        )}

                        {/* Notice if Cascade is selected and sub-items are added */}
                        {currentRes.action === "cascade_delete" && conflict.requiresCascadeInspection && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-1.5 rounded-md break-words">
                            با انتخاب حذف این مورد، وابستگی‌های متصل به آن نیز به انتهای صف تصمیم‌گیری اضافه می‌شوند.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t overflow-hidden flex-wrap">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={executing}
                className="h-8 text-xs shrink-0"
              >
                انصراف
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleExecuteDelete}
                disabled={loading || executing || !isAllResolved}
                className="h-8 text-xs font-bold gap-1.5 shadow-sm px-4 shrink-0"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    در حال اجرای حذف و پاکسازی...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    {safeDirect && queue.length === 0
                      ? "تایید و حذف قطعی فیزیکی"
                      : `اجرای حذف نهایی و رفع وابستگی‌ها (${queue.length} مورد)`}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

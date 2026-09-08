"use client";

import React, { useState } from "react";
import {
  Copy,
  FolderTree,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Info,
  Layers,
  BookOpen,
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
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Track, Major } from "@/lib/types";

interface TrackCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetTrack: Track | null;
  allTracks: Track[];
  allMajors?: Major[];
  onSuccess?: () => void;
}

export function TrackCloneDialog({
  open,
  onOpenChange,
  targetTrack,
  allTracks,
  allMajors = [],
  onSuccess,
}: TrackCloneDialogProps) {
  const [sourceTrackId, setSourceTrackId] = useState<string>("");
  const [cloneVisualCategories, setCloneVisualCategories] = useState(true);
  const [cloneRuleCategories, setCloneRuleCategories] = useState(true);
  const [cloneRulesTree, setCloneRulesTree] = useState(true);
  const [cloneAssignments, setCloneAssignments] = useState(true);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
    stats?: {
      visualCategoriesCloned: number;
      ruleCategoriesCloned: number;
      assignmentsCloned: number;
      rulesTreeCloned: boolean;
    };
  } | null>(null);

  // Filter available source tracks (exclude target track)
  const availableSourceTracks = allTracks.filter(
    (t) => !targetTrack || t.id !== targetTrack.id
  );

  const majorMap = new Map<string, string>();
  allMajors.forEach((m) => majorMap.set(m.id, m.name));

  const handleCloneSubmit = async () => {
    if (!targetTrack || !sourceTrackId) return;

    try {
      setLoading(true);
      setFeedback(null);

      const res = await postJson("/api/tracks/clone-structure", {
        sourceTrackId,
        targetTrackId: targetTrack.id,
        options: {
          cloneVisualCategories,
          cloneRuleCategories,
          cloneRulesTree,
          cloneAssignments,
        },
      });

      setFeedback(res);

      if (res.success && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setFeedback({
        success: false,
        message: "خطا در برقراری ارتباط با سرور.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFeedback(null);
    setSourceTrackId("");
    onOpenChange(false);
  };

  if (!targetTrack) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            کپی و شبیه‌سازی ساختار قوانین از گرایش دیگر
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            کپی ساختار دسته‌بندی‌ها، شروط منطقی و دروس به گرایش «
            <span className="font-semibold text-foreground">{targetTrack.name}</span>»
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Source Track Selector */}
          <div className="p-3.5 rounded-2xl border border-border/80 bg-muted/20 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" />
              گرایش مبدأ برای کپی اطلاعات:
            </Label>
            <Select value={sourceTrackId} onValueChange={setSourceTrackId}>
              <SelectTrigger className="w-full text-xs h-9 bg-background">
                <SelectValue placeholder="انتخاب گرایش مبدأ..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availableSourceTracks.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} ({majorMap.get(t.majorId) || t.code})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Smart ID Re-mapping Alert */}
          <div className="p-3 rounded-2xl bg-primary/5 border border-primary/20 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Sparkles className="h-4 w-4" />
              <span>نگاشت هوشمند شناسه‌ها (Deep ID Re-mapping)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              سیستم به طور خودکار شناسه‌های دسته‌ها را برای گرایش مقصد بازتولید کرده و درخت شروط و تخصیص دروس را با شناسه‌های جدید همگام‌سازی می‌نماید تا هیچ تداخلی در پایگاه داده رخ ندهد.
            </p>
          </div>

          {/* Options Checkboxes */}
          <div className="space-y-2.5 rounded-2xl border border-border/80 p-3.5 bg-card">
            <span className="text-xs font-bold text-foreground block">
              بخش‌های مورد نظر برای کپی:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneVisualCategories}
                  onChange={(e) => setCloneVisualCategories(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-blue-500" />
                  <span>دسته‌های بصری رنگی</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneRuleCategories}
                  onChange={(e) => setCloneRuleCategories(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div className="flex items-center gap-1.5">
                  <FolderTree className="h-3.5 w-3.5 text-purple-500" />
                  <span>دسته‌های درختی قوانین</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneRulesTree}
                  onChange={(e) => setCloneRulesTree(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>درخت شروط منطقی (AST)</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl border border-border/60 hover:bg-muted/40 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={cloneAssignments}
                  onChange={(e) => setCloneAssignments(e.target.checked)}
                  className="rounded text-primary focus:ring-primary h-4 w-4"
                />
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                  <span>تخصیص دروس به دسته‌ها</span>
                </div>
              </label>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl border space-y-2 text-xs ${
                feedback.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {feedback.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <span>{feedback.message}</span>
              </div>

              {feedback.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center text-xs">
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">دسته‌های بصری</span>
                    <span className="font-bold text-foreground">{feedback.stats.visualCategoriesCloned}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">دسته‌های قوانین</span>
                    <span className="font-bold text-foreground">{feedback.stats.ruleCategoriesCloned}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">دروس متصل‌شده</span>
                    <span className="font-bold text-emerald-600">{feedback.stats.assignmentsCloned}</span>
                  </div>
                  <div className="bg-background/80 p-2 rounded-xl border">
                    <span className="text-muted-foreground block text-[10px]">درخت شروط</span>
                    <span className="font-bold text-primary">
                      {feedback.stats.rulesTreeCloned ? "کپی شد" : "بدون تغییر"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="h-8 text-xs"
            >
              بستن
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleCloneSubmit}
              disabled={loading || !sourceTrackId}
              className="h-8 text-xs font-bold gap-1.5 px-4"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  در حال کپی و بازنشانی شناسه‌ها...
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  شروع کپی ساختار
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

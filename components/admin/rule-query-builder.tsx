"use client";

import { useState } from "react";
import {
  GitBranch,
  Plus,
  Trash2,
  Save,
  Check,
  HelpCircle,
  FolderTree,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
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
  RuleNode,
  RuleGroupNode,
  RuleLeafNode,
  RuleCategory,
  Course,
} from "@/lib/types";

interface RuleQueryBuilderProps {
  trackId: string;
  trackName: string;
  initialTree?: RuleGroupNode | null;
  ruleCategories: RuleCategory[];
  courses: Course[];
  onTreeSaved?: (tree: RuleGroupNode) => void;
}

export function RuleQueryBuilder({
  trackId,
  trackName,
  initialTree,
  ruleCategories,
  courses,
  onTreeSaved,
}: RuleQueryBuilderProps) {
  const [tree, setTree] = useState<RuleGroupNode>(() => {
    if (initialTree && initialTree.type === "GROUP") {
      return initialTree;
    }
    return {
      id: "root_group",
      type: "GROUP",
      operator: "AND",
      children: [
        {
          id: `leaf_${crypto.randomUUID().slice(0, 8)}`,
          type: "MIN_CREDITS_IN_CATEGORY",
          ruleCategoryId: ruleCategories[0]?.id || "",
          minCredits: 20,
        },
      ],
    };
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  // Helper functions for immutable tree updates
  const updateNode = (
    current: RuleGroupNode,
    targetId: string,
    updater: (node: RuleNode) => RuleNode | null
  ): RuleGroupNode => {
    if (current.id === targetId) {
      const result = updater(current);
      return (result as RuleGroupNode) || current;
    }

    const newChildren: RuleNode[] = [];
    for (const child of current.children) {
      if (child.id === targetId) {
        const updated = updater(child);
        if (updated !== null) {
          newChildren.push(updated);
        }
      } else if (child.type === "GROUP") {
        newChildren.push(updateNode(child as RuleGroupNode, targetId, updater));
      } else {
        newChildren.push(child);
      }
    }

    return {
      ...current,
      children: newChildren,
    };
  };

  const handleAddLeaf = (groupId: string) => {
    const newLeaf: RuleLeafNode = {
      id: `leaf_${crypto.randomUUID().slice(0, 8)}`,
      type: "MIN_CREDITS_IN_CATEGORY",
      ruleCategoryId: ruleCategories[0]?.id || "",
      minCredits: 12,
    };

    setTree((prev) =>
      updateNode(prev, groupId, (node) => {
        if (node.type === "GROUP") {
          return {
            ...node,
            children: [...(node as RuleGroupNode).children, newLeaf],
          };
        }
        return node;
      })
    );
  };

  const handleAddSubGroup = (groupId: string) => {
    const newSubGroup: RuleGroupNode = {
      id: `group_${crypto.randomUUID().slice(0, 8)}`,
      type: "GROUP",
      operator: "OR",
      children: [
        {
          id: `leaf_${crypto.randomUUID().slice(0, 8)}`,
          type: "MIN_CREDITS_IN_CATEGORY",
          ruleCategoryId: ruleCategories[0]?.id || "",
          minCredits: 10,
        },
      ],
    };

    setTree((prev) =>
      updateNode(prev, groupId, (node) => {
        if (node.type === "GROUP") {
          return {
            ...node,
            children: [...(node as RuleGroupNode).children, newSubGroup],
          };
        }
        return node;
      })
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    setTree((prev) => updateNode(prev, nodeId, () => null));
  };

  const handleSaveTree = async () => {
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/tracks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId,
          rulesTree: tree,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSavedSuccess(true);
        if (onTreeSaved) onTreeSaved(tree);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Save rules error:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">
                فرم‌ساز درختی شروط فارغ‌التحصیلی: «{trackName}»
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              شروط منطقی (AND / OR) و قواعد پایان‌دوره را به صورت ساختار درختی تعریف و ذخیره کنید.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowJsonPreview(!showJsonPreview)}
              className="h-8 gap-1 text-xs"
            >
              <FileCode className="h-3.5 w-3.5" />
              {showJsonPreview ? "مخفی‌سازی JSON" : "مشاهده خروجی JSON AST"}
            </Button>

            <Button
              size="sm"
              onClick={handleSaveTree}
              disabled={saving}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {savedSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  قوانین با موفقیت ذخیره شدند
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "در حال ذخیره..." : "ذخیره درخت قوانین"}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showJsonPreview && (
          <div className="rounded-xl border border-border/80 bg-slate-950 p-3 text-emerald-400 text-[11px] overflow-x-auto max-h-60" dir="ltr">
            <pre>{JSON.stringify(tree, null, 2)}</pre>
          </div>
        )}

        {/* Root Group Renderer */}
        <div className="space-y-3">
          <RuleGroupItem
            group={tree}
            isRoot={true}
            ruleCategories={ruleCategories}
            courses={courses}
            onUpdateOperator={(op) => {
              setTree((prev) => ({ ...prev, operator: op }));
            }}
            onAddLeaf={() => handleAddLeaf(tree.id)}
            onAddSubGroup={() => handleAddSubGroup(tree.id)}
            onDeleteNode={handleDeleteNode}
            onUpdateChild={(childId, updatedChild) => {
              setTree((prev) => updateNode(prev, childId, () => updatedChild));
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------
// GROUP ITEM COMPONENT (Recursive)
// ----------------------------------------------------------------------
interface RuleGroupItemProps {
  group: RuleGroupNode;
  isRoot?: boolean;
  ruleCategories: RuleCategory[];
  courses: Course[];
  onUpdateOperator: (op: "AND" | "OR") => void;
  onAddLeaf: () => void;
  onAddSubGroup: () => void;
  onDeleteNode: (id: string) => void;
  onUpdateChild: (id: string, updated: RuleNode) => void;
}

function RuleGroupItem({
  group,
  isRoot = false,
  ruleCategories,
  courses,
  onUpdateOperator,
  onAddLeaf,
  onAddSubGroup,
  onDeleteNode,
  onUpdateChild,
}: RuleGroupItemProps) {
  return (
    <div
      className={`rounded-2xl border p-4 space-y-3.5 transition-colors ${
        group.operator === "AND"
          ? "border-sky-500/40 bg-sky-500/5 dark:bg-sky-950/10"
          : "border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/10"
      }`}
    >
      {/* Group Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold">
            {isRoot ? "ریشه اصلی شروط فارغ‌التحصیلی:" : "زیرگروه شروط:"}
          </span>

          {/* Operator Switcher */}
          <div className="inline-flex rounded-lg border border-border/80 p-0.5 bg-background shadow-2xs">
            <button
              type="button"
              onClick={() => onUpdateOperator("AND")}
              className={`rounded px-2.5 py-0.5 text-xs font-bold transition-colors ${
                group.operator === "AND"
                  ? "bg-sky-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              AND (همه شروط الزامی)
            </button>
            <button
              type="button"
              onClick={() => onUpdateOperator("OR")}
              className={`rounded px-2.5 py-0.5 text-xs font-bold transition-colors ${
                group.operator === "OR"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              OR (حداقل یک شرط الزامی)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={onAddLeaf}
            className="h-7 text-[11px] gap-1 shadow-2xs"
          >
            <Plus className="h-3 w-3" /> افزودن شرط پایه
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onAddSubGroup}
            className="h-7 text-[11px] gap-1 shadow-2xs"
          >
            <Plus className="h-3 w-3" /> افزودن زیرگروه
          </Button>

          {!isRoot && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeleteNode(group.id)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Children Nodes */}
      <div className="space-y-2.5 pr-2 sm:pr-4">
        {group.children.map((child) => {
          if (child.type === "GROUP") {
            return (
              <RuleGroupItem
                key={child.id}
                group={child as RuleGroupNode}
                ruleCategories={ruleCategories}
                courses={courses}
                onUpdateOperator={(op) => {
                  onUpdateChild(child.id, { ...(child as RuleGroupNode), operator: op });
                }}
                onAddLeaf={() => {
                  const newLeaf: RuleLeafNode = {
                    id: `leaf_${crypto.randomUUID().slice(0, 8)}`,
                    type: "MIN_CREDITS_IN_CATEGORY",
                    ruleCategoryId: ruleCategories[0]?.id || "",
                    minCredits: 10,
                  };
                  onUpdateChild(child.id, {
                    ...(child as RuleGroupNode),
                    children: [...(child as RuleGroupNode).children, newLeaf],
                  });
                }}
                onAddSubGroup={() => {
                  const newSub: RuleGroupNode = {
                    id: `group_${crypto.randomUUID().slice(0, 8)}`,
                    type: "GROUP",
                    operator: "AND",
                    children: [],
                  };
                  onUpdateChild(child.id, {
                    ...(child as RuleGroupNode),
                    children: [...(child as RuleGroupNode).children, newSub],
                  });
                }}
                onDeleteNode={onDeleteNode}
                onUpdateChild={(cId, updated) => {
                  const currentG = child as RuleGroupNode;
                  const newKids = currentG.children.map((k) => (k.id === cId ? updated : k));
                  onUpdateChild(child.id, { ...currentG, children: newKids });
                }}
              />
            );
          } else {
            return (
              <RuleLeafItem
                key={child.id}
                leaf={child as RuleLeafNode}
                ruleCategories={ruleCategories}
                courses={courses}
                onUpdate={(updatedLeaf) => onUpdateChild(child.id, updatedLeaf)}
                onDelete={() => onDeleteNode(child.id)}
              />
            );
          }
        })}

        {group.children.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-3 italic">
            این گروه هیچ شرطی ندارد. روی «افزودن شرط پایه» کلیک کنید.
          </p>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// LEAF ITEM COMPONENT
// ----------------------------------------------------------------------
interface RuleLeafItemProps {
  leaf: RuleLeafNode;
  ruleCategories: RuleCategory[];
  courses: Course[];
  onUpdate: (leaf: RuleLeafNode) => void;
  onDelete: () => void;
}

const RULE_TYPE_ITEMS = [
  { value: "MIN_CREDITS_IN_CATEGORY", label: "حداقل N واحد از دسته قوانین" },
  { value: "MAX_CREDITS_IN_CATEGORY", label: "حداکثر N واحد از دسته قوانین" },
  { value: "ALL_COURSES_IN_CATEGORY", label: "گذراندن تمام دروس دسته قوانین" },
  { value: "EXACT_N_COURSES_IN_CATEGORY", label: "دقیقاً N درس از دسته قوانین" },
  { value: "MIN_TOTAL_CREDITS_BEFORE_COURSE", label: "حداقل N واحد قبل از اخذ درس خاص" },
  { value: "MANDATORY_COURSES", label: "دروس اجباری مشخص" },
];

function RuleLeafItem({ leaf, ruleCategories, courses, onUpdate, onDelete }: RuleLeafItemProps) {
  const courseItems = courses.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors">
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        {/* Rule Type Selector */}
        <Select
          value={leaf.type}
          onValueChange={(val) =>
            val &&
            onUpdate({
              ...leaf,
              type: val as any,
              ...(val === "MAX_CREDITS_IN_CATEGORY" && !leaf.maxCredits
                ? { maxCredits: leaf.minCredits || 10, minCredits: leaf.minCredits || 10 }
                : {}),
            })
          }
        >
          <SelectTrigger className="min-w-[210px] font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {RULE_TYPE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Dynamic Fields by Type */}
        {leaf.type === "MIN_CREDITS_IN_CATEGORY" && (
          <div className="flex items-center gap-1.5 w-auto whitespace-nowrap">
            <span className="text-muted-foreground">از دسته:</span>
            <CategoryPicker
              categories={ruleCategories}
              value={leaf.ruleCategoryId || null}
              onChange={(val) => onUpdate({ ...leaf, ruleCategoryId: val || undefined })}
              placeholder="انتخاب دسته..."
              triggerClassName="h-7 min-w-[160px] text-xs"
            />

            <span className="text-muted-foreground">حداقل:</span>
            <NumberInput
              min={1}
              max={150}
              value={leaf.minCredits || 20}
              onChange={(val) => onUpdate({ ...leaf, minCredits: parseInt(String(val)) || 0 })}
              className="w-20"
            />
            <span className="text-muted-foreground">واحد</span>
          </div>
        )}

        {leaf.type === "MAX_CREDITS_IN_CATEGORY" && (
          <div className="flex items-center gap-1.5 w-auto whitespace-nowrap">
            <span className="text-muted-foreground">از دسته:</span>
            <CategoryPicker
              categories={ruleCategories}
              value={leaf.ruleCategoryId || null}
              onChange={(val) => onUpdate({ ...leaf, ruleCategoryId: val || undefined })}
              placeholder="انتخاب دسته..."
              triggerClassName="h-7 min-w-[160px] text-xs"
            />

            <span className="text-muted-foreground">حداکثر:</span>
            <NumberInput
              min={1}
              max={150}
              value={leaf.maxCredits ?? leaf.minCredits ?? 10}
              onChange={(val) => {
                const num = parseInt(String(val)) || 0;
                onUpdate({ ...leaf, maxCredits: num, minCredits: num });
              }}
              className="w-20"
            />
            <span className="text-muted-foreground">واحد</span>
          </div>
        )}

        {leaf.type === "ALL_COURSES_IN_CATEGORY" && (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">از دسته قوانین:</span>
            <CategoryPicker
              categories={ruleCategories}
              value={leaf.ruleCategoryId || null}
              onChange={(val) => onUpdate({ ...leaf, ruleCategoryId: val || undefined })}
              placeholder="انتخاب دسته قوانین..."
              triggerClassName="min-w-[180px] text-xs"
            />
          </div>
        )}

        {leaf.type === "EXACT_N_COURSES_IN_CATEGORY" && (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground text-xs">از دسته:</span>
            <CategoryPicker
              categories={ruleCategories}
              value={leaf.ruleCategoryId || null}
              onChange={(val) => onUpdate({ ...leaf, ruleCategoryId: val || undefined })}
              placeholder="انتخاب دسته..."
              triggerClassName="h-7 min-w-[160px] text-xs"
            />

            <span className="text-muted-foreground">دقیقاً:</span>
            <NumberInput
              min={1}
              max={20}
              value={leaf.exactCount || 3}
              onChange={(val) => onUpdate({ ...leaf, exactCount: parseInt(String(val)) || 1 })}
              className="w-20"
            />
            <span className="text-muted-foreground">درس</span>
          </div>
        )}

        {leaf.type === "MIN_TOTAL_CREDITS_BEFORE_COURSE" && (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted-foreground">قبل از درس:</span>
           
              <Combobox
                items={courses.map((c) => ({
                  value: c.id,
                  label: c.name,
                  badge: c.code,
                  keywords: [c.name, c.code],
                }))}
                value={leaf.targetCourseId || courses[0]?.id || ""}
                onChange={(val) => onUpdate({ ...leaf, targetCourseId: val })}
                placeholder="-- انتخاب یا جستجوی درس --"
                searchPlaceholder="جستجوی نام یا کد درس..."
                className="h-7 text-xs max-w-[160px]"
              />
           

            <span className="text-muted-foreground">حداقل:</span>
            <NumberInput
              min={1}
              max={140}
              value={leaf.requiredCreditsBefore || 80}
              onChange={(val) =>
                onUpdate({ ...leaf, requiredCreditsBefore: parseInt(String(val)) || 0 })
              }
              className="w-20"
            />
            <span className="text-muted-foreground">واحد</span>
          </div>
        )}

        {leaf.type === "MANDATORY_COURSES" && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs shrink-0">درس اجباری:</span>
            <div className="min-w-[200px]">
              <Combobox
                items={courses.map((c) => ({
                  value: c.id,
                  label: c.name,
                  badge: c.code,
                  keywords: [c.name, c.code],
                }))}
                value={leaf.mandatoryCourseIds?.[0] || courses[0]?.id || ""}
                onChange={(val) =>
                  onUpdate({
                    ...leaf,
                    mandatoryCourseIds: [val],
                  })
                }
                placeholder="-- انتخاب یا جستجوی درس اجباری --"
                searchPlaceholder="جستجوی نام یا کد درس..."
                className="h-7 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getClientId } from "@/lib/client-id";
import type { ReviewReactionSummary } from "@/lib/types";

export const REACTION_EMOJIS = [
  { emoji: "👍", label: "موافق", src: "/emojis/thumbs-up.webp" },
  { emoji: "👎", label: "مخالف", src: "/emojis/thumbs-down.webp" },
  { emoji: "❤️", label: "عالی", src: "/emojis/red-heart.webp" },
  { emoji: "💡", label: "مفید", src: "/emojis/light-bulb.webp" },
  { emoji: "😂", label: "بامزه", src: "/emojis/tears-of-joy.webp" },
  { emoji: "👏", label: "تشویق", src: "/emojis/clapping-hands.webp" },
  { emoji: "🔥", label: "فوق‌العاده", src: "/emojis/fire.webp" },
] as const;

function toPersianDigits(num: number | string): string {
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(num).replace(/\d/g, (x) => farsiDigits[parseInt(x, 10)]);
}

function EmojiImage({
  emoji,
  src,
  alt,
  size = 20,
  className,
}: {
  emoji: string;
  src?: string;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <span className="inline-flex items-center justify-center leading-none select-none text-[15px]">
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      onError={() => setError(true)}
      className={cn("pointer-events-none select-none object-contain inline-block shrink-0", className)}
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}

interface ReviewReactionsBarProps {
  reviewId: string;
  initialReactions?: ReviewReactionSummary[];
  className?: string;
}

export function ReviewReactionsBar({
  reviewId,
  initialReactions = [],
  className,
}: ReviewReactionsBarProps) {
  const [reactions, setReactions] = useState<ReviewReactionSummary[]>(initialReactions);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // Sync with initialReactions if changed from parent
  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  const handleToggle = async (emoji: string) => {
    if (isPending) return;

    setPopoverOpen(false);

    const prevReactions = [...reactions];
    const existingIndex = reactions.findIndex((r) => r.emoji === emoji);
    let nextReactions: ReviewReactionSummary[];

    if (existingIndex >= 0) {
      const item = reactions[existingIndex];
      if (item.userReacted) {
        // Toggle off
        if (item.count <= 1) {
          nextReactions = reactions.filter((_, idx) => idx !== existingIndex);
        } else {
          nextReactions = reactions.map((r, idx) =>
            idx === existingIndex ? { ...r, count: r.count - 1, userReacted: false } : r
          );
        }
      } else {
        // Toggle on
        nextReactions = reactions.map((r, idx) =>
          idx === existingIndex ? { ...r, count: r.count + 1, userReacted: true } : r
        );
      }
    } else {
      nextReactions = [...reactions, { emoji, count: 1, userReacted: true }];
    }

    // Sort by count descending
    nextReactions.sort((a, b) => b.count - a.count);
    setReactions(nextReactions);
    setIsPending(true);

    try {
      const clientId = getClientId();
      const res = await fetch("/api/reviews/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": clientId,
        },
        body: JSON.stringify({ reviewId, emoji, clientId }),
      });

      const data: any = await res.json();
      if (data.success && Array.isArray(data.reactions)) {
        setReactions(data.reactions);
      } else {
        setReactions(prevReactions);
      }
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
      setReactions(prevReactions);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 pt-2 mt-2 border-t border-border/40",
        className
      )}
    >
      {/* Existing Reaction Badges */}
      {reactions.map((item) => {
        const meta = REACTION_EMOJIS.find((e) => e.emoji === item.emoji);
        const label = meta ? meta.label : "";
        return (
          <button
            key={item.emoji}
            type="button"
            onClick={() => handleToggle(item.emoji)}
            disabled={isPending}
            title={label ? `${label} (${toPersianDigits(item.count)})` : undefined}
            className={cn(
              "h-8 px-2.5 rounded-full border inline-flex items-center justify-center gap-1.5 text-xs transition-colors cursor-pointer select-none",
              item.userReacted
                ? "bg-primary/15 border-primary/45 text-primary font-medium dark:bg-primary/25 dark:border-primary/50"
                : "bg-muted/50 hover:bg-muted/80 border-border/80 text-muted-foreground hover:text-foreground dark:bg-zinc-800/80 dark:border-zinc-700 dark:hover:bg-zinc-700/80"
            )}
          >
            <EmojiImage
              emoji={item.emoji}
              src={meta?.src}
              alt={label || item.emoji}
              size={20}
            />
            <span className="text-xs font-semibold tabular-nums leading-none">
              {toPersianDigits(item.count)}
            </span>
          </button>
        );
      })}

      {/* Add Reaction Picker Popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="h-8 w-8 rounded-full inline-flex items-center justify-center border border-dashed border-border/80 text-muted-foreground/70 hover:text-foreground hover:border-border hover:bg-muted/50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 transition-colors"
            title="افزودن واکنش"
            aria-label="افزودن واکنش"
          >
            <SmilePlus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={6}
          className="w-auto p-1 rounded-full border border-border/70 bg-card/95 dark:bg-zinc-800/95 dark:border-zinc-700/80 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center gap-1">
            {REACTION_EMOJIS.map((item) => {
              const hasReacted = reactions.some((r) => r.emoji === item.emoji && r.userReacted);
              return (
                <button
                  key={item.emoji}
                  type="button"
                  onClick={() => handleToggle(item.emoji)}
                  title={item.label}
                  className={cn(
                    "h-9.5 w-9.5 rounded-full flex items-center justify-center transition-colors hover:bg-muted/70 dark:hover:bg-zinc-700/80",
                    hasReacted && "bg-primary/20 ring-1 ring-primary/50"
                  )}
                >
                  <EmojiImage
                    emoji={item.emoji}
                    src={item.src}
                    alt={item.label}
                    size={28}
                  />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

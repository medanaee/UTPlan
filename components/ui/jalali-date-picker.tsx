"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { cn } from "@/lib/utils";
import {
  formatJalaliDisplay,
  jalaliMonthLength,
  jalaliMonthName,
  jalaliToIso,
  normalizeJalaliDate,
  parseGregorianIso,
  todayJalali,
  type JalaliDate,
} from "@/lib/jalali";

type JalaliDatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

type WheelItem = {
  value: number;
  label: string;
};

const VIEWPORT_PADDING = 8;
const GAP = 4;
const PANEL_WIDTH = 300;
const ITEM_HEIGHT = 36;
const WHEEL_VISIBLE_COUNT = 5;
const WHEEL_PADDING = Math.floor(WHEEL_VISIBLE_COUNT / 2);
const WHEEL_HEIGHT = ITEM_HEIGHT * WHEEL_VISIBLE_COUNT;
const YEAR_MIN = 1300;
const YEAR_MAX = 1450;

function clampPosition(
  trigger: DOMRect,
  panelWidth: number,
  panelHeight: number,
): PanelPosition {
  const width = panelWidth;

  let left = trigger.right - width;
  left = Math.min(
    Math.max(VIEWPORT_PADDING, left),
    window.innerWidth - width - VIEWPORT_PADDING,
  );

  const spaceBelow = window.innerHeight - trigger.bottom - VIEWPORT_PADDING;
  const spaceAbove = trigger.top - VIEWPORT_PADDING;
  const openUpwards = spaceBelow < panelHeight && spaceAbove > spaceBelow;

  let top = openUpwards
    ? trigger.top - GAP - panelHeight
    : trigger.bottom + GAP;

  top = Math.min(
    Math.max(VIEWPORT_PADDING, top),
    Math.max(
      VIEWPORT_PADDING,
      window.innerHeight - panelHeight - VIEWPORT_PADDING,
    ),
  );

  return { top, left, width };
}

function JalaliWheelColumn({
  label,
  items,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  items: WheelItem[];
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScroll = useRef(0);
  const scrollEndTimer = useRef<number | null>(null);
  const animFrame = useRef<number | null>(null);
  const interacting = useRef(false);
  const moveSamples = useRef<Array<{ y: number; t: number }>>([]);

  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === value),
  );

  const maxScrollTop = Math.max(0, (items.length - 1) * ITEM_HEIGHT);

  const clampScrollTop = useCallback(
    (top: number) => Math.min(maxScrollTop, Math.max(0, top)),
    [maxScrollTop],
  );

  const cancelAnimation = useCallback(() => {
    if (animFrame.current !== null) {
      cancelAnimationFrame(animFrame.current);
      animFrame.current = null;
    }
    interacting.current = false;
  }, []);

  const emitIndex = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), items.length - 1);
      const next = items[clamped]?.value;
      if (next !== undefined && next !== value) {
        onChange(next);
      }
      return clamped;
    },
    [items, onChange, value],
  );

  const animateScrollTo = useCallback(
    (targetTop: number, onComplete?: () => void) => {
      const el = scrollRef.current;
      if (!el) return;

      cancelAnimation();
      interacting.current = true;

      const startTop = el.scrollTop;
      const distance = clampScrollTop(targetTop) - startTop;
      const duration = Math.min(360, Math.max(180, Math.abs(distance) * 0.75));
      const startTime = performance.now();

      const frame = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.scrollTop = startTop + distance * eased;

        if (progress < 1) {
          animFrame.current = requestAnimationFrame(frame);
          return;
        }

        animFrame.current = null;
        interacting.current = false;
        onComplete?.();
      };

      animFrame.current = requestAnimationFrame(frame);
    },
    [cancelAnimation, clampScrollTop],
  );

  const snapToNearest = useCallback(
    (smooth: boolean) => {
      const el = scrollRef.current;
      if (!el || items.length === 0) return;

      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.min(Math.max(index, 0), items.length - 1);
      const targetTop = clamped * ITEM_HEIGHT;

      if (smooth) {
        animateScrollTo(targetTop, () => emitIndex(clamped));
      } else {
        el.scrollTop = targetTop;
        emitIndex(clamped);
      }
    },
    [animateScrollTo, emitIndex, items.length],
  );

  const scrollToIndex = useCallback(
    (index: number, smooth = false) => {
      const clamped = Math.min(Math.max(index, 0), items.length - 1);
      const targetTop = clamped * ITEM_HEIGHT;
      if (smooth) {
        animateScrollTo(targetTop);
      } else {
        const el = scrollRef.current;
        if (el) el.scrollTop = targetTop;
      }
    },
    [animateScrollTo, items.length],
  );

  useLayoutEffect(() => {
    if (dragging.current || interacting.current) return;
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, items.length, scrollToIndex]);

  const runMomentum = useCallback(
    (initialVelocity: number) => {
      const el = scrollRef.current;
      if (!el) return;

      cancelAnimation();
      interacting.current = true;

      let velocity = initialVelocity;
      let lastTime = performance.now();

      const frame = (now: number) => {
        const dt = Math.min(32, now - lastTime);
        lastTime = now;

        el.scrollTop = clampScrollTop(el.scrollTop + velocity * dt);
        velocity *= Math.pow(0.92, dt / 16);

        const atEdge =
          el.scrollTop <= 0 || el.scrollTop >= maxScrollTop;
        if (atEdge) velocity *= 0.4;

        if (Math.abs(velocity) > 0.04) {
          animFrame.current = requestAnimationFrame(frame);
          return;
        }

        animFrame.current = null;
        snapToNearest(true);
      };

      animFrame.current = requestAnimationFrame(frame);
    },
    [cancelAnimation, clampScrollTop, maxScrollTop, snapToNearest],
  );

  function handleScroll() {
    if (dragging.current || interacting.current) return;
    if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => snapToNearest(true), 140);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    cancelAnimation();
    if (scrollEndTimer.current) {
      window.clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = null;
    }

    dragging.current = true;
    interacting.current = true;
    dragStartY.current = event.clientY;
    dragStartScroll.current = scrollRef.current?.scrollTop ?? 0;
    moveSamples.current = [{ y: event.clientY, t: performance.now() }];
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || !scrollRef.current) return;

    const now = performance.now();
    moveSamples.current.push({ y: event.clientY, t: now });
    if (moveSamples.current.length > 6) moveSamples.current.shift();

    scrollRef.current.scrollTop = clampScrollTop(
      dragStartScroll.current - (event.clientY - dragStartY.current),
    );
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const samples = moveSamples.current.filter(
      (sample) => performance.now() - sample.t < 120,
    );
    moveSamples.current = [];

    if (samples.length >= 2) {
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      const dt = Math.max(1, last.t - first.t);
      const velocity = -(last.y - first.y) / dt;
      if (Math.abs(velocity) > 0.08) {
        runMomentum(velocity);
        return;
      }
    }

    interacting.current = false;
    snapToNearest(true);
  }

  useEffect(() => {
    return () => {
      cancelAnimation();
      if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
    };
  }, [cancelAnimation]);

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <span className="mb-1 text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md border bg-muted/20",
          disabled && "opacity-50",
        )}
        style={{ height: WHEEL_HEIGHT }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 border-y border-primary/30 bg-primary/5" />
        <div
          ref={scrollRef}
          className={cn(
            "h-full overflow-y-auto overscroll-contain select-none",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            disabled ? "pointer-events-none" : "cursor-grab active:cursor-grabbing",
          )}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onWheel={() => {
            if (dragging.current || interacting.current) return;
            if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
            scrollEndTimer.current = window.setTimeout(() => snapToNearest(true), 160);
          }}
        >
          {Array.from({ length: WHEEL_PADDING }).map((_, index) => (
            <div key={`pad-top-${index}`} style={{ height: ITEM_HEIGHT }} aria-hidden />
          ))}
          {items.map((item) => {
            const active = item.value === value;
            return (
              <div
                key={item.value}
                style={{ height: ITEM_HEIGHT }}
                className={cn(
                  "flex items-center justify-center px-1 text-xs transition-[opacity,transform] duration-150",
                  active
                    ? "scale-100 font-semibold text-foreground opacity-100"
                    : "scale-95 text-muted-foreground opacity-55",
                )}
              >
                {item.label}
              </div>
            );
          })}
          {Array.from({ length: WHEEL_PADDING }).map((_, index) => (
            <div key={`pad-bot-${index}`} style={{ height: ITEM_HEIGHT }} aria-hidden />
          ))}
        </div>
      </div>
    </div>
  );
}

export function JalaliDatePicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "انتخاب تاریخ آزمون",
  className,
}: JalaliDatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [draft, setDraft] = useState<JalaliDate>(() => todayJalali());
  const [dayInput, setDayInput] = useState("");
  const [monthInput, setMonthInput] = useState("");
  const [yearInput, setYearInput] = useState("");

  const selected = useMemo(() => parseGregorianIso(value), [value]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syncInputs = useCallback((date: JalaliDate) => {
    setDayInput(String(date.day));
    setMonthInput(String(date.month));
    setYearInput(String(date.year));
  }, []);

  const commitDraft = useCallback(
    (next: JalaliDate) => {
      const normalized = normalizeJalaliDate(next);
      setDraft(normalized);
      syncInputs(normalized);
      onChange(jalaliToIso(normalized));
    },
    [onChange, syncInputs],
  );

  useEffect(() => {
    if (!open) return;
    const initial = selected ?? todayJalali();
    setDraft(initial);
    syncInputs(initial);
  }, [open, selected, syncInputs]);

  function placePanel() {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const next = clampPosition(
      trigger.getBoundingClientRect(),
      PANEL_WIDTH,
      panel.offsetHeight,
    );
    setPosition(next);
    setPlaced(true);
  }

  useLayoutEffect(() => {
    if (!open) {
      setPlaced(false);
      setPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setPosition(clampPosition(rect, PANEL_WIDTH, 320));
    }

    const frame = requestAnimationFrame(() => {
      placePanel();
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      placePanel();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  const dayItems = useMemo(() => {
    const count = jalaliMonthLength(draft.year, draft.month);
    return Array.from({ length: count }, (_, index) => {
      const day = index + 1;
      return { value: day, label: String(day) };
    });
  }, [draft.year, draft.month]);

  const monthItems = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return { value: month, label: jalaliMonthName(month) };
      }),
    [],
  );

  const yearItems = useMemo(
    () =>
      Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, index) => {
        const year = YEAR_MIN + index;
        return { value: year, label: String(year) };
      }),
    [],
  );

  function applyManualInputs() {
    const day = Number(dayInput.trim());
    const month = Number(monthInput.trim());
    const year = Number(yearInput.trim());
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
      syncInputs(draft);
      return;
    }
    commitDraft({ day, month, year });
  }

  const panel =
    open && mounted && position
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 100,
              opacity: placed ? undefined : 0,
              pointerEvents: placed ? "auto" : "none",
            }}
            className={cn(
              "rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              placed && "animate-in fade-in zoom-in-95 duration-100",
            )}
          >
            <div className="grid grid-cols-3 gap-2">
              <JalaliWheelColumn
                label="روز"
                items={dayItems}
                value={draft.day}
                onChange={(day) => commitDraft({ ...draft, day })}
                disabled={disabled}
              />
              <JalaliWheelColumn
                label="ماه"
                items={monthItems}
                value={draft.month}
                onChange={(month) => commitDraft({ ...draft, month })}
                disabled={disabled}
              />
              <JalaliWheelColumn
                label="سال"
                items={yearItems}
                value={draft.year}
                onChange={(year) => commitDraft({ ...draft, year })}
                disabled={disabled}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <NumberInput
                min={1}
                max={jalaliMonthLength(draft.year, draft.month)}
                value={dayInput}
                disabled={disabled}
                placeholder="روز"
                sizeVariant="sm"
                className="text-center"
                onChange={(val) => setDayInput(String(val))}
                onStep={(day) => commitDraft({ ...draft, day })}
                onBlur={applyManualInputs}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyManualInputs();
                }}
              />
              <NumberInput
                min={1}
                max={12}
                value={monthInput}
                disabled={disabled}
                placeholder="ماه"
                sizeVariant="sm"
                className="text-center"
                onChange={(val) => setMonthInput(String(val))}
                onStep={(month) => commitDraft({ ...draft, month })}
                onBlur={applyManualInputs}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyManualInputs();
                }}
              />
              <NumberInput
                min={YEAR_MIN}
                max={YEAR_MAX}
                value={yearInput}
                disabled={disabled}
                placeholder="سال"
                sizeVariant="sm"
                className="text-center"
                onChange={(val) => setYearInput(String(val))}
                onStep={(year) => commitDraft({ ...draft, year })}
                onBlur={applyManualInputs}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyManualInputs();
                }}
              />
            </div>

            <p className="mt-2.5 text-center text-xs font-medium text-muted-foreground">
              {formatJalaliDisplay(draft)}
            </p>

            <div className="mt-2.5 flex items-center justify-between border-t border-border/70 pt-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                پاک کردن
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                className="h-7 text-xs"
                onClick={() => {
                  commitDraft(todayJalali());
                }}
              >
                امروز
              </Button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-start text-sm outline-none transition-colors",
          "hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-muted-foreground",
        )}
      >
        <span className="truncate">
          {selected ? formatJalaliDisplay(selected) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {panel}
    </div>
  );
}

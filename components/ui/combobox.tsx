"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ComboboxItem {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  keywords?: string[];
}

export interface ComboboxProps {
  items: ComboboxItem[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  popoverWidth?: string;
  allowClear?: boolean;
}

export function Combobox({
  items,
  value,
  onChange,
  placeholder = "انتخاب کنید...",
  searchPlaceholder = "جستجو...",
  emptyText = "موردی یافت نشد.",
  disabled = false,
  className,
  popoverWidth,
  allowClear = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedItem = React.useMemo(() => {
    return items.find((item) => item.value === value);
  }, [items, value]);

  // Ensure mouse wheel scrolling works inside modals/dialogs by stopping propagation
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-xs h-9 px-3",
            !selectedItem && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedItem ? selectedItem.label : placeholder}
          </span>
          <ChevronsUpDown className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        data-radix-scroll-lock-ignore
        onWheel={(e) => e.stopPropagation()}
        className={cn("p-0 w-[var(--radix-popover-trigger-width)] min-w-[240px]", popoverWidth)}
      >
        <Command
          filter={(itemValue, search) => {
            const item = items.find((i) => i.value === itemValue);
            if (!item) return 0;
            const searchLower = search.toLowerCase().trim();
            const textToSearch = [
              item.label,
              item.sublabel || "",
              item.badge || "",
              ...(item.keywords || []),
            ]
              .join(" ")
              .toLowerCase();
            return textToSearch.includes(searchLower) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} className="text-xs h-8" />
          <div
            ref={listRef}
            data-radix-scroll-lock-ignore
            className="max-h-60 overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <CommandList className="max-h-none overflow-visible">
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </CommandEmpty>
              <CommandGroup>
                {allowClear && value && (
                  <CommandItem
                    value="__CLEAR__"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="text-xs text-muted-foreground italic border-b mb-1"
                  >
                    پاک کردن انتخاب
                  </CommandItem>
                )}
                {items.map((item) => {
                  const isSelected = item.value === value;
                  return (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={() => {
                        onChange(item.value === value && allowClear ? "" : item.value);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between text-xs py-2 cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5 truncate flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={cn("truncate", isSelected && "font-bold text-primary")}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="text-[10px]  px-1 py-0 rounded bg-muted text-muted-foreground shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.sublabel && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {item.sublabel}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "h-3.5 w-3.5 text-primary shrink-0 mr-1",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

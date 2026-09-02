"use client";

import React, { useRef, useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Sparkles, X, Code2, Maximize2, Minimize2 } from "lucide-react";

export interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  maxHeight?: string;
  minHeight?: string;
  readOnly?: boolean;
  disabled?: boolean;
  title?: string;
  formatJson?: boolean;
}

// Lightweight, safe syntax highlighter for JSON
function highlightJson(code: string): string {
  if (!code) return "";
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          // JSON Object Key: vibrant sky/cyan
          return `<span class="text-sky-600 dark:text-sky-400 font-semibold">${match.slice(0, -1)}</span><span class="text-muted-foreground/80">:</span>`;
        }
        // String Value: warm emerald
        return `<span class="text-emerald-600 dark:text-emerald-400">${match}</span>`;
      }
      if (/true|false/.test(match)) {
        // Boolean: purple/indigo
        return `<span class="text-purple-600 dark:text-purple-400 font-bold">${match}</span>`;
      }
      if (/null/.test(match)) {
        // Null: rose/red
        return `<span class="text-rose-500 dark:text-rose-400 italic font-semibold">${match}</span>`;
      }
      if (/^-?\d/.test(match)) {
        // Number: amber/orange
        return `<span class="text-amber-600 dark:text-amber-400 font-semibold">${match}</span>`;
      }
      if (/[{}[\],]/.test(match)) {
        // Punctuation & brackets
        return `<span class="text-slate-500 dark:text-slate-400 font-bold">${match}</span>`;
      }
      return match;
    }
  );
}

export function CodeEditor({
  value,
  onChange,
  placeholder,
  className = "",
  maxHeight = "18rem", // 288px / max-h-72
  minHeight = "10rem", // 160px
  readOnly = false,
  disabled = false,
  title,
  formatJson = true,
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isFullscreen]);

  // Lock body scroll during fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  // Split lines for line numbers
  const lines = useMemo(() => value.split("\n"), [value]);
  const lineCount = Math.max(lines.length, 1);

  // Generate syntax highlighted HTML
  const highlightedHtml = useMemo(() => highlightJson(value), [value]);

  // Sync scrolling from textarea to line numbers gutter and highlighted pre layer
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
  };

  // Wheel event on gutter forwards to textarea
  const handleGutterWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (textareaRef.current) {
      textareaRef.current.scrollTop += e.deltaY;
    }
  };

  // Handle Tab key to insert 2 spaces instead of losing focus
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !readOnly && !disabled) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const newVal = val.substring(0, start) + "  " + val.substring(end);
      onChange(newVal);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  // Auto format JSON
  const handleFormatJson = () => {
    if (!value.trim()) return;
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
    } catch {
      // Ignore invalid JSON syntax during manual typing
    }
  };

  // Copy content to clipboard
  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const editorContent = (
    <div
      className={
        isFullscreen
          ? "fixed inset-3 sm:inset-6 md:inset-8 z-50 flex flex-col rounded-3xl border border-border/80 bg-background shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 animate-in fade-in-50 zoom-in-95 duration-200"
          : `rounded-2xl border border-border/80 bg-background overflow-hidden shadow-2xs focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all ${className}`
      }
    >
      {/* Editor Toolbar Header (Persian / System layout) */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/40 border-b border-border/60 text-xs select-none shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-foreground text-[11px]">
            {title || "ویرایشگر کد (JSON)"}
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] font-mono px-1.5 py-0 rounded-md font-medium text-muted-foreground"
          >
            {lineCount.toLocaleString("fa-IR")} سطر
          </Badge>
        </div>

        <div className="flex items-center gap-0">
          {formatJson && value.trim() && !readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFormatJson}
              className="h-6 text-[11px] px-1 gap-1 text-muted-foreground hover:text-foreground rounded-lg"
              title="مرتب‌سازی ساختار JSON (Prettify)"
            >
              <span>مرتب‌سازی</span>
            </Button>
          )}

          {value.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-6 text-[11px] px-1 gap-1 text-muted-foreground hover:text-foreground rounded-lg"
              title="کپی متن"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-600">کپی شد</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>کپی</span>
                </>
              )}
            </Button>
          )}

          {/* Fullscreen Toggle Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="h-6 text-[11px] px-1 gap-1 text-muted-foreground hover:text-foreground rounded-lg"
            title={isFullscreen ? "خروج از تمام‌صفحه (Esc)" : "تمام‌صفحه"}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3 w-3" />
                <span className="hidden sm:inline">کوچک‌نمایی</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                <span className="hidden sm:inline">تمام‌صفحه</span>
              </>
            )}
          </Button>

        </div>
      </div>

      {/* Editor Body: Gutter (Left) + Syntax Highlighter / Textarea (Right) */}
      <div
        className="flex overflow-hidden relative flex-1 min-h-0"
        dir="ltr"
        style={
          isFullscreen
            ? { height: "100%", maxHeight: "100%", minHeight: 0 }
            : { maxHeight, minHeight }
        }
      >
        {/* Line Numbers Gutter: Left side */}
        <div
          ref={gutterRef}
          onWheel={handleGutterWheel}
          className="w-10 sm:w-12 bg-slate-100/90 dark:bg-[#131417] border-r border-border/60 dark:border-white/10 py-2.5 select-none overflow-hidden text-right font-mono text-[11px] text-muted-foreground/50 shrink-0"
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className="h-5 leading-5 pr-2.5 pl-1 truncate hover:text-muted-foreground/80"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code View Area: Soft dark slate background (NOT pure black) */}
        <div className="relative flex-1 overflow-hidden bg-slate-50/70 dark:bg-[#181a1f]">
          {/* Syntax Highlighted Pre Layer */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 py-2.5 px-3 font-mono text-xs leading-5 overflow-hidden whitespace-pre border-0 text-foreground"
            style={{ tabSize: 2 }}
            dangerouslySetInnerHTML={{
              __html: highlightedHtml + (value.endsWith("\n") ? "<br/>" : ""),
            }}
          />

          {/* Transparent Input Textarea Layer */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            disabled={disabled}
            spellCheck={false}
            wrap="off"
            style={{ tabSize: 2 }}
            className="absolute inset-0 w-full h-full m-0 resize-none bg-transparent py-2.5 px-3 font-mono text-xs leading-5 text-transparent caret-primary selection:bg-primary/25 selection:text-transparent outline-none border-0 overflow-auto whitespace-pre placeholder:text-muted-foreground/40"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-opacity animate-in fade-in-0 duration-200"
          onClick={() => setIsFullscreen(false)}
        />
      )}
      {editorContent}
    </>
  );
}

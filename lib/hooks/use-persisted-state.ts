"use client";

import { useState, useEffect, useCallback } from "react";

const SYNC_EVENT_NAME = "ut_ece_local_storage_sync";

export function getStoredItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = window.localStorage.getItem(key);
    if (item !== null && item !== "undefined") {
      return JSON.parse(item) as T;
    }
  } catch (err) {
    console.warn(`[localStorage] Error reading key "${key}":`, err);
  }
  return fallback;
}

export function setStoredItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT_NAME, {
        detail: { key, value },
      })
    );
  } catch (err) {
    console.warn(`[localStorage] Error writing key "${key}":`, err);
  }
}

/**
 * SSR-safe persisted state hook.
 * Avoids hydration mismatch by initializing with fallback on initial render,
 * then immediately hydrating from localStorage on mount.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(defaultValue);

  // Hydrate from localStorage once mounted
  useEffect(() => {
    const stored = getStoredItem<T>(key, defaultValue);
    setState(stored);
  }, [key]);

  // Listen to cross-component sync events for the same key
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string; value: T }>;
      if (customEvent.detail && customEvent.detail.key === key) {
        setState(customEvent.detail.value);
      }
    };

    window.addEventListener(SYNC_EVENT_NAME, handleSync);
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setState(JSON.parse(e.newValue) as T);
        } catch {}
      }
    });

    return () => {
      window.removeEventListener(SYNC_EVENT_NAME, handleSync);
    };
  }, [key]);

  const setValue = useCallback(
    (valueOrUpdater: T | ((prev: T) => T)) => {
      setState((prev) => {
        const nextValue =
          typeof valueOrUpdater === "function"
            ? (valueOrUpdater as (prev: T) => T)(prev)
            : valueOrUpdater;

        setStoredItem(key, nextValue);
        return nextValue;
      });
    },
    [key]
  );

  return [state, setValue];
}

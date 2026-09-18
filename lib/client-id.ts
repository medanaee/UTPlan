"use client";

/**
 * Returns a persistent anonymous client ID stored in localStorage.
 * Used to distinguish guest interactions (e.g. review reactions) without requiring login.
 */
export function getClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    const KEY = "ut_ece_client_id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "cl_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

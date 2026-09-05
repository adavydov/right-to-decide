"use client";
import { useSyncExternalStore } from "react";
const fallback: Record<string, string | null> = {};
function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return fallback[key] ?? null;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("book-reading-preference", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("book-reading-preference", callback);
  };
}
export function writeReadingPreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    fallback[key] = value;
  }
  window.dispatchEvent(new Event("book-reading-preference"));
}
export function useReadingPreference(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}

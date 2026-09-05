"use client";
import { useSyncExternalStore } from "react";
const fallback: Record<string, string | null> = {};
export function readReadingPreference(key: string) {
  if (Object.prototype.hasOwnProperty.call(fallback, key)) return fallback[key];
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
export function writeReadingPreference(key: string, value: string, notify = true) {
  try {
    window.localStorage.setItem(key, value);
    delete fallback[key];
  } catch {
    fallback[key] = value;
  }
  if (notify) window.dispatchEvent(new Event("book-reading-preference"));
}
export function useReadingPreference(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => readReadingPreference(key),
    () => null,
  );
}

import { useSyncExternalStore } from "react";

/**
 * The visitor's analytics choice. Nothing is loaded until they accept; the
 * choice is remembered in this browser only and can be changed from the
 * footer ("Cookie settings").
 */

export type AnalyticsConsent = "granted" | "denied";

const STORAGE_KEY = "nanda_analytics_consent";
const CHANGE_EVENT = "nanda-consent-change";

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null; // storage blocked (private mode, policy): treat as undecided
  }
}

export function setAnalyticsConsent(value: AnalyticsConsent | null): void {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Can't persist: the choice still applies for this page view below.
  }
  window.dispatchEvent(new CustomEvent<AnalyticsConsent | null>(CHANGE_EVENT, { detail: value }));
}

/** Calls `listener` whenever the choice changes in this tab. Returns an unsubscribe. */
export function onAnalyticsConsentChange(listener: (value: AnalyticsConsent | null) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<AnalyticsConsent | null>).detail);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The current choice: "granted" | "denied" | null (not asked yet), or
 * undefined during server rendering, when the browser's choice is unknown.
 */
export function useAnalyticsConsent(): AnalyticsConsent | null | undefined {
  return useSyncExternalStore(subscribe, getAnalyticsConsent, () => undefined);
}

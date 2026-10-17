"use client";

import { setAnalyticsConsent } from "@/lib/consent";

/** Clears the analytics choice so the consent banner asks again. */
export function CookieSettingsButton() {
  return (
    <button onClick={() => setAnalyticsConsent(null)} className="underline hover:text-brand-600">
      Cookie settings
    </button>
  );
}

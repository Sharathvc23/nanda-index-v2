"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An (i) button that reveals help text on hover, keyboard focus or tap.
 *
 * The popover is positioned against the nearest positioned ancestor rather
 * than the icon, so it spans its row instead of overflowing narrow screens —
 * render it inside a `relative` container (FieldLabel does this).
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  // Touch has no hover/leave: close on a tap elsewhere, and on Escape for everyone.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={ref} className="inline-flex"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}>
      <button type="button" aria-label={`About ${label}`} aria-describedby={tipId}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
        className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      </button>
      <span id={tipId} role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-full max-w-sm rounded-xl bg-slate-950 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg transition-opacity",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}>
        {children}
      </span>
    </span>
  );
}

/** A form label with an optional "(optional)" marker and an InfoTip beside it. */
export function FieldLabel({ htmlFor, label, info, optional }: {
  htmlFor: string; label: string; info?: ReactNode; optional?: boolean;
}) {
  return (
    <div className="relative mb-1 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
        {optional && <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">(optional)</span>}
      </label>
      {info && <InfoTip label={label}>{info}</InfoTip>}
    </div>
  );
}

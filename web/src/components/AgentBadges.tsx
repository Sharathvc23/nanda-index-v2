import { cn } from "@/lib/utils";

export function ProtocolBadge({ protocol }: { protocol: string }) {
  const colors: Record<string, string> = {
    a2a:   "bg-brand-200 text-brand-600",
    mcp:   "bg-accent-teal text-accent-teal-ink",
    rest:  "bg-surface-tag text-ink",
    https: "bg-[#fdeccc] text-[#8a5a06]",
  };
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
      colors[protocol] ?? colors.rest,
    )}>
      {protocol}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide",
      visibility === "private"
        ? "bg-[#fdeccc] text-[#8a5a06]"
        : "bg-accent-teal text-accent-teal-ink",
    )}>
      {visibility}
    </span>
  );
}

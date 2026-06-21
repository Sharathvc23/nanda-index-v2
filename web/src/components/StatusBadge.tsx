import type { OrgStatus } from "@/lib/nanda-types";
import { cn } from "@/lib/utils";

type StatusValue = OrgStatus | "active" | "inactive";

export function StatusBadge({ status }: { status: StatusValue }) {
  const styles: Record<string, string> = {
    active:    "bg-accent-teal text-accent-teal-ink",
    pending:   "bg-[#fdeccc] text-[#8a5a06]",
    suspended: "bg-[#fef3f2] text-[#b42318]",
    inactive:  "bg-surface-strong text-ink-weak",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold",
        styles[status] ?? "bg-surface-tag text-ink",
      )}
    >
      {status}
    </span>
  );
}

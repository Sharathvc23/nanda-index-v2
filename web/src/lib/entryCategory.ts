import type { IndexCatalogEntry } from "@/lib/nanda-types";
import { nandaField } from "@/lib/air";

// Exactly six categories. MCPs and Skills are driven purely by media_type;
// Enterprise / DNS SVCB / SMBs / Personal come from the entry's
// org.projectnanda resolutionRole, falling back to media_type plus tags.

export type Category = "enterprise" | "dns-svcb" | "smb" | "personal" | "mcp" | "skill";

const ROLE_CATEGORY: Record<string, Category> = {
  "dns-svcb-pointer": "dns-svcb",
  "smb-agent-card": "smb",
  "personal-agent-card": "personal",
};

/** Map a single record to one of the six categories, or null when it fits none. */
export function categoryOf(record: IndexCatalogEntry): Category | null {
  const mt = record.type ?? "";
  const tags = (record.tags ?? []).map((t) => t.toLowerCase());

  // Media-type-driven categories take priority.
  if (mt === "application/mcp-server-card+json") return "mcp";
  if (mt === "application/agentskill+zip") return "skill";
  if (mt === "application/ai-catalog+json" || mt === "application/ai-registry+json") return "enterprise";

  const role = nandaField(record, "resolutionRole");
  if (role && ROLE_CATEGORY[role]) return ROLE_CATEGORY[role];

  // A2A agent cards split into Personal vs SMB by their tags.
  if (mt === "application/a2a-agent-card+json") {
    if (tags.includes("personal-agent") || tags.includes("email-identity")) return "personal";
    if (tags.includes("smb")) return "smb";
  }
  return null;
}

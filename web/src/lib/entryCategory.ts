import type { IndexCatalogEntry } from "@/lib/nanda-types";
import { nandaField } from "@/lib/air";

// Exactly six categories, decided in this order:
//   1. A personal entry (resolutionRole "personal-agent-card") is Personal,
//      whatever it publishes: agent card, MCP server card or skill.
//   2. Media type: MCP server card → MCPs, skill → Skills, AI catalog or
//      registry → Enterprise.
//   3. The org.projectnanda resolutionRole: DNS-SVCB pointer → DNS SVCB,
//      SMB agent card → SMBs.
//   4. An A2A agent card with neither falls back to its tags.

export type Category = "enterprise" | "dns-svcb" | "smb" | "personal" | "mcp" | "skill";

const ROLE_CATEGORY: Record<string, Category> = {
  "dns-svcb-pointer": "dns-svcb",
  "smb-agent-card": "smb",
};

/** Map a single record to one of the six categories, or null when it fits none. */
export function categoryOf(record: IndexCatalogEntry): Category | null {
  const role = nandaField(record, "resolutionRole");
  if (role === "personal-agent-card") return "personal";

  const mt = record.type ?? "";
  if (mt === "application/mcp-server-card+json") return "mcp";
  if (mt === "application/agentskill+zip") return "skill";
  if (mt === "application/ai-catalog+json" || mt === "application/ai-registry+json") return "enterprise";

  if (role && ROLE_CATEGORY[role]) return ROLE_CATEGORY[role];

  // A2A agent cards split into Personal vs SMB by their tags.
  if (mt === "application/a2a-agent-card+json") {
    const tags = (record.tags ?? []).map((t) => t.toLowerCase());
    if (tags.includes("personal-agent") || tags.includes("email-identity")) return "personal";
    if (tags.includes("smb")) return "smb";
  }
  return null;
}

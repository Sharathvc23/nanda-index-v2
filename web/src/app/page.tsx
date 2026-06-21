"use client";

import { useMemo, useState } from "react";

type Registry = {
  id: string;
  name: string;
  type: "Enterprise" | "SMB" | "DNS-AID" | "Personal" | "Custom";
  version: string;
  date: string;
  identifier: string;
  description: string;
  tags: string[];
  verified: boolean;
  status: "Active" | "Pending" | "Suspended";
  typeBadge: string;
};

const SEED_REGISTRYS: Registry[] = [
  {
    id: "travel26",
    name: "travel26",
    type: "Enterprise",
    version: "Enterprise",
    date: "6/20/2026",
    identifier: "urn:ai:domain:travel26.net",
    description: "urn:ai:domain:travel26.net - 31 agents indexed via AI Catalog. Travel + booking enterprise registry.",
    tags: ["travel", "enterprise", "booking"],
    verified: true,
    status: "Active",
    typeBadge: "ENTERPRISE",
  },
  {
    id: "agntcy",
    name: "agntcy",
    type: "Enterprise",
    version: "Enterprise",
    date: "6/18/2026",
    identifier: "urn:ai:org.agntcy",
    description: "https://ai-catalog.outshift.io - Cisco's AGNTCY AI catalog, enterprise discovery surface.",
    tags: ["enterprise", "catalog", "cisco"],
    verified: true,
    status: "Active",
    typeBadge: "ENTERPRISE",
  },
  {
    id: "moon-bakery",
    name: "moon-bakery",
    type: "SMB",
    version: "SMB",
    date: "6/15/2026",
    identifier: "urn:ai:domain:moonbakery.com:agent:orders",
    description: "urn:ai:domain:moonbakery.com:agent:orders - neighborhood bakery orders agent registered via NANDA.",
    tags: ["smb", "food", "orders"],
    verified: false,
    status: "Active",
    typeBadge: "SMB",
  },
  {
    id: "sunrise-tours",
    name: "sunrise-tours",
    type: "SMB",
    version: "SMB",
    date: "6/14/2026",
    identifier: "urn:ai:domain:sunrisetours.com:agent:booking",
    description: "urn:ai:domain:sunrisetours.com:agent:booking - small-business tour booking agent.",
    tags: ["smb", "travel", "tours"],
    verified: false,
    status: "Active",
    typeBadge: "SMB",
  },
  {
    id: "brew-lab",
    name: "brew-lab",
    type: "SMB",
    version: "SMB",
    date: "6/12/2026",
    identifier: "urn:ai:domain:brewlab.coffee:agent:orders",
    description: "urn:ai:domain:brewlab.coffee:agent:orders - specialty coffee shop orders agent.",
    tags: ["smb", "food", "coffee"],
    verified: false,
    status: "Active",
    typeBadge: "SMB",
  },
  {
    id: "fitzone",
    name: "fitzone",
    type: "SMB",
    version: "SMB",
    date: "6/10/2026",
    identifier: "urn:ai:domain:fitzone.fit:agent:memberships",
    description: "urn:ai:domain:fitzone.fit:agent:memberships - gym memberships and scheduling agent.",
    tags: ["smb", "fitness", "memberships"],
    verified: false,
    status: "Pending",
    typeBadge: "SMB",
  },
  {
    id: "travel26-flights",
    name: "travel26-flights",
    type: "DNS-AID",
    version: "DNS-AID",
    date: "6/9/2026",
    identifier: "urn:ai:domain:flights.travel26.net",
    description: "urn:ai:domain:flights.travel26.net - DNS-AID record pointing to the flights subdomain agent.",
    tags: ["dns-aid", "travel", "flights"],
    verified: true,
    status: "Active",
    typeBadge: "DNS-AID",
  },
  {
    id: "medicore-health",
    name: "medicore-health",
    type: "DNS-AID",
    version: "DNS-AID",
    date: "6/7/2026",
    identifier: "urn:ai:domain:medicore.health",
    description: "urn:ai:domain:medicore.health - health-domain DNS-AID record for clinical agents.",
    tags: ["dns-aid", "health", "medical"],
    verified: false,
    status: "Active",
    typeBadge: "DNS-AID",
  },
  {
    id: "priya-personal",
    name: "priya-personal",
    type: "Personal",
    version: "Personal",
    date: "6/6/2026",
    identifier: "urn:ai:email:priya@gmail.com",
    description: "urn:ai:email:priya@gmail.com - individual identity with delegated agent card hosting.",
    tags: ["personal", "individual"],
    verified: true,
    status: "Active",
    typeBadge: "PERSONAL",
  },
  {
    id: "ankit-dev",
    name: "ankit-dev",
    type: "Personal",
    version: "Personal",
    date: "6/4/2026",
    identifier: "urn:ai:email:ankit@nasiko.com",
    description: "urn:ai:email:ankit@nasiko.com - developer's personal identity with a dev agent card.",
    tags: ["personal", "dev"],
    verified: false,
    status: "Active",
    typeBadge: "PERSONAL",
  },
  {
    id: "sara-design",
    name: "sara-design",
    type: "Personal",
    version: "Personal",
    date: "6/2/2026",
    identifier: "urn:ai:email:sara@outlook.com",
    description: "urn:ai:email:sara@outlook.com - design portfolio agent for an individual creator.",
    tags: ["personal", "design"],
    verified: false,
    status: "Pending",
    typeBadge: "PERSONAL",
  },
  {
    id: "nasiko-org",
    name: "nasiko-org",
    type: "Enterprise",
    version: "Enterprise",
    date: "5/30/2026",
    identifier: "urn:ai:domain:nasiko.com",
    description: "urn:ai:domain:nasiko.com - Nasiko organization registry with developer agents.",
    tags: ["enterprise", "dev"],
    verified: false,
    status: "Active",
    typeBadge: "ENTERPRISE",
  },
];

const TYPE_OPTIONS: Registry["type"][] = ["Enterprise", "SMB", "DNS-AID", "Personal", "Custom"];
const STATUS_OPTIONS: Registry["status"][] = ["Active", "Pending", "Suspended"];
const TAG_OPTIONS = [
  "enterprise",
  "smb",
  "dns-aid",
  "personal",
  "custom",
  "travel",
  "food",
  "fitness",
  "health",
  "dev",
  "design",
];

const PAGE_SIZE = 6;

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set());
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  function toggle(set: Set<string>, value: string, updater: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    updater(next);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SEED_REGISTRYS.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.identifier.toLowerCase().includes(q)) {
        return false;
      }
      if (typeFilters.size > 0 && !typeFilters.has(r.type)) return false;
      if (statusFilters.size > 0 && !statusFilters.has(r.status)) return false;
      if (tagFilters.size > 0 && !r.tags.some((t) => tagFilters.has(t))) return false;
      return true;
    });
  }, [search, typeFilters, statusFilters, tagFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-ink-strong leading-tight">Explore</h2>
        <p className="mt-1 text-sm text-ink-medium max-w-3xl">
          Browse the secure directory of verified agent registries indexed by NANDA.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          typeFilters={typeFilters}
          onToggleType={(v) => toggle(typeFilters, v, setTypeFilters)}
          statusFilters={statusFilters}
          onToggleStatus={(v) => toggle(statusFilters, v, setStatusFilters)}
          tagFilters={tagFilters}
          onToggleTag={(v) => toggle(tagFilters, v, setTagFilters)}
        />

        <div className="flex-1 min-w-0">
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((item) => (
              <RegistryCard key={item.id} item={item} />
            ))}
          </div>

          <Pagination
            page={currentPage}
            total={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            onGoto={(p) => setPage(p)}
          />
        </div>
      </div>
    </main>
  );
}

function FilterSidebar(props: {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilters: Set<string>;
  onToggleType: (v: string) => void;
  statusFilters: Set<string>;
  onToggleStatus: (v: string) => void;
  tagFilters: Set<string>;
  onToggleTag: (v: string) => void;
}) {
  return (
    <aside className="lg:w-64 flex-shrink-0">
      <div className="bg-surface-strong rounded-card border border-line p-4 space-y-5 sticky top-24 max-h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
        <div className="flex-shrink-0">
          <label
            htmlFor="search"
            className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-1.5"
          >
            Search
          </label>
          <input
            type="text"
            id="search"
            placeholder="Filter by org or identifier..."
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            className="w-full rounded-control border-2 border-line bg-surface-light px-3 py-2 text-sm text-ink placeholder:text-ink-weak focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex-shrink-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-2">
            Type
          </span>
          <div className="space-y-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.typeFilters.has(opt)}
                  onChange={() => props.onToggleType(opt)}
                  className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-2">
            Status
          </span>
          <div className="space-y-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.statusFilters.has(opt)}
                  onChange={() => props.onToggleStatus(opt)}
                  className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-medium mb-2">
            Tags
          </span>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {TAG_OPTIONS.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={props.tagFilters.has(tag)}
                  onChange={() => props.onToggleTag(tag)}
                  className="rounded border-line-strong text-brand-500 focus:ring-brand-500"
                />
                <span className="truncate">{tag}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function RegistryCard({ item }: { item: Registry }) {
  return (
    <article
      className="bg-surface-light rounded-card border border-line/70 shadow-card p-4 hover:shadow-card-hover hover:border-line-strong transition cursor-pointer flex flex-col h-full gap-3"
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-semibold text-ink-strong truncate">{item.name}</h3>
            {item.verified && (
              <span className="inline-flex flex-shrink-0" title="Verified">
                <svg
                  className="w-4 h-4 text-brand-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-ink-weak">
            Version {item.version} • {item.date}
          </div>
        </div>
        {item.typeBadge && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fdeccc] text-[#8a5a06] flex-shrink-0">
            {item.typeBadge}
          </span>
        )}
      </div>
      <p className="text-sm text-ink line-clamp-2 leading-relaxed">{item.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {item.tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-tag text-ink"
          >
            {t}
          </span>
        ))}
      </div>
    </article>
  );
}

function Pagination(props: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onGoto: (p: number) => void;
}) {
  const { page, total } = props;

  // Build page list: show all if <= 5, else 1 / ... / window / ... / N
  const pages: (number | "...")[] = [];
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < total - 2) pages.push("...");
    pages.push(total);
  }

  return (
    <nav className="flex items-center justify-center gap-2 mt-6 pb-4">
      <button
        onClick={props.onPrev}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm font-medium rounded text-ink border-2 border-line bg-surface-light hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Previous
      </button>
      <div className="flex items-center gap-1">
        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`e-${idx}`} className="px-2 py-1 text-sm text-ink-weak">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => props.onGoto(p)}
              className={`min-w-9 h-9 px-2 text-sm font-medium rounded-full transition ${
                p === page ? "bg-brand-500 text-white" : "text-ink hover:bg-surface-strong"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        onClick={props.onNext}
        disabled={page === total}
        className="px-3 py-1.5 text-sm font-medium rounded text-ink border-2 border-line bg-surface-light hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Next
      </button>
    </nav>
  );
}

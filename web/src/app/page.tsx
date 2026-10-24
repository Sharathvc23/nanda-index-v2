import { externalLinks } from "@/lib/site-data";

export default function HomePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="space-y-5 text-base leading-relaxed text-ink-medium">
        <p>
          The agentic web is an emerging layer of the internet in which
          autonomous and semi-autonomous software agents discover, compose, and
          invoke capabilities across organizational and technological boundaries.
          Enterprises, platforms, and developer communities have each adopted
          different systems, including AI Catalogs, DNS-based service discovery,
          enterprise gateways, agent descriptors such as A2A Agent Cards and MCP
          servers, and a growing set of platform, telecom, and sector-specific
          registries.
        </p>

        <p>
          Each system is authoritative within its own domain, but no common
          layer connects them. This fragments the ecosystem into isolated
          discovery islands and prevents agents from finding and using
          capabilities across boundaries.
        </p>

        <p>
          NandaIndex is an AI Catalog-formatted federation layer that maps a
          stable resource identifier to the appropriate discovery object, whether
          an AI Catalog, a DNS-based service-discovery path, a gateway, a platform
          registry, or a hosted agent card. It functions as a global switchboard:
          it does not replace existing discovery systems but routes requesters to
          them.
        </p>

        <p>
          For enterprises that publish AI Catalog at a well-known endpoint and
          own the domain, direct resolution already works. NandaIndex is not in
          the critical path. Small businesses can distribute runtime, agent card,
          and domain across separate providers and still be resolved from one
          resource identifier. NandaIndex enables identity-first discovery for
          individuals, when the underlying account identity is verifiably bound
          to the resolution record.
        </p>
        <p>
          Several questions remain open, and we expect future work to address
          them:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Refining resolution semantics and identity models.</li>
          <li>Strengthening trust, verification, and policy mechanisms.</li>
          <li>
            Standardizing the interfaces between the resolution, discovery, and
            infrastructure layers.
          </li>
          <li>
            Supporting richer query routing and multi-hop resolution across
            federated systems.
          </li>
        </ul>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <a
          href={externalLinks.paper}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-10 rounded-control bg-brand-800 px-5 text-sm font-medium text-white hover:bg-brand-700 transition"
        >
          Read the paper
        </a>
        <a
          href={externalLinks.github}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-10 rounded-control border-2 border-line px-5 text-sm font-medium text-ink hover:border-line-strong transition"
        >
          GitHub repo
        </a>
        <a
          href={externalLinks.ietfDraft}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-10 rounded-control border-2 border-line px-5 text-sm font-medium text-ink hover:border-line-strong transition"
        >
          IETF Draft
        </a>
        <a
          href={externalLinks.host39}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center h-10 rounded-control border-2 border-line px-5 text-sm font-medium text-ink hover:border-line-strong transition"
        >
          host39.org
        </a>
      </div>
    </div>
  );
}

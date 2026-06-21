import { heroStats } from "@/lib/site-data";

export function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-10 lg:pt-16">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-weak">
            Nanda Index
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-3xl sm:text-4xl font-semibold text-ink-strong leading-tight tracking-[-0.01em]">
            Federated resolution for the agentic web.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-medium">
            NandaIndex resolves any agent identity (domain, email, or URN) to the
            correct next discovery object: AI Catalog, DNS-AID, A2A Agent Card, or
            personal agent card. It bridges agent discovery across enterprises, small
            businesses, and individuals without replacing existing discovery systems.
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {["Enterprise", "SMB", "Individual"].map((item) => (
              <span
                key={item}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-tag text-ink"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {heroStats.map((stat) => (
            <div
              key={stat.label}
              className="bg-surface-light rounded-card border border-line p-6 shadow-card"
            >
              <div className="text-3xl font-semibold text-brand-500">
                {stat.value}
              </div>
              <div className="mt-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

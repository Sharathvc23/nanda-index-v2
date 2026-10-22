import Image from "next/image";
import { PageShell } from "@/components/PageShell";
import { CONTRIBUTOR_LOGOS } from "@/lib/contributor-logos";
import { CONTRIBUTOR_QUOTES } from "@/lib/contributor-quotes";
import { externalLinks } from "@/lib/site-data";

type Person = {
  name: string;
  organization: string;
};

type Paper = {
  title: string;
  href: string;
  authors: Person[];
};

const CONTRIBUTORS: Person[] = [
  { name: "Ankit Kumar Nath", organization: "Nasiko and ProjectNANDA.org" },
  { name: "Vedh Krishnan", organization: "MIT and ProjectNANDA.org" },
  { name: "Sharath Chandra", organization: "StellarMinds.ai and ProjectNANDA.org" },
  { name: "Umamaheswar Edara", organization: "ProjectNANDA.org" },
  { name: "Chaman Singhal", organization: "Nasiko" },
  { name: "Gaurav Tiwari", organization: "Nasiko" },
  { name: "Dario Fenoglio", organization: "MIT" },
  { name: "Karthik Sreedhar", organization: "MIT" },
];

const PAPERS: Paper[] = [
  {
    title:
      "A Global Switchboard for the Agentic Web: Connecting Discovery Islands Across Enterprises, SMBs, and Individuals",
    href: externalLinks.paper,
    authors: [
      { name: "Ramesh Raskar", organization: "MIT Media Lab and ProjectNANDA.org" },
      { name: "Pradyumna Chari", organization: "MIT Media Lab" },
      { name: "Luca Muscariello", organization: "Cisco" },
      { name: "Samuel Sharaf", organization: "Google" },
      { name: "Junjie Bu", organization: "Google" },
      { name: "Karan Bharadwaj", organization: "Nasiko and ProjectNANDA.org" },
      { name: "Vijoy Pandey", organization: "Cisco" },
    ],
  },
  {
    title:
      "Beyond DNS: Unlocking the Internet of AI Agents via the NANDA Index and Verified AgentFacts",
    href: "https://arxiv.org/abs/2507.14263",
    authors: [
      { name: "Ramesh Raskar", organization: "MIT" },
      { name: "Pradyumna Chari", organization: "MIT" },
      { name: "John Zinky", organization: "Akamai" },
      { name: "Mahesh Lambe", organization: "UnifyDynamics" },
      { name: "Jared James Grogan", organization: "Universitas AI" },
      { name: "Sichao Wang", organization: "Cisco" },
      { name: "Rajesh Ranjan", organization: "Carnegie Mellon University" },
      { name: "Rekha Singhal", organization: "Tata Consultancy Services (TCS)" },
      { name: "Shailja Gupta", organization: "Carnegie Mellon University" },
      { name: "Robert Lincourt", organization: "Dell" },
      { name: "Raghu Bala", organization: "Synergetics AI" },
      { name: "Aditi Joshi", organization: "Google" },
      { name: "Abhishek Singh", organization: "MIT" },
      { name: "Ayush Chopra", organization: "MIT" },
      { name: "Dimitris Stripelis", organization: "Flower AI" },
      { name: "Bhuwan B", organization: "HCLTech" },
      { name: "Sumit Kumar", organization: "HCLTech" },
      { name: "Maria Gorskikh", organization: "ProjectNANDA.org" },
    ],
  },
  {
    title:
      "Evolution of AI Agent Registry Solutions: Centralized, Enterprise, and Distributed Approaches",
    href: "https://arxiv.org/abs/2508.03095",
    authors: [
      { name: "Aditi Singh", organization: "Cleveland State University" },
      { name: "Abul Ehtesham", organization: "Kent State University" },
      { name: "Mahesh Lambe", organization: "Independent Researcher" },
      { name: "Jared James Grogan", organization: "Independent Researcher" },
      { name: "Abhishek Singh", organization: "MIT" },
      { name: "Saket Kumar", organization: "Northeastern University" },
      { name: "Luca Muscariello", organization: "Cisco" },
      { name: "Vijoy Pandey", organization: "Cisco" },
      { name: "Guillaume Sauvage De Saint Marc", organization: "Cisco" },
      { name: "Pradyumna Chari", organization: "MIT" },
      { name: "Ramesh Raskar", organization: "MIT" },
    ],
  },
];

function PeopleTable({ caption, people }: { caption: string; people: Person[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col" className="w-2/5 py-2 pr-4 text-xs font-bold uppercase tracking-wide text-ink-weak">
            Name
          </th>
          <th scope="col" className="py-2 text-xs font-bold uppercase tracking-wide text-ink-weak">
            Organization
          </th>
        </tr>
      </thead>
      <tbody>
        {people.map((person) => (
          <tr key={person.name} className="border-b border-line align-top">
            <td className="py-2 pr-4 font-medium text-ink-strong break-words">{person.name}</td>
            <td className="py-2 text-ink-medium break-words">{person.organization}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ContributorsPage() {
  return (
    <PageShell
      title="Contributors"
      description="Nanda Index is being designed, reviewed, and supported by agent builders."
    >
      <nav aria-label="On this page" className="mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a href="#organizations" className="text-brand-600 hover:text-brand-700 hover:underline">
          Organizations
        </a>
        <a href="#community-perspectives" className="text-brand-600 hover:text-brand-700 hover:underline">
          Community perspectives
        </a>
        <a href="#research-authors" className="text-brand-600 hover:text-brand-700 hover:underline">
          Research authors
        </a>
        <a href="#contributors" className="text-brand-600 hover:text-brand-700 hover:underline">
          Contributors
        </a>
      </nav>
      <section id="organizations" aria-labelledby="organizations-heading" className="mb-12 max-w-5xl scroll-mt-24">
        <h2 id="organizations-heading" className="mb-6 font-display text-lg font-semibold text-ink-strong">
          Organizations
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CONTRIBUTOR_LOGOS.map(({ name, src, width, height }) => (
            <li key={src} className="flex h-28 items-center justify-center rounded-lg border border-line bg-white p-4">
              <Image
                src={src}
                alt={name}
                width={width}
                height={height}
                sizes="(min-width: 1024px) 176px, (min-width: 640px) 200px, 42vw"
                className="h-20 w-full object-contain"
              />
            </li>
          ))}
        </ul>
      </section>
      <div className="max-w-3xl space-y-12">
        <section id="community-perspectives" aria-labelledby="community-perspectives-heading" className="scroll-mt-24">
          <h2 id="community-perspectives-heading" className="mb-6 font-display text-lg font-semibold text-ink-strong">
            Community perspectives
          </h2>
          <div className="space-y-8">
            {CONTRIBUTOR_QUOTES.map(({ text, attribution }) => (
              <figure key={attribution} className="border-l-2 border-brand-300 pl-5">
                <blockquote className="text-sm leading-relaxed text-ink">
                  <p>“{text}”</p>
                </blockquote>
                <figcaption className="mt-3 text-sm font-semibold text-ink-strong">
                  {attribution}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="research-authors" aria-labelledby="research-authors-heading" className="scroll-mt-24">
          <h2 id="research-authors-heading" className="mb-6 font-display text-lg font-semibold text-ink-strong">
            Research authors
          </h2>
          <div className="space-y-12">
            {PAPERS.map((paper) => (
              <section key={paper.href}>
                <h3 className="mb-4 font-display text-lg font-semibold text-ink-strong">
                  <a
                    href={paper.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    {paper.title} <span aria-hidden="true">↗</span>
                  </a>
                </h3>
                <PeopleTable caption={`Authors of ${paper.title}`} people={paper.authors} />
              </section>
            ))}
          </div>
        </section>

        <section id="contributors" className="scroll-mt-24">
          <h2 className="mb-4 font-display text-lg font-semibold text-ink-strong">
            Contributors
          </h2>
          <PeopleTable caption="Nanda Index contributors" people={CONTRIBUTORS} />
        </section>
      </div>
    </PageShell>
  );
}

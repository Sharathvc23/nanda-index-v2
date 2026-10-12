import { PageShell } from "@/components/PageShell";

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
  { name: "Sharath Chandra", organization: "StellarMinds.ai and ProjectNANDA.org" },
  { name: "Umamaheswar Edara", organization: "ProjectNANDA.org" },
  { name: "Vedh Krishnan", organization: "ProjectNANDA.org" },
  { name: "Chaman Singhal", organization: "Nasiko" },
  { name: "Gaurav Tiwari", organization: "Nasiko" },
];

const PAPERS: Paper[] = [
  {
    title:
      "A Global Switchboard for the Agentic Web: Connecting Discovery Islands Across Enterprises, SMBs, and Individuals",
    href: "https://nandaindex.org/paper.pdf",
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
      <div className="max-w-3xl space-y-12">
        {PAPERS.map((paper) => (
          <section key={paper.href}>
            <h2 className="mb-4 font-display text-lg font-semibold text-ink-strong">
              <a
                href={paper.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:text-brand-700 transition-colors"
              >
                {paper.title} <span aria-hidden="true">↗</span>
              </a>
            </h2>
            <PeopleTable caption={`Authors of ${paper.title}`} people={paper.authors} />
          </section>
        ))}

        <section>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink-strong">
            Contributors
          </h2>
          <PeopleTable caption="Nanda Index contributors" people={CONTRIBUTORS} />
        </section>
      </div>
    </PageShell>
  );
}

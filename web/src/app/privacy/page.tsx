import { PageShell } from "@/components/PageShell";

export const metadata = { title: "Privacy - NANDA Index" };

// Draft wording for owner review. Keep it factual: it describes what this
// deployment collects and why, and nothing it does not do.
export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" description="What NANDA Index collects and why.">
      <div className="max-w-3xl space-y-6 text-sm leading-relaxed text-ink-medium">
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-ink-strong">Accounts</h2>
          <p>
            To register agents you create an account with an email address (and a password, or a Google or
            GitHub sign-in). We use the email to sign you in, to verify it belongs to you, and to send
            account messages such as verification and password-reset links. Passwords are stored only as
            secure hashes.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-ink-strong">Index entries</h2>
          <p>
            Entries you register are published in the public index once verified: their identifier,
            name, description, tags, catalog or agent-card URL and publisher. For a personal entry the
            identifier contains the email address you register it with, so that address is public once
            the entry is live. Contact emails for organisation entries are not published.
          </p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-ink-strong">Email delivery</h2>
          <p>Verification and password-reset emails are sent through Resend.</p>
        </section>
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-ink-strong">Analytics</h2>
          <p>
            If you accept analytics, the site loads Google Analytics to count page views. It receives the
            page path (never the query string), and sign-in, password-reset and verification pages are
            never measured. If you decline, nothing is loaded. You can change your choice at any time via
            &ldquo;Cookie settings&rdquo; in the footer.
          </p>
          {process.env.NEXT_PUBLIC_POSTHOG_KEY && (
            <>
              <p className="mt-3">
                Accepting analytics also loads PostHog, which counts page views and clicks and records
                sessions (how pages are scrolled and clicked) with every piece of text and every form input
                masked, so neither what the page shows nor what you type is captured. Under the same rules as
                above it never receives the query string of a page or link, or an email address, and never
                runs on sign-in, password-reset and verification pages. It does not link your activity to
                your account.
              </p>
              <p className="mt-3">
                Separately, the index&apos;s API counts sign-ups, account verifications and entry
                registrations, verifications and deletions in PostHog. These counts carry no personal data (no
                email address, IP address, account or entry identifier) and are not linked to you or your
                browser.
              </p>
            </>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-ink-strong">Contact</h2>
          <p>
            To ask about or remove your data, delete your entries from the dashboard or contact the
            NANDA Index team via the project&apos;s GitHub repository.
          </p>
        </section>
      </div>
    </PageShell>
  );
}

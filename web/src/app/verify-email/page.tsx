"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, verifyEmail } from "@/lib/nanda-api";

const primaryBtnClass =
  "inline-flex items-center justify-center h-9 w-full rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-60";

/**
 * Confirms a contact email. Verification happens on the button press, not on
 * page load: mail scanners open links before the recipient does, and used to
 * spend the single-use token so the real click reported failure.
 */
function VerifyEmailInner() {
  // Read the token once, then drop it from the address bar and history so it
  // isn't left behind in the URL after the page has it.
  const tokenFromUrl = useSearchParams().get("token") ?? "";
  const [token] = useState(tokenFromUrl);
  useEffect(() => {
    if (tokenFromUrl) window.history.replaceState(null, "", window.location.pathname);
  }, [tokenFromUrl]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedOrg, setVerifiedOrg] = useState<{ id: string; active: boolean } | null>(null);

  async function onConfirm() {
    setLoading(true);
    setError(null);
    try {
      const org = await verifyEmail(token);
      setVerifiedOrg({ id: org.org_id, active: org.status === "active" });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "This link has expired or was already used. If your dashboard shows the email as verified, you're done — otherwise send a new link from the dashboard."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell title="Verify your email" description="Confirm the contact email for your NANDA Index registration.">
      <div className="mx-auto max-w-md space-y-5">
        <div className="bg-surface-light rounded-card border border-line p-8 shadow-card space-y-4">
          {!token ? (
            <p className="text-sm text-ink-medium">
              This verification link is invalid or incomplete. Open your{" "}
              <Link href="/dashboard" className="underline hover:text-brand-600">dashboard</Link>{" "}
              to send a new one.
            </p>
          ) : verifiedOrg ? (
            <p className="text-sm text-ink-medium">
              Email verified for <span className="font-mono">{verifiedOrg.id}</span>.{" "}
              {verifiedOrg.active
                ? "It is now live in the index."
                : "Next, verify your domain from the dashboard to make it live."}{" "}
              <Link href={`/dashboard/orgs/${encodeURIComponent(verifiedOrg.id)}`} className="underline hover:text-brand-600">
                Go to the dashboard
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-medium">Press the button to confirm this email address.</p>
              <button onClick={onConfirm} disabled={loading} className={primaryBtnClass}>
                {loading ? "Verifying…" : "Verify email"}
              </button>
            </>
          )}

          {error && (
            <p className="rounded-control border border-[#b42318]/30 bg-[#fef3f2] px-4 py-2.5 text-sm text-[#b42318]">
              {error}
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}

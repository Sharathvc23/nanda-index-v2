"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ApiError, verifyAccount } from "@/lib/nanda-api";

const primaryBtnClass =
  "inline-flex items-center justify-center h-9 w-full rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition disabled:opacity-60";

function VerifyAccountInner() {
  const searchParams = useSearchParams();
  // Read the token once: the URL is scrubbed right after (below), and later
  // renders must keep the original value.
  const [token] = useState(() => searchParams.get("token") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Drop the token from the address bar so it does not linger in history,
  // screenshots, or Referer headers.
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Verification happens only on an explicit click (POST). Email security
  // scanners prefetch links, so verifying on page load would let them confirm
  // an address its owner never saw.
  async function onConfirm() {
    setLoading(true);
    setError(null);
    try {
      await verifyAccount(token);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? "This verification link is invalid or has expired. Sign in and resend it from your dashboard."
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell title="Verify your email" description="Confirm your email address to start registering agents.">
      <div className="mx-auto max-w-md space-y-5">
        <div className="bg-surface-light rounded-card border border-line p-8 shadow-card">
          {!token ? (
            <p className="text-sm text-ink-medium">
              This verification link is invalid or incomplete.{" "}
              <Link href="/dashboard" className="underline hover:text-brand-600">
                Go to your dashboard
              </Link>{" "}
              to resend it.
            </p>
          ) : done ? (
            <p className="text-sm text-ink-medium">
              Your email is verified. You can now{" "}
              <Link href="/dashboard" className="underline hover:text-brand-600">
                register and manage agents
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-medium">
                Click below to confirm this is your email address.
              </p>

              {error && (
                <p className="rounded-control border border-[#b42318]/30 bg-[#fef3f2] px-4 py-2.5 text-sm text-[#b42318]">
                  {error}
                </p>
              )}

              <button type="button" onClick={onConfirm} disabled={loading} className={primaryBtnClass}>
                {loading ? "…" : "Verify my email"}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

export default function VerifyAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-ink-weak">Loading…</p>
        </div>
      }
    >
      <VerifyAccountInner />
    </Suspense>
  );
}

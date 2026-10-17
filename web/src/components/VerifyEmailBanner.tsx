"use client";

import { useState } from "react";
import { ApiError, resendAccountVerification } from "@/lib/nanda-api";

interface VerifyEmailBannerProps {
  email: string;
}

type ResendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

/**
 * Shown on the dashboard while the account email is unverified. Until it is,
 * the API rejects every org write, so nothing the user registers gets listed.
 */
export function VerifyEmailBanner({ email }: VerifyEmailBannerProps) {
  const [state, setState] = useState<ResendState>({ kind: "idle" });

  async function resend() {
    setState({ kind: "sending" });
    try {
      await resendAccountVerification();
      setState({ kind: "sent" });
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 429
          ? "A verification email was sent recently. Please wait a minute and try again."
          : "Could not send the email. Please try again.";
      setState({ kind: "error", message });
    }
  }

  return (
    <div
      role="status"
      className="rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
    >
      <p className="font-semibold">Verify your email to register and manage agents</p>
      <p className="mt-1">
        We sent a verification link to <span className="font-medium">{email}</span>. Until you
        confirm it, you can&apos;t register organizations and your agents won&apos;t be listed.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resend}
          disabled={state.kind === "sending" || state.kind === "sent"}
          className="inline-flex items-center justify-center h-8 rounded-control border-2 border-amber-300 bg-white px-3 text-sm font-medium text-amber-800 hover:border-amber-400 transition disabled:opacity-60"
        >
          {state.kind === "sending" ? "Sending…" : "Resend verification email"}
        </button>
        {state.kind === "sent" && <span>Sent. Check your inbox.</span>}
        {state.kind === "error" && <span className="text-[#b42318]">{state.message}</span>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { AtSign, Loader2, LogOut, Wallet } from "lucide-react";
import { connect, disconnect, loginSocial, short, useAccount, useSocialAvailable, useSource } from "@/lib/wallet-store";

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}

/** Sign-in card for the ☰ menu, in the same card style as the Introduction section. */
export function WalletCard() {
  const account = useAccount();
  const source = useSource();
  const socialOn = useSocialAvailable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const browser = async () => {
    setError("");
    setBusy(true);
    try {
      await connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't connect.");
    } finally {
      setBusy(false);
    }
  };

  const opt =
    "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-current/20 px-4 text-sm font-semibold transition-colors hover:bg-current/10 disabled:opacity-50";

  return (
    <article className="max-w-2xl rounded-3xl border border-current/15 p-5 md:p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] opacity-60">{account ? "Account" : "Sign in"}</p>
      <p className="display mt-2 text-[1.7rem] leading-tight text-[#ccff00] [html[data-mode=dark]_&]:text-[#3d7a00]">
        {account ? short(account) : "Join Kindle."}
      </p>
      <p className="mt-2 text-sm leading-relaxed opacity-75">
        {account
          ? source === "social"
            ? "Signed in with X or email. You approve every transaction."
            : "Connected with your browser wallet."
          : socialOn
            ? "Use X or email — Kindle makes a wallet only you control — or connect the wallet you already have."
            : "Connect the wallet you already have. Kindle never holds your keys."}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {account ? (
          <button type="button" className={opt} onClick={() => disconnect()}>
            <LogOut className="size-4" /> {source === "social" ? "Sign out" : "Disconnect"}
          </button>
        ) : (
          <>
            {socialOn && (
              <>
                <button type="button" className={`${opt} border-transparent bg-coral text-[#0b0b0b] hover:bg-coral/90`} onClick={() => loginSocial("twitter")}>
                  <XMark className="size-4" /> Continue with X
                </button>
                <button type="button" className={opt} onClick={() => loginSocial("email")}>
                  <AtSign className="size-4" /> Email
                </button>
              </>
            )}
            <button type="button" className={opt} disabled={busy} onClick={() => void browser()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />} Browser wallet
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs opacity-80">
          {error}
        </p>
      )}
    </article>
  );
}

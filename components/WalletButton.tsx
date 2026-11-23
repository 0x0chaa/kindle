"use client";

import { useEffect, useRef, useState } from "react";
import { AtSign, LogOut, Wallet } from "lucide-react";
import { connect, disconnect, loginSocial, short, useAccount, useSocialAvailable, useSource } from "@/lib/wallet-store";
import { cn } from "@/lib/utils";

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}

/** Sign-in button used in the nav, the menu and the trade and launch forms: browser wallet, X or email. */
export function WalletButton({
  className,
  tone = "light",
  iconOnly = false,
}: {
  className?: string;
  tone?: "light" | "dark" | "blue";
  iconOnly?: boolean;
}) {
  const account = useAccount();
  const source = useSource();
  const socialOn = useSocialAvailable();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const styles = {
    light: "border border-current/40 hover:bg-white hover:text-black",
    dark: "bg-ink text-paper hover:bg-coral hover:text-[#0b0b0b]",
    blue: "bg-coral text-[#0b0b0b] hover:bg-ink hover:text-paper",
  }[tone];

  const browser = async () => {
    setOpen(false);
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

  const label = account ? short(account) : busy ? "Connecting…" : socialOn ? "Sign in" : "Connect wallet";
  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-current/10";

  return (
    <div ref={box} className="relative inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        aria-label={iconOnly ? (account ? `Wallet ${short(account)}` : "Sign in") : undefined}
        title={iconOnly ? (account ? short(account) : "Sign in") : undefined}
        aria-expanded={open}
        onClick={() => {
          setError("");
          if (!account && !socialOn) return void browser();
          setOpen((v) => !v);
        }}
        className={cn(
          "relative inline-flex h-11 items-center gap-2 rounded-full text-sm font-semibold transition-colors",
          iconOnly ? "w-11 justify-center px-0" : "px-5",
          styles,
          className,
        )}
      >
        <Wallet className="size-4" />
        {!iconOnly && label}
        {iconOnly && account && (
          <span className="absolute right-2 top-2 size-2 rounded-full bg-[var(--flame)] ring-2 ring-[var(--bg)]" aria-hidden />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-current/10 bg-[var(--bg)] p-2 text-[var(--fg)] shadow-xl"
        >
          {account ? (
            <>
              <p className="px-3 pb-2 pt-1 text-xs opacity-60">
                {source === "social" ? "Signed in with X or email" : "Browser wallet"}
              </p>
              <p className="px-3 pb-2 font-mono text-sm">{short(account)}</p>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  disconnect();
                }}
              >
                <LogOut className="size-4" /> {source === "social" ? "Sign out" : "Disconnect"}
              </button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" className={item} onClick={browser}>
                <Wallet className="size-4" /> Browser wallet
              </button>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  loginSocial("twitter");
                }}
              >
                <XMark className="size-4" /> Continue with X
              </button>
              <button
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setOpen(false);
                  loginSocial("email");
                }}
              >
                <AtSign className="size-4" /> Continue with email
              </button>
              <p className="px-3 pb-1 pt-2 text-xs leading-snug opacity-55">
                X and email create a wallet only you control. You approve every transaction.
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <span role="alert" className="mt-1 max-w-xs text-xs text-[#3d7a00]">
          {error}
        </span>
      )}
    </div>
  );
}

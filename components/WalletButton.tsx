"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { AtSign, LogOut, Wallet, X as Close } from "lucide-react";
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
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
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
  const opt =
    "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-current/20 px-5 text-sm font-semibold transition-colors hover:bg-current/10";

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

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                <motion.div
                  key="backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 top-[84px] z-[58] bg-black/40 backdrop-blur-[2px]"
                  aria-hidden
                />
                <motion.div
                  key="panel"
                  ref={panel}
                  role="dialog"
                  aria-label={account ? "Wallet" : "Sign in"}
                  initial={{ y: -16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -16, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="fixed inset-x-0 top-[84px] z-[59] border-b border-current/10 bg-[var(--bg)] px-[5vw] py-5 text-[var(--fg)] shadow-xl"
                >
                  <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="display text-2xl">{account ? "Your wallet" : "Sign in to Kindle"}</p>
                        <p className="mt-1 text-sm opacity-60">
                          {account
                            ? `${source === "social" ? "Signed in with X or email" : "Browser wallet"} · ${short(account)}`
                            : "X and email create a wallet only you control. You approve every transaction."}
                        </p>
                      </div>
                      <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-current/10 md:hidden">
                        <Close className="size-5" />
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 md:flex md:items-center">
                      {account ? (
                        <button
                          type="button"
                          className={opt}
                          onClick={() => {
                            setOpen(false);
                            disconnect();
                          }}
                        >
                          <LogOut className="size-4" /> {source === "social" ? "Sign out" : "Disconnect"}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={cn(opt, "bg-coral text-[#0b0b0b] hover:bg-ink hover:text-paper")}
                            onClick={() => {
                              setOpen(false);
                              loginSocial("twitter");
                            }}
                          >
                            <XMark className="size-4" /> Continue with X
                          </button>
                          <button
                            type="button"
                            className={opt}
                            onClick={() => {
                              setOpen(false);
                              loginSocial("email");
                            }}
                          >
                            <AtSign className="size-4" /> Continue with email
                          </button>
                          <button type="button" className={opt} onClick={browser}>
                            <Wallet className="size-4" /> Browser wallet
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setOpen(false)}
                        className="hidden rounded-full p-2 hover:bg-current/10 md:inline-flex"
                      >
                        <Close className="size-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {error && (
        <span role="alert" className="mt-1 max-w-xs text-xs text-[#3d7a00]">
          {error}
        </span>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "./Providers";
import { Magnetic } from "./Magnetic";
import { TextScanner } from "@/components/ui/animated-text-10";
import { socials } from "@/lib/content";
import { EASE_EXPO, EASE_QUART } from "@/lib/utils";
import { WalletButton } from "./WalletButton";

/** Everything in the menu (top-right ☰). The desktop bar shows the `bar` ones too. */
const links = [
  { label: "Introduction", href: "/about#about" },
  { label: "How it works", href: "/about#how-it-works" },
  { label: "Tokens", href: "/#tokens", bar: true },
  { label: "Launch", href: "/launch", bar: true },
  { label: "Fees", href: "/about#fees", bar: true },
  { label: "FAQ", href: "/about#faq" },
  { label: "Docs", href: "/docs", bar: true },
];

function RollLabel({ children }: { children: string }) {
  return (
    <span className="relative block h-[1.25em] overflow-hidden leading-[1.25em]">
      <span className="block transition-transform duration-500 ease-out-expo group-hover:-translate-y-full">
        {children}
      </span>
      <span
        aria-hidden
        className="absolute left-0 top-full block transition-transform duration-500 ease-out-expo group-hover:-translate-y-full"
      >
        {children}
      </span>
    </span>
  );
}

export function Nav() {
  const { navigate, lenis, ready } = useApp();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > last.current && y > 240);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (open) lenis?.stop();
    else lenis?.start();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, lenis, ready]);

  const go = (href: string) => {
    setOpen(false);
    // let the menu close before scrolling / routing
    setTimeout(() => navigate(href), open ? 450 : 0);
  };

  return (
    <>
      <motion.header
        initial={{ y: -110 }}
        animate={{ y: !ready ? -110 : 0 }}
        transition={{ duration: 0.9, ease: EASE_EXPO }}
        className="absolute inset-x-0 top-0 z-[60] flex items-center justify-between px-[5vw] py-5 text-white mix-blend-difference"
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-[5vw] bottom-0 h-px bg-white/40" />
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("/#top");
          }}
          className="display inline-flex items-center gap-2.5 text-[2rem] tracking-[-0.06em] md:text-[2.4rem]"
          aria-label="Kindle — home"
        >
          <svg viewBox="0 0 100 100" className="size-9 shrink-0 md:size-10" aria-hidden="true">
            <path d="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z" fill="#ccff00" />
            <path d="M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z" fill="#0b0b0b" />
          </svg>
          <TextScanner text="Kindle" duration={2.8} inkColor="#ffffff" accentColor="var(--primary)" className="display" />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-9 text-sm md:flex">
          {links.filter((l) => l.bar).map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="group"
              onClick={(e) => {
                e.preventDefault();
                go(l.href);
              }}
            >
              <RollLabel>{l.label}</RollLabel>
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Magnetic className="hidden md:inline-block">
            <WalletButton tone="light" className="border-white/40" />
          </Magnetic>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="relative grid size-11 place-items-center rounded-full border border-white/40"
          >
            <span
              className="absolute h-px w-5 bg-white transition-transform duration-500 ease-out-expo"
              style={{ transform: open ? "rotate(45deg)" : "translateY(-6px)" }}
            />
            <span
              className="absolute h-px w-5 bg-white transition-opacity duration-300"
              style={{ opacity: open ? 0 : 1 }}
            />
            <span
              className="absolute h-px w-5 bg-white transition-transform duration-500 ease-out-expo"
              style={{ transform: open ? "rotate(-45deg)" : "translateY(6px)" }}
            />
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: 0.9, ease: EASE_QUART }}
            data-lenis-prevent
            className="fixed inset-0 z-[55] flex flex-col justify-between gap-8 overflow-y-auto bg-[#0b0b0b] px-[5vw] pb-10 pt-28 text-white"
          >
            <div className="aura" />
            <ul className="relative space-y-1">
              {links.map((l, i) => (
                <li key={l.href} className="overflow-hidden">
                  <motion.a
                    href={l.href}
                    onClick={(e) => {
                      e.preventDefault();
                      go(l.href);
                    }}
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "110%" }}
                    transition={{ duration: 0.8, delay: 0.15 + i * 0.06, ease: EASE_EXPO }}
                    className="display flex items-baseline gap-4 text-[clamp(2.2rem,9.5vw,5rem)] leading-[1.05]"
                  >
                    <span className="font-mono text-xs tracking-normal text-paper/40">{String(i + 1).padStart(2, "0")}</span>
                    {l.label}
                  </motion.a>
                </li>
              ))}
            </ul>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.5 } }}
              exit={{ opacity: 0 }}
              className="relative space-y-4 text-sm"
            >
              <WalletButton tone="blue" />
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-paper/60">
                {socials.map((s) =>
                  s.href ? (
                    <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="hover:text-paper">
                      {s.label}
                    </a>
                  ) : (
                    <span key={s.label}>
                      {s.label} <span className="text-xs">(soon)</span>
                    </span>
                  ),
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

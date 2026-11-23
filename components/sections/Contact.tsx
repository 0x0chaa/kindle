"use client";

import { useApp } from "../Providers";
import { TokenCA } from "../TokenCA";
import { socials } from "@/lib/content";
import { FACTORY } from "@/lib/factory";
import { NETWORKS } from "@/lib/networks";

type Item = { label: string; href: string; external?: boolean };

const columns: { title: string; items: Item[] }[] = [
  {
    title: "Kindle",
    items: [
      { label: "About", href: "/about#about" },
      { label: "How it works", href: "/about#how-it-works" },
      { label: "Fees", href: "/about#fees" },
      { label: "FAQ", href: "/about#faq" },
    ],
  },
  {
    title: "Products",
    items: [
      { label: "Launch", href: "/launch" },
      { label: "Tokens", href: "/#tokens" },
    ],
  },
  {
    title: "Community",
    items: socials.flatMap((s) => (s.href ? [{ label: s.id === "x" ? "X" : s.label, href: s.href, external: true }] : [])),
  },
  {
    title: "Explore",
    items: [
      { label: "Docs", href: "/docs" },
      { label: "API", href: "/docs#developers" },
      ...(FACTORY ? [{ label: "Factory contract", href: `${NETWORKS.robinhood.explorer}/address/${FACTORY}`, external: true }] : []),
      { label: "Robinhood Chain explorer", href: NETWORKS.robinhood.explorer, external: true },
      { label: "Terms & risks", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

/** Site footer: link columns on a dark ground. */
export function Contact() {
  const { navigate } = useApp();

  return (
    <footer id="contact" className="relative border-t border-current/10 bg-[var(--bg)] px-[5vw] pb-8 pt-10 text-[var(--fg)]">

      <nav aria-label="Footer" className="grid max-w-3xl grid-cols-2 gap-x-6 gap-y-7 md:grid-cols-4">
        {columns.map((c) => (
          <div key={c.title}>
            <h3 className="mb-2.5 text-sm font-semibold">{c.title}</h3>
            <ul className="space-y-1.5">
              {c.items.map((i) => (
                <li key={i.label}>
                  <a
                    href={i.href}
                    {...(i.external
                      ? { target: "_blank", rel: "noreferrer" }
                      : {
                          onClick: (e: React.MouseEvent) => {
                            e.preventDefault();
                            navigate(i.href);
                          },
                        })}
                    className="text-sm opacity-60 transition-opacity hover:opacity-100"
                  >
                    {i.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <TokenCA className="mt-8 max-w-xl" />

      <div className="mt-10 flex flex-col gap-2 border-t border-current/10 pt-6 text-sm opacity-50 md:flex-row md:justify-between">
        <span>© {new Date().getFullYear()} Kindle. Built on Uniswap v4, on Robinhood Chain.</span>
        <span>Not affiliated with Robinhood or Uniswap. Not financial advice.</span>
      </div>
    </footer>
  );
}

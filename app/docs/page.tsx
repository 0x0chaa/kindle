import type { Metadata } from "next";
import { docs } from "@/lib/launchpad-content";

export const metadata: Metadata = {
  title: "Docs — Kindle",
  description: "How Kindle works: launching on a bonding curve, graduation to Uniswap v4, pairs, fees, creator tax, buybacks and safety.",
};

export default function DocsPage() {
  return (
    <section data-tone="light" className="relative min-h-[100svh] px-[5vw] pb-24 pt-28">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-12">
        <nav aria-label="Docs sections" className="md:col-span-3">
          <div className="md:sticky md:top-28">
            <span className="mb-4 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Docs</span>
            <ul className="space-y-2 text-sm">
              {docs.map((d) => (
                <li key={d.id}>
                  <a href={`#${d.id}`} className="font-semibold opacity-70 hover:text-[#3d7a00] hover:opacity-100">
                    {d.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <div className="space-y-12 md:col-span-9">
          <h1 className="display text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.95]">Kindle docs</h1>
          {docs.map((d) => (
            <article key={d.id} id={d.id} className="scroll-mt-28">
              <h2 className="mb-3 text-2xl font-bold">{d.title}</h2>
              <div className="space-y-3 leading-relaxed opacity-80">
                {d.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

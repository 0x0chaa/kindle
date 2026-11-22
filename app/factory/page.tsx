import type { Metadata } from "next";
import { FactoryDeploy } from "@/components/launch/FactoryDeploy";
import { PairsAdmin } from "@/components/launch/PairsAdmin";

export const metadata: Metadata = { title: "Deploy the Kindle factory", robots: { index: false } };

export default function FactoryPage() {
  return (
    <section data-tone="light" className="relative min-h-[100svh] px-[5vw] pb-20 pt-28">
      <div className="mx-auto max-w-2xl">
        <span className="mb-4 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Owner setup</span>
        <h1 className="display text-[clamp(2.4rem,7vw,5rem)] leading-[0.95]">Deploy the factory.</h1>
        <p className="mb-8 mt-4 max-w-lg leading-relaxed opacity-75">
          One-time setup. Your wallet deploys Kindle&apos;s launch factory on Robinhood Chain and becomes its owner. Then put the
          address in Vercel as NEXT_PUBLIC_KINDLE_FACTORY and redeploy.
        </p>
        <FactoryDeploy />
        <PairsAdmin />
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata: Metadata = {
  title: "Launch a token — Kindle",
  description: "Launch a token on Robinhood Chain from your own wallet.",
};

export default function LaunchPage() {
  return (
    <section data-tone="light" className="relative min-h-[100svh] px-[5vw] pb-20 pt-28">
      <div className="mx-auto max-w-2xl">
        <span className="mb-4 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Launch</span>
        <h1 className="display text-[clamp(2.6rem,8vw,6rem)] leading-[0.95]">Launch a token.</h1>
        <p className="mb-8 mt-4 max-w-lg leading-relaxed opacity-75">
          Name it, give it an image, sign once. Your token goes live on a bonding curve on Robinhood Chain
          and graduates to a locked Uniswap v4 pool when it sells out.
        </p>
        <LaunchForm />
      </div>
    </section>
  );
}

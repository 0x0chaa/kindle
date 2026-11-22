import { Pill } from "@/components/Pill";

export default function NotFound() {
  return (
    <section data-tone="dark" className="relative flex min-h-[100svh] flex-col items-start justify-center px-[5vw]">
      <div className="aura" aria-hidden />
      <span className="relative mb-6 font-mono text-xs uppercase tracking-[0.2em] opacity-60">Error 404</span>
      <h1 className="display relative text-[clamp(3rem,12vw,12rem)]">
        Lost in <span className="text-chrome">space.</span>
      </h1>
      <p className="relative mt-6 max-w-md opacity-70">This page doesn&apos;t exist. Let&apos;s get you back home.</p>
      <div className="relative mt-10">
        <Pill href="/" variant="light">
          Back home
        </Pill>
      </div>
    </section>
  );
}

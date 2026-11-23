import Link from "next/link";

export default function NotFound() {
  return (
    <section className="relative flex min-h-[100svh] items-center px-[5vw] pt-16">
      <div className="mx-auto w-full max-w-6xl">
        <span className="mb-5 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Error 404</span>
        <h1 className="display text-[clamp(3rem,9vw,8rem)] leading-[0.95]">
          Nothing
          <br />
          <span className="text-[#3d7a00]">here.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed opacity-75">
          This page doesn&apos;t exist. If you followed a token link, check the contract address.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-[var(--fg)] px-6 py-3 font-semibold text-[var(--bg)] transition-opacity hover:opacity-85">
            Back home
          </Link>
          <Link href="/#tokens" className="rounded-full border border-current/20 px-6 py-3 font-semibold transition-colors hover:bg-current/5">
            Browse tokens
          </Link>
        </div>
      </div>
    </section>
  );
}

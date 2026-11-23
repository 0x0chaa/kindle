type Section = { title: string; body: string[] };

/** Plain text page for Terms and Privacy, styled like the docs. */
export function LegalPage({ label, title, updated, intro, sections }: { label: string; title: string; updated: string; intro: string; sections: Section[] }) {
  return (
    <section className="relative min-h-[100svh] px-[5vw] pb-24 pt-28">
      <div className="mx-auto max-w-3xl">
        <span className="mb-5 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">{label}</span>
        <h1 className="display text-[clamp(2.6rem,6vw,4.5rem)] leading-[0.95]">{title}</h1>
        <p className="mt-4 text-sm opacity-60">Last updated {updated}</p>
        <p className="mt-8 text-lg leading-relaxed opacity-80">{intro}</p>
        <div className="mt-12 space-y-10">
          {sections.map((s, i) => (
            <article key={s.title}>
              <h2 className="mb-3 text-xl font-bold">
                <span className="mr-2 opacity-40">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="space-y-3 leading-relaxed opacity-80">
                {s.body.map((p) => (
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

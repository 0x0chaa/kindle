import { Calendar, Database, FileText, Mail, MessageSquare, ShieldCheck, Check } from "lucide-react";
import type { StepVisualKind } from "@/lib/content";

/** A small animated motif for each "How it works" step. */
export function StepVisual({ kind }: { kind: StepVisualKind }) {
  switch (kind) {
    case "prompt":
      return (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="w-full max-w-[260px] rounded-2xl border border-current/20 bg-paper p-4">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] opacity-50">Goal</span>
            <p className="font-mono text-[13px] leading-snug">
              <span className="typing inline-block overflow-hidden whitespace-nowrap align-bottom">Summarise new tickets daily</span>
              <span className="caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-mint" />
            </p>
            <div className="mt-4 flex justify-end">
              <span className="rounded-full bg-gradient-to-r from-coral to-mint px-3 py-1 text-[11px] font-medium text-[#0b0b0b]">Run</span>
            </div>
          </div>
        </div>
      );
    case "connect": {
      const icons = [Mail, Calendar, Database, FileText, MessageSquare];
      return (
        <div className="absolute inset-0 grid place-items-center">
          <div className="spin-slow relative size-40">
            <svg className="absolute inset-0 size-full opacity-30" viewBox="0 0 160 160" aria-hidden>
              {icons.map((_, i) => {
                const a = (i / icons.length) * Math.PI * 2;
                return <line key={i} x1="80" y1="80" x2={80 + Math.cos(a) * 70} y2={80 + Math.sin(a) * 70} stroke="currentColor" strokeDasharray="3 4" />;
              })}
            </svg>
            {icons.map((Icon, i) => {
              const a = (i / icons.length) * Math.PI * 2;
              return (
                <span
                  key={i}
                  className="spin-rev absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-current/20 bg-ink text-paper"
                  style={{ left: `${50 + Math.cos(a) * 44}%`, top: `${50 + Math.sin(a) * 44}%` }}
                >
                  <Icon className="size-4" />
                </span>
              );
            })}
          </div>
          <span className="absolute size-10 rounded-full bg-gradient-to-br from-mint to-coral shadow-[0_0_30px_rgba(204,255,0,.7)]" />
        </div>
      );
    }
    case "guard":
      return (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="w-full max-w-[250px] space-y-2.5">
            {[
              ["Read inbox", true],
              ["Send replies", false],
              ["Spend over $50", false],
            ].map(([label, on], i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-current/15 bg-paper/70 px-3 py-2 text-[13px]">
                <span>{label as string}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">{on ? "Auto" : "Ask me"}</span>
                <span className={`relative h-5 w-9 rounded-full ${on ? "bg-coral" : "bg-current/20"}`}>
                  <span className={`absolute top-0.5 size-4 rounded-full bg-paper transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                </span>
              </div>
            ))}
          </div>
          <ShieldCheck className="bob absolute right-5 top-4 size-6 text-mint" />
        </div>
      );
    case "plan":
      return (
        <div className="absolute inset-0 grid place-items-center p-6">
          <ol className="w-full max-w-[240px] space-y-2.5">
            {["Fetch new tickets", "Group by topic", "Draft summary", "Post to #support"].map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-[13px]">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full border border-coral text-[10px]"
                  style={{ animation: "step-on 4s ease-in-out infinite", animationDelay: `${i * 0.8}s` }}
                >
                  {i + 1}
                </span>
                <span className="h-px flex-1 bg-current/15" />
                <span className="w-32 opacity-80">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "execute":
      return (
        <div className="absolute inset-0 grid place-items-center p-5">
          <div className="w-full max-w-[270px] overflow-hidden rounded-xl border border-current/15 bg-ink text-paper font-mono text-[11px] leading-relaxed">
            <div className="flex gap-1.5 border-b border-current/10 px-3 py-2">
              {["#e2ff80", "#ccff00", "#c9c9d3"].map((c) => (
                <span key={c} className="size-2 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <div className="space-y-1 p-3">
              {[
                ["›", "zendesk.search(status:new)", "opacity-80"],
                ["✓", "42 tickets fetched", "text-mint"],
                ["›", "cluster(topics)", "opacity-80"],
                ["✓", "6 topics found", "text-mint"],
                ["›", "slack.post(#support)", "text-mint"],
              ].map(([p, t, c], i) => (
                <div key={i} className={`log-line ${c}`} style={{ animationDelay: `${i * 0.45}s` }}>
                  <span className="mr-2 opacity-50">{p}</span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "review":
      return (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="flex h-28 items-end gap-2.5">
            {[38, 52, 46, 68, 74, 90].map((h, i) => (
              <span
                key={i}
                className="bar w-6 origin-bottom rounded-t-md bg-gradient-to-t from-coral to-mint"
                style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="bob absolute right-6 top-5 grid size-9 place-items-center rounded-full bg-paper text-ink">
            <Check className="size-4" />
          </span>
        </div>
      );
  }
}

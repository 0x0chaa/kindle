"use client";

import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { Pill } from "./Pill";
import { useCases } from "@/lib/content";
import { cn, EASE_EXPO } from "@/lib/utils";

type Fields = { name: string; email: string; company: string; details: string; interests: string[] };
type Errors = Partial<Record<"name" | "email" | "details", string>>;

const empty: Fields = { name: "", email: "", company: "", details: "", interests: [] };

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Please tell us your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email)) e.email = "That email doesn't look right.";
  if (f.details.trim().length < 10) e.details = "A sentence or two about the task, please.";
  return e;
}

function Field({
  id,
  label,
  error,
  textarea,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  error?: string;
  textarea?: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  const cls =
    "peer w-full resize-none border-b border-paper/20 bg-transparent pb-3 pt-7 text-base text-paper outline-none transition-colors placeholder:text-transparent focus:border-mint";
  return (
    <div className="relative">
      {textarea ? (
        <textarea
          id={id}
          name={id}
          rows={4}
          placeholder={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cls}
          data-lenis-prevent
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          placeholder={label}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={cls}
        />
      )}
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-0 top-7 origin-left text-paper/50 transition-all duration-300 peer-focus:top-0 peer-focus:scale-75 peer-focus:text-mint peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:scale-75"
      >
        {label}
      </label>
      <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-coral to-mint transition-transform duration-500 peer-focus:scale-x-100" />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-mint">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactForm() {
  const [f, setF] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [honey, setHoney] = useState("");

  const set = (k: keyof Fields) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k as keyof Errors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const toggle = (t: string) =>
    setF((p) => ({
      ...p,
      interests: p.interests.includes(t) ? p.interests.filter((x) => x !== t) : [...p.interests, t],
    }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, website: honey }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setF(empty);
    } catch {
      setStatus("error");
    }
  }

  return (
    <AnimatePresence mode="wait">
      {status === "sent" ? (
        <motion.div
          key="ok"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
          className="flex min-h-[420px] flex-col items-start justify-center rounded-[28px] border border-paper/15 bg-white/[0.03] p-8"
          role="status"
        >
          <span className="mb-6 grid size-14 place-items-center rounded-full bg-gradient-to-br from-coral to-mint text-ink">
            <Check className="size-6" />
          </span>
          <h3 className="display text-[clamp(2rem,4vw,3.4rem)]">Request received.</h3>
          <p className="mt-4 max-w-sm text-paper/70">
            Thanks — we&apos;ll reply within two working days with next steps for your first agent.
          </p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="mt-8 text-sm underline underline-offset-4 hover:text-mint"
          >
            Send another message
          </button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          noValidate
          onSubmit={submit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-8"
        >
          <div className="grid gap-8 sm:grid-cols-2">
            <Field id="name" label="Name *" autoComplete="name" value={f.name} onChange={set("name")} error={errors.name} />
            <Field
              id="email"
              label="Email *"
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={set("email")}
              error={errors.email}
            />
          </div>
          <Field id="company" label="Company" autoComplete="organization" value={f.company} onChange={set("company")} />

          <fieldset>
            <legend className="mb-3 text-sm text-paper/50">I want to automate</legend>
            <div className="flex flex-wrap gap-2">
              {useCases.map((s) => {
                const on = f.interests.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-all duration-300",
                      on ? "border-mint bg-mint text-ink" : "border-paper/20 hover:border-paper/60",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field id="details" label="What should your agent do? *" textarea value={f.details} onChange={set("details")} error={errors.details} />

          {/* honeypot */}
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
            name="website"
            value={honey}
            onChange={(e) => setHoney(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <Pill
              type="submit"
              variant="light"
              disabled={status === "sending"}
              icon={status === "sending" ? <Loader2 className="size-4 animate-spin" /> : undefined}
            >
              {status === "sending" ? "Sending…" : "Request access"}
            </Pill>
            {status === "error" && (
              <p role="alert" className="text-sm text-mint">
                Something went wrong. Please try again or email us directly.
              </p>
            )}
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}

import { NextResponse } from "next/server";

type Payload = {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  details?: unknown;
  interests?: unknown;
  website?: unknown; // honeypot
};

const str = (v: unknown, max = 5000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Bots fill the hidden field — pretend success, drop silently.
  if (str(body.website)) return NextResponse.json({ ok: true });

  const name = str(body.name, 200);
  const email = str(body.email, 320);
  const company = str(body.company, 200);
  const details = str(body.details);
  const interests = Array.isArray(body.interests)
    ? body.interests.filter((x): x is string => typeof x === "string").slice(0, 10)
    : [];

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "A valid email is required.";
  if (details.length < 10) errors.details = "Please add a few words about the project.";
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  const message = { name, email, company, details, interests, receivedAt: new Date().toISOString() };

  // Deliver the lead. Set CONTACT_WEBHOOK_URL (Slack/Discord/Zapier/Make/your CRM) to forward it.
  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `New project enquiry from ${name} <${email}>${company ? ` (${company})` : ""}\n${
            interests.length ? `Interests: ${interests.join(", ")}\n` : ""
          }\n${details}`,
          ...message,
        }),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    } catch (err) {
      console.error("[contact] delivery failed", err);
      return NextResponse.json({ ok: false, error: "Delivery failed." }, { status: 502 });
    }
  } else {
    console.info("[contact] new enquiry (no CONTACT_WEBHOOK_URL set):", message);
  }

  return NextResponse.json({ ok: true });
}

import "server-only";
import { NextResponse } from "next/server";
import { complete } from "./llm";

/** Optional shared access code so a public deployment can't spend your API credits. */
export function checkAccess(req: Request) {
  const code = process.env.AGENT_ACCESS_CODE;
  if (!code) return null;
  if (req.headers.get("x-access-code") === code) return null;
  return NextResponse.json({ error: "access_code", message: "This console needs an access code." }, { status: 401 });
}

/* ------------------------------ fetch_url ------------------------------ */

const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[?::1\]?|\[?f[cd][0-9a-f]{2}:.*)$/i;

function assertPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That is not a valid URL.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http and https URLs are allowed.");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("Private and local addresses are not allowed.");
  return u;
}

function htmlToText(html: string) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, body };
}

export async function fetchUrl(raw: string) {
  let url = assertPublicUrl(raw);
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
      headers: { "user-agent": "KindleAgent/1.0 (+https://kindle.ai)", accept: "text/html,text/plain,application/json" },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = assertPublicUrl(new URL(loc, url).toString());
      continue;
    }
    break;
  }
  if (!res) throw new Error("No response.");
  if (!res.ok) throw new Error(`The page answered with HTTP ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  const raw2 = (await res.text()).slice(0, 1_500_000);
  const { title, body } = type.includes("html") ? htmlToText(raw2) : { title: "", body: raw2 };
  const text = body.length > 9000 ? `${body.slice(0, 9000)}\n…[truncated]` : body;
  return `URL: ${url.toString()}\nTitle: ${title || "(none)"}\n\n${text}`;
}

/* ------------------------------ calculator ----------------------------- */

export function calculate(expression: string) {
  const expr = String(expression ?? "").replace(/,/g, "").replace(/\^/g, "**").replace(/×/g, "*").replace(/÷/g, "/");
  if (!expr.trim() || expr.length > 300 || !/^[0-9+\-*/().%\s]+$/.test(expr)) {
    throw new Error("Only numbers, + - * / ^ % and parentheses are allowed.");
  }
  // Safe: the pattern above admits no identifiers, so nothing but arithmetic can run.
  const value = Function(`"use strict";return (${expr});`)() as unknown;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("The expression did not produce a finite number.");
  return `${expression} = ${Number(value.toPrecision(15))}`;
}

/* ------------------------------- get_time ------------------------------ */

export function getTime(timezone?: string) {
  const tz = timezone || "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "long",
    });
    return `${fmt.format(new Date())} (${tz})`;
  } catch {
    throw new Error(`Unknown time zone "${tz}". Use an IANA name such as Asia/Jakarta.`);
  }
}

/* ----------------------------- http_request ---------------------------- */

export async function httpRequest(input: { method?: string; url?: string; headers?: Record<string, string>; body?: string }) {
  const method = input.method === "POST" ? "POST" : "GET";
  const url = assertPublicUrl(String(input.url ?? ""));
  const headers: Record<string, string> = { "user-agent": "KindleAgent/1.0" };
  for (const [k, v] of Object.entries(input.headers ?? {}).slice(0, 12)) {
    if (/^(host|cookie|connection|content-length)$/i.test(k)) continue;
    headers[k] = String(v).slice(0, 2000);
  }
  if (method === "POST" && input.body && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? String(input.body ?? "").slice(0, 100_000) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  const text = (await res.text()).slice(0, 12_000);
  return `HTTP ${res.status} ${res.statusText}\ncontent-type: ${res.headers.get("content-type") ?? "?"}\n\n${text}${text.length >= 12_000 ? "\n…[truncated]" : ""}`;
}

/* ------------------------------- ask_llm ------------------------------- */

export async function askLlm(input: { prompt?: string; model?: string; system?: string }) {
  const tier = input.model === "fast" ? "fast" : input.model === "smart" ? "smart" : undefined;
  return complete(String(input.prompt ?? "").slice(0, 60_000), input.system ? String(input.system).slice(0, 4000) : undefined, tier);
}

/* ----------------------------- send_message ---------------------------- */

export async function sendMessage(text: string) {
  const hook = process.env.AGENT_WEBHOOK_URL;
  if (!hook) throw new Error("No chat is connected. Set AGENT_WEBHOOK_URL (a Slack, Discord or Teams incoming webhook).");
  const msg = String(text ?? "").slice(0, 3500);
  // Slack and Teams read `text`; Discord reads `content`.
  const res = await fetch(hook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: msg, content: msg }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`The chat webhook answered HTTP ${res.status}.`);
  return "Message sent.";
}

/* ----------------------------- MCP servers ----------------------------- */

/** Servers configured on the server (tokens never reach the browser): JSON in MCP_SERVERS. */
export function envMcpServers(): { name: string; url: string; token?: string }[] {
  try {
    const list = JSON.parse(process.env.MCP_SERVERS || "[]") as { name: string; url: string; token?: string }[];
    return Array.isArray(list) ? list.filter((s) => s?.name && s?.url) : [];
  } catch {
    console.error("[agent] MCP_SERVERS is not valid JSON");
    return [];
  }
}

/* ------------------------------ chain_docs ----------------------------- */

const RH_DOCS = "https://docs.robinhood.com";
const RH_PAGES = [
  { path: "/chain", title: "Robinhood Chain overview" },
  { path: "/chain/connecting", title: "Connecting to Robinhood Chain: network configuration, RPC, faucet" },
  { path: "/chain/add-network-to-wallet", title: "Add Robinhood Chain to a wallet" },
  { path: "/chain/protocol-contracts", title: "Protocol contracts on Robinhood Chain" },
];
let docsIndex: { at: number; lines: string[] } | null = null;

function docsText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function chainDocs(input: { query?: string; path?: string }) {
  if (input.path) {
    const url = new URL(String(input.path), RH_DOCS);
    if (url.host !== "docs.robinhood.com" || !url.pathname.startsWith("/chain")) {
      throw new Error("Only Robinhood Chain docs pages (docs.robinhood.com/chain/…) can be read.");
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`docs.robinhood.com answered HTTP ${res.status} for ${url.pathname}.`);
    const raw = await res.text();
    const text = (res.headers.get("content-type") ?? "").includes("html") ? docsText(raw) : raw;
    return `Source: ${url.toString()}\n\n${text.length > 10_000 ? `${text.slice(0, 10_000)}\n…[truncated]` : text}`;
  }
  // Prefer the docs' llms.txt index when it exists; fall back to the known core pages.
  if (!docsIndex || Date.now() - docsIndex.at > 3_600_000) {
    let lines: string[] = [];
    for (const idx of [`${RH_DOCS}/chain/llms.txt`, `${RH_DOCS}/llms.txt`]) {
      const res = await fetch(idx, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
      if (res?.ok) {
        lines = (await res.text()).split("\n").filter((l) => l.includes("](") && l.includes("/chain"));
        if (lines.length) break;
      }
    }
    if (!lines.length) lines = RH_PAGES.map((p) => `- [${p.title}](${RH_DOCS}${p.path})`);
    docsIndex = { at: Date.now(), lines };
  }
  const terms = String(input.query ?? "").toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  const scored = docsIndex.lines
    .map((l) => ({ l, s: terms.reduce((n, t) => n + (l.toLowerCase().includes(t) ? 1 : 0), 0) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 10);
  return `Robinhood Chain docs pages (read one with path, e.g. /chain/connecting):\n${scored.map((x) => x.l.trim()).join("\n")}`;
}

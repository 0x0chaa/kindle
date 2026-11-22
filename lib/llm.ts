import "server-only";

/**
 * One model call in Anthropic Messages format, whatever provider is configured.
 *
 *   LLM_PROVIDER = anthropic | gemini | groq | openrouter   (default: anthropic if ANTHROPIC_API_KEY is set, else gemini)
 *   LLM_API_KEY  = key for gemini / groq / openrouter        (ANTHROPIC_API_KEY for anthropic)
 *   LLM_MODEL    = model id (optional; sensible free default per provider)
 *
 * Gemini, Groq and OpenRouter speak the OpenAI Chat Completions format, so their
 * requests and replies are translated here. The console never needs to know.
 */

export type Provider = "anthropic" | "gemini" | "groq" | "openrouter";

const OPENAI_COMPAT: Record<Exclude<Provider, "anthropic">, { base: string; model: string; label: string }> = {
  gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-latest", label: "Google Gemini (free tier)" },
  groq: { base: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", label: "Groq (free tier)" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openrouter/free", label: "OpenRouter (free models)" },
};

export function llmConfig() {
  const explicit = process.env.LLM_PROVIDER as Provider | undefined;
  const provider: Provider =
    explicit && (explicit === "anthropic" || explicit in OPENAI_COMPAT)
      ? explicit
      : process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : "gemini";
  if (provider === "anthropic") {
    return {
      provider,
      key: process.env.ANTHROPIC_API_KEY,
      model: process.env.AGENT_MODEL || process.env.LLM_MODEL || "claude-sonnet-5-5",
      label: "Claude (Anthropic API)",
    };
  }
  const p = OPENAI_COMPAT[provider];
  return { provider, key: process.env.LLM_API_KEY, model: process.env.LLM_MODEL || p.model, label: p.label, base: p.base };
}

/** True when the provider can run Anthropic's server tools (web search, code sandbox, MCP connector). */
export const supportsServerTools = () => llmConfig().provider === "anthropic";

type AnyBlock = Record<string, unknown> & { type: string };
type AMsg = { role: "user" | "assistant"; content: string | AnyBlock[] };
export type StepResult = {
  content: AnyBlock[];
  stop_reason: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

export class LlmError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* Anthropic                                                           */
/* ------------------------------------------------------------------ */
async function callAnthropic(body: Record<string, unknown>, extraHeaders: Record<string, string>): Promise<StepResult> {
  const cfg = llmConfig();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": cfg.key!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify({ model: cfg.model, ...body }),
    signal: AbortSignal.timeout(115_000),
  }).catch(() => null);
  if (!res) throw new LlmError("Could not reach the model.");
  const data = (await res.json().catch(() => null)) as (StepResult & { error?: { message?: string } }) | null;
  if (!res.ok || !data) throw new LlmError(data?.error?.message ?? `Model error (HTTP ${res.status}).`, res.status === 429 ? 429 : 502);
  return { content: data.content, stop_reason: data.stop_reason, usage: data.usage };
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible (Gemini, Groq, OpenRouter)                        */
/* ------------------------------------------------------------------ */
function toOpenAiMessages(system: string, messages: AMsg[]) {
  const out: Record<string, unknown>[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("\n");
      const calls = m.content
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: String(b.id), type: "function", function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) } }));
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    // user turn: tool results become `tool` messages; the rest becomes one user message
    const parts: Record<string, unknown>[] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") {
        const c = b.content;
        out.push({
          role: "tool",
          tool_call_id: String(b.tool_use_id),
          content: (b.is_error ? "ERROR: " : "") + (typeof c === "string" ? c : JSON.stringify(c)),
        });
      } else if (b.type === "text") {
        parts.push({ type: "text", text: String(b.text ?? "") });
      } else if (b.type === "image") {
        const src = b.source as { media_type?: string; data?: string };
        parts.push({ type: "image_url", image_url: { url: `data:${src.media_type};base64,${src.data}` } });
      } else if (b.type === "document") {
        parts.push({ type: "text", text: `[A PDF named "${String(b.title ?? "document")}" was attached, but this model provider can't read PDFs. Ask the user to paste the text instead.]` });
      }
    }
    if (parts.length) out.push({ role: "user", content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts });
  }
  return out;
}

async function callOpenAiCompat(system: string, messages: AMsg[], tools: AnyBlock[] | Record<string, unknown>[], maxTokens: number): Promise<StepResult> {
  const cfg = llmConfig();
  const fnTools = (tools as Record<string, unknown>[])
    .filter((t) => t.input_schema)
    .map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${cfg.key}`,
      "content-type": "application/json",
      ...(cfg.provider === "openrouter" ? { "x-title": "Kindle" } : {}),
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      messages: toOpenAiMessages(system, messages),
      ...(fnTools.length ? { tools: fnTools, tool_choice: "auto" } : {}),
    }),
    signal: AbortSignal.timeout(115_000),
  }).catch(() => null);
  if (!res) throw new LlmError("Could not reach the model.");
  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string } | string;
  } | null;
  if (!res.ok || !data?.choices?.length) {
    const msg = typeof data?.error === "string" ? data.error : data?.error?.message;
    throw new LlmError(msg ?? `Model error (HTTP ${res.status}).`, res.status === 429 ? 429 : 502);
  }
  const msg = data.choices[0].message ?? {};
  const content: AnyBlock[] = [];
  if (msg.content) content.push({ type: "text", text: msg.content });
  for (const [i, c] of (msg.tool_calls ?? []).entries()) {
    let input: unknown = {};
    try {
      input = JSON.parse(c.function.arguments || "{}");
    } catch {
      input = {};
    }
    content.push({ type: "tool_use", id: c.id || `call_${Date.now()}_${i}`, name: c.function.name, input });
  }
  return {
    content,
    stop_reason: msg.tool_calls?.length ? "tool_use" : "end_turn",
    usage: { input_tokens: data.usage?.prompt_tokens, output_tokens: data.usage?.completion_tokens },
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */
export async function runTurn(opts: {
  system: string;
  messages: AMsg[];
  tools: Record<string, unknown>[];
  mcpServers?: Record<string, unknown>[];
  maxTokens?: number;
}): Promise<StepResult> {
  const cfg = llmConfig();
  if (!cfg.key) throw new LlmError("missing_key", 503);
  if (cfg.provider === "anthropic") {
    const mcp = opts.mcpServers ?? [];
    return callAnthropic(
      {
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: opts.messages,
        ...(opts.tools.length ? { tools: opts.tools } : {}),
        ...(mcp.length ? { mcp_servers: mcp } : {}),
      },
      mcp.length ? { "anthropic-beta": "mcp-client-2025-11-20" } : {},
    );
  }
  return callOpenAiCompat(opts.system, opts.messages, opts.tools, opts.maxTokens ?? 4096);
}

/** Single prompt → text, used by the "Ask another model" tool. */
export async function complete(prompt: string, system?: string, tier?: "fast" | "smart"): Promise<string> {
  const cfg = llmConfig();
  if (!cfg.key) throw new Error("No model API key is configured.");
  if (cfg.provider === "anthropic") {
    const model =
      tier === "fast" ? process.env.AGENT_FAST_MODEL || "claude-haiku-5-5" : tier === "smart" ? process.env.AGENT_SMART_MODEL || "claude-opus-5-5" : cfg.model;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": cfg.key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 2048, ...(system ? { system } : {}), messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(90_000),
    });
    const data = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
    if (!res.ok || !data) throw new Error(data?.error?.message ?? `Model error (HTTP ${res.status}).`);
    return `[${model}]\n${(data.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n")}`;
  }
  const r = await callOpenAiCompat(system || "You are a helpful assistant.", [{ role: "user", content: prompt }], [], 2048);
  return `[${cfg.model}]\n${r.content.filter((b) => b.type === "text").map((b) => String(b.text)).join("\n")}`;
}

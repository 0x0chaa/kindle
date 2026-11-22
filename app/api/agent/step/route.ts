import { NextResponse } from "next/server";
import { MCP_NAME, SYSTEM_PROMPT, TOOLS, toolDefinitions, type McpServer, type ToolName } from "@/lib/agent-tools";
import { checkAccess, envMcpServers } from "@/lib/agent-server";
import { NETWORKS } from "@/lib/networks";
import { LlmError, llmConfig, runTurn, supportsServerTools } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED = TOOLS.map((t) => t.name);

/**
 * One turn of the agent loop: send the conversation to the configured model
 * (Claude, or a free Gemini / Groq / OpenRouter key) and return its reply in
 * Anthropic format. The browser drives the loop so it can pause for approvals.
 */
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;

  const cfg = llmConfig();
  if (!cfg.key) {
    return NextResponse.json(
      {
        error: "missing_key",
        message:
          cfg.provider === "anthropic"
            ? "Set ANTHROPIC_API_KEY in .env.local to run real agents."
            : "Set LLM_API_KEY in .env.local (a free Google AI Studio, Groq or OpenRouter key) to run real agents.",
      },
      { status: 503 },
    );
  }
  const serverTools = supportsServerTools();

  let body: { messages?: unknown; tools?: unknown; mcp?: unknown; envMcp?: unknown; network?: unknown; wallet?: unknown; limits?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length || messages.length > 80 || JSON.stringify(messages).length > 600_000) {
    return NextResponse.json({ error: "bad_request", message: "The conversation is empty or too long." }, { status: 400 });
  }
  const tools = (Array.isArray(body.tools) ? body.tools : [])
    .filter((t): t is ToolName => ALLOWED.includes(t as ToolName))
    .filter((t) => serverTools || TOOLS.find((x) => x.name === t)?.runs !== "anthropic");

  // MCP: servers configured on the server (by name) plus servers the user added in the console.
  const wantEnv = new Set(Array.isArray(body.envMcp) ? (body.envMcp as string[]) : []);
  const userMcp = (Array.isArray(body.mcp) ? (body.mcp as McpServer[]) : []).slice(0, 5).filter((m) => {
    try {
      return MCP_NAME.test(m.name) && new URL(m.url).protocol === "https:";
    } catch {
      return false;
    }
  });
  const mcp = serverTools ? [...envMcpServers().filter((m) => wantEnv.has(m.name)), ...userMcp] : [];
  const mcpServers = mcp.map((m) => ({
    type: "url",
    url: m.url,
    name: m.name,
    ...(m.token ? { authorization_token: m.token } : {}),
  }));
  const allTools = [
    ...toolDefinitions(tools),
    ...mcp.map((m) => ({ type: "mcp_toolset", mcp_server_name: m.name })),
  ];

  const today = new Date().toISOString().slice(0, 10);
  const net = NETWORKS[body.network === "robinhood-testnet" ? "robinhood-testnet" : "robinhood"];
  const wallet = typeof body.wallet === "string" && /^0x[0-9a-fA-F]{40}$/.test(body.wallet) ? body.wallet : null;
  const kindleCa = (process.env.NEXT_PUBLIC_KINDLE_CA ?? "").trim();
  const tokenContext = /^0x[0-9a-fA-F]{40}$/.test(kindleCa)
    ? ` The official $KINDLE token (Kindle's own token) is ${kindleCa} on Robinhood Chain mainnet; swap_quote accepts "KINDLE" as a symbol. When asked for the Kindle contract address, give exactly this one and warn that look-alike tokens exist.`
    : "";
  const chainContext = tools.some((t) => t.startsWith("chain_") || t === "swap_quote")
    ? `\nActive blockchain network: ${net.name} (chain id ${net.chainId}, explorer ${net.explorer}). ${
        wallet ? `The user's connected wallet is ${wallet}.` : "The user has not connected a wallet yet; ask them to connect one before preparing a transaction."
      }${
        typeof body.limits === "string" && body.limits
          ? ` The user's signing limits (enforced before any wallet prompt; stay inside them): ${body.limits.slice(0, 1500)}.`
          : ""
      }${tokenContext}`
    : "";
  try {
    const out = await runTurn({
      system: `${SYSTEM_PROMPT}\nToday's date is ${today}.${chainContext}`,
      messages: messages as Parameters<typeof runTurn>[0]["messages"],
      tools: allTools as Record<string, unknown>[],
      mcpServers,
    });
    return NextResponse.json(out);
  } catch (e) {
    const err = e instanceof LlmError ? e : new LlmError("Could not reach the model.");
    console.error("[agent] model request failed", e);
    return NextResponse.json({ error: "upstream", message: err.message }, { status: err.status });
  }
}

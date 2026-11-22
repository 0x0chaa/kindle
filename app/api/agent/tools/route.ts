import { NextResponse } from "next/server";
import { askLlm, chainDocs, calculate, checkAccess, fetchUrl, getTime, httpRequest, sendMessage } from "@/lib/agent-server";
import { chainHistory, chainRead, chainSimulate } from "@/lib/chain";
import { compileContract, type Artifact } from "@/lib/compile";
import { swapQuote } from "@/lib/swap";
import type { NetworkId } from "@/lib/networks";

export const runtime = "nodejs";
export const maxDuration = 120;

type Call = { id: string; name: string; input: Record<string, unknown> };

/** Runs the agent's server-side tools and returns tool_result blocks. */
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return denied;

  let calls: Call[] = [];
  let network: NetworkId = "robinhood";
  try {
    const body = (await req.json()) as { calls?: Call[]; network?: string };
    calls = Array.isArray(body.calls) ? body.calls.slice(0, 10) : [];
    if (body.network === "robinhood-testnet") network = "robinhood-testnet";
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }

  const results = await Promise.all(
    calls.map(async (c) => {
      try {
        let content: string;
        let artifact: Artifact | undefined;
        switch (c.name) {
          case "fetch_url":
            content = await fetchUrl(String(c.input?.url ?? ""));
            break;
          case "calculator":
            content = calculate(String(c.input?.expression ?? ""));
            break;
          case "get_time":
            content = getTime(c.input?.timezone ? String(c.input.timezone) : undefined);
            break;
          case "http_request":
            content = await httpRequest(c.input as Parameters<typeof httpRequest>[0]);
            break;
          case "ask_llm":
            content = await askLlm(c.input as Parameters<typeof askLlm>[0]);
            break;
          case "chain_read":
            content = await chainRead(c.input, network);
            break;
          case "chain_simulate":
            content = await chainSimulate(c.input, network);
            break;
          case "chain_docs":
            content = await chainDocs(c.input as { query?: string; path?: string });
            break;
          case "chain_history":
            content = await chainHistory(c.input, network);
            break;
          case "swap_quote":
            content = await swapQuote(c.input, network);
            break;
          case "compile_contract": {
            const out = await compileContract(c.input, network);
            content = out.content;
            artifact = out.artifact;
            break;
          }
          case "send_message":
            content = await sendMessage(String(c.input?.text ?? ""));
            break;
          default:
            throw new Error(`Unknown tool "${c.name}".`);
        }
        // The artifact (ABI + bytecode) stays in the browser; only `content` goes to the model.
        return { type: "tool_result", tool_use_id: c.id, content, ...(artifact ? { artifact } : {}) };
      } catch (e) {
        return {
          type: "tool_result",
          tool_use_id: c.id,
          is_error: true,
          content: e instanceof Error ? e.message : "Tool failed.",
        };
      }
    }),
  );

  return NextResponse.json({ results });
}

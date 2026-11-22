import { NextResponse } from "next/server";
import { llmConfig } from "@/lib/llm";

/** Which model provider is configured (no secrets). */
export async function GET() {
  const c = llmConfig();
  return NextResponse.json({
    provider: c.provider,
    label: c.label,
    model: c.model,
    configured: Boolean(c.key),
    serverTools: c.provider === "anthropic",
  });
}

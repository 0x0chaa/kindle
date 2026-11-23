import { NextResponse } from "next/server";
import { swapQuote } from "@/lib/swap";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Quote + ready-to-sign steps for the swap box (Kindle tokens via Uniswap v4; other tokens v3, then v4). No AI involved. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }
  try {
    const out = await swapQuote(
      {
        from: body.from,
        token_in: body.token_in,
        token_out: body.token_out,
        amount_in: body.amount_in,
        slippage_percent: body.slippage_percent,
      },
      "robinhood",
    );
    return NextResponse.json(JSON.parse(out));
  } catch (e) {
    return NextResponse.json({ error: "quote_failed", message: e instanceof Error ? e.message : "Couldn't get a quote." }, { status: 400 });
  }
}

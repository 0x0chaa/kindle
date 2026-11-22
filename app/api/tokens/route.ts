import { NextResponse } from "next/server";
import { listTokens, TABS, type Tab } from "@/lib/market";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET(req: Request) {
  const tab = new URL(req.url).searchParams.get("tab") as Tab | null;
  if (!tab || !TABS.includes(tab)) return NextResponse.json({ error: "bad_tab", message: `tab must be one of ${TABS.join(", ")}` }, { status: 400 });
  try {
    const tokens = await listTokens(tab);
    return NextResponse.json({ tab, tokens }, { headers: { "cache-control": "s-maxage=30, stale-while-revalidate=60" } });
  } catch (e) {
    return NextResponse.json({ error: "upstream", message: e instanceof Error ? e.message : "Couldn't load tokens." }, { status: 502 });
  }
}

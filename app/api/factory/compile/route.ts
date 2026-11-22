import { NextResponse } from "next/server";
import { compileContract } from "@/lib/compile";
import { FACTORY_SOURCE } from "@/lib/factory-source";

export const runtime = "nodejs";
export const maxDuration = 60;

let cached: { abi: unknown; bytecode: string; compiler: string } | null = null;

/** Compile Kindle's launch factory (fixed source) so the owner can deploy it from their wallet at /factory. */
export async function GET() {
  try {
    if (!cached) {
      const { content, artifact } = await compileContract({ source: FACTORY_SOURCE, contract_name: "KindleFactory" }, "robinhood");
      cached = { abi: artifact.abi, bytecode: artifact.bytecode, compiler: String((JSON.parse(content) as { compiler?: string }).compiler ?? "") };
    }
    return NextResponse.json({ ...cached, source: FACTORY_SOURCE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

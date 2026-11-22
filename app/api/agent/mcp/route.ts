import { NextResponse } from "next/server";
import { envMcpServers } from "@/lib/agent-server";

/** Lists the MCP servers configured on the server (names and hosts only — never tokens). */
export async function GET() {
  return NextResponse.json({
    servers: envMcpServers().map((s) => {
      let host = "?";
      try {
        host = new URL(s.url).host;
      } catch {}
      return { name: s.name, host };
    }),
  });
}

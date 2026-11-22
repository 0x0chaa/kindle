import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToken } from "@/lib/market";
import { TokenView } from "@/components/token/TokenView";

type Params = { params: Promise<{ address: string }> };
export const revalidate = 30;

const valid = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  if (!valid(address)) return { title: "Token not found — Kindle" };
  const t = await getToken(address).catch(() => null);
  return t
    ? { title: `${t.name} ($${t.symbol}) — Kindle`, description: `Trade ${t.name} on Robinhood Chain. Contract ${t.address}.` }
    : { title: "Token — Kindle" };
}

export default async function TokenPage({ params }: Params) {
  const { address } = await params;
  if (!valid(address)) notFound();
  const token = await getToken(address).catch(() => null);
  if (!token) notFound();
  return <TokenView token={token} />;
}

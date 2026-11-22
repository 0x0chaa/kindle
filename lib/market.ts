import "server-only";

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { FACTORY, FACTORY_ABI } from "./factory";
import { NETWORKS } from "./networks";

// Token lists come from Kindle's own factory contract; prices, market caps and volume from DexScreener.
const DEXSCREENER = "https://api.dexscreener.com";

/** A token "graduates" when its market cap passes this line (a milestone, not a contract migration). */
export const GRADUATE_MCAP = Number(process.env.GRADUATE_MCAP_USD || 69_000);
const GRADUATING_FROM = GRADUATE_MCAP * 0.3;

export type Tab = "new" | "top" | "trending" | "graduating" | "graduated";
export const TABS: Tab[] = ["new", "top", "trending", "graduating", "graduated"];

export type TokenRow = {
  address: string;
  name: string;
  symbol: string;
  image: string | null;
  createdAt: string | null;
  creator: string | null;
  isKindle: boolean;
  priceUsd: number | null;
  marketCap: number | null;
  volume24h: number | null;
  change24h: number | null;
  liquidityUsd: number | null;
  txns24h: number | null;
  pairAddress: string | null;
  dexUrl: string | null;
  description: string | null;
  websites: { label: string; url: string }[];
  socials: { type: string; url: string }[];
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

async function getJson(url: string, init?: RequestInit, revalidate = 30): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate },
  } as RequestInit);
  if (!res.ok) throw new Error(`${new URL(url).host} answered HTTP ${res.status}`);
  return res.json();
}

type Pair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  txns?: { h24?: { buys?: number; sells?: number } };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { label?: string; url?: string }[]; socials?: { type?: string; url?: string }[] };
};

/** DexScreener pairs for up to 30 tokens per call; keeps the most liquid pair per token. */
async function dexPairs(addresses: string[]): Promise<Map<string, Pair>> {
  const best = new Map<string, Pair>();
  for (let i = 0; i < addresses.length; i += 30) {
    const chunk = addresses.slice(i, i + 30);
    try {
      const pairs = (await getJson(`${DEXSCREENER}/tokens/v1/robinhood/${chunk.join(",")}`, undefined, 20)) as Pair[];
      for (const p of Array.isArray(pairs) ? pairs : []) {
        const a = p.baseToken?.address?.toLowerCase();
        if (!a) continue;
        const cur = best.get(a);
        if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best.set(a, p);
      }
    } catch {
      // market data is optional; the list still shows
    }
  }
  return best;
}

function merge(row: TokenRow, p: Pair | undefined): TokenRow {
  if (!p) return row;
  return {
    ...row,
    image: row.image ?? p.info?.imageUrl ?? null,
    priceUsd: num(p.priceUsd) ?? row.priceUsd,
    marketCap: num(p.marketCap) ?? num(p.fdv) ?? row.marketCap,
    volume24h: num(p.volume?.h24) ?? row.volume24h,
    change24h: num(p.priceChange?.h24) ?? row.change24h,
    liquidityUsd: num(p.liquidity?.usd),
    txns24h: p.txns?.h24 ? (p.txns.h24.buys ?? 0) + (p.txns.h24.sells ?? 0) : null,
    pairAddress: p.pairAddress ?? row.pairAddress,
    dexUrl: p.url ?? null,
    createdAt: row.createdAt ?? (p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null),
    websites: (p.info?.websites ?? []).flatMap((w) => (w.url ? [{ label: w.label || "Website", url: w.url }] : [])),
    socials: (p.info?.socials ?? []).flatMap((s) => (s.url ? [{ type: s.type || "link", url: s.url }] : [])),
  };
}

type Info = { token: string; creator: string; createdAt: bigint; name: string; symbol: string; image: string };

const rpc = () =>
  createPublicClient({ transport: http(process.env.ROBINHOOD_RPC_URL || NETWORKS.robinhood.rpc, { timeout: 12_000 }) });

const rowOf = (t: Info): TokenRow => ({
  address: t.token,
  name: t.name || "Unknown",
  symbol: t.symbol || "?",
  image: /^(https|ipfs):\/\//.test(t.image) ? t.image.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") : null,
  createdAt: new Date(Number(t.createdAt) * 1000).toISOString(),
  creator: t.creator,
  isKindle: true,
  priceUsd: null,
  marketCap: null,
  volume24h: null,
  change24h: null,
  liquidityUsd: null,
  txns24h: null,
  pairAddress: null,
  dexUrl: null,
  description: null,
  websites: [],
  socials: [],
});

/** Newest launches from Kindle's factory (up to 200), cached for 20 seconds per server instance. */
let memo: { at: number; rows: TokenRow[] } | null = null;
async function kindleLaunches(): Promise<TokenRow[]> {
  if (!FACTORY) return [];
  if (memo && Date.now() - memo.at < 20_000) return memo.rows;
  const list = (await rpc().readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "recent", args: [0n, 200n] })) as readonly Info[];
  memo = { at: Date.now(), rows: list.map(rowOf) };
  return memo.rows;
}

const DAY = 86_400;

/** Tokens for one tab of the board. */
export async function listTokens(tab: Tab): Promise<TokenRow[]> {
  const now = Math.floor(Date.now() / 1000);
  let rows = await kindleLaunches();
  if (tab === "new") rows = rows.filter((r) => Date.parse(r.createdAt ?? "0") / 1000 > now - 3 * DAY).slice(0, 120);

  const market = await dexPairs(rows.map((r) => r.address));
  rows = rows.map((r) => merge(r, market.get(r.address.toLowerCase())));

  if (tab === "new") rows.sort((a, b) => Date.parse(b.createdAt ?? "0") - Date.parse(a.createdAt ?? "0"));
  if (tab === "top") rows.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  if (tab === "trending") rows.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  if (tab === "graduated") rows = rows.filter((r) => (r.marketCap ?? 0) >= GRADUATE_MCAP).sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  if (tab === "graduating")
    rows = rows
      .filter((r) => (r.marketCap ?? 0) >= GRADUATING_FROM && (r.marketCap ?? 0) < GRADUATE_MCAP)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  return rows.slice(0, 120);
}

/** One token, for the detail page. */
export async function getToken(address: string): Promise<TokenRow | null> {
  let row: TokenRow | null = null;
  if (FACTORY) {
    try {
      const c = rpc();
      const l = (await c.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "launchOf", args: [address as Address] })) as {
        token: string;
        creator: string;
        createdAt: bigint;
      };
      const erc = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function image() view returns (string)"]);
      const [name, symbol, image] = await Promise.all(
        (["name", "symbol", "image"] as const).map((f) => c.readContract({ address: address as Address, abi: erc, functionName: f }) as Promise<string>),
      );
      row = rowOf({ token: l.token, creator: l.creator, createdAt: l.createdAt, name, symbol, image });
    } catch {
      // not a Kindle launch: still show it if DexScreener knows it
    }
  }
  const market = await dexPairs([address]);
  const p = market.get(address.toLowerCase());
  if (!row && !p) return null;
  row ??= {
    address,
    name: p?.baseToken?.name ?? "Unknown",
    symbol: p?.baseToken?.symbol ?? "?",
    image: null,
    createdAt: null,
    creator: null,
    isKindle: false,
    priceUsd: null,
    marketCap: null,
    volume24h: null,
    change24h: null,
    liquidityUsd: null,
    txns24h: null,
    pairAddress: null,
    dexUrl: null,
    description: null,
    websites: [],
    socials: [],
  };
  return merge(row, p);
}


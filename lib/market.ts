import "server-only";

import { createPublicClient, http, parseAbi, type Address } from "viem";
import { FACTORY, FACTORY_ABI } from "./factory";
import { NETWORKS } from "./networks";

// Token lists come from Kindle's own factory contract; prices, market caps and volume from DexScreener.
const DEXSCREENER = "https://api.dexscreener.com";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

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
  /** Bonding-curve state for Kindle launches (null for other tokens). */
  graduated: boolean | null;
  progress: number | null;
  raisedEth: number | null;
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

type Info = {
  token: string;
  creator: string;
  createdAt: bigint;
  graduated: boolean;
  sold: bigint;
  realEth: bigint;
  name: string;
  symbol: string;
  image: string;
};

const rpc = () =>
  createPublicClient({ transport: http(process.env.ROBINHOOD_RPC_URL || NETWORKS.robinhood.rpc, { timeout: 12_000 }) });

// Curve constants (must match lib/factory-source.ts)
const E18 = 10n ** 18n;
const CURVE = 800_000_000n * E18;
const V0 = 14n * 10n ** 17n;
const T0 = 1066666666666666666666666667n;

/** ETH/USD from DexScreener (WETH on Robinhood Chain), cached 60s. */
let ethMemo: { at: number; usd: number | null } | null = null;
async function ethUsd(): Promise<number | null> {
  if (ethMemo && Date.now() - ethMemo.at < 60_000) return ethMemo.usd;
  let usd: number | null = null;
  try {
    const pairs = (await getJson(`${DEXSCREENER}/tokens/v1/robinhood/${WETH}`, undefined, 60)) as Pair[];
    const best = (Array.isArray(pairs) ? pairs : [])
      .filter((p) => p.baseToken?.address?.toLowerCase() === WETH.toLowerCase())
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    usd = num(best?.priceUsd);
  } catch {}
  ethMemo = { at: Date.now(), usd };
  return usd;
}

const rowOf = (t: Info, eth: number | null): TokenRow => {
  const priceEth = Number(((V0 + t.realEth) * 10n ** 12n) / (T0 - t.sold)) / 1e12; // ETH per whole token
  const priceUsd = !t.graduated && eth ? priceEth * eth : null;
  return {
    address: t.token,
    name: t.name || "Unknown",
    symbol: t.symbol || "?",
    image: /^(https|ipfs):\/\//.test(t.image) ? t.image.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") : null,
    createdAt: new Date(Number(t.createdAt) * 1000).toISOString(),
    creator: t.creator,
    isKindle: true,
    graduated: t.graduated,
    progress: t.graduated ? 100 : Number((t.sold * 10000n) / CURVE) / 100,
    raisedEth: t.graduated ? null : Number(t.realEth) / 1e18,
    priceUsd,
    marketCap: priceUsd ? priceUsd * 1e9 : null,
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
};

/** Newest launches from Kindle's factory (up to 200), cached for 20 seconds per server instance. */
let memo: { at: number; rows: TokenRow[] } | null = null;
async function kindleLaunches(): Promise<TokenRow[]> {
  if (!FACTORY) return [];
  if (memo && Date.now() - memo.at < 20_000) return memo.rows;
  const [list, eth] = await Promise.all([
    rpc().readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "recent", args: [0n, 200n] }) as Promise<readonly Info[]>,
    ethUsd(),
  ]);
  memo = { at: Date.now(), rows: list.map((t) => rowOf(t, eth)) };
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
  // Trending: pool volume for graduated tokens, curve momentum (ETH raised) for the rest
  if (tab === "trending")
    rows.sort((a, b) => (b.volume24h ?? (b.raisedEth ?? 0) * 1000) - (a.volume24h ?? (a.raisedEth ?? 0) * 1000));
  if (tab === "graduated")
    rows = rows
      .filter((r) => (r.isKindle ? r.graduated : (r.marketCap ?? 0) >= GRADUATE_MCAP))
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  if (tab === "graduating")
    rows = rows.filter((r) => r.isKindle && !r.graduated && (r.progress ?? 0) >= 50).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0));
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
        graduated: boolean;
        sold: bigint;
        realEth: bigint;
      };
      const erc = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function image() view returns (string)"]);
      const [name, symbol, image] = await Promise.all(
        (["name", "symbol", "image"] as const).map((f) => c.readContract({ address: address as Address, abi: erc, functionName: f }) as Promise<string>),
      );
      row = rowOf(
        { token: l.token, creator: l.creator, createdAt: l.createdAt, graduated: l.graduated, sold: l.sold, realEth: l.realEth, name, symbol, image },
        await ethUsd(),
      );
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
    graduated: null,
    progress: null,
    raisedEth: null,
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


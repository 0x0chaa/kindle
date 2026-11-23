// Mirror of TokenRow in lib/market.ts (that file is server-only).
export type TokenRow = {
  address: string;
  name: string;
  symbol: string;
  image: string | null;
  createdAt: string | null;
  creator: string | null;
  isKindle: boolean;
  graduated: boolean | null;
  progress: number | null;
  raised: number | null;
  graduation: number | null;
  quote: { address: string; symbol: string; decimals: number } | null;
  taxPct: number | null;
  /** true: the creator share of fees goes to holders. */
  holderRewards: boolean | null;
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

export type Tab = "new" | "top" | "trending" | "graduating" | "graduated";

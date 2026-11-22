// The $KINDLE token. Everything token-related stays hidden until NEXT_PUBLIC_KINDLE_CA is set in Vercel
// (Settings → Environment Variables), followed by a redeploy.
const raw = (process.env.NEXT_PUBLIC_KINDLE_CA ?? "").trim();

/** The official contract address on Robinhood Chain, or "" when not launched yet. */
export const KINDLE_CA = /^0x[0-9a-fA-F]{40}$/.test(raw) ? raw : "";
export const KINDLE_SYMBOL = (process.env.NEXT_PUBLIC_KINDLE_SYMBOL ?? "KINDLE").trim() || "KINDLE";

/** Where "Buy $KINDLE" goes: NEXT_PUBLIC_KINDLE_BUY_URL if set (e.g. a DexScreener page), else Uniswap on Robinhood Chain. */
export const KINDLE_BUY_URL = KINDLE_CA
  ? (process.env.NEXT_PUBLIC_KINDLE_BUY_URL ?? "").trim() ||
    `https://app.uniswap.org/swap?inputCurrency=NATIVE&outputCurrency=${KINDLE_CA}`
  : "";

export const KINDLE_EXPLORER = KINDLE_CA ? `https://robinhoodchain.blockscout.com/token/${KINDLE_CA}` : "";
export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

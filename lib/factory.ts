// Kindle's own launch factory on Robinhood Chain. Set NEXT_PUBLIC_KINDLE_FACTORY in Vercel after deploying it at /factory.
import { parseAbi, type Address } from "viem";

const raw = (process.env.NEXT_PUBLIC_KINDLE_FACTORY ?? "").trim();
export const FACTORY: Address | null = /^0x[0-9a-fA-F]{40}$/.test(raw) ? (raw as Address) : null;

/** Uniswap v4 PoolManager on Robinhood Chain mainnet. */
export const POOL_MANAGER: Address = "0x8366a39cc670b4001a1121b8f6a443a643e40951";

/** Share of swap fees that goes to Kindle's treasury, in basis points (fixed when the factory is deployed). */
export const PROTOCOL_SHARE_BPS = 3000;
export const POOL_FEE_PCT = 1;
export const SUPPLY = 1_000_000_000;
/** Tokens sold on the bonding curve; the rest (200M) seeds the Uniswap v4 pool at graduation. */
export const CURVE_SUPPLY = 800_000_000;
/** ETH the curve collects when it sells out (graduation). */
export const GRADUATION_ETH = 4.2;
export const SNIPE_WINDOW_S = 5;

export const MAX_TAX_PCT = 10;
export const VEST_YEARS = 5;

export const FACTORY_ABI = parseAbi([
  "struct LaunchParams { string name; string symbol; string image; address quote; uint16 taxBps; uint16 buybackBps; bool holderRewards; uint256 buyAmount; uint256 minTokensOut; }",
  "function launch(LaunchParams p) payable returns (address token)",
  "function buy(address token, uint256 amountIn, uint256 minTokensOut) payable returns (uint256)",
  "function sell(address token, uint256 amount, uint256 minOut) returns (uint256 out)",
  "function launchFee() view returns (uint256)",
  "function launchCount() view returns (uint256)",
  "function treasury() view returns (address)",
  "function owner() view returns (address)",
  "function protocolShareBps() view returns (uint16)",
  "function indexPlusOne(address) view returns (uint256)",
  "function pairList() view returns (address[])",
  "function pairs(address) view returns (bool enabled, uint256 graduation, uint160 sqrtPriceQuote0, uint160 sqrtPriceQuote1, uint128 liquidity)",
  "function setPair(address asset, bool enabled, uint256 graduation, uint160 sqrtPriceQuote0, uint160 sqrtPriceQuote1, uint128 liquidity)",
  "function setLaunchFee(uint256 fee)",
  "function sweepFees(address token)",
  "function claimCreatorFees(address token) returns (uint256 paid)",
  "function claimRewards(address token) returns (uint256 amount)",
  "function buyback(address token, uint256 amount)",
  "function setBuybackBps(address token, uint16 bps)",
  "function claimVested(address token) returns (uint256 amount)",
  "function vested(address token) view returns (uint256)",
  "function lockedTokens(address token) view returns (uint256)",
  "function setFeeRecipient(address token, address recipient)",
  "function snipeTaxBps(address token) view returns (uint256)",
  "struct Launch { address token; address creator; address feeRecipient; address quote; uint64 createdAt; uint16 taxBps; uint16 buybackBps; bool graduated; uint256 sold; uint256 raised; uint256 creatorFees; bool holderRewards; }",
  "function launchOf(address token) view returns (Launch)",
  "struct Quote { uint256 out; uint256 fee; uint256 tax; uint256 snipe; uint256 net; uint256 used; }",
  "function quoteBuy(address token, uint256 amountIn, address buyer) view returns (Quote)",
  "function quoteSell(address token, uint256 amount) view returns (uint256 out, uint256 fee, uint256 tax)",
  "struct Info { address token; address creator; address quote; uint64 createdAt; uint16 taxBps; bool graduated; uint256 sold; uint256 raised; uint256 graduation; bool holderRewards; string name; string symbol; string image; }",
  "function recent(uint256 offset, uint256 count) view returns (Info[])",
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "function poolKeyOf(address token) view returns (PoolKey)",
  "event Launched(address indexed token, address indexed creator, address quote, uint16 taxBps, string name, string symbol, string image)",
  "event Trade(address indexed token, address indexed trader, bool isBuy, uint256 quoteAmount, uint256 tokens, uint256 sold, uint256 raised)",
  "event Graduated(address indexed token, uint256 quoteAmount, uint256 tokens, bytes32 poolId)",
]);

export const ERC20_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function rewardsOf(address) view returns (uint256)",
]);

export const ETH_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/** Curve maths shared by the UI (mirrors the contract). Amounts in raw units. */
export const CURVE_RAW = 800_000_000n * 10n ** 18n;
export const VIRTUAL_TOKENS_RAW = 1066666666666666666666666667n;
export const virtualQuote = (graduation: bigint) => (graduation * (VIRTUAL_TOKENS_RAW - CURVE_RAW)) / CURVE_RAW;

/** Integer square root (for the pair calculator on /factory). */
export function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** sqrtPriceX96 values and full-range liquidity for a pair that graduates at `graduation` (raw units). */
export function pairParams(graduation: bigint) {
  const LP = 200_000_000n * 10n ** 18n;
  const Q192 = 2n ** 192n;
  const Q96 = 2n ** 96n;
  const sqrtQuote0 = isqrt((LP * Q192) / graduation); // pair asset is currency0: price = token per quote
  const sqrtQuote1 = isqrt((graduation * Q192) / LP); // pair asset is currency1: price = quote per token
  // full range ~ (0, inf): amount0 = L*Q96/sqrtP, amount1 = L*sqrtP/Q96 -> take the smaller L, minus 0.1%
  const l0 = (graduation * sqrtQuote0) / Q96;
  const l1 = (LP * Q96) / sqrtQuote0;
  const liquidity = (((l0 < l1 ? l0 : l1) * 999n) / 1000n);
  return { sqrtQuote0, sqrtQuote1, liquidity };
}


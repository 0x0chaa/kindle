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

export const FACTORY_ABI = parseAbi([
  "function launch(string name_, string symbol_, string image_, uint256 minTokensOut) payable returns (address token)",
  "function buy(address token, uint256 minTokensOut) payable returns (uint256)",
  "function sell(address token, uint256 amount, uint256 minEthOut) returns (uint256 ethOut)",
  "function launchFee() view returns (uint256)",
  "function launchCount() view returns (uint256)",
  "function treasury() view returns (address)",
  "function owner() view returns (address)",
  "function protocolShareBps() view returns (uint16)",
  "function indexPlusOne(address) view returns (uint256)",
  "function collectFees(address token) returns (uint256 eth, uint256 tokens)",
  "function claimCreatorFees(address token) returns (uint256 amount)",
  "function setFeeRecipient(address token, address recipient)",
  "function snipeTaxBps(address token) view returns (uint256)",
  "function curvePrice(address token) view returns (uint256)",
  "struct Launch { address token; address creator; address feeRecipient; uint64 createdAt; bool graduated; uint256 sold; uint256 realEth; uint256 creatorFees; }",
  "function launchOf(address token) view returns (Launch)",
  "struct Quote { uint256 out; uint256 fee; uint256 snipe; uint256 net; uint256 refund; }",
  "function quoteBuy(address token, uint256 ethIn, address buyer) view returns (Quote)",
  "function quoteSell(address token, uint256 amount) view returns (uint256 ethOut, uint256 fee)",
  "struct Info { address token; address creator; uint64 createdAt; bool graduated; uint256 sold; uint256 realEth; string name; string symbol; string image; }",
  "function recent(uint256 offset, uint256 count) view returns (Info[])",
  "event Launched(address indexed token, address indexed creator, string name, string symbol, string image)",
  "event Trade(address indexed token, address indexed trader, bool isBuy, uint256 eth, uint256 tokens, uint256 sold, uint256 realEth)",
  "event Graduated(address indexed token, uint256 eth, uint256 tokens, bytes32 poolId)",
]);

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

export const FACTORY_ABI = parseAbi([
  "function launch(string name_, string symbol_, string image_) payable returns (address token)",
  "function launchFee() view returns (uint256)",
  "function launchCount() view returns (uint256)",
  "function treasury() view returns (address)",
  "function owner() view returns (address)",
  "function protocolShareBps() view returns (uint16)",
  "function indexPlusOne(address) view returns (uint256)",
  "function collectFees(address token) returns (uint256 eth, uint256 tokens)",
  "function setFeeRecipient(address token, address recipient)",
  "struct Launch { address token; address creator; address feeRecipient; uint64 createdAt; }",
  "function launchOf(address token) view returns (Launch)",
  "struct Info { address token; address creator; uint64 createdAt; string name; string symbol; string image; }",
  "function recent(uint256 offset, uint256 count) view returns (Info[])",
  "event Launched(address indexed token, address indexed creator, string name, string symbol, string image, bytes32 poolId)",
]);

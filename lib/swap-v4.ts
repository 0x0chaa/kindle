import "server-only";
import {
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  formatEther,
  formatUnits,
  keccak256,
  parseAbi,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { NETWORKS, type NetworkId } from "./networks";
import { FACTORY, FACTORY_ABI } from "./factory";

// Uniswap v4 on Robinhood Chain (addresses from Uniswap's official v4 deployments page). Mainnet only.
const V4: Partial<Record<NetworkId, { poolManager: Address; quoters: Address[]; stateView: Address; router: Address }>> = {
  robinhood: {
    poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
    quoters: ["0x8dc178efb8111bb0973dd9d722ebeff267c98f94"],
    stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
    router: "0x8876789976decbfcbbbe364623c63652db8c0904",
  },
};
const PERMIT2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const WETH: Address = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const NATIVE: Address = "0x0000000000000000000000000000000000000000";
const ROUTER_SELF: Address = "0x0000000000000000000000000000000000000002"; // ActionConstants.ADDRESS_THIS
const OPEN_DELTA = 0n;

// Universal Router commands and v4 router actions.
const CMD = { WRAP_ETH: 0x0b, UNWRAP_WETH: 0x0c, V4_SWAP: 0x10 };
const ACT = { SWAP_EXACT_IN_SINGLE: 0x06, SETTLE: 0x0b, SETTLE_ALL: 0x0c, TAKE: 0x0e, TAKE_ALL: 0x0f };

const QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)",
]);
const STATE_VIEW_ABI = parseAbi([
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128)",
]);
const INITIALIZE = parseAbiItem(
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)",
);
const ERC20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const PERMIT2_ABI = parseAbi([
  "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);
const ROUTER_ABI = parseAbi(["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"]);
const EXECUTE_SIG = "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable";

export type Side = { native: boolean; address: Address; symbol: string; decimals: number };
type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };

const lc = (a: string) => a.toLowerCase();
function v4(net: NetworkId) {
  const c = V4[net];
  if (!c) throw new Error("Uniswap v4 swaps are available on Robinhood Chain mainnet only.");
  return c;
}
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

function poolId(k: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [k.currency0, k.currency1, k.fee, k.tickSpacing, k.hooks],
    ),
  );
}

/** A graduated Kindle token's pool, straight from the factory (its tick spacing is picked at graduation). */
async function poolFromFactory(c: PublicClient, token: Address): Promise<PoolKey[]> {
  if (!FACTORY) return [];
  try {
    const k = await c.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "poolKeyOf", args: [token] });
    if (!k || k.tickSpacing === 0) return [];
    return [{ currency0: k.currency0, currency1: k.currency1, fee: k.fee, tickSpacing: k.tickSpacing, hooks: k.hooks }];
  } catch {
    return [];
  }
}

/** Pools the token was launched with (Kindle's factory creates the pool in the token's creation transaction). */
async function poolsFromCreation(c: PublicClient, net: NetworkId, token: Address): Promise<PoolKey[]> {
  try {
    const res = await fetch(`${NETWORKS[net].explorer}/api/v2/addresses/${token}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const info = (await res.json()) as { creation_transaction_hash?: string; creation_tx_hash?: string };
    const hash = (info.creation_transaction_hash ?? info.creation_tx_hash) as Hex | undefined;
    if (!hash) return [];
    const rc = await c.getTransactionReceipt({ hash });
    const out: PoolKey[] = [];
    for (const log of rc.logs) {
      if (lc(log.address) !== lc(v4(net).poolManager)) continue;
      try {
        const ev = decodeEventLog({ abi: [INITIALIZE], data: log.data, topics: log.topics });
        const a = ev.args;
        if (lc(a.currency0) !== lc(token) && lc(a.currency1) !== lc(token)) continue;
        out.push({ currency0: a.currency0, currency1: a.currency1, fee: a.fee, tickSpacing: a.tickSpacing, hooks: a.hooks });
      } catch {}
    }
    return out;
  } catch {
    return [];
  }
}

/** Plain (hook-less) v4 pools at the standard fee tiers. */
async function poolsByProbe(c: PublicClient, net: NetworkId, a: Address, b: Address): Promise<PoolKey[]> {
  const tiers: [number, number][] = [
    [100, 1],
    [500, 10],
    [3000, 60],
    [10000, 200],
  ];
  const [c0, c1] = BigInt(a) < BigInt(b) ? [a, b] : [b, a];
  const keys = tiers.map(([fee, tickSpacing]) => ({ currency0: c0, currency1: c1, fee, tickSpacing, hooks: NATIVE }));
  const live = await Promise.all(
    keys.map((k) =>
      c
        .readContract({ address: v4(net).stateView, abi: STATE_VIEW_ABI, functionName: "getSlot0", args: [poolId(k)] })
        .then((s) => s[0] > 0n)
        .catch(() => false),
    ),
  );
  return keys.filter((_, i) => live[i]);
}

async function quote(c: PublicClient, net: NetworkId, key: PoolKey, zeroForOne: boolean, amount: bigint) {
  for (const q of v4(net).quoters) {
    try {
      const { result } = await c.simulateContract({
        address: q,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ poolKey: key, zeroForOne, exactAmount: amount, hookData: "0x" }],
      });
      return result[0];
    } catch {}
  }
  return 0n;
}

const swapParams = (key: PoolKey, zeroForOne: boolean, amountIn: bigint, minOut: bigint) =>
  encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          {
            name: "poolKey",
            type: "tuple",
            components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ],
          },
          { name: "zeroForOne", type: "bool" },
          { name: "amountIn", type: "uint128" },
          { name: "amountOutMinimum", type: "uint128" },
          { name: "hookData", type: "bytes" },
        ],
      },
    ],
    [{ poolKey: key, zeroForOne, amountIn, amountOutMinimum: minOut, hookData: "0x" }],
  );
const enc = (types: string[], values: unknown[]) =>
  encodeAbiParameters(
    types.map((type) => ({ type })),
    values as never,
  );
const bytesOf = (codes: number[]) => (`0x${codes.map((x) => x.toString(16).padStart(2, "0")).join("")}`) as Hex;

/**
 * Quote and prepare a single-pool Uniswap v4 swap (including Kindle launches and hooked pools).
 * One side must be ETH/WETH or the pool's other currency.
 */
export async function swapQuoteV4(args: {
  c: PublicClient;
  net: NetworkId;
  from: Address;
  tin: Side;
  tout: Side;
  amountIn: bigint;
  slippage: number;
}) {
  const { c, net, from, tin, tout, amountIn, slippage } = args;
  const n = NETWORKS[net];
  const { router } = v4(net);
  const isEthLike = (s: Side) => s.native || lc(s.address) === lc(WETH);

  // The "project" token is the side that isn't ETH/WETH; look for its pools.
  const target = isEthLike(tin) ? tout : tin;
  const other = target === tin ? tout : tin;
  let pools = await poolFromFactory(c, target.address);
  if (!pools.length) pools = await poolsFromCreation(c, net, target.address);
  if (!pools.length) {
    const pairs: Address[] = isEthLike(other) ? [NATIVE, WETH] : [other.address];
    pools = (await Promise.all(pairs.map((p) => poolsByProbe(c, net, target.address, p)))).flat();
  }
  // Keep pools whose other currency matches the trade's other side.
  const otherCurrencies = isEthLike(other) ? [NATIVE, WETH] : [other.address];
  pools = pools.filter((k) => {
    const o = lc(k.currency0) === lc(target.address) ? k.currency1 : k.currency0;
    return otherCurrencies.some((x) => lc(x) === lc(o));
  });
  if (!pools.length) {
    throw new Error(`No Uniswap v3 or v4 pool found for ${tin.symbol} → ${tout.symbol} on ${n.name}. Only direct pools are supported.`);
  }

  // Quote every candidate pool and keep the best.
  const quoted = await Promise.all(
    pools.map(async (key) => {
      const pairCur = lc(key.currency0) === lc(target.address) ? key.currency1 : key.currency0;
      const inCur = target === tin ? target.address : pairCur;
      const zeroForOne = lc(inCur) === lc(key.currency0);
      return { key, pairCur, inCur, zeroForOne, out: await quote(c, net, key, zeroForOne, amountIn) };
    }),
  );
  const best = quoted.filter((q) => q.out > 0n).sort((a, b) => (b.out > a.out ? 1 : -1))[0];
  if (!best) throw new Error(`Found a Uniswap v4 pool for ${target.symbol}, but it couldn't be quoted right now (no liquidity or a restricted hook).`);

  const { key, inCur, zeroForOne } = best;
  const outCur = zeroForOne ? key.currency1 : key.currency0;
  const minOut = (best.out * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

  // Build Universal Router commands.
  const commands: number[] = [];
  const inputs: Hex[] = [];
  const actions: number[] = [ACT.SWAP_EXACT_IN_SINGLE];
  const params: Hex[] = [swapParams(key, zeroForOne, amountIn, minOut)];

  const payWithEth = tin.native;
  const inIsNativePool = lc(inCur) === lc(NATIVE);
  if (payWithEth && !inIsNativePool) {
    // ETH → wrap to WETH inside the router, then settle from the router's balance.
    commands.push(CMD.WRAP_ETH);
    inputs.push(enc(["address", "uint256"], [ROUTER_SELF, amountIn]));
    actions.push(ACT.SETTLE);
    params.push(enc(["address", "uint256", "bool"], [inCur, OPEN_DELTA, false]));
  } else {
    actions.push(ACT.SETTLE_ALL);
    params.push(enc(["address", "uint256"], [inCur, amountIn]));
  }
  const wantEth = tout.native;
  const outIsNativePool = lc(outCur) === lc(NATIVE);
  if (wantEth && !outIsNativePool) {
    actions.push(ACT.TAKE);
    params.push(enc(["address", "address", "uint256"], [outCur, ROUTER_SELF, OPEN_DELTA]));
  } else {
    actions.push(ACT.TAKE_ALL);
    params.push(enc(["address", "uint256"], [outCur, minOut]));
  }
  commands.push(CMD.V4_SWAP);
  inputs.push(enc(["bytes", "bytes[]"], [bytesOf(actions), params]));
  if (wantEth && !outIsNativePool) {
    commands.push(CMD.UNWRAP_WETH);
    inputs.push(enc(["address", "uint256"], [from, minOut]));
  }
  const cmdHex = bytesOf(commands);
  const value = payWithEth ? amountIn : 0n;

  // Balance and approvals (ERC-20 input goes through Permit2).
  const steps: Record<string, unknown>[] = [];
  const humanIn = `${formatUnits(amountIn, tin.decimals)} ${tin.symbol}`;
  const humanOut = `${formatUnits(best.out, tout.decimals)} ${tout.symbol}`;
  const humanMin = `${formatUnits(minOut, tout.decimals)} ${tout.symbol}`;
  const balance = tin.native
    ? await c.getBalance({ address: from })
    : await c.readContract({ address: tin.address, abi: ERC20, functionName: "balanceOf", args: [from] });
  let needsApproval = false;
  if (!tin.native) {
    const toPermit2 = await c.readContract({ address: tin.address, abi: ERC20, functionName: "allowance", args: [from, PERMIT2] });
    if (toPermit2 < amountIn) {
      needsApproval = true;
      steps.push({
        to: tin.address,
        signature: "function approve(address spender, uint256 amount) returns (bool)",
        args: [PERMIT2, amountIn.toString()],
        summary: `Allow Permit2 (Uniswap's approval contract) to move exactly ${humanIn}, not unlimited.`,
      });
    }
    const [amt, exp] = await c.readContract({ address: PERMIT2, abi: PERMIT2_ABI, functionName: "allowance", args: [from, tin.address, router] });
    if (amt < amountIn || Number(exp) < Math.floor(Date.now() / 1000) + 60) {
      needsApproval = true;
      steps.push({
        to: PERMIT2,
        signature: "function approve(address token, address spender, uint160 amount, uint48 expiration)",
        args: [tin.address, router, amountIn.toString(), String(Math.floor(Date.now() / 1000) + 30 * 60)],
        summary: `Let the Uniswap router use exactly ${humanIn} through Permit2, for the next 30 minutes.`,
      });
    }
  }
  steps.push({
    to: router,
    ...(value > 0n ? { value_eth: formatEther(value) } : {}),
    signature: EXECUTE_SIG,
    args: [cmdHex, inputs, deadline.toString()],
    summary: `Swap ${humanIn} for about ${humanOut} on Uniswap v4 (at least ${humanMin}, ${slippage}% max slippage). Valid for 20 minutes.`,
  });

  let simulation: Record<string, unknown> = { note: "Run after the approvals confirm; the swap can't be simulated before them." };
  if (!needsApproval) {
    const data = encodeFunctionData({ abi: ROUTER_ABI, functionName: "execute", args: [cmdHex, inputs, deadline] });
    try {
      const [gas, price] = await Promise.all([c.estimateGas({ account: from, to: router, data, value }), c.getGasPrice()]);
      simulation = { result: "success — the swap would not revert right now", estimatedGas: gas, estimatedFeeEth: formatEther(gas * price) };
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      simulation = { result: "REVERT — the swap would fail right now; do not send it", reason: err.shortMessage ?? err.message ?? "unknown" };
    }
  }

  const feeLabel = key.fee & 0x800000 ? "dynamic (set by the pool's hook)" : `${key.fee / 10000}%`;
  return json({
    network: n.name,
    dex: "Uniswap v4",
    pool: { ...key, hooked: lc(key.hooks) !== lc(NATIVE) },
    pay: humanIn,
    receiveAbout: humanOut,
    receiveAtLeast: humanMin,
    rate: `1 ${tin.symbol} ≈ ${(Number(formatUnits(best.out, tout.decimals)) / Number(formatUnits(amountIn, tin.decimals))).toPrecision(6)} ${tout.symbol}`,
    poolFee: feeLabel,
    slippage: `${slippage}%`,
    yourBalance: `${formatUnits(balance, tin.decimals)} ${tin.symbol}`,
    enoughBalance: balance >= amountIn,
    simulation,
    steps,
    howToExecute:
      "Explain the quote first. If the user wants to go ahead, call chain_send with each step exactly as given, in order. After each approval, confirm it with chain_read action=transaction before the next step. Never send the swap if the simulation reverted.",
  });
}

import "server-only";
import {
  createPublicClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { NETWORKS, type NetworkId } from "./networks";
import { swapQuoteV4 } from "./swap-v4";

// Uniswap v3 on Robinhood Chain (addresses from Uniswap's official Robinhood Chain deployments page).
// Uniswap isn't listed for the testnet, so swaps are mainnet-only.
const UNISWAP: Partial<Record<NetworkId, { quoter: Address; router: Address }>> = {
  robinhood: {
    quoter: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7",
    router: "0xcaf681a66d020601342297493863e78c959e5cb2",
  },
};
const WETH: Address = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const KINDLE = (process.env.NEXT_PUBLIC_KINDLE_CA ?? "").trim();
const KNOWN: Record<NetworkId, Record<string, Address>> = {
  robinhood: {
    WETH,
    ...(isAddress(KINDLE) ? { KINDLE: KINDLE as Address } : {}),
  },
  "robinhood-testnet": {},
};
/** SwapRouter02 sentinel: keep the output in the router (used before unwrapping WETH to ETH). */
const ROUTER_SELF: Address = "0x0000000000000000000000000000000000000002";
const FEES = [100, 500, 3000, 10000] as const;

const QUOTER_ABI = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);
const ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
]);
const ERC20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);
const MULTICALL_SIG = "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)";
const APPROVE_SIG = "function approve(address spender, uint256 amount) returns (bool)";

function client(net: NetworkId) {
  const rpc = net === "robinhood" ? process.env.ROBINHOOD_RPC_URL : process.env.ROBINHOOD_TESTNET_RPC_URL;
  return createPublicClient({ transport: http(rpc || NETWORKS[net].rpc, { timeout: 15_000 }) });
}

type Side = { native: boolean; address: Address; symbol: string; decimals: number };

async function resolveToken(v: unknown, net: NetworkId, c: ReturnType<typeof client>, field: string): Promise<Side> {
  const raw = String(v ?? "").trim();
  if (!raw) throw new Error(`"${field}" is required: a token address, ETH or WETH.`);
  if (raw.toUpperCase() === "ETH") return { native: true, address: WETH, symbol: "ETH", decimals: 18 };
  const known = KNOWN[net][raw.toUpperCase()];
  const address = (known ?? raw) as Address;
  if (!isAddress(address)) throw new Error(`"${field}" must be ETH, WETH or a 0x… token address (got "${raw.slice(0, 50)}").`);
  const [symbol, decimals] = await Promise.all([
    c.readContract({ address, abi: ERC20, functionName: "symbol" }).catch(() => raw),
    c.readContract({ address, abi: ERC20, functionName: "decimals" }),
  ]).catch(() => {
    throw new Error(`${address} doesn't look like an ERC-20 token on ${NETWORKS[net].name}.`);
  });
  return { native: false, address, symbol: String(symbol), decimals: Number(decimals) };
}

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

/** Quote a Uniswap v3 swap on Robinhood Chain and prepare the exact transactions for the user to sign. */
export async function swapQuote(input: Record<string, unknown>, net: NetworkId) {
  const c = client(net);
  const n = NETWORKS[net];
  const uni = UNISWAP[net];
  if (!uni) throw new Error("Swaps are available on Robinhood Chain mainnet only.");
  const { quoter, router } = uni;

  const from = String(input.from ?? "").trim();
  if (!isAddress(from)) throw new Error('"from" must be the user\'s connected wallet address.');
  const tin = await resolveToken(input.token_in, net, c, "token_in");
  const tout = await resolveToken(input.token_out, net, c, "token_out");
  if (tin.address.toLowerCase() === tout.address.toLowerCase()) throw new Error("token_in and token_out are the same asset.");

  let amountIn: bigint;
  try {
    amountIn = parseUnits(String(input.amount_in ?? "").trim(), tin.decimals);
  } catch {
    throw new Error(`"amount_in" must be a plain number of ${tin.symbol}, e.g. "0.01".`);
  }
  if (amountIn <= 0n) throw new Error('"amount_in" must be greater than zero.');
  const slippage = Math.min(Math.max(Number(input.slippage_percent ?? 0.5) || 0.5, 0.05), 5);

  // Find the pool fee tier with the best output.
  const fees: number[] = input.fee ? [Number(input.fee)] : [...FEES];
  const quotes = await Promise.allSettled(
    fees.map(async (fee) => {
      const { result } = await c.simulateContract({
        address: quoter,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: tin.address, tokenOut: tout.address, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      return { fee, amountOut: result[0], gasEstimate: result[3] };
    }),
  );
  const ok = quotes.flatMap((q) => (q.status === "fulfilled" && q.value.amountOut > 0n ? [q.value] : []));
  // No v3 pool (e.g. a Kindle launch, which trades in a Uniswap v4 pool): try Uniswap v4.
  if (!ok.length) return swapQuoteV4({ c: c as unknown as PublicClient, net, from, tin, tout, amountIn, slippage });
  const best = ok.reduce((a, b) => (b.amountOut > a.amountOut ? b : a));
  const minOut = (best.amountOut * BigInt(Math.round((100 - slippage) * 100))) / 10000n;

  // Balance and allowance checks.
  const balance = tin.native
    ? await c.getBalance({ address: from })
    : await c.readContract({ address: tin.address, abi: ERC20, functionName: "balanceOf", args: [from] });
  const allowance = tin.native
    ? amountIn
    : await c.readContract({ address: tin.address, abi: ERC20, functionName: "allowance", args: [from, router] });

  // Build the router call: multicall(deadline, [exactInputSingle, (unwrapWETH9)]).
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
  const inner: Hex[] = [
    encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: tin.address,
          tokenOut: tout.address,
          fee: best.fee,
          recipient: tout.native ? ROUTER_SELF : from,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
  ];
  if (tout.native) inner.push(encodeFunctionData({ abi: ROUTER_ABI, functionName: "unwrapWETH9", args: [minOut, from] }));
  const valueEth = tin.native ? formatEther(amountIn) : undefined;
  const humanIn = `${formatUnits(amountIn, tin.decimals)} ${tin.symbol}`;
  const humanOut = `${formatUnits(best.amountOut, tout.decimals)} ${tout.symbol}`;
  const humanMin = `${formatUnits(minOut, tout.decimals)} ${tout.symbol}`;

  const steps: Record<string, unknown>[] = [];
  const needsApproval = allowance < amountIn;
  if (needsApproval) {
    steps.push({
      to: tin.address,
      signature: APPROVE_SIG,
      args: [router, amountIn.toString()],
      summary: `Allow the Uniswap router to spend exactly ${humanIn} (not unlimited).`,
    });
  }
  steps.push({
    to: router,
    ...(valueEth ? { value_eth: valueEth } : {}),
    signature: MULTICALL_SIG,
    args: [deadline.toString(), inner],
    summary: `Swap ${humanIn} for about ${humanOut} on Uniswap (at least ${humanMin}, ${slippage}% max slippage). Valid for 20 minutes.`,
  });

  // Dry-run the swap now if nothing has to be approved first.
  let simulation: Record<string, unknown> = { note: "Run after the approval confirms; the swap can't be simulated before it." };
  if (!needsApproval) {
    const data = encodeFunctionData({ abi: ROUTER_ABI, functionName: "multicall", args: [deadline, inner] });
    const value = tin.native ? amountIn : 0n;
    try {
      const [gas, price] = await Promise.all([c.estimateGas({ account: from, to: router, data, value }), c.getGasPrice()]);
      simulation = { result: "success — the swap would not revert right now", estimatedGas: gas, estimatedFeeEth: formatEther(gas * price) };
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      simulation = { result: "REVERT — the swap would fail right now", reason: err.shortMessage ?? err.message ?? "unknown" };
    }
  }

  return json({
    network: n.name,
    dex: "Uniswap v3",
    pay: humanIn,
    receiveAbout: humanOut,
    receiveAtLeast: humanMin,
    rate: `1 ${tin.symbol} ≈ ${(Number(formatUnits(best.amountOut, tout.decimals)) / Number(formatUnits(amountIn, tin.decimals))).toPrecision(6)} ${tout.symbol}`,
    poolFee: `${best.fee / 10000}%`,
    slippage: `${slippage}%`,
    yourBalance: `${formatUnits(balance, tin.decimals)} ${tin.symbol}`,
    enoughBalance: balance >= amountIn,
    simulation,
    steps,
    howToExecute:
      "Explain the quote first. If the user wants to go ahead, call chain_send with each step exactly as given, in order. After an approval step, confirm it with chain_read action=transaction before sending the swap.",
  });
}

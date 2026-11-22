import "server-only";
import {
  createPublicClient,
  defineChain,
  decodeFunctionResult,
  formatEther,
  formatUnits,
  http,
  isAddress,
  isHash,
  parseAbi,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { NETWORKS, type NetworkId } from "./networks";
import { buildCalldata, coerceArgs, fnFromSignature } from "./abi";

const clients = new Map<NetworkId, ReturnType<typeof createPublicClient>>();

function viemChain(net: NetworkId) {
  const n = NETWORKS[net];
  return defineChain({
    id: n.chainId,
    name: n.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [n.rpc] } },
    blockExplorers: { default: { name: "Blockscout", url: n.explorer } },
    testnet: net === "robinhood-testnet",
  });
}

function client(net: NetworkId) {
  let c = clients.get(net);
  if (!c) {
    const rpc = net === "robinhood" ? process.env.ROBINHOOD_RPC_URL : process.env.ROBINHOOD_TESTNET_RPC_URL;
    c = createPublicClient({ chain: viemChain(net), transport: http(rpc || NETWORKS[net].rpc, { timeout: 15_000 }) });
    clients.set(net, c);
  }
  return c;
}

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);

function addr(v: unknown, field = "address"): Address {
  const s = String(v ?? "").trim();
  if (!isAddress(s)) throw new Error(`"${field}" must be a 0x… address (got "${s.slice(0, 50)}").`);
  return s as Address;
}

const ERC20 = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
]);

/* ------------------------------------------------------------------ */
/* chain_read                                                           */
/* ------------------------------------------------------------------ */
export async function chainRead(input: Record<string, unknown>, net: NetworkId) {
  const c = client(net);
  const n = NETWORKS[net];
  switch (String(input.action)) {
    case "balance": {
      const a = addr(input.address);
      const [wei, nonce, code] = await Promise.all([c.getBalance({ address: a }), c.getTransactionCount({ address: a }), c.getCode({ address: a })]);
      return json({ network: n.name, address: a, balance: `${formatEther(wei)} ETH`, wei, transactionsSent: nonce, isContract: Boolean(code && code !== "0x") });
    }
    case "token": {
      const token = addr(input.token, "token");
      const [name, symbol, decimals, supply] = await Promise.all([
        c.readContract({ address: token, abi: ERC20, functionName: "name" }).catch(() => "?"),
        c.readContract({ address: token, abi: ERC20, functionName: "symbol" }).catch(() => "?"),
        c.readContract({ address: token, abi: ERC20, functionName: "decimals" }).catch(() => 18),
        c.readContract({ address: token, abi: ERC20, functionName: "totalSupply" }).catch(() => null),
      ]);
      const out: Record<string, unknown> = {
        network: n.name,
        token,
        name,
        symbol,
        decimals,
        totalSupply: supply === null ? "?" : formatUnits(supply as bigint, Number(decimals)),
      };
      if (input.address) {
        const holder = addr(input.address);
        const bal = await c.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [holder] });
        out.holder = holder;
        out.balance = `${formatUnits(bal as bigint, Number(decimals))} ${symbol}`;
      }
      return json(out);
    }
    case "block": {
      const b = input.block === undefined || input.block === "latest" ? await c.getBlock() : await c.getBlock({ blockNumber: BigInt(String(input.block)) });
      return json({
        network: n.name,
        number: b.number,
        hash: b.hash,
        time: new Date(Number(b.timestamp) * 1000).toISOString(),
        transactions: b.transactions.length,
        gasUsed: b.gasUsed,
        gasLimit: b.gasLimit,
        baseFeeGwei: b.baseFeePerGas !== null && b.baseFeePerGas !== undefined ? formatUnits(b.baseFeePerGas, 9) : null,
      });
    }
    case "transaction": {
      const hash = String(input.hash ?? "");
      if (!isHash(hash)) throw new Error('"hash" must be a 0x… transaction hash.');
      const [tx, rc] = await Promise.all([c.getTransaction({ hash: hash as Hex }), c.getTransactionReceipt({ hash: hash as Hex }).catch(() => null)]);
      return json({
        network: n.name,
        hash,
        from: tx.from,
        to: tx.to,
        value: `${formatEther(tx.value)} ETH`,
        input: tx.input.length > 202 ? `${tx.input.slice(0, 202)}…` : tx.input,
        block: tx.blockNumber,
        status: rc ? rc.status : "pending",
        gasUsed: rc?.gasUsed,
        feeEth: rc ? formatEther(rc.gasUsed * rc.effectiveGasPrice) : null,
        contractCreated: rc?.contractAddress ?? null,
        logs: rc?.logs.length ?? 0,
        explorer: `${n.explorer}/tx/${hash}`,
      });
    }
    case "call": {
      const { abi, fn } = fnFromSignature(String(input.signature ?? ""));
      const args = coerceArgs(fn, Array.isArray(input.args) ? input.args : []);
      const result = await c.readContract({ address: addr(input.address), abi, functionName: fn.name, args });
      return json({ network: n.name, contract: input.address, function: fn.name, result });
    }
    case "gas": {
      const [price, block] = await Promise.all([c.getGasPrice(), c.getBlockNumber()]);
      return json({ network: n.name, gasPriceGwei: formatUnits(price, 9), latestBlock: block });
    }
    default:
      throw new Error('Unknown action. Use one of: balance, token, block, transaction, call, gas.');
  }
}

/* ------------------------------------------------------------------ */
/* chain_simulate — dry-run a transaction against live state            */
/* ------------------------------------------------------------------ */
export async function chainSimulate(input: Record<string, unknown>, net: NetworkId) {
  const c = client(net);
  const n = NETWORKS[net];
  const from = addr(input.from, "from");
  const to = addr(input.to, "to");
  const value = input.value_eth ? parseEther(String(input.value_eth)) : 0n;
  const data = buildCalldata(input);

  try {
    const [res, gas, price, bal] = await Promise.all([
      c.call({ account: from, to, data, value }),
      c.estimateGas({ account: from, to, data, value }),
      c.getGasPrice(),
      c.getBalance({ address: from }),
    ]);
    let decoded: unknown = res.data ?? "0x";
    if (input.signature && res.data && res.data !== "0x") {
      try {
        const { abi, fn } = fnFromSignature(String(input.signature));
        if (fn.outputs.length) decoded = decodeFunctionResult({ abi, functionName: fn.name, data: res.data });
      } catch {}
    }
    const fee = gas * price;
    return json({
      network: n.name,
      result: "success — the transaction would not revert at the current state",
      from,
      to,
      valueEth: formatEther(value),
      calldata: data ?? "0x",
      returnData: decoded,
      estimatedGas: gas,
      estimatedFeeEth: formatEther(fee),
      senderBalanceEth: formatEther(bal),
      enoughBalance: bal >= fee + value,
    });
  } catch (e) {
    const err = e as { shortMessage?: string; message?: string; details?: string };
    return json({
      network: n.name,
      result: "REVERT — this transaction would fail",
      reason: err.shortMessage ?? err.details ?? err.message ?? "unknown",
      from,
      to,
      valueEth: formatEther(value),
      calldata: data ?? "0x",
    });
  }
}

/* ------------------------------------------------------------------ */
/* chain_history — explorer data via the Blockscout API (Etherscan-compatible) */
/* ------------------------------------------------------------------ */
export async function chainHistory(input: Record<string, unknown>, net: NetworkId) {
  // Blockscout indexes Robinhood Chain and Robinhood Chain Testnet with a free, Etherscan-compatible API.
  const action = String(input.action ?? "transactions");
  const a = addr(input.address);
  const params = new URLSearchParams();
  if (process.env.BLOCKSCOUT_API_KEY) params.set("apikey", process.env.BLOCKSCOUT_API_KEY);
  if (action === "transactions") params.set("module", "account"), params.set("action", "txlist");
  else if (action === "token_transfers") params.set("module", "account"), params.set("action", "tokentx");
  else if (action === "source") params.set("module", "contract"), params.set("action", "getsourcecode");
  else throw new Error("Unknown action. Use transactions, token_transfers or source.");
  params.set("address", a);
  if (action !== "source") {
    params.set("page", "1");
    params.set("offset", String(Math.min(Number(input.limit ?? 15) || 15, 50)));
    params.set("sort", "desc");
  }
  const res = await fetch(`${NETWORKS[net].explorer}/api?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`The explorer answered HTTP ${res.status}.`);
  const data = (await res.json()) as { status?: string; message?: string; result?: unknown };
  if (data.status !== "1" && !Array.isArray(data.result)) throw new Error(`Explorer: ${data.message ?? "error"} — ${String(data.result).slice(0, 200)}`);

  if (action === "source") {
    const r = (data.result as Record<string, string>[])[0] ?? {};
    const src = r.SourceCode ?? "";
    return json({
      network: NETWORKS[net].name,
      address: a,
      verified: Boolean(src),
      contractName: r.ContractName,
      compiler: r.CompilerVersion,
      proxy: r.Proxy === "1" ? r.Implementation : null,
      source: src.length > 9000 ? `${src.slice(0, 9000)}\n…[truncated]` : src,
    });
  }
  const rows = (data.result as Record<string, string>[]).map((t) => ({
    time: new Date(Number(t.timeStamp) * 1000).toISOString(),
    hash: t.hash,
    from: t.from,
    to: t.to,
    value: action === "token_transfers" ? `${formatUnits(BigInt(t.value || "0"), Number(t.tokenDecimal || 18))} ${t.tokenSymbol}` : `${formatEther(BigInt(t.value || "0"))} ETH`,
    ...(action === "transactions" ? { status: t.isError === "1" ? "failed" : "ok", method: t.functionName?.split("(")[0] || undefined } : {}),
  }));
  return json({ network: NETWORKS[net].name, address: a, items: rows });
}

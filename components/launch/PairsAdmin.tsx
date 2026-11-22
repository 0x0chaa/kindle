"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, defineChain, formatUnits, http, isAddress, parseUnits, type Address } from "viem";
import { Loader2 } from "lucide-react";
import { useAccount } from "@/lib/wallet-store";
import { ensureChain, getWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { ERC20_ABI, ETH_ADDRESS, FACTORY, FACTORY_ABI, pairParams } from "@/lib/factory";

const robinhood = defineChain({
  id: NETWORKS.robinhood.chainId,
  name: NETWORKS.robinhood.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [NETWORKS.robinhood.rpc] } },
});
const client = createPublicClient({ chain: robinhood, transport: http(NETWORKS.robinhood.rpc) });

type Row = { address: Address; symbol: string; decimals: number; enabled: boolean; graduation: bigint; params: readonly [bigint, bigint, bigint] };

/** Owner tool: approve pair assets (tokenized stocks, stablecoins…) and set how much each curve raises before graduating. */
export function PairsAdmin() {
  const account = useAccount();
  const [owner, setOwner] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [asset, setAsset] = useState("");
  const [grad, setGrad] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!FACTORY) return;
    const [o, list] = await Promise.all([
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "owner" }),
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "pairList" }),
    ]);
    setOwner(o);
    setRows(
      await Promise.all(
        list.map(async (a) => {
          const p = await client.readContract({ address: FACTORY!, abi: FACTORY_ABI, functionName: "pairs", args: [a] });
          const eth = a.toLowerCase() === ETH_ADDRESS;
          const [symbol, decimals] = eth
            ? ["ETH", 18]
            : await Promise.all([
                client.readContract({ address: a, abi: ERC20_ABI, functionName: "symbol" }),
                client.readContract({ address: a, abi: ERC20_ABI, functionName: "decimals" }),
              ]);
          return { address: a, symbol: String(symbol), decimals: Number(decimals), enabled: p[0], graduation: p[1], params: [p[2], p[3], p[4]] as const };
        }),
      ),
    );
  }, []);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  if (!FACTORY || !owner) return null;
  const isOwner = !!account && account.toLowerCase() === owner.toLowerCase();

  const send = async (label: string, a: Address, enabled: boolean, graduation: bigint, sq0: bigint, sq1: bigint, liq: bigint) => {
    setMsg("");
    const eth = getWallet();
    if (!eth || !account) return setMsg("Connect the owner wallet.");
    setBusy(label);
    try {
      await ensureChain(eth, "robinhood");
      const wallet = createWalletClient({ account: account as Address, chain: robinhood, transport: custom(eth as unknown as Parameters<typeof custom>[0]) });
      const { request } = await client.simulateContract({
        account: account as Address,
        address: FACTORY!,
        abi: FACTORY_ABI,
        functionName: "setPair",
        args: [a, enabled, graduation, sq0, sq1, liq],
      });
      const r = await client.waitForTransactionReceipt({ hash: await wallet.writeContract(request) });
      setMsg(r.status === "success" ? "Saved." : "The transaction failed.");
      setAsset("");
      setGrad("");
      await load();
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "";
      setMsg(/rejected|denied/i.test(m) ? "You rejected the transaction." : m.slice(0, 200));
    }
    setBusy("");
  };

  const add = async () => {
    if (!isAddress(asset)) return setMsg("Enter the pair asset's contract address.");
    try {
      const dec = Number(await client.readContract({ address: asset, abi: ERC20_ABI, functionName: "decimals" }));
      const g = parseUnits(grad, dec);
      if (g <= 0n) return setMsg("Enter how much the curve should raise before graduating.");
      const { sqrtQuote0, sqrtQuote1, liquidity } = pairParams(g);
      await send("add", asset, true, g, sqrtQuote0, sqrtQuote1, liquidity);
    } catch (e) {
      setMsg((e as Error).message.slice(0, 200));
    }
  };

  const field = "h-11 w-full rounded-xl border border-ink/15 bg-paper px-3 text-sm";

  return (
    <div className="mt-8 space-y-4 rounded-3xl border border-ink/10 bg-paper/70 p-5 md:p-6">
      <h2 className="text-xl font-bold">Pairs</h2>
      <p className="text-sm opacity-75">
        Assets creators can pair their token with. Each pair has its own graduation target (what the curve raises before the token moves to
        Uniswap v4). A pair&apos;s target is fixed once a token uses it; you can still disable it for new launches.
      </p>
      <ul className="divide-y divide-ink/10 text-sm">
        {rows.map((r) => (
          <li key={r.address} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <b>{r.symbol}</b> · graduates at {Number(formatUnits(r.graduation, r.decimals)).toLocaleString("en-US")} {r.symbol} ·{" "}
              {r.enabled ? "enabled" : "disabled"}
            </span>
            {isOwner && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void send(r.address, r.address, !r.enabled, r.graduation, r.params[0], r.params[1], r.params[2])}
                className="h-9 rounded-full border border-ink/20 px-4 text-xs font-bold"
              >
                {busy === r.address ? <Loader2 className="size-4 animate-spin" /> : r.enabled ? "Disable" : "Enable"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner ? (
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <input value={asset} onChange={(e) => setAsset(e.target.value.trim())} placeholder="Pair asset address (0x…)" className={field} />
          <input value={grad} onChange={(e) => setGrad(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Graduation target" className={field} />
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void add()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-coral px-5 text-sm font-bold text-[#0b0b0b]"
          >
            {busy === "add" && <Loader2 className="size-4 animate-spin" />} Add pair
          </button>
        </div>
      ) : (
        <p className="text-xs opacity-60">Connect the owner wallet to add or disable pairs.</p>
      )}
      <p className="text-xs opacity-60">
        Only add plain ERC-20s (no transfer tax, no rebasing). Pick a target worth roughly the same as 4.2 ETH so curves behave alike.
      </p>
      {msg && <p className="break-words text-sm">{msg}</p>}
    </div>
  );
}

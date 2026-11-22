// Browser wallet (EIP-1193: MetaMask, Coinbase Wallet, Rabby…). Keys never leave the wallet.
import { parseEther, type Hex } from "viem";
import { buildCalldata } from "./abi";
import { NETWORKS, type NetworkId } from "./networks";

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...a: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...a: unknown[]) => void) => void;
};

export function getWallet(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum ?? null;
}

export async function connectWallet(): Promise<string> {
  const eth = getWallet();
  if (!eth) throw new Error("No browser wallet found. Install MetaMask, Coinbase Wallet or Rabby, then reload.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("The wallet didn't share an account.");
  return accounts[0];
}

export async function ensureChain(eth: Eip1193, net: NetworkId) {
  const n = NETWORKS[net];
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: n.hexId }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: n.hexId,
          chainName: n.name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [n.rpc],
          blockExplorerUrls: [n.explorer],
        },
      ],
    });
  }
}

/** Ask the user's wallet to sign and send. Returns the transaction hash. */
export async function sendWithWallet(net: NetworkId, from: string, input: Record<string, unknown>): Promise<Hex> {
  const eth = getWallet();
  if (!eth) throw new Error("No browser wallet found.");
  await ensureChain(eth, net);
  const data = buildCalldata(input);
  const value = input.value_eth ? parseEther(String(input.value_eth)) : 0n;
  const tx: Record<string, string> = { from, to: String(input.to) };
  if (data) tx.data = data;
  if (value > 0n) tx.value = `0x${value.toString(16)}`;
  return (await eth.request({ method: "eth_sendTransaction", params: [tx] })) as Hex;
}

/** Ask the user's wallet to sign a contract deployment (no `to`). Returns the transaction hash. */
export async function deployWithWallet(net: NetworkId, from: string, data: Hex, valueEth?: string): Promise<Hex> {
  const eth = getWallet();
  if (!eth) throw new Error("No browser wallet found.");
  await ensureChain(eth, net);
  const value = valueEth ? parseEther(valueEth) : 0n;
  const tx: Record<string, string> = { from, data };
  if (value > 0n) tx.value = `0x${value.toString(16)}`;
  return (await eth.request({ method: "eth_sendTransaction", params: [tx] })) as Hex;
}

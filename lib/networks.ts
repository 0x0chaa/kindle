// Robinhood Chain networks (shared by the browser wallet flow and the server tools).
// Robinhood Chain is an Arbitrum Orbit (Nitro) L2 on Ethereum; gas is paid in ETH.
export type NetworkId = "robinhood" | "robinhood-testnet";

export const NETWORKS: Record<
  NetworkId,
  { name: string; short: string; chainId: number; hexId: string; rpc: string; explorer: string; faucet?: string }
> = {
  robinhood: {
    name: "Robinhood Chain",
    short: "Mainnet",
    chainId: 4663,
    hexId: "0x1237",
    rpc: "https://rpc.mainnet.chain.robinhood.com",
    explorer: "https://robinhoodchain.blockscout.com",
  },
  "robinhood-testnet": {
    name: "Robinhood Chain Testnet",
    short: "Testnet",
    chainId: 46630,
    hexId: "0xb626",
    rpc: "https://rpc.testnet.chain.robinhood.com",
    explorer: "https://explorer.testnet.chain.robinhood.com",
    faucet: "https://faucet.testnet.chain.robinhood.com",
  },
};

export const DEFAULT_NETWORK: NetworkId = "robinhood";

// Copy for the launchpad sections (Fees, FAQ, Docs). Facts follow Kindle's factory contract (lib/factory-source.ts).

export const fees: { title: string; value: string; text: string }[] = [
  {
    title: "Launching",
    value: "Gas only",
    text: "You pay Robinhood Chain gas. Kindle charges no launch fee today — if that changes, your wallet shows it before you sign.",
  },
  {
    title: "Pool fee",
    value: "1%",
    text: "Every Kindle token trades in a Uniswap v4 pool with a 1% swap fee. There is no extra buy or sell tax.",
  },
  {
    title: "Creator share",
    value: "70%",
    text: "70% of the pool fee goes to the token's creator, in ETH and in the token. Anyone can trigger the payout from the token page.",
  },
  {
    title: "Kindle share",
    value: "30%",
    text: "30% of the pool fee goes to Kindle's treasury. It's fixed in the factory contract and can't be raised.",
  },
  {
    title: "Liquidity",
    value: "Locked",
    text: "The whole supply goes into the pool at launch and the factory has no function to remove it.",
  },
  {
    title: "Team tokens",
    value: "0",
    text: "No presale and no team allocation: creators buy from the pool like everyone else.",
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "What is Kindle?",
    a: "A friendly launchpad for Robinhood Chain. You can launch a token, browse new, top and trending Kindle tokens, open any token's page and swap it — always from your own wallet.",
  },
  {
    q: "Whose contracts are these?",
    a: "Kindle's own. One factory contract creates each token, opens its Uniswap v4 pool and locks the liquidity. The source is public and verified on Blockscout.",
  },
  {
    q: "What does it cost to launch?",
    a: "Robinhood Chain gas. Kindle charges no launch fee today; your wallet shows the total before you sign.",
  },
  {
    q: "Why “Graduating” and “Graduated” instead of “migrating”?",
    a: "Kindle tokens have no bonding curve: they trade in a Uniswap v4 pool from the first block, so there is nothing to migrate. Kindle uses a $69K market-cap milestone instead — Graduating tokens are getting close, Graduated tokens have passed it.",
  },
  {
    q: "Can a creator pull the liquidity?",
    a: "No. The whole supply is placed in the pool at launch and the liquidity belongs to the factory, which has no function to remove it.",
  },
  {
    q: "Is every token here safe?",
    a: "No. Anyone can launch a token and Kindle doesn't vet them. Always check the contract address from the project's own channels and only trade what you can afford to lose.",
  },
  {
    q: "How do swaps work?",
    a: "Kindle finds the token's Uniswap v4 pool (or a v3 pool for other tokens), dry-runs the swap, shows the minimum you'll receive, and you sign in your wallet. Selling a token needs an approval for exactly the amount you sell — never unlimited.",
  },
  {
    q: "Which wallets work?",
    a: "Any browser wallet on Robinhood Chain — MetaMask, Coinbase Wallet, Rabby and others. On a phone, open Kindle inside your wallet app's browser.",
  },
  {
    q: "How do creators get paid?",
    a: "Swap fees build up in the pool. Press Collect fees on the token page and 70% is sent to the creator's wallet, 30% to Kindle. Anyone can press it; the money always goes to the creator.",
  },
  {
    q: "Will my token show on GMGN and DexScreener?",
    a: "Tokens with a pool and trades are picked up by trackers like DexScreener and GMGN automatically, usually within minutes of the first trades.",
  },
];

export const docs: { id: string; title: string; body: string[] }[] = [
  {
    id: "overview",
    title: "Overview",
    body: [
      "Kindle is a token launchpad and trading interface on Robinhood Chain (chain ID 4663), with its own launch factory on Uniswap v4.",
      "Everything happens from your own wallet. Kindle never holds keys, tokens or funds.",
    ],
  },
  {
    id: "launching",
    title: "Launching a token",
    body: [
      "Open Launch, connect your wallet, enter a name, a ticker and an image link, and confirm one transaction.",
      "Kindle's factory creates a token with a fixed supply of 1,000,000,000, opens a Uniswap v4 pool paired with ETH (1% fee) and places the full supply in it as single-sided liquidity, starting at a market cap of about 2 ETH. The factory owns that liquidity and has no way to remove it.",
      "Your wallet is recorded as the creator and receives 70% of the pool fees. There is no admin key on the token. After launch, share the exact contract address from your own accounts.",
    ],
  },
  {
    id: "lists",
    title: "Token lists",
    body: [
      "New — launched on Kindle in the last 3 days, newest first.",
      "Top — highest market cap. Trending — highest 24-hour volume.",
      "Graduating — tokens with a market cap between $20.7K and $69K. Graduated — tokens above $69K. These are milestones, not contract migrations.",
      "Lists come from Kindle's factory contract on-chain; prices, market caps and volume from DexScreener, refreshed about every 30 seconds.",
    ],
  },
  {
    id: "trading",
    title: "Trading",
    body: [
      "The swap box on each token page buys with ETH or sells for ETH.",
      "Quotes come from Uniswap's v3 quoter, or the v4 quoter for tokens that trade in v4 pools. Each swap is dry-run on Robinhood Chain before you sign.",
      "ETH swaps need one signature. Selling a token needs an exact-amount approval through Permit2 first, then the swap. Max slippage is up to you (0.5–5%).",
    ],
  },
  {
    id: "fees",
    title: "Fees",
    body: [
      "Launch: gas only (the owner can add a launch fee of at most 0.01 ETH; it's shown before you sign).",
      "Trading: a 1% Uniswap v4 pool fee and no tax. 70% of it goes to the creator and 30% to Kindle's treasury, paid out by Collect fees on the token page.",
    ],
  },
  {
    id: "safety",
    title: "Safety",
    body: [
      "Anyone can launch a token. Look-alike names are common — trust contract addresses, not names or images.",
      "Read every wallet prompt before you confirm. Kindle never asks for your seed phrase and never DMs first.",
    ],
  },
  {
    id: "developers",
    title: "For developers",
    body: [
      "The factory's address is shown on the Launch page; its verified source is on Robinhood Chain's Blockscout. Read launches with recent(offset, count) or listen for the Launched event.",
      "Kindle's own endpoints: GET /api/tokens?tab=new|top|trending|graduating|graduated and POST /api/swap/quote.",
    ],
  },
];

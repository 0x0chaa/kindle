// Copy for the launchpad sections (Fees, FAQ, Docs). Facts follow Kindle's factory contract (lib/factory-source.ts).

export const fees: { title: string; value: string; text: string }[] = [
  {
    title: "Launching",
    value: "0.0005 ETH",
    text: "A flat 0.0005 ETH launch fee plus Robinhood Chain gas. Your wallet shows the total before you sign.",
  },
  {
    title: "Trading fee",
    value: "1%",
    text: "Every trade pays 1%, on the bonding curve and in the Uniswap v4 pool after graduation: 70% to the creator, 30% to Kindle.",
  },
  {
    title: "Creator tax",
    value: "0–10%",
    text: "Creators can add their own tax at launch. It's charged on every trade, on the curve and in the pool, and goes entirely to the creator.",
  },
  {
    title: "Pairs",
    value: "ETH +",
    text: "Tokens trade against ETH or another approved asset, such as a tokenized stock or a stablecoin. Fees are paid in that asset.",
  },
  {
    title: "Buybacks",
    value: "5 years",
    text: "Creators can spend their fees buying their own token back. Bought-back tokens unlock evenly over five years.",
  },
  {
    title: "Anti-snipe",
    value: "5 s",
    text: "Buys in the first seconds after launch pay a tax that falls from 99% to 0, so bots can't grab a launch.",
  },
];

export const faqs: { q: string; a: string }[] = [
  {
    q: "What is Kindle?",
    a: "A token launchpad for Robinhood Chain. Launch a token in one transaction, trade it on its bonding curve, and watch it graduate to Uniswap v4 — always from your own wallet.",
  },
  {
    q: "How does the bonding curve work?",
    a: "800M of the 1B tokens are sold on a curve: every buy raises the price, every sell lowers it. When the curve sells out (about 4.2 ETH raised), the token graduates.",
  },
  {
    q: "What happens at graduation?",
    a: "In the same transaction, the last 200M tokens and the ETH the curve raised are added to a Uniswap v4 pool as one full-range position that Kindle's factory owns and can never remove. From then on it trades in that pool on any Uniswap v4 app.",
  },
  {
    q: "What is the anti-snipe tax?",
    a: "For the first 5 seconds after a launch, buys pay a tax that starts at 99% and drops to 0. The creator's own first buy, made in the launch transaction, is exempt.",
  },
  {
    q: "What is the creator tax?",
    a: "An optional extra fee, from 0 to 10%, that a creator sets at launch. It applies to every buy and sell — on the curve and, after graduation, in the Uniswap v4 pool — and all of it goes to the creator. Check a token's tax on its page before you trade.",
  },
  {
    q: "Can a token be paired with something other than ETH?",
    a: "Yes. Creators can pick ETH or another asset Kindle has approved, such as a tokenized stock or a stablecoin. Buyers pay in that asset, graduation is measured in it, and fees are paid in it. Tokens paired with a stock also move with that stock.",
  },
  {
    q: "How do creator buybacks work?",
    a: "Creators can use fees from escrow to buy their own token, either by hand or automatically with a share of every claim. Each buyback is locked and unlocks evenly over five years.",
  },
  {
    q: "What does it cost?",
    a: "Launching costs 0.0005 ETH plus gas. Every trade pays 1% (70% to the creator, 30% to Kindle) plus the creator's tax, if any.",
  },
  {
    q: "Is every token here safe?",
    a: "No. Anyone can launch a token and Kindle doesn't vet them. Always check the contract address from the project's own channels and only trade what you can afford to lose.",
  },
  {
    q: "Which wallets work?",
    a: "Any browser wallet on Robinhood Chain — MetaMask, Coinbase Wallet, Rabby and others. On a phone, open Kindle inside your wallet app's browser.",
  },
  {
    q: "How do creators get paid?",
    a: "Fees collect in escrow. On the token page, Claim creator fees pays them out (after graduation, Sweep pool fees first moves the pool's fees into escrow). Anyone can press it; the money always goes to the creator.",
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
      "Kindle's factory creates a token with a fixed supply of 1,000,000,000. 800M are sold on a bonding curve with virtual reserves (start price ≈ 0.0000000013 ETH, about 1.3 ETH fully diluted). You can add a first buy in the same transaction.",
      "When the curve sells out (~4.2 ETH), the remaining 200M tokens and the ETH go into a Uniswap v4 pool (1% fee) owned by the factory, which has no way to remove it. Your wallet receives 70% of all fees. There is no admin key on the token. After launch, share the exact contract address from your own accounts.",
    ],
  },
  {
    id: "lists",
    title: "Token lists",
    body: [
      "New — launched on Kindle in the last 3 days, newest first.",
      "Top — highest market cap. Trending — highest 24-hour volume.",
      "Graduating — bonding curve more than half sold. Graduated — curve sold out and trading in the Uniswap v4 pool.",
      "Lists come from Kindle's factory contract on-chain; prices, market caps and volume from DexScreener, refreshed about every 30 seconds.",
    ],
  },
  {
    id: "trading",
    title: "Trading",
    body: [
      "The swap box on each token page buys with ETH or sells for ETH.",
      "Before graduation you trade on the bonding curve, directly against the factory. After graduation, quotes come from Uniswap's v4 quoter. Each trade is dry-run on Robinhood Chain before you sign.",
      "ETH swaps need one signature. Selling a token needs an exact-amount approval through Permit2 first, then the swap. Max slippage is up to you (0.5–5%).",
    ],
  },
  {
    id: "fees",
    title: "Fees",
    body: [
      "Launch: 0.0005 ETH plus gas (the owner can change it, at most 0.01 ETH; it's shown before you sign).",
      "Trading: 1% on every trade, on the curve and in the pool — 70% to the creator, 30% to Kindle's treasury — plus the creator's optional tax (0–10%, all to the creator). After graduation the total is the pool's LP fee.",
      "Pairs: ETH by default, or an asset Kindle has approved (tokenized stocks, stablecoins). Graduation targets are set per pair.",
      "Buybacks: creators can spend escrowed fees on their own token; each buyback unlocks linearly over five years.",
      "Anti-snipe: buys in the first 5 seconds after launch pay a tax that falls from 99% to 0 (paid to the treasury).",
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

# Kindle

A token launchpad on Robinhood Chain (chain ID 4663), with its own launch factory on Uniswap v4.

- **Home** — editorial hero, live ticker and the token board (New, Top, Trending, Graduating, Graduated), 40 at a time with Read more. Graduating = curve more than half sold, Graduated = curve sold out and trading on Uniswap v4.
- **Token pages** (`/token/[address]`) — stats, DexScreener chart, contract copy, links, a bonding-curve buy/sell box with progress and live anti-snipe tax before graduation, the Uniswap v4 swap box after, and creator fee claims.
- **Launch** (`/launch`) — calls `launch(name, symbol, image, minOut)` (optionally with a first buy) on the factory: fixed 1B supply, 800M sold on a virtual-reserve bonding curve, graduation at ~4.2 ETH into a full-range Uniswap v4 position locked in the factory, 1% fee on every trade (70% creator / 30% treasury), 0.0005 ETH launch fee, 5-second anti-snipe tax (~99% → 0).
- **Factory setup** (`/factory`) — the owner compiles (server-side, solc) and deploys the factory from their wallet, then sets `NEXT_PUBLIC_KINDLE_FACTORY`.
- **About** (`/about`) — introduction, how it works, fees and FAQ. **Docs** (`/docs`).

The factory source is in `lib/factory-source.ts`. It is not audited: get it audited before promoting it widely.

## Run locally

```bash
npm install
npm run dev
```

## Deploy on Vercel

Import the repo, leave Root Directory empty, add the variables from `.env.example`, deploy. Then open `/factory`, deploy the factory from your wallet, set `NEXT_PUBLIC_KINDLE_FACTORY` and redeploy.

Kindle never holds keys: every transaction is signed in the user's own wallet.

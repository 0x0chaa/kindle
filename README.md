# Kindle

A token launchpad on Robinhood Chain (chain ID 4663), with its own launch factory on Uniswap v4.

- **Home** — editorial hero, live ticker and the token board (New, Top, Trending, Graduating, Graduated), 40 at a time with Read more. Graduating/Graduated are market-cap milestones (default $69K, `GRADUATE_MCAP_USD`): tokens have no bonding curve.
- **Token pages** (`/token/[address]`) — stats, DexScreener chart, contract copy, links, a swap box (Uniswap v3, then the token's v4 pool, dry-run, signed in the user's wallet) and Collect fees.
- **Launch** (`/launch`) — calls `launch(name, symbol, image)` on the factory from the user's wallet: fixed 1B supply, Uniswap v4 pool against ETH at a 1% fee, liquidity locked in the factory, fees 70% creator / 30% treasury.
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

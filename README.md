# Kindle — token launchpad on Robinhood Chain

Kindle is a launchpad and trading interface on Robinhood Chain, with its own launch factory on Uniswap v4:

- **Token board** — New, Top, Trending, Graduating and Graduated Kindle tokens (read from the factory contract + DexScreener market data). Graduating/Graduated are market-cap milestones (default $69K, `GRADUATE_MCAP_USD`), since Kindle tokens have no bonding curve to migrate from.
- **Token pages** (`/token/[address]`) — stats, DexScreener chart, contract copy, links, and a swap box that quotes Uniswap v3 then v4 (Kindle pools), dry-runs, and executes from the user's wallet.
- **Launch** (`/launch`) — calls `launch(name, symbol, image)` on Kindle's factory (`lib/factory-source.ts`) from the user's wallet: fixed 1B supply, Uniswap v4 pool vs ETH at 1%, liquidity locked in the factory, fees 70% creator / 30% treasury.
- **Factory setup** (`/factory`) — the owner compiles and deploys the factory from their wallet, then sets `NEXT_PUBLIC_KINDLE_FACTORY` in Vercel.
- **Fees, FAQ, Docs** (`/docs`), a global Connect wallet, and the ☰ menu linking every section.
- **Ask Kindle** (`/run`) — the AI agent console (chain reads, swaps, contract deploys).

# Kindle — AI agent platform website

An immersive marketing site for an AI-agent platform, built with **Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · React Three Fiber · GSAP · Motion (Framer Motion) · shadcn/ui structure · Lenis · Lucide**.

A soft, squishy 3D kindle character (the agent mascot) lives in a fixed WebGL layer and travels through every section as you scroll, while the page flips between peach and cocoa chapters.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Requires Node 20.9+. Put at least one model key in `.env.local` (a free Gemini key is enough — see *Model provider* below).

### Model provider — free keys work

Kindle runs on whichever model you configure in `.env.local`:

| Provider | Cost | How to get a key | Set |
|---|---|---|---|
| **Google Gemini** (default) | Free tier, no card | aistudio.google.com/apikey | `LLM_PROVIDER=gemini`, `LLM_API_KEY=…` |
| Groq | Free tier, no card | console.groq.com | `LLM_PROVIDER=groq`, `LLM_API_KEY=…` |
| OpenRouter | Free `:free` models, small daily cap | openrouter.ai/keys | `LLM_PROVIDER=openrouter`, `LLM_API_KEY=…` |
| Claude (Anthropic API) | Paid (small trial credit for new accounts) | platform.claude.com | `ANTHROPIC_API_KEY=…` |

`LLM_MODEL` overrides the default model (`gemini-flash-latest`, `openai/gpt-oss-120b`, `openrouter/free`). Free tiers have rate limits and can change; check each provider's console. With a free provider every tool works **except** web search, the code sandbox and MCP servers, which run on Anthropic's side and need the Claude API — the console marks them "Needs Claude API". PDFs can't be read by the free providers (paste the text instead); images work.

### Agent console (`/run`)

"Start an agent", "Run an agent" in the nav and "Run this agent" on every agent page open a real agent console:

1. Write a goal (or pick a template), choose which tools the agent may use, and set each to **Auto**, **Ask me** (pauses for your approval) or **Off**.
2. Press **Run agent**. The browser drives the loop: each turn calls `/api/agent/step` (Claude via the Messages API), runs the requested tools through `/api/agent/tools` (or in the browser for notes), waits for approvals, and repeats until the agent finishes (max 14 turns).
3. The timeline shows the plan, web searches, tool calls and results, and the final answer with sources. Ask follow-ups to continue the same run.

Tools (each can be Auto, Ask me or Off):

| Tool | Runs on | What it does |
|---|---|---|
| Web search | Anthropic | Searches the web with citations (enable web search for your org in the Claude Console) |
| Code sandbox | Anthropic | Python and shell in a secure sandbox — data analysis, charts, file work |
| Read a web page | your server | Fetches public http(s) pages (private/local addresses blocked) |
| API requests | your server | GET/POST to public JSON APIs |
| Ask another model | your server | Delegates a sub-task to a fast (`AGENT_FAST_MODEL`) or smart (`AGENT_SMART_MODEL`) Claude model |
| Calculator, Clock | your server | Exact maths, current time in any zone |
| Long-term memory | browser | Saves facts and preferences between runs (localStorage) |
| Send a message | your server | Posts to Slack/Discord/Teams through `AGENT_WEBHOOK_URL` |
| Notes | browser | Pins key findings beside the run |

**MCP servers.** Connect any remote MCP server in the console (name, https URL, optional token) or on the server with `MCP_SERVERS`. Claude discovers and calls their tools through Anthropic's MCP connector (`anthropic-beta: mcp-client-2025-11-20`); MCP tool calls run inside the model turn, so they can't pause for approval.

**Robinhood Chain (on-chain).** The console has a **Robinhood Chain** panel: pick Mainnet (chain ID 8453) or Robinhood Chain Testnet testnet (chain ID 84532), connect a browser wallet (MetaMask, Coinbase Wallet, Rabby…; the network is added automatically), and enable:

| Tool | What it does |
|---|---|
| Read Robinhood Chain | ETH and ERC-20 balances (ETH, USDC and any other token), token info, blocks, transactions, gas price, any read-only contract function (`viem`) |
| Simulate transaction | `eth_call` + gas estimate against live state: success or revert reason, decoded return data, fee in ETH, whether the sender can afford it |
| Explorer data | Wallet history, token transfers and verified contract source from Blockscout (`base.blockscout.com` / `base-sepolia.blockscout.com`), free with no API key |
| Check the Robinhood Chain docs | Reads `docs.base.org` so answers are grounded in the official docs |
| Sign in my wallet | Kindle prepares a transaction; you review the summary and sign in your own wallet. Always "Ask me" — Kindle never holds keys |
| Swap quote | Best Uniswap quote on Robinhood Chain. Uniswap v3 first; if the token has no v3 pool (e.g. a Kindle launch), it finds the token's Uniswap v4 pool from its creation transaction (or the standard hook-less tiers), quotes it with V4Quoter and builds a Universal Router `execute` (wrap/unwrap ETH as needed; ERC-20 input via exact-amount Permit2 approvals). v3: (QuoterV2 across the 0.01/0.05/0.3/1% pools), minimum output after slippage, balance check, dry-run, and ready-to-sign steps: an exact-amount approval if needed, then `multicall(deadline, …)` on SwapRouter02 (ETH in/out handled via WETH) |
| Compile contract | Compiles Solidity with solc-js on the server (optimizer 200, EVM cancun); `@openzeppelin/contracts/…` v5 imports are fetched from jsDelivr. Returns an `artifact_id`, constructor, functions and the estimated deployment fee. The ABI and bytecode stay in the browser — the model only sees the id |
| Deploy contract | Deploys a compiled artifact from your own wallet after you approve; then `chain_read action=transaction` shows the new address |

```bash
BASE_RPC_URL=https://...          # optional: your own RPC (the public https://mainnet.base.org is rate-limited)
BASE_SEPOLIA_RPC_URL=https://...  # optional
BLOCKSCOUT_API_KEY=...                 # optional, for higher Blockscout rate limits
```

Free testnet ETH: https://docs.base.org/base-chain/network-information/network-faucets

**Tools and guardrails** is laid out like Tesera's product: *Read the chain*, *Check the docs* (official Robinhood Chain docs), *Simulate & explain*, *Self-custody signing*, *Token swaps* and *Build & deploy contracts*. **Signing limits** apply to every signature request before your wallet opens: spend cap per transaction (ETH), allowed contracts/recipients, allowed functions (add `deploy` to allow deployments when this list is used), blocking unlimited approvals, and a session expiry. Anything outside them is refused and the agent is told why. General tools (web search, code sandbox, memory…) sit under *Extra tools*.

Templates (Tesera-style, for Robinhood Chain): *Read the chain*, *Inspect a contract*, *Simulate & explain*, *Sign in my wallet*, *Explain a transaction*, *Token check*, *Gas & network*, *Swap tokens*, *Deploy a token*. The system prompt requires a simulation and a plain-language explanation before any signature request.

**Tesera (on-chain, Elysium only for now).** The MCP panel's preset is now **Connect Robinhood Chain MCP** (no URL is prefilled — paste a Robinhood Chain MCP server you trust; there is no official one yet). Tesera can still be added manually as a custom server for Elysium: Paste the MCP URL and access key from your Tesera dashboard (teseralab.com → Access keys) and Kindle can read Elysium balances, blocks, events and contracts, simulate and explain transactions, and build, deploy and verify contracts. Transactions are signed in your own wallet; Kindle's system prompt also requires it to simulate and explain before anything is signed and never to sign on your behalf. To configure it server-side instead:

```bash
MCP_SERVERS=[{"name":"tesera","url":"<your Tesera MCP URL>","token":"<your access key>"}]
```

**Attachments.** PDFs, images, text, CSV and JSON (up to 8 MB) are sent with the goal.

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
AGENT_MODEL=claude-sonnet-5-5        # optional
AGENT_ACCESS_CODE=choose-a-code      # optional: require a code before anyone can spend your credits
AGENT_FAST_MODEL=claude-haiku-5-5    # optional, used by "Ask another model"
AGENT_SMART_MODEL=claude-opus-5-5    # optional
AGENT_WEBHOOK_URL=https://hooks.slack.com/services/...   # optional, enables "Send a message"
MCP_SERVERS=[{"name":"tracker","url":"https://your-mcp-server.example.com/mcp","token":"..."}]   # optional
```

Without a key the console explains the setup and can play a clearly labelled sample run. **Set `AGENT_ACCESS_CODE` before deploying publicly** — otherwise anyone with the URL can run agents on your API key.

### Contact form delivery

The form posts to `app/api/contact/route.ts`, which validates input, filters bots with a honeypot and forwards the enquiry to a webhook:

```bash
# .env.local
CONTACT_WEBHOOK_URL=https://hooks.slack.com/services/...   # or Discord / Zapier / Make / your CRM
```

Without the variable, enquiries are logged on the server and the form still succeeds — set it before going live.

## shadcn/ui setup

The project follows the shadcn structure (`components.json` is included), so you can add more shadcn components with:

```bash
npx shadcn@latest add button
```

- **`components/ui/`** holds reusable primitives (shadcn components and third-party pieces such as `animated-text-10.tsx`). The CLI installs into this folder through the `ui` alias, and the components themselves import from it, so keep the path.
- **`lib/utils.ts`** exports the shadcn `cn()` helper (`clsx` + `tailwind-merge`).
- **`app/globals.css`** maps the shadcn tokens (`--background`, `--foreground`, `--primary`, `--accent`) onto Kindle's colours. `--foreground` follows the dark/light section tone automatically.
- Animation uses the **`motion`** package (`motion/react`), which is the current name of Framer Motion.

### TextScanner (`components/ui/animated-text-10.tsx`)

An animated text where a light sweep and a glowing line pass across the letters. It falls back to plain text when someone's device asks for reduced motion.

| Prop | Default | |
|---|---|---|
| `text` | `"SCANNER"` | what to show |
| `className` | – | size and type (e.g. `display text-7xl`) |
| `inkColor` | `var(--foreground)` | text colour |
| `accentColor` | `var(--primary)` | scan-line colour |
| `duration` | `2.6` | seconds per sweep |

It's used for the large KINDLE® wordmark at the bottom of the contact section, the loader's "Loading worlds" label and the hero's "Booking 2027" status. A standalone demo is in `components/demos/animated-text-10-demo.tsx`.

## Structure

```
app/
  layout.tsx            fonts, metadata, Providers, Nav, Cursor, grain
  page.tsx              home: <Stage/> (WebGL) + sections
  agents/[slug]/page.tsx agent template pages (statically generated)
  run/page.tsx          agent console
  api/agent/step        one model turn (Claude Messages API)
  api/agent/tools       server-side tools: fetch_url, http_request, ask_llm, calculator, get_time, send_message
  api/agent/mcp         lists MCP servers configured on the server (no tokens)
  api/contact/route.ts  form endpoint
  not-found.tsx
components/
  Providers.tsx         Lenis smooth scroll, GSAP/ScrollTrigger, page-transition curtain,
                        dark/light tone switching, reduced-motion detection
  Loader.tsx            intro counter + curtain
  Nav.tsx               hide-on-scroll nav, mobile full-screen menu
  Cursor.tsx            dot + ring cursor with contextual labels ("View", "Next")
  ui/animated-text-10.tsx TextScanner (shadcn-style primitive)
  Magnetic.tsx, Pill.tsx magnetic buttons with fill + text-roll hover
  Text.tsx              SplitText (kinetic reveals), ScrubText, FadeIn, velocity Marquee
  ProjectArt.tsx        generative CSS/SVG agent covers (replace with real media)
  StepVisual.tsx        animated motif per "How it works" step
  AgentView.tsx         agent template page
  sections/             Hero, About (Introduction: what you need), HowItWorks, Work (Agents), Process (Agent loop), Contact
  three/
    Stage.tsx           lazy, client-only mount of the 3D bundle
    Experience.tsx      Canvas, environment light-formers, floaters,
                        scroll "Director" (per-section poses), bloom + chromatic aberration
    Kindle.tsx           procedural kindle mascot (no model download)
lib/content.ts          all copy: needs, how-it-works steps, agents, agent loop, use cases, socials, email
```

## How the 3D journey works

Every section has `data-scene="hero|about|services|work|process|contact"`. Each frame the `Director` measures how much of the viewport each section covers, blends the matching poses (position, scale, rotation, camera distance, floaters visibility) and eases the mascot toward the result. Edit the `DESKTOP` / `MOBILE` pose tables in `components/three/Experience.tsx` to re-choreograph it.

Sections also carry `data-tone="dark|light"`; ScrollTrigger flips `html[data-mode]` and the body background cross-fades.

## Performance & accessibility

- Three.js, drei and postprocessing are code-split and loaded at idle time behind the intro loader.
- No HDRs, textures or models to download — the environment is built from drei `Lightformer`s.
- Rendering pauses when the Work section covers the canvas and when the tab is hidden.
- `PerformanceMonitor` drops DPR and post-processing on slow devices; mobile gets a lighter scene (fewer objects, no transmission, no post FX, capped DPR).
- `prefers-reduced-motion`: no smooth scroll, no pinning or kinetic reveals, static 3D rendered on demand, CSS animations disabled.
- Semantic landmarks, labelled controls, visible focus, keyboard-closable menu, form errors announced with `role="alert"`.

## Customising

- **Brand:** colours in `app/globals.css` (`@theme`), fonts in `app/layout.tsx`.
- **Content:** `lib/content.ts`. The agents shown are example templates — replace them with your own.
- **Real project media:** swap `<ProjectArt>` for `next/image` or `<video>` in `Work.tsx` and `ProjectView.tsx`.
- **Custom mascot:** export a GLB, load it with drei `useGLTF` inside `Kindle.tsx`, keep the outer group so the scroll choreography still applies.

> Dependency versions in `package.json` use caret ranges for the current majors. If `npm install` resolves a newer major with breaking changes, pin to the listed versions.

## Theme

| Token | Colour | Use |
|---|---|---|
| `peach` | `#ffe3d3` | light chapters |
| `ink` (cocoa) | `#3a2219` | dark chapters, text |
| `paper` (rice cream) | `#fff6ef` | text on cocoa, cards |
| `coral` | `#d4503f` | primary accent, buttons |
| `mint` | `#9ee6c9` | secondary accent |

Fonts: **Baloo 2** (display) + **Nunito** (body) + JetBrains Mono (labels).

// Tools the Kindle agent can use. Shared by the console (labels, defaults)
// and the API routes (definitions sent to the model).

export type ToolName =
  | "web_search"
  | "code_execution"
  | "fetch_url"
  | "http_request"
  | "ask_llm"
  | "calculator"
  | "get_time"
  | "memory"
  | "send_message"
  | "save_note"
  | "chain_read"
  | "chain_simulate"
  | "chain_history"
  | "chain_docs"
  | "chain_send"
  | "swap_quote"
  | "compile_contract"
  | "deploy_contract";
export type ToolMode = "auto" | "ask" | "off";

export const TOOLS: {
  name: ToolName;
  label: string;
  hint: string;
  /** where it runs: Anthropic's servers, our API route, or the browser */
  runs: "anthropic" | "server" | "browser" | "wallet";
  group?: "chain";
  defaultMode: ToolMode;
}[] = [
  {
    name: "web_search",
    label: "Web search",
    hint: "Searches the web and cites sources. Runs inside the model call, so it can't wait for approval.",
    runs: "anthropic",
    defaultMode: "auto",
  },
  {
    name: "code_execution",
    label: "Code sandbox",
    hint: "Runs Python and shell commands in a secure sandbox for data analysis, charts and files. Runs on Anthropic.",
    runs: "anthropic",
    defaultMode: "auto",
  },
  {
    name: "fetch_url",
    label: "Read a web page",
    hint: "Opens a public URL and reads its text.",
    runs: "server",
    defaultMode: "ask",
  },
  {
    name: "http_request",
    label: "API requests",
    hint: "Calls public HTTP/JSON APIs (GET or POST).",
    runs: "server",
    defaultMode: "ask",
  },
  {
    name: "ask_llm",
    label: "Ask another model",
    hint: "Delegates a sub-task to a fast or a stronger Claude model — drafts, summaries, second opinions.",
    runs: "server",
    defaultMode: "auto",
  },
  { name: "calculator", label: "Calculator", hint: "Exact arithmetic for budgets, totals and percentages.", runs: "server", defaultMode: "auto" },
  { name: "get_time", label: "Clock", hint: "Current date and time in any time zone.", runs: "server", defaultMode: "auto" },
  {
    name: "memory",
    label: "Long-term memory",
    hint: "Remembers facts and preferences between runs (stored in this browser).",
    runs: "browser",
    defaultMode: "auto",
  },
  {
    name: "send_message",
    label: "Send a message",
    hint: "Posts to your team chat through the webhook set in AGENT_WEBHOOK_URL (Slack, Discord, Teams…).",
    runs: "server",
    defaultMode: "ask",
  },
  { name: "save_note", label: "Notes", hint: "Saves key findings to the notes panel during the run.", runs: "browser", defaultMode: "auto" },
  {
    name: "chain_read",
    label: "Read Robinhood Chain",
    hint: "Balances, ERC-20 tokens, blocks, transactions, gas and any contract read function.",
    runs: "server",
    defaultMode: "auto",
    group: "chain",
  },
  {
    name: "chain_simulate",
    label: "Simulate transaction",
    hint: "Dry-runs a transaction against live Robinhood Chain state: would it revert, what does it return, what will gas cost.",
    runs: "server",
    defaultMode: "auto",
    group: "chain",
  },
  {
    name: "chain_history",
    label: "Explorer data",
    hint: "Wallet history, token transfers and verified contract source from the Blockscout explorer.",
    runs: "server",
    defaultMode: "auto",
    group: "chain",
  },
  {
    name: "chain_docs",
    label: "Check the Robinhood Chain docs",
    hint: "Looks up the official Robinhood Chain documentation so answers are grounded in the docs.",
    runs: "server",
    defaultMode: "auto",
    group: "chain",
  },
  {
    name: "chain_send",
    label: "Sign in my wallet",
    hint: "Prepares a transaction for you to review and sign in your own wallet. Kindle never holds keys.",
    runs: "wallet",
    defaultMode: "ask",
    group: "chain",
  },
  {
    name: "swap_quote",
    label: "Swap quote",
    hint: "Best Uniswap v3 or v4 price on Robinhood Chain (including Kindle tokens), with ready-to-sign approval and swap steps.",
    runs: "server",
    defaultMode: "auto",
    group: "chain",
  },
  {
    name: "compile_contract",
    label: "Compile contract",
    hint: "Compiles Solidity (with OpenZeppelin imports) and estimates the deployment cost.",
    runs: "server",
    defaultMode: "auto",
    group: "chain",
  },
  {
    name: "deploy_contract",
    label: "Deploy contract",
    hint: "Deploys a compiled contract from your own wallet, after you review and sign.",
    runs: "wallet",
    defaultMode: "ask",
    group: "chain",
  },
];

/** Anthropic Messages API tool definitions for the enabled tools. */
export function toolDefinitions(enabled: ToolName[]) {
  const defs: Record<ToolName, unknown> = {
    web_search: { type: "web_search_20250305", name: "web_search", max_uses: 5 },
    code_execution: { type: "code_execution_20250825", name: "code_execution" },
    http_request: {
      name: "http_request",
      description:
        "Call a public HTTP API and return the status and (truncated) response body. Use for JSON APIs such as exchange rates, weather or open data.",
      input_schema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"] },
          url: { type: "string", description: "Absolute http(s) URL" },
          headers: { type: "object", additionalProperties: { type: "string" } },
          body: { type: "string", description: "Request body for POST (usually JSON)" },
        },
        required: ["method", "url"],
      },
    },
    ask_llm: {
      name: "ask_llm",
      description:
        "Ask another Claude model to do a self-contained sub-task (draft, summarise, translate, critique, brainstorm) and return its answer. Give it all the context it needs.",
      input_schema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          model: { type: "string", enum: ["fast", "smart"], description: "fast = quick and cheap, smart = strongest reasoning" },
          system: { type: "string", description: "Optional role or style instructions" },
        },
        required: ["prompt"],
      },
    },
    memory: {
      name: "memory",
      description:
        "Long-term memory that persists between runs. action=save stores a fact or preference under a key; action=search finds saved memories matching a query; action=list returns everything; action=forget deletes a key.",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["save", "search", "list", "forget"] },
          key: { type: "string" },
          value: { type: "string" },
          query: { type: "string" },
        },
        required: ["action"],
      },
    },
    send_message: {
      name: "send_message",
      description: "Send a short message to the user's team chat channel. Use only when the goal asks you to notify or post.",
      input_schema: {
        type: "object",
        properties: { text: { type: "string", description: "The message, plain text or light Markdown" } },
        required: ["text"],
      },
    },
    fetch_url: {
      name: "fetch_url",
      description:
        "Fetch a public web page and return its title and readable text (truncated). Use for reading a specific URL the user gave or one found via search.",
      input_schema: {
        type: "object",
        properties: { url: { type: "string", description: "Absolute http(s) URL" } },
        required: ["url"],
      },
    },
    calculator: {
      name: "calculator",
      description:
        "Evaluate an arithmetic expression exactly. Supports + - * / ^ % and parentheses. Use for any non-trivial maths.",
      input_schema: {
        type: "object",
        properties: { expression: { type: "string", description: "e.g. (1200 * 0.15) + 49.9" } },
        required: ["expression"],
      },
    },
    get_time: {
      name: "get_time",
      description: "Get the current date and time, optionally in an IANA time zone such as Asia/Jakarta.",
      input_schema: {
        type: "object",
        properties: { timezone: { type: "string", description: "IANA time zone, default UTC" } },
      },
    },
    chain_read: {
      name: "chain_read",
      description:
        "Read data from the active Robinhood Chain network. action=balance (ETH balance, nonce, is-contract for `address`), token (ERC-20 info for `token`, plus the balance of `address` if given), block (`block` number or latest), transaction (`hash`: details, status, fee), call (call a read-only contract function: `address`, `signature` like \"function balanceOf(address) view returns (uint256)\", `args`), gas (current gas price).",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["balance", "token", "block", "transaction", "call", "gas"] },
          address: { type: "string" },
          token: { type: "string" },
          block: { type: "string" },
          hash: { type: "string" },
          signature: { type: "string" },
          args: { type: "array", items: {} },
        },
        required: ["action"],
      },
    },
    chain_simulate: {
      name: "chain_simulate",
      description:
        "Simulate a transaction on the active Robinhood Chain network without sending it: reports success or the revert reason, decoded return data, gas estimate, fee in ETH and whether the sender can afford it. Build calldata from `signature` + `args`, or pass raw `data`.",
      input_schema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Sender address (usually the user's connected wallet)" },
          to: { type: "string" },
          value_eth: { type: "string", description: "ETH to send, e.g. \"0.01\"" },
          signature: { type: "string", description: "e.g. \"function transfer(address to, uint256 amount) returns (bool)\"" },
          args: { type: "array", items: {} },
          data: { type: "string" },
        },
        required: ["from", "to"],
      },
    },
    chain_history: {
      name: "chain_history",
      description:
        "Explorer data (Blockscout) for the active Robinhood Chain network: action=transactions (recent transactions of `address`), token_transfers (recent ERC-20 transfers), source (verified source code of a contract at `address`).",
      input_schema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["transactions", "token_transfers", "source"] },
          address: { type: "string" },
          limit: { type: "number" },
        },
        required: ["action", "address"],
      },
    },
    chain_docs: {
      name: "chain_docs",
      description:
        "Search or read the official Robinhood Chain documentation (docs.robinhood.com/chain). Pass `query` to find relevant pages, or `path` (e.g. /chain/connecting) to read one page. Use it to ground answers about Robinhood Chain itself.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" }, path: { type: "string" } },
      },
    },
    chain_send: {
      name: "chain_send",
      description:
        "Ask the user to review and sign a transaction in their own wallet on the active Robinhood Chain network. ALWAYS run chain_simulate first and explain the result. The user sees `summary`, can sign or reject, and you receive the transaction hash or the rejection. Use `signature` + `args` or raw `data`; amounts in token units must already include decimals.",
      input_schema: {
        type: "object",
        properties: {
          to: { type: "string" },
          value_eth: { type: "string" },
          signature: { type: "string" },
          args: { type: "array", items: {} },
          data: { type: "string" },
          summary: { type: "string", description: "One or two plain-language sentences shown to the user before signing" },
        },
        required: ["to", "summary"],
      },
    },
    swap_quote: {
      name: "swap_quote",
      description:
        "Get the best Uniswap quote (v3 pools, or v4 pools such as Kindle launches) on the active Robinhood Chain network and prepare the exact transactions to sign. Tokens: ETH, WETH or any 0x token address. Returns the expected and minimum output, pool fee, the user's balance, a dry-run, and `steps` — pass each step unchanged to chain_send, in order (approval first, if any).",
      input_schema: {
        type: "object",
        properties: {
          from: { type: "string", description: "The user's connected wallet" },
          token_in: { type: "string", description: "ETH, WETH or a token address" },
          token_out: { type: "string", description: "ETH, WETH or a token address" },
          amount_in: { type: "string", description: "Amount of token_in in normal units, e.g. \"0.005\"" },
          slippage_percent: { type: "number", description: "Default 0.5, max 5" },
        },
        required: ["from", "token_in", "token_out", "amount_in"],
      },
    },
    compile_contract: {
      name: "compile_contract",
      description:
        "Compile a Solidity contract (solc 0.8, EVM cancun). Import OpenZeppelin Contracts v5 with @openzeppelin/contracts/… paths; other imports aren't supported. Returns an artifact_id, the constructor, functions, warnings and — when `from` is given — the estimated deployment fee. Prefer audited OpenZeppelin building blocks and keep contracts minimal.",
      input_schema: {
        type: "object",
        properties: {
          source: { type: "string", description: "Full Solidity source, including the SPDX line and pragma" },
          contract_name: { type: "string", description: "Which contract to deploy, if the file has several" },
          from: { type: "string", description: "The user's wallet, to estimate the deployment fee" },
          constructor_args: { type: "array", items: {}, description: "Constructor arguments, for the fee estimate" },
        },
        required: ["source"],
      },
    },
    deploy_contract: {
      name: "deploy_contract",
      description:
        "Ask the user to deploy a contract compiled with compile_contract from their own wallet on the active Robinhood Chain network. Explain the cost and risks first; suggest Robinhood Chain Testnet for a first try. Returns the transaction hash — then use chain_read action=transaction to get the new contract address.",
      input_schema: {
        type: "object",
        properties: {
          artifact_id: { type: "string" },
          constructor_args: { type: "array", items: {}, description: "Amounts in token units must include decimals" },
          value_eth: { type: "string", description: "Only for payable constructors" },
          summary: { type: "string", description: "One or two plain-language sentences shown to the user before signing" },
        },
        required: ["artifact_id", "summary"],
      },
    },
    save_note: {
      name: "save_note",
      description: "Save a short note (a key finding, number or decision) to the user's notes panel.",
      input_schema: {
        type: "object",
        properties: { title: { type: "string" }, content: { type: "string" } },
        required: ["title", "content"],
      },
    },
  };
  return enabled.filter((n) => n in defs).map((n) => defs[n]);
}

export const SYSTEM_PROMPT = `You are Kindle, a friendly and highly capable AI agent.
Work like a careful professional:
1. Start with one or two sentences stating your plan.
2. Use the available tools whenever they make the answer more accurate (search and read sources for facts, use the calculator for maths). Keep tool inputs minimal.
3. Check results before relying on them. If a tool fails or the user denies it, adapt and continue.
4. Save important intermediate findings with save_note when that tool is available. Check memory for the user's saved preferences at the start when memory is available, and save new lasting preferences there.
   Use MCP tools (from connected servers) when they match the task. Delegate self-contained writing or review sub-tasks with ask_llm when it helps.
5. Finish with a clear, well-structured final answer in Markdown (short headings or bullet points where useful), citing sources you used.
If the goal needs access you don't have (for example a private inbox), say so plainly and do the most useful part you can with what the user provided.
Never invent facts, numbers or sources.
On-chain work (Robinhood Chain tools, or MCP servers such as Tesera): read state before acting, simulate every transaction and explain in plain language what it will do, its cost and its risks. Never ask the user to sign or send anything they did not explicitly ask for, and never try to sign on their behalf.
Swaps: get a quote with swap_quote, explain it, and only on the user's request send its steps with chain_send. Contracts: write minimal code on OpenZeppelin, compile_contract with the user's wallet as \`from\`, explain cost and risks, then deploy_contract; afterwards share the contract address and explorer link.`;

export type Template = { id: string; label: string; goal: string; tools?: ToolName[] };

export const TEMPLATES: Template[] = [
  {
    id: "read-chain",
    label: "Read the chain",
    goal: "Check wallet 0x… on Robinhood Chain: its ETH balance, how many transactions it has sent, the tokens it has received recently and its latest activity. Summarise what this wallet does. (Replace 0x… with an address.)",
    tools: ["chain_read", "chain_docs", "chain_history", "save_note"],
  },
  {
    id: "inspect-contract",
    label: "Inspect a contract",
    goal: "Inspect the contract at 0x… on Robinhood Chain: is it verified on Blockscout, what kind of contract is it (token, NFT, proxy…), its key state (name, symbol, supply, owner where available) and anything risky in its source code. Explain it in plain language.",
    tools: ["chain_read", "chain_docs", "chain_history", "save_note"],
  },
  {
    id: "simulate",
    label: "Simulate & explain",
    goal: "Before I sign anything: simulate sending 0.001 ETH on Robinhood Chain from my connected wallet to 0x…. Tell me in plain language whether it would succeed, what it costs in gas, and any risks. Don't ask me to sign yet.",
    tools: ["chain_read", "chain_docs", "chain_simulate"],
  },
  {
    id: "sign",
    label: "Sign in my wallet",
    goal: "Send 0.001 ETH on Robinhood Chain Testnet to 0x… from my connected wallet. Check my balance, simulate the transfer, explain the cost, then ask me to sign it in my wallet.",
    tools: ["chain_read", "chain_docs", "chain_simulate", "chain_send"],
  },
  {
    id: "explain-tx",
    label: "Explain a transaction",
    goal: "Explain this Robinhood Chain transaction in plain language — who sent what to whom, which contract was called, whether it succeeded and what it cost: 0x… (paste a transaction hash).",
    tools: ["chain_read", "chain_docs", "chain_history"],
  },
  {
    id: "token-check",
    label: "Token check",
    goal: "Look up the token at 0x… on Robinhood Chain: name, symbol, decimals and total supply, and how much of it wallet 0x… holds. Flag anything unusual.",
    tools: ["chain_read", "chain_docs", "save_note"],
  },
  {
    id: "gas",
    label: "Gas & network",
    goal: "What is the current gas price and latest block on Robinhood Chain, and roughly what would a simple ETH transfer and an ERC-20 transfer cost right now in ETH and in USD?",
    tools: ["chain_read", "chain_docs", "calculator"],
  },
  {
    id: "buy-kindle",
    label: "Buy KINDLE",
    goal: "Quote a swap of 0.001 ETH to KINDLE on Robinhood Chain mainnet from my connected wallet. Confirm it's the official $KINDLE contract, then show the rate, the minimum I'd receive, the pool fee and the gas cost. If it looks fine, prepare it for me to sign.",
    tools: ["chain_read", "swap_quote", "chain_send"],
  },
  {
    id: "swap",
    label: "Swap tokens",
    goal: "Quote a swap of 0.001 ETH to the token 0x… on Robinhood Chain from my connected wallet. (Replace 0x… with a token address.) Show the rate, the minimum I'd receive, the pool fee and the gas cost. If it looks fine, prepare it for me to sign.",
    tools: ["chain_read", "swap_quote", "chain_send"],
  },
  {
    id: "deploy-token",
    label: "Deploy a token",
    goal: "Create an ERC-20 token on Robinhood Chain Testnet using OpenZeppelin: name \"Kindle Points\", symbol KPTS, 1,000,000 supply minted to my connected wallet. Compile it, explain the code, the cost and the risks, then let me deploy it from my wallet and give me the contract address.",
    tools: ["chain_read", "compile_contract", "deploy_contract", "save_note"],
  },
];

/** A remote MCP server the agent may use (via Anthropic's MCP connector). */
export type McpServer = { name: string; url: string; token?: string };
export const MCP_NAME = /^[a-zA-Z0-9_-]{1,40}$/;

/** One-click MCP presets shown in the console. URLs come from each provider's dashboard. */
export const MCP_PRESETS: { id: string; name: string; label: string; hint: string; link: string }[] = [
  {
    id: "robinhood",
    name: "robinhood",
    label: "Robinhood Chain MCP",
    hint: "Adds an extra MCP server for Robinhood Chain (chain ID 4663) on top of Kindle's built-in Robinhood Chain tools — for example a read-only server for token or DeFi data. Community servers are unofficial, so prefer read-only ones you trust and never give a server your private key. Paste its https URL (and token, if it needs one).",
    link: "https://docs.robinhood.com/chain",
  },
];

/* ------------------------------------------------------------------ */
/* Tesera-style capabilities, grouped over the underlying tools        */
/* ------------------------------------------------------------------ */
export const CAPABILITIES: { id: string; label: string; hint: string; tools: ToolName[]; options: ToolMode[] }[] = [
  {
    id: "read",
    label: "Read the chain",
    hint: "Balances, blocks, events, contract state and verified contract source on Robinhood Chain.",
    tools: ["chain_read", "chain_docs", "chain_history"],
    options: ["auto", "ask", "off"],
  },
  {
    id: "docs",
    label: "Check the docs",
    hint: "Checks the official Robinhood Chain docs in the same step, so answers are grounded in the chain and the docs.",
    tools: ["chain_docs"],
    options: ["auto", "off"],
  },
  {
    id: "simulate",
    label: "Simulate & explain",
    hint: "Runs transactions against live state and explains them in plain language before you sign.",
    tools: ["chain_simulate"],
    options: ["auto", "off"],
  },
  {
    id: "swap",
    label: "Token swaps",
    hint: "Best Uniswap v3 and v4 quotes on Robinhood Chain, including Kindle tokens, with exact-amount approvals and a dry-run before you sign.",
    tools: ["swap_quote"],
    options: ["auto", "off"],
  },
  {
    id: "build",
    label: "Build & deploy contracts",
    hint: "Writes and compiles Solidity on audited OpenZeppelin code and shows the deployment cost in ETH.",
    tools: ["compile_contract"],
    options: ["auto", "off"],
  },
  {
    id: "sign",
    label: "Self-custody signing",
    hint: "You sign every transaction and deployment in your own wallet, inside the limits below. Kindle never holds keys.",
    tools: ["chain_send", "deploy_contract"],
    options: ["ask", "off"],
  },
];

export const ROADMAP: { label: string; hint: string }[] = [];

/* ------------------------------------------------------------------ */
/* Signing limits (checked in the browser before any wallet prompt)    */
/* ------------------------------------------------------------------ */
export type Limits = {
  spendCapEth: string;
  contracts: string;
  functions: string;
  blockUnlimited: boolean;
  expiryMin: number;
};

export const DEFAULT_LIMITS: Limits = {
  spendCapEth: "0.01",
  contracts: "",
  functions: "",
  blockUnlimited: true,
  expiryMin: 60,
};

export const splitList = (v: string) =>
  v
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export function describeLimits(l: Limits, endsAt: number | null) {
  const parts = [`max ${l.spendCapEth || "0"} ETH per transaction`];
  const c = splitList(l.contracts);
  const f = splitList(l.functions);
  parts.push(c.length ? `only these contracts/recipients: ${c.join(", ")}` : "any recipient");
  if (f.length) parts.push(`only these functions: ${f.join(", ")}`);
  if (l.blockUnlimited) parts.push("no unlimited token approvals");
  if (endsAt) parts.push(`signing session ends ${new Date(endsAt).toISOString()}`);
  return parts.join("; ");
}

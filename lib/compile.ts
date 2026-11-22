import "server-only";
import { createPublicClient, encodeDeployData, formatEther, http, isAddress, type Abi, type AbiFunction, type Hex } from "viem";
import { coerceArgs } from "./abi";
import { NETWORKS, type NetworkId } from "./networks";

// Compiles Solidity on the server with solc-js. OpenZeppelin imports are fetched from the npm CDN.
const OZ_PREFIX = "@openzeppelin/contracts/";
const OZ_CDN = "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@5/";
const MAIN = "Contract.sol";
const MAX_FILES = 80;

export type Artifact = { id: string; name: string; abi: Abi; bytecode: Hex };

type SolcOut = {
  errors?: { severity: string; formattedMessage?: string; message: string }[];
  contracts?: Record<string, Record<string, { abi: Abi; evm?: { bytecode?: { object?: string } } }>>;
};

function importsOf(src: string): string[] {
  const out: string[] = [];
  const re = /\bimport\s+(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']\s*;/g;
  for (const m of src.matchAll(re)) out.push(m[1]);
  return out;
}

function resolvePath(from: string, spec: string) {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return spec;
  const parts = from.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

async function fetchImport(path: string) {
  if (!path.startsWith(OZ_PREFIX)) {
    throw new Error(`Only OpenZeppelin imports (${OZ_PREFIX}…) are supported, not "${path}". Put any other code in the same source.`);
  }
  const res = await fetch(OZ_CDN + path.slice(OZ_PREFIX.length), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Couldn't load ${path} (HTTP ${res.status}). Check the import path for OpenZeppelin Contracts v5.`);
  return res.text();
}

/** Collect the main source and every OpenZeppelin file it imports, recursively. */
async function gatherSources(main: string) {
  const sources: Record<string, { content: string }> = { [MAIN]: { content: main } };
  let queue = importsOf(main).map((s) => {
    if (s.startsWith(".")) throw new Error(`Relative import "${s}" can't be resolved — use @openzeppelin/contracts/… paths or inline the code.`);
    return s;
  });
  while (queue.length) {
    const batch = [...new Set(queue)].filter((p) => !sources[p]);
    queue = [];
    if (Object.keys(sources).length + batch.length > MAX_FILES) throw new Error("Too many imported files.");
    const texts = await Promise.all(batch.map(fetchImport));
    batch.forEach((p, i) => {
      sources[p] = { content: texts[i] };
      for (const spec of importsOf(texts[i])) queue.push(resolvePath(p, spec));
    });
  }
  return sources;
}

const sig = (f: { name?: string; inputs: readonly { type: string; name?: string }[] }) =>
  `${f.name ?? "constructor"}(${f.inputs.map((i) => `${i.type}${i.name ? ` ${i.name}` : ""}`).join(", ")})`;

export async function compileContract(
  input: Record<string, unknown>,
  net: NetworkId,
): Promise<{ content: string; artifact: Artifact }> {
  const source = String(input.source ?? "");
  if (!source.trim()) throw new Error('"source" must be the full Solidity source code.');
  if (source.length > 60_000) throw new Error("The source is too long (60 KB max).");

  const sources = await gatherSources(source);
  const solc = (await import("solc")).default;
  const out = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources,
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun",
          outputSelection: { [MAIN]: { "*": ["abi", "evm.bytecode.object"] } },
        },
      }),
    ),
  ) as SolcOut;

  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) {
    throw new Error(`Compilation failed:\n${errors.slice(0, 5).map((e) => e.formattedMessage ?? e.message).join("\n")}`);
  }
  const warnings = (out.errors ?? []).filter((e) => e.severity === "warning").length;

  const compiled = out.contracts?.[MAIN] ?? {};
  const declared = [...source.matchAll(/^\s*contract\s+([A-Za-z_]\w*)/gm)].map((m) => m[1]);
  const wanted = input.contract_name
    ? [String(input.contract_name)]
    : declared.length
      ? declared.reverse()
      : Object.keys(compiled).reverse();
  const name = wanted.find((c) => (compiled[c]?.evm?.bytecode?.object ?? "").length > 0);
  if (!name) throw new Error(`No deployable contract found${input.contract_name ? ` named ${input.contract_name}` : ""}. Abstract contracts and interfaces can't be deployed.`);

  const abi = compiled[name].abi;
  const bytecode = `0x${compiled[name].evm!.bytecode!.object}` as Hex;
  const artifact: Artifact = { id: `art_${Math.random().toString(36).slice(2, 10)}`, name, abi, bytecode };
  const ctor = abi.find((x) => x.type === "constructor") as Extract<Abi[number], { type: "constructor" }> | undefined;
  const fns = abi.filter((x): x is AbiFunction => x.type === "function").map((f) => sig(f));

  // Optional: estimate the deployment cost for the user's wallet.
  let cost: Record<string, unknown> = { note: "Pass from (and constructor_args) to estimate the deployment fee." };
  const from = String(input.from ?? "");
  if (isAddress(from)) {
    try {
      const args = ctor ? coerceArgs(ctor as unknown as AbiFunction, Array.isArray(input.constructor_args) ? input.constructor_args : []) : [];
      const data = encodeDeployData({ abi, bytecode, args });
      const rpc = net === "robinhood" ? process.env.ROBINHOOD_RPC_URL : process.env.ROBINHOOD_TESTNET_RPC_URL;
      const c = createPublicClient({ transport: http(rpc || NETWORKS[net].rpc, { timeout: 15_000 }) });
      const [gas, price, bal] = await Promise.all([c.estimateGas({ account: from, data }), c.getGasPrice(), c.getBalance({ address: from })]);
      cost = { estimatedGas: gas.toString(), estimatedFeeEth: formatEther(gas * price), walletBalanceEth: formatEther(bal), enoughBalance: bal >= gas * price };
    } catch (e) {
      const err = e as { shortMessage?: string; message?: string };
      cost = { result: "The deployment would fail with these constructor arguments", reason: err.shortMessage ?? err.message ?? "unknown" };
    }
  }

  const content = JSON.stringify(
    {
      compiled: name,
      artifact_id: artifact.id,
      compiler: `solc ${solc.version()} · optimizer 200 runs · EVM cancun`,
      bytecodeBytes: (bytecode.length - 2) / 2,
      constructor: ctor ? sig(ctor) : "constructor() — no arguments",
      functions: fns.slice(0, 40),
      warnings,
      deploymentCost: cost,
      network: NETWORKS[net].name,
      next: "To deploy, call deploy_contract with this artifact_id and the constructor_args, after explaining the cost and risks.",
    },
    null,
    2,
  );
  return { content, artifact };
}

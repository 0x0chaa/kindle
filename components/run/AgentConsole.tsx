"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Hammer,
  Rocket,
  BookOpen,
  Bot,
  ChevronDown,
  Lock,
  Brain,
  Blocks,
  Braces,
  Calculator,
  Check,
  Clock,
  Globe,
  Link2,
  Loader2,
  MessageSquare,
  PenLine,
  Search,
  FlaskConical,
  Wallet,
  NotebookPen,
  Paperclip,
  Plug,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import {
  CAPABILITIES,
  DEFAULT_LIMITS,
  MCP_NAME,
  MCP_PRESETS,
  ROADMAP,
  TEMPLATES,
  TOOLS,
  describeLimits,
  type Limits,
  type McpServer,
  type ToolMode,
  type ToolName,
} from "@/lib/agent-tools";
import { checkDeployLimits, checkLimits } from "@/lib/limits";
import { KINDLE_CA } from "@/lib/token";
import { useApp } from "../Providers";
import { renderMarkdown } from "./markdown";
import { DEFAULT_NETWORK, NETWORKS, type NetworkId } from "@/lib/networks";
import { connectWallet, deployWithWallet, getWallet, sendWithWallet } from "@/lib/wallet";
import { coerceArgs } from "@/lib/abi";
import { encodeDeployData, type Abi, type AbiFunction, type Hex } from "viem";
import { DEMO_SCRIPT } from "./demo";
import { cn, EASE_EXPO } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type Block =
  | { type: "text"; text: string; citations?: { url: string; title?: string }[] }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "server_tool_use"; id: string; name: string; input: { query?: string } }
  | { type: "web_search_tool_result"; tool_use_id: string; content: { url?: string; title?: string }[] | { error_code?: string } }
  | { type: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: string | Block[] | Record<string, unknown>[] };

type CallStatus = "waiting" | "running" | "done" | "error" | "denied";
export type LogItem =
  | { id: string; kind: "goal"; text: string }
  | { id: string; kind: "thought"; text: string }
  | { id: string; kind: "call"; name: string; input: Record<string, unknown>; status: CallStatus; result?: string }
  | { id: string; kind: "search"; query: string; results: { url: string; title: string }[] }
  | { id: string; kind: "server"; name: string; input: unknown; status: "running" | "done" | "error"; result?: string }
  | { id: string; kind: "final"; text: string; sources: { url: string; title: string }[] }
  | { id: string; kind: "error"; text: string };

type Status = "idle" | "running" | "waiting" | "done" | "error" | "stopped";

const ICONS: Record<ToolName, typeof Globe> = {
  web_search: Globe,
  code_execution: Terminal,
  http_request: Braces,
  ask_llm: Bot,
  memory: Brain,
  send_message: MessageSquare,
  chain_read: Blocks,
  chain_simulate: FlaskConical,
  chain_history: Search,
  chain_docs: BookOpen,
  chain_send: PenLine,
  swap_quote: ArrowLeftRight,
  compile_contract: Hammer,
  deploy_contract: Rocket,
  fetch_url: Link2,
  calculator: Calculator,
  get_time: Clock,
  save_note: NotebookPen,
};
const MAX_STEPS = 14;
const MAX_UPLOAD = 8 * 1024 * 1024;

/* ---------- long-term memory (this browser) ---------- */
type Memory = Record<string, { value: string; savedAt: string }>;
function loadMemory(): Memory {
  try {
    return JSON.parse(localStorage.getItem("kindle:memory") || "{}") as Memory;
  } catch {
    return {};
  }
}
function saveMemory(m: Memory) {
  try {
    localStorage.setItem("kindle:memory", JSON.stringify(m));
  } catch {}
}
function runMemory(input: Record<string, unknown>): string {
  const mem = loadMemory();
  const action = String(input.action ?? "list");
  const key = String(input.key ?? "").trim().slice(0, 80);
  if (action === "save") {
    if (!key) throw new Error("A key is required to save a memory.");
    mem[key] = { value: String(input.value ?? "").slice(0, 2000), savedAt: new Date().toISOString() };
    saveMemory(mem);
    return `Saved "${key}".`;
  }
  if (action === "forget") {
    delete mem[key];
    saveMemory(mem);
    return `Forgot "${key}".`;
  }
  const q = String(input.query ?? "").toLowerCase();
  const rows = Object.entries(mem).filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.value.toLowerCase().includes(q));
  return rows.length ? rows.map(([k, v]) => `- ${k}: ${v.value}`).join("\n") : "No saved memories match.";
}

/** Text from a server tool result block (code execution, MCP, …). */
function resultText(b: Record<string, unknown>): string {
  const c = b.content as unknown;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === "object" && x && "text" in x ? String((x as { text: unknown }).text) : JSON.stringify(x))).join("\n");
  if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    if ("stdout" in o || "stderr" in o) return [o.stdout, o.stderr ? `stderr:\n${o.stderr}` : "", o.return_code !== undefined ? `exit ${o.return_code}` : ""].filter(Boolean).join("\n");
    if ("error_code" in o) return `Error: ${o.error_code}`;
    return JSON.stringify(o, null, 2);
  }
  return "";
}

/** Read an attached file into Claude content blocks. */
async function fileToBlocks(f: File): Promise<Record<string, unknown>[]> {
  const b64 = () =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] ?? "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    });
  if (f.type === "application/pdf") {
    return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: await b64() }, title: f.name }];
  }
  if (/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) {
    return [{ type: "image", source: { type: "base64", media_type: f.type === "image/jpg" ? "image/jpeg" : f.type, data: await b64() } }];
  }
  const text = (await f.text()).slice(0, 200_000);
  return [{ type: "text", text: `Attached file "${f.name}":\n\n${text}` }];
}
const uid = () => Math.random().toString(36).slice(2, 10);

/** Shorten long tool results from earlier turns so each request stays within free-tier token limits. */
function compactHistory(msgs: Msg[]): Msg[] {
  const keepFrom = msgs.length - 2;
  return msgs.map((m, i) => {
    if (i >= keepFrom || typeof m.content === "string") return m;
    return {
      ...m,
      content: (m.content as Record<string, unknown>[]).map((b) =>
        b.type === "tool_result" && typeof b.content === "string" && b.content.length > 1500
          ? { ...b, content: `${b.content.slice(0, 1500)}\n…[trimmed]` }
          : b,
      ),
    } as Msg;
  });
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                       */
/* ------------------------------------------------------------------ */
function KindleAvatar({ status }: { status: Status }) {
  const busy = status === "running";
  return (
    <span
      aria-hidden
      className={cn("relative grid size-11 shrink-0 place-items-center rounded-full bg-ink", busy && "animate-[kindle-hop_0.9s_ease-in-out_infinite]")}
    >
      <svg viewBox="0 0 100 100" className="size-7">
        <path d="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z" fill="#ccff00" />
        <circle cx="41" cy="64" r="5" fill="#0b0b0b" />
        <circle cx="59" cy="64" r="5" fill="#0b0b0b" />
        <path d="M44 76q6 6 12 0" fill="none" stroke="#0b0b0b" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "Ready",
  running: "Working…",
  waiting: "Waiting for your approval",
  done: "Done",
  error: "Something went wrong",
  stopped: "Stopped",
};

function StatusPill({ status }: { status: Status }) {
  const dot =
    status === "running"
      ? "bg-coral animate-pulse"
      : status === "waiting"
        ? "bg-[#e0a400] animate-pulse"
        : status === "done"
          ? "bg-[#2fae7f]"
          : status === "error"
            ? "bg-coral"
            : "bg-ink/30";
  return (
    <span role="status" className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-sm">
      <span className={cn("size-2 rounded-full", dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}

function short(v: unknown, n = 140) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/* ------------------------------------------------------------------ */
/* Console                                                            */
/* ------------------------------------------------------------------ */
export function AgentConsole() {
  const params = useSearchParams();
  const { navigate } = useApp();

  const initial = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === params.get("template"));
    return t ?? null;
  }, [params]);

  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [modes, setModes] = useState<Record<ToolName, ToolMode>>(() => {
    const m = Object.fromEntries(TOOLS.map((t) => [t.name, t.defaultMode])) as Record<ToolName, ToolMode>;
    if (initial?.tools) for (const t of TOOLS) m[t.name] = initial.tools.includes(t.name) ? t.defaultMode : "off";
    return m;
  });
  const [log, setLog] = useState<LogItem[]>([]);
  const [notes, setNotes] = useState<{ title: string; content: string }[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [usage, setUsage] = useState({ input: 0, output: 0, steps: 0 });
  const [setup, setSetup] = useState<null | "missing_key" | "access_code">(null);
  const [accessCode, setAccessCode] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [demo, setDemo] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [envMcp, setEnvMcp] = useState<{ name: string; host: string; on: boolean }[]>([]);
  const [userMcp, setUserMcp] = useState<(McpServer & { on: boolean })[]>([]);
  const [mcpForm, setMcpForm] = useState({ name: "", url: "", token: "" });
  const [mcpError, setMcpError] = useState("");
  const [preset, setPreset] = useState<(typeof MCP_PRESETS)[number] | null>(null);
  const mcpUrlRef = useRef<HTMLInputElement>(null);
  const [memCount, setMemCount] = useState(0);
  const [network, setNetwork] = useState<NetworkId>(DEFAULT_NETWORK);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletError, setWalletError] = useState("");
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);
  const [model, setModel] = useState<{ label: string; model: string; serverTools: boolean } | null>(null);
  const [sessionEnds, setSessionEnds] = useState<number | null>(null);
  const setLimit = <K extends keyof Limits>(k: K, v: Limits[K]) => setLimits((l) => ({ ...l, [k]: v }));
  const renewSession = (min = limits.expiryMin) => setSessionEnds(min > 0 ? Date.now() + min * 60_000 : null);

  const msgsRef = useRef<Msg[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const approvals = useRef(new Map<string, (ok: boolean) => void>());
  /** Compiled contracts (ABI + bytecode) kept in the browser; the model only sees their artifact_id. */
  const artifacts = useRef(new Map<string, { name: string; abi: Abi; bytecode: Hex }>());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setAccessCode(localStorage.getItem("kindle:access") ?? "");
      setUserMcp(JSON.parse(localStorage.getItem("kindle:mcp") || "[]"));
    } catch {}
    setMemCount(Object.keys(loadMemory()).length);
    fetch("/api/agent/info")
      .then((r) => r.json())
      .then((d: { label: string; model: string; serverTools: boolean }) => setModel(d))
      .catch(() => {});
    fetch("/api/agent/mcp")
      .then((r) => r.json())
      .then((d: { servers?: { name: string; host: string }[] }) => setEnvMcp((d.servers ?? []).map((x) => ({ ...x, on: true }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const eth = getWallet();
    if (!eth?.on) return;
    const onAcc = (...a: unknown[]) => setWallet(((a[0] as string[]) ?? [])[0] ?? null);
    eth.on("accountsChanged", onAcc);
    return () => eth.removeListener?.("accountsChanged", onAcc);
  }, []);

  useEffect(() => {
    setSessionEnds(Date.now() + DEFAULT_LIMITS.expiryMin * 60_000);
  }, []);

  const doConnect = async () => {
    setWalletError("");
    try {
      setWallet(await connectWallet());
      renewSession();
    } catch (e) {
      setWalletError(e instanceof Error ? e.message : "Couldn't connect the wallet.");
    }
  };

  const persistMcp = (list: (McpServer & { on: boolean })[]) => {
    setUserMcp(list);
    try {
      localStorage.setItem("kindle:mcp", JSON.stringify(list));
    } catch {}
  };

  const addMcp = () => {
    const name = mcpForm.name.trim();
    const url = mcpForm.url.trim();
    if (!MCP_NAME.test(name)) return setMcpError("Use letters, numbers, - or _ for the name.");
    try {
      if (new URL(url).protocol !== "https:") throw new Error();
    } catch {
      return setMcpError("Enter the server's https URL (for example https://example.com/mcp).");
    }
    if ([...userMcp, ...envMcp].some((m) => m.name === name)) return setMcpError("That name is already used.");
    persistMcp([...userMcp, { name, url, token: mcpForm.token.trim() || undefined, on: true }]);
    setMcpForm({ name: "", url: "", token: "" });
    setMcpError("");
    setPreset(null);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log.length]);

  const push = (item: LogItem) => setLog((l) => [...l, item]);
  const patch = (id: string, p: Partial<LogItem>) =>
    setLog((l) => l.map((x) => (x.id === id ? ({ ...x, ...p } as LogItem) : x)));

  const api = useCallback(
    async <T,>(path: string, body: unknown, signal: AbortSignal): Promise<T> => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
        body: JSON.stringify(body),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.message ?? `Request failed (${res.status})`) as Error & { code?: string };
        err.code = data.error;
        throw err;
      }
      return data as T;
    },
    [accessCode],
  );

  const enabledTools = (Object.keys(modes) as ToolName[]).filter((k) => modes[k] !== "off");

  /* ---------------- the agent loop ---------------- */
  const loop = useCallback(async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("running");
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        type StepRes = { content: Block[]; stop_reason: string; usage?: { input_tokens?: number; output_tokens?: number } };
        const body = {
          messages: compactHistory(msgsRef.current),
          tools: enabledTools,
          envMcp: envMcp.filter((m) => m.on).map((m) => m.name),
          network,
          wallet,
          limits: describeLimits(limits, sessionEnds),
          mcp: userMcp.filter((m) => m.on).map(({ name, url, token }) => ({ name, url, token })),
        };
        // Free model tiers have a tokens-per-minute cap: wait the time the provider asks for, then retry.
        let res: StepRes | null = null;
        for (let attempt = 0; !res; attempt++) {
          try {
            res = await api<StepRes>("/api/agent/step", body, ctrl.signal);
          } catch (e) {
            const wait = /try again in\s*(?:(\d+)m)?\s*([\d.]+)s/i.exec(e instanceof Error ? e.message : "");
            if (!wait || attempt >= 3) throw e;
            const secs = Math.min(Number(wait[1] ?? 0) * 60 + Number(wait[2]) + 1, 65);
            const noteId = uid();
            push({ id: noteId, kind: "thought", text: `The free model is busy (rate limit). Retrying automatically in ${Math.ceil(secs)} s…` });
            await new Promise<void>((resolve, reject) => {
              const t = setTimeout(resolve, secs * 1000);
              ctrl.signal.addEventListener("abort", () => (clearTimeout(t), reject(new DOMException("Stopped", "AbortError"))), { once: true });
            });
            setLog((l) => l.filter((x) => x.id !== noteId));
          }
        }
        if (!res) throw new Error("The model didn't answer.");

        msgsRef.current.push({ role: "assistant", content: res.content });
        setUsage((u) => ({
          input: u.input + (res.usage?.input_tokens ?? 0),
          output: u.output + (res.usage?.output_tokens ?? 0),
          steps: u.steps + 1,
        }));

        // render what the model did this turn
        const texts: string[] = [];
        const sources = new Map<string, string>();
        const searchIds = new Map<string, string>();
        for (const b of res.content) {
          if (b.type === "text") {
            const tb = b as Extract<Block, { type: "text" }>;
            texts.push(tb.text);
            tb.citations?.forEach((c) => c.url && sources.set(c.url, c.title ?? c.url));
          } else if (b.type === "server_tool_use" || b.type === "mcp_tool_use") {
            const sb = b as { id: string; name: string; input: Record<string, unknown>; server_name?: string };
            const id = uid();
            searchIds.set(sb.id, id);
            if (sb.name === "web_search") push({ id, kind: "search", query: String(sb.input?.query ?? ""), results: [] });
            else
              push({
                id,
                kind: "server",
                name: b.type === "mcp_tool_use" ? `${sb.server_name ?? "mcp"} · ${sb.name}` : sb.name,
                input: sb.input,
                status: "running",
              });
          } else if (b.type === "web_search_tool_result") {
            const rb = b as Extract<Block, { type: "web_search_tool_result" }>;
            const id = searchIds.get(rb.tool_use_id);
            if (id && Array.isArray(rb.content)) {
              patch(id, {
                results: rb.content.filter((r) => r.url).map((r) => ({ url: r.url!, title: r.title ?? r.url! })),
              } as Partial<LogItem>);
            }
          } else if (typeof b.type === "string" && b.type.endsWith("_tool_result") && "tool_use_id" in b) {
            const rb = b as Record<string, unknown>;
            const id = searchIds.get(String(rb.tool_use_id));
            const inner = rb.content as { type?: string } | undefined;
            const isErr = Boolean(rb.is_error) || /error/.test(String(inner?.type ?? ""));
            if (id) patch(id, { status: isErr ? "error" : "done", result: resultText(rb) } as Partial<LogItem>);
          }
        }

        if (res.stop_reason === "pause_turn") {
          if (texts.join("").trim()) push({ id: uid(), kind: "thought", text: texts.join("\n\n") });
          continue;
        }

        if (res.stop_reason !== "tool_use") {
          push({
            id: uid(),
            kind: "final",
            text: texts.join("\n\n") || "(The agent finished without a written answer.)",
            sources: [...sources].map(([url, title]) => ({ url, title })),
          });
          setStatus("done");
          return;
        }

        if (texts.join("").trim()) push({ id: uid(), kind: "thought", text: texts.join("\n\n") });

        // run the client tool calls, asking for approval where required
        const calls = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
        const results: Record<string, unknown>[] = [];
        const serverCalls: { id: string; name: string; input: Record<string, unknown>; logId: string }[] = [];

        for (const c of calls) {
          const logId = uid();
          const mode = modes[c.name as ToolName] ?? "ask";
          if (c.name === "chain_send" || c.name === "deploy_contract") {
            const violation =
              c.name === "chain_send" ? checkLimits(c.input, limits, sessionEnds) : checkDeployLimits(c.input, limits, sessionEnds);
            if (violation) {
              const msg = `Blocked by the user's signing limits: ${violation}.`;
              push({ id: logId, kind: "call", name: c.name, input: c.input, status: "denied", result: msg });
              results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: msg });
              continue;
            }
          }
          if (c.name === "deploy_contract" && !artifacts.current.has(String(c.input.artifact_id ?? ""))) {
            const msg = "Unknown artifact_id — compile the contract with compile_contract first, then use the artifact_id it returns.";
            push({ id: logId, kind: "call", name: c.name, input: c.input, status: "error", result: msg });
            results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: msg });
            continue;
          }
          push({ id: logId, kind: "call", name: c.name, input: c.input, status: mode === "ask" ? "waiting" : "running" });

          if (mode === "ask") {
            setStatus("waiting");
            const ok = await new Promise<boolean>((resolve) => approvals.current.set(logId, resolve));
            approvals.current.delete(logId);
            if (ctrl.signal.aborted) throw new DOMException("Stopped", "AbortError");
            setStatus("running");
            if (!ok) {
              patch(logId, { status: "denied" } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: "The user denied this action. Continue without it." });
              continue;
            }
            patch(logId, { status: "running" } as Partial<LogItem>);
          }

          if (c.name === "save_note") {
            const n = { title: String(c.input.title ?? "Note"), content: String(c.input.content ?? "") };
            setNotes((ns) => [...ns, n]);
            patch(logId, { status: "done", result: "Saved to notes" } as Partial<LogItem>);
            results.push({ type: "tool_result", tool_use_id: c.id, content: "Saved." });
          } else if (c.name === "chain_send") {
            try {
              if (!wallet) throw new Error("No wallet is connected. Connect a wallet in the Robinhood Chain panel and ask again.");
              const hash = await sendWithWallet(network, wallet, c.input);
              const out = `Sent. Transaction hash: ${hash}\n${NETWORKS[network].explorer}/tx/${hash}`;
              patch(logId, { status: "done", result: out } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, content: out });
            } catch (e) {
              const rejected = (e as { code?: number }).code === 4001;
              const msg = rejected ? "The user rejected the transaction in their wallet." : e instanceof Error ? e.message : "The wallet failed.";
              patch(logId, { status: rejected ? "denied" : "error", result: msg } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: msg });
            }
          } else if (c.name === "deploy_contract") {
            try {
              if (!wallet) throw new Error("No wallet is connected. Connect a wallet in the Robinhood Chain panel and ask again.");
              const art = artifacts.current.get(String(c.input.artifact_id))!;
              const ctor = art.abi.find((x) => x.type === "constructor") as Extract<Abi[number], { type: "constructor" }> | undefined;
              const args = ctor
                ? coerceArgs(ctor as unknown as AbiFunction, Array.isArray(c.input.constructor_args) ? c.input.constructor_args : [])
                : [];
              const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode, args });
              const hash = await deployWithWallet(network, wallet, data, c.input.value_eth ? String(c.input.value_eth) : undefined);
              const out = `Deployment of ${art.name} sent. Transaction hash: ${hash}\n${NETWORKS[network].explorer}/tx/${hash}\nOnce it confirms, chain_read action=transaction shows the new contract address (contractCreated).`;
              patch(logId, { status: "done", result: out } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, content: out });
            } catch (e) {
              const rejected = (e as { code?: number }).code === 4001;
              const msg = rejected ? "The user rejected the deployment in their wallet." : e instanceof Error ? e.message : "The wallet failed.";
              patch(logId, { status: rejected ? "denied" : "error", result: msg } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: msg });
            }
          } else if (c.name === "memory") {
            try {
              const out = runMemory(c.input);
              setMemCount(Object.keys(loadMemory()).length);
              patch(logId, { status: "done", result: out } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, content: out });
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Memory failed.";
              patch(logId, { status: "error", result: msg } as Partial<LogItem>);
              results.push({ type: "tool_result", tool_use_id: c.id, is_error: true, content: msg });
            }
          } else {
            serverCalls.push({ id: c.id, name: c.name, input: c.input, logId });
          }
        }

        if (serverCalls.length) {
          const { results: out } = await api<{
            results: {
              tool_use_id: string;
              content: string;
              is_error?: boolean;
              artifact?: { id: string; name: string; abi: Abi; bytecode: Hex };
            }[];
          }>(
            "/api/agent/tools",
            { calls: serverCalls.map(({ id, name, input }) => ({ id, name, input })), network },
            ctrl.signal,
          );
          for (const { artifact, ...r } of out) {
            if (artifact) artifacts.current.set(artifact.id, { name: artifact.name, abi: artifact.abi, bytecode: artifact.bytecode });
            const sc = serverCalls.find((s) => s.id === r.tool_use_id);
            if (sc) patch(sc.logId, { status: r.is_error ? "error" : "done", result: r.content } as Partial<LogItem>);
            results.push(r);
          }
        }

        msgsRef.current.push({ role: "user", content: results });
      }
      push({ id: uid(), kind: "error", text: `Stopped after ${MAX_STEPS} steps to keep costs in check. Ask a follow-up to continue.` });
      setStatus("done");
    } catch (e) {
      if (ctrl.signal.aborted) {
        setStatus("stopped");
        return;
      }
      const err = e as Error & { code?: string };
      if (err.code === "missing_key" || err.code === "access_code") {
        setSetup(err.code);
        setStatus("idle");
        setLog((l) => l.filter((x) => x.kind !== "goal"));
        msgsRef.current = [];
        return;
      }
      push({ id: uid(), kind: "error", text: err.message || "Something went wrong." });
      setStatus("error");
    }
  }, [api, enabledTools, modes, envMcp, userMcp, network, wallet, limits, sessionEnds]);

  const start = async () => {
    if (!goal.trim() || status === "running" || status === "waiting") return;
    setDemo(false);
    setSetup(null);
    const names = files.map((f) => f.name).join(", ");
    setLog([{ id: uid(), kind: "goal", text: goal.trim() + (names ? `\n\nAttached: ${names}` : "") }]);
    setNotes([]);
    setUsage({ input: 0, output: 0, steps: 0 });
    let content: Msg["content"] = goal.trim();
    if (files.length) {
      try {
        const blocks = (await Promise.all(files.map(fileToBlocks))).flat();
        content = [...blocks, { type: "text", text: goal.trim() }];
      } catch {
        setFileError("Couldn't read one of the files.");
        return;
      }
    }
    msgsRef.current = [{ role: "user", content }];
    void loop();
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files, ...Array.from(list)].slice(0, 6);
    const total = next.reduce((n, f) => n + f.size, 0);
    if (total > MAX_UPLOAD) {
      setFileError("Attachments are limited to 8 MB in total.");
      return;
    }
    setFileError("");
    setFiles(next);
  };

  const ask = () => {
    const q = followUp.trim();
    if (!q || status === "running" || status === "waiting") return;
    setFollowUp("");
    push({ id: uid(), kind: "goal", text: q });
    msgsRef.current.push({ role: "user", content: q });
    void loop();
  };

  const stop = () => {
    abortRef.current?.abort();
    approvals.current.forEach((r) => r(false));
    approvals.current.clear();
    setStatus("stopped");
  };

  const reset = () => {
    stop();
    setLog([]);
    setNotes([]);
    setStatus("idle");
    setDemo(false);
    msgsRef.current = [];
  };

  const playDemo = async () => {
    setSetup(null);
    setDemo(true);
    setLog([]);
    setNotes([]);
    setStatus("running");
    for (const item of DEMO_SCRIPT) {
      await new Promise((r) => setTimeout(r, 900));
      push({ ...item, id: uid() } as LogItem);
    }
    setNotes([{ title: "Budget total", content: "≈ IDR 29.6 million before activities (sample figures)" }]);
    setStatus("done");
  };

  const busy = status === "running" || status === "waiting";

  /* ---------------- render ---------------- */
  return (
    <section data-tone="light" className="relative min-h-[100svh] px-[5vw] pb-24 pt-28 md:pt-32">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
            className="group mb-6 inline-flex min-h-11 items-center gap-2 text-sm opacity-70 hover:opacity-100"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" /> Back to Kindle
          </a>
          <h1 className="display text-[clamp(2.6rem,7vw,6rem)]">Agent console</h1>
          <p className="mt-4 max-w-xl text-lg opacity-75">
            Give Kindle a goal, choose what it may use, and watch it plan, act and report back — live.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <KindleAvatar status={status} />
          <StatusPill status={status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        {/* ---------- setup ---------- */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[28px] border border-ink/10 bg-paper p-5 md:p-6">
            <label htmlFor="goal" className="mb-3 block text-sm font-semibold">
              What should your agent do?
            </label>
            <textarea
              id="goal"
              data-lenis-prevent
              rows={6}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void start();
              }}
              placeholder="Research the best budget e-bikes under $1,500 and give me a comparison table with sources"
              className="w-full resize-y rounded-2xl border border-ink/15 bg-white/70 p-4 text-base leading-relaxed outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {TEMPLATES.filter((t) => t.id !== "buy-kindle" || KINDLE_CA).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setGoal(t.goal);
                    if (t.tools)
                      setModes((m) => {
                        const n = { ...m };
                        for (const tool of TOOLS) n[tool.name] = t.tools!.includes(tool.name) ? (m[tool.name] === "off" ? tool.defaultMode : m[tool.name]) : "off";
                        return n;
                      });
                  }}
                  className="min-h-9 rounded-full border border-ink/15 px-3.5 py-1.5 text-sm transition hover:border-coral hover:bg-coral hover:text-ink"
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-5 border-t border-ink/10 pt-4">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-dashed border-ink/25 px-4 text-sm transition hover:border-coral focus-within:ring-4 focus-within:ring-coral/20">
                <Paperclip className="size-4" /> Attach files
                <input
                  type="file"
                  multiple
                  accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp,.gif,text/*"
                  className="sr-only"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-peach py-1 pl-3 pr-1 text-xs">
                      {f.name}
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles(files.filter((_, j) => j !== i))}
                        className="grid size-6 place-items-center rounded-full hover:bg-ink/10"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fileError && (
                <p role="alert" className="mt-2 text-sm text-[#3d7a00]">
                  {fileError}
                </p>
              )}
              <p className="mt-2 text-xs opacity-60">PDF, images, text, CSV or JSON — up to 8 MB in total.</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-paper p-5 md:p-6">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#3d7a00]" />
              <h2 className="text-sm font-semibold">Tools and guardrails</h2>
            </div>
            <p className="mb-4 text-xs leading-snug opacity-65">
              What Kindle can do on {NETWORKS[network].name}, and the limits it signs within.
            </p>
            <ul className="space-y-3">
              {CAPABILITIES.map((cap) => {
                const Icon = ICONS[cap.tools[0]];
                const current = modes[cap.tools[0]];
                return (
                  <li key={cap.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-peach text-ink">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{cap.label}</p>
                        <p className="text-xs leading-snug opacity-65">{cap.hint}</p>
                      </div>
                    </div>
                    <div role="radiogroup" aria-label={`${cap.label} permission`} className="flex rounded-full bg-peach p-1 text-xs">
                      {cap.options.map((o) => (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={current === o}
                          disabled={busy}
                          onClick={() =>
                            setModes((m) => {
                              const n = { ...m };
                              for (const t of cap.tools) n[t] = o;
                              return n;
                            })
                          }
                          className={cn(
                            "min-h-8 rounded-full px-3 font-semibold capitalize transition",
                            current === o ? "bg-ink text-paper" : "opacity-70 hover:opacity-100",
                          )}
                        >
                          {o === "ask" ? "Ask me" : o}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
              {ROADMAP.map((r) => (
                <li key={r.label} className="flex flex-wrap items-center justify-between gap-3 opacity-60">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-peach text-ink">
                      <Lock className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="text-xs leading-snug opacity-80">{r.hint}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-peach px-3 py-1.5 text-xs font-semibold">Coming soon</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-ink/10 pt-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Lock className="size-4 text-[#3d7a00]" /> Signing limits
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold">
                  Spend cap per transaction (ETH)
                  <input
                    inputMode="decimal"
                    value={limits.spendCapEth}
                    disabled={busy}
                    onChange={(e) => setLimit("spendCapEth", e.target.value.replace(/[^0-9.]/g, ""))}
                    className="mt-1 h-11 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-base font-normal outline-none focus:border-coral"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Session expires after
                  <select
                    value={limits.expiryMin}
                    disabled={busy}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLimit("expiryMin", v);
                      renewSession(v);
                    }}
                    className="mt-1 h-11 w-full rounded-xl border border-ink/15 bg-white/70 px-3 text-base font-normal outline-none focus:border-coral"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={1440}>24 hours</option>
                    <option value={10080}>7 days</option>
                    <option value={0}>No expiry</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-xs font-semibold">
                Allowed contracts and recipients <span className="font-normal opacity-60">— one per line, empty means any</span>
                <textarea
                  rows={2}
                  value={limits.contracts}
                  disabled={busy}
                  onChange={(e) => setLimit("contracts", e.target.value)}
                  placeholder="0x… (one address per line)"
                  data-lenis-prevent
                  className="mt-1 w-full resize-y rounded-xl border border-ink/15 bg-white/70 p-3 font-mono text-sm font-normal outline-none focus:border-coral"
                />
              </label>
              <label className="mt-3 block text-xs font-semibold">
                Allowed functions <span className="font-normal opacity-60">— e.g. transfer, approve; empty means any</span>
                <input
                  value={limits.functions}
                  disabled={busy}
                  onChange={(e) => setLimit("functions", e.target.value)}
                  placeholder="transfer"
                  className="mt-1 h-11 w-full rounded-xl border border-ink/15 bg-white/70 px-3 font-mono text-sm font-normal outline-none focus:border-coral"
                />
              </label>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={limits.blockUnlimited}
                  disabled={busy}
                  onChange={(e) => setLimit("blockUnlimited", e.target.checked)}
                  className="size-5 accent-[#ccff00]"
                />
                Block unlimited token approvals
              </label>
              <p className="mt-2 text-xs opacity-70">
                {sessionEnds
                  ? `Signing session ends at ${new Date(sessionEnds).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. `
                  : "Signing session has no expiry. "}
                <button type="button" onClick={() => renewSession()} className="min-h-8 font-semibold underline underline-offset-2">
                  Renew
                </button>
              </p>
            </div>

            <details className="group mt-5 border-t border-ink/10 pt-4">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-semibold">
                Extra tools
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-4 space-y-3">
              {TOOLS.filter((t) => !t.group).map((t) => {
                const Icon = ICONS[t.name];
                const options: ToolMode[] = t.runs === "anthropic" ? ["auto", "off"] : ["auto", "ask", "off"];
                const claudeOnly = t.runs === "anthropic" && model !== null && !model.serverTools;
                return (
                  <li key={t.name} className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-peach text-ink">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="text-xs leading-snug opacity-65">{t.hint}</p>
                      </div>
                    </div>
                    {claudeOnly ? (
                      <span className="rounded-full bg-peach px-3 py-1.5 text-xs font-semibold opacity-70">Needs Claude API</span>
                    ) : (
                    <div role="radiogroup" aria-label={`${t.label} permission`} className="flex rounded-full bg-peach p-1 text-xs">
                      {options.map((o) => (
                        <button
                          key={o}
                          type="button"
                          role="radio"
                          aria-checked={modes[t.name] === o}
                          disabled={busy}
                          onClick={() => setModes((m) => ({ ...m, [t.name]: o }))}
                          className={cn(
                            "min-h-8 rounded-full px-3 font-semibold capitalize transition",
                            modes[t.name] === o ? "bg-ink text-paper" : "opacity-70 hover:opacity-100",
                          )}
                        >
                          {o === "ask" ? "Ask me" : o}
                        </button>
                      ))}
                    </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/10 pt-4 text-sm">
              <span className="flex items-center gap-2">
                <Brain className="size-4 text-[#3d7a00]" />
                {memCount} saved {memCount === 1 ? "memory" : "memories"}
              </span>
              {memCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    saveMemory({});
                    setMemCount(0);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold hover:bg-peach"
                >
                  <Trash2 className="size-3.5" /> Clear memory
                </button>
              )}
            </div>
            </details>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-paper p-5 md:p-6">
            <div className="mb-1 flex items-center gap-2">
              <Blocks className="size-4 text-[#3d7a00]" />
              <h2 className="text-sm font-semibold">Robinhood Chain</h2>
            </div>
            <p className="mb-4 text-xs leading-snug opacity-65">
              Choose the network and connect the wallet you sign with. Kindle never holds your keys.
            </p>
            <div role="radiogroup" aria-label="Network" className="mb-4 flex w-fit rounded-full bg-peach p-1 text-xs">
              {(Object.keys(NETWORKS) as NetworkId[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={network === n}
                  disabled={busy}
                  onClick={() => setNetwork(n)}
                  className={cn("min-h-8 rounded-full px-3 font-semibold transition", network === n ? "bg-ink text-paper" : "opacity-70 hover:opacity-100")}
                >
                  {NETWORKS[n].short}
                </button>
              ))}
            </div>
            {wallet ? (
              <p className="mb-4 flex items-center gap-2 rounded-2xl bg-mint/30 px-3 py-2 text-sm">
                <Wallet className="size-4 shrink-0" />
                <span className="truncate font-mono text-xs">{wallet}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void doConnect()}
                className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-coral"
              >
                <Wallet className="size-4" /> Connect wallet
              </button>
            )}
            {walletError && (
              <p role="alert" className="mb-3 text-sm text-[#3d7a00]">
                {walletError}
              </p>
            )}
            <p className="mt-4 text-xs leading-snug opacity-60">
              Tip: try the testnet first — free test ETH from the{" "}
              <a href={NETWORKS["robinhood-testnet"].faucet} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                Robinhood Chain Testnet faucets
              </a>
              . Explorer data comes from Blockscout.
            </p>
          </div>

          <div className="rounded-[28px] border border-ink/10 bg-paper p-5 md:p-6">
            <div className="mb-1 flex items-center gap-2">
              <Plug className="size-4 text-[#3d7a00]" />
              <h2 className="text-sm font-semibold">MCP servers</h2>
            </div>
            <p className="mb-4 text-xs leading-snug opacity-65">
              Connect remote MCP servers — your own, or services such as Linear, Notion or GitHub that offer one. Kindle discovers and calls their tools through Anthropic&apos;s MCP connector.
            </p>
            {model && !model.serverTools && (
              <p className="mb-4 rounded-2xl bg-peach p-3 text-xs leading-snug">
                You&apos;re running on {model.label}. MCP servers, web search and the code sandbox need the Claude API (set <code>ANTHROPIC_API_KEY</code>); everything else works.
              </p>
            )}
            <div className="mb-4 flex flex-wrap gap-2">
              {MCP_PRESETS.map((p) => {
                const connected = [...userMcp, ...envMcp].some((m) => m.name === p.name);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={connected}
                    onClick={() => {
                      setPreset(p);
                      setMcpForm({ name: p.name, url: "", token: "" });
                      setMcpError("");
                      setTimeout(() => mcpUrlRef.current?.focus(), 0);
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3.5 text-sm transition hover:border-coral hover:bg-coral hover:text-ink disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-current"
                  >
                    <Plug className="size-3.5" /> {connected ? `${p.label} — connected` : `Connect ${p.label}`}
                  </button>
                );
              })}
            </div>
            {preset && (
              <p className="mb-3 rounded-2xl bg-mint/25 p-3 text-xs leading-relaxed">
                {preset.hint}{" "}
                <a href={preset.link} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                  Robinhood Chain docs
                </a>
              </p>
            )}
            {envMcp.length + userMcp.length === 0 && <p className="mb-3 text-sm opacity-60">No servers connected yet.</p>}
            <ul className="space-y-2">
              {envMcp.map((m, i) => (
                <li key={`env-${m.name}`} className="flex items-center justify-between gap-3 rounded-2xl bg-peach/70 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{m.name}</span> <span className="text-xs opacity-60">{m.host} · from server config</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={m.on}
                    disabled={busy}
                    aria-label={`Use ${m.name}`}
                    onChange={() => setEnvMcp(envMcp.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                    className="size-5 shrink-0 accent-[#ccff00]"
                  />
                </li>
              ))}
              {userMcp.map((m, i) => (
                <li key={`u-${m.name}`} className="flex items-center justify-between gap-3 rounded-2xl bg-peach/70 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{m.name}</span>{" "}
                    <span className="text-xs opacity-60">
                      {(() => {
                        try {
                          return new URL(m.url).host;
                        } catch {
                          return m.url;
                        }
                      })()}
                      {m.token ? " · token" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <input
                      type="checkbox"
                      checked={m.on}
                      disabled={busy}
                      aria-label={`Use ${m.name}`}
                      onChange={() => persistMcp(userMcp.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                      className="size-5 accent-[#ccff00]"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${m.name}`}
                      disabled={busy}
                      onClick={() => persistMcp(userMcp.filter((_, j) => j !== i))}
                      className="grid size-9 place-items-center rounded-full hover:bg-ink/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMcp();
              }}
              className="mt-4 grid gap-2"
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <label className="sr-only" htmlFor="mcp-name">Server name</label>
                <input
                  id="mcp-name"
                  value={mcpForm.name}
                  onChange={(e) => setMcpForm({ ...mcpForm, name: e.target.value })}
                  placeholder="name"
                  className="h-11 rounded-xl border border-ink/15 bg-white/70 px-3 text-base outline-none focus:border-coral"
                />
                <label className="sr-only" htmlFor="mcp-url">Server URL</label>
                <input
                  id="mcp-url"
                  ref={mcpUrlRef}
                  value={mcpForm.url}
                  onChange={(e) => setMcpForm({ ...mcpForm, url: e.target.value })}
                  placeholder="https://example.com/mcp"
                  className="h-11 rounded-xl border border-ink/15 bg-white/70 px-3 text-base outline-none focus:border-coral"
                />
              </div>
              <label className="sr-only" htmlFor="mcp-token">Access token (optional)</label>
              <input
                id="mcp-token"
                type="password"
                value={mcpForm.token}
                onChange={(e) => setMcpForm({ ...mcpForm, token: e.target.value })}
                placeholder="Access token (optional)"
                className="h-11 rounded-xl border border-ink/15 bg-white/70 px-3 text-base outline-none focus:border-coral"
              />
              {mcpError && (
                <p role="alert" className="text-sm text-[#3d7a00]">
                  {mcpError}
                </p>
              )}
              <button type="submit" className="h-11 rounded-xl bg-ink font-semibold text-paper transition hover:bg-coral">
                Add server
              </button>
              <p className="text-xs leading-snug opacity-60">
                Tokens added here stay in this browser and are sent with each run. On a shared deployment, configure servers in <code>MCP_SERVERS</code> instead so tokens never leave the server.
              </p>
            </form>
          </div>

          <div className="flex flex-wrap gap-3">
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-14 items-center gap-2 rounded-full bg-ink px-7 font-semibold text-paper transition hover:bg-coral"
              >
                <Square className="size-4" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                disabled={!goal.trim()}
                className="inline-flex h-14 items-center gap-2 rounded-full bg-coral px-7 font-semibold text-ink transition hover:bg-ink disabled:opacity-50"
              >
                <Play className="size-4" /> Run agent
              </button>
            )}
            {log.length > 0 && !busy && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-14 items-center gap-2 rounded-full border border-ink/20 px-6 font-semibold transition hover:border-ink"
              >
                <RotateCcw className="size-4" /> New run
              </button>
            )}
          </div>
          <p className="text-xs opacity-60">Tip: press Ctrl/⌘ + Enter to run.</p>
        </div>

        {/* ---------- run timeline ---------- */}
        <div className="min-w-0 rounded-[28px] bg-ink p-5 text-paper md:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-paper/10 pb-4">
            <h2 className="font-semibold">Run</h2>
            <span className="font-mono text-xs text-paper/60">
              {model ? `${model.label} · ` : ""}
              {usage.steps} steps · {(usage.input + usage.output).toLocaleString()} tokens
            </span>
          </div>

          {setup && (
            <div className="mb-5 rounded-2xl border border-mint/40 bg-mint/10 p-5 text-sm leading-relaxed">
              {setup === "missing_key" ? (
                <>
                  <p className="mb-2 font-semibold text-mint">Connect a model to run real agents</p>
                  <p className="text-paper/80">
                    Get a free key from{" "}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">
                      Google AI Studio
                    </a>{" "}
                    (or Groq / OpenRouter), add it to <code>.env.local</code> and restart the server:
                  </p>
                  <pre className="my-3 overflow-x-auto rounded-xl bg-black/30 p-3 font-mono text-xs">
                    {"LLM_PROVIDER=gemini\nLLM_API_KEY=your-free-key\n# or use Claude for web search, code sandbox and MCP:\n# ANTHROPIC_API_KEY=sk-ant-...\nAGENT_ACCESS_CODE=choose-a-code"}
                  </pre>
                  <button type="button" onClick={playDemo} className="min-h-11 font-semibold underline underline-offset-4 hover:text-mint">
                    Watch a sample run instead
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      localStorage.setItem("kindle:access", accessCode);
                    } catch {}
                    setSetup(null);
                    void start();
                  }}
                  className="space-y-3"
                >
                  <label htmlFor="code" className="block font-semibold text-mint">
                    This console is protected. Enter the access code:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="code"
                      type="password"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-paper/20 bg-black/20 px-3 text-base text-paper outline-none focus:border-mint"
                    />
                    <button type="submit" className="h-11 rounded-xl bg-mint px-4 font-semibold text-ink">
                      Continue
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {demo && (
            <p className="mb-4 rounded-xl bg-paper/10 px-3 py-2 text-xs text-paper/80">
              Sample run with illustrative figures — no model was called. Add an API key to run your own goals.
            </p>
          )}

          {log.length === 0 && !setup && (
            <div className="grid min-h-[320px] place-items-center text-center">
              <div>
                <p className="display text-3xl">No runs yet</p>
                <p className="mt-2 text-sm text-paper/60">Pick a template or write a goal, then press Run agent.</p>
              </div>
            </div>
          )}

          <ol className="space-y-4" aria-live="polite">
            <AnimatePresence initial={false}>
              {log.map((item) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_EXPO }}
                >
                  {item.kind === "goal" && (
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-coral px-4 py-3 text-ink">
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{item.text}</p>
                    </div>
                  )}

                  {item.kind === "thought" && (
                    <div className="prose-kindle text-[15px] leading-relaxed text-paper/85" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text) }} />
                  )}

                  {item.kind === "search" && (
                    <div className="rounded-2xl border border-paper/10 bg-paper/5 p-4">
                      <p className="flex items-center gap-2 text-sm">
                        <Globe className="size-4 text-mint" /> Searched the web for <strong className="font-semibold">“{item.query}”</strong>
                      </p>
                      {item.results.length > 0 && (
                        <ul className="mt-3 space-y-1.5 text-sm">
                          {item.results.slice(0, 5).map((r) => (
                            <li key={r.url} className="truncate">
                              <a href={r.url} target="_blank" rel="noreferrer" className="text-paper/70 underline-offset-2 hover:text-mint hover:underline">
                                {r.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {item.kind === "server" && (
                    <div className="rounded-2xl border border-paper/10 bg-paper/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-2 text-sm">
                          {item.name.includes("·") ? <Plug className="size-4 shrink-0 text-mint" /> : <Terminal className="size-4 shrink-0 text-mint" />}
                          <span className="font-semibold">
                            {{
                              bash_code_execution: "Code sandbox · shell",
                              text_editor_code_execution: "Code sandbox · files",
                              code_execution: "Code sandbox",
                              web_fetch: "Web fetch",
                            }[item.name] ?? item.name}
                          </span>
                          <code className="truncate font-mono text-xs text-paper/60">{short(item.input, 90)}</code>
                        </p>
                        <span className="flex items-center gap-1.5 text-xs text-paper/70">
                          {item.status === "running" && <Loader2 className="size-3.5 animate-spin" />}
                          {item.status === "done" && <Check className="size-3.5 text-mint" />}
                          {item.status === "error" && <X className="size-3.5 text-[#3d7a00]" />}
                          {{ running: "Running", done: "Done", error: "Failed" }[item.status]}
                        </span>
                      </div>
                      {item.result && (
                        <details className="mt-3 text-xs text-paper/70">
                          <summary className="cursor-pointer select-none">Output</summary>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 font-mono" data-lenis-prevent>
                            {item.result}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  {item.kind === "call" && (
                    <div
                      className={cn(
                        "rounded-2xl border p-4",
                        item.status === "waiting" ? "border-[#e0a400]/60 bg-[#e0a400]/10" : "border-paper/10 bg-paper/5",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="flex min-w-0 items-center gap-2 text-sm">
                          {(() => {
                            const Icon = ICONS[item.name as ToolName] ?? Globe;
                            return <Icon className="size-4 shrink-0 text-mint" />;
                          })()}
                          <span className="font-semibold">{TOOLS.find((t) => t.name === item.name)?.label ?? item.name}</span>
                          <code className="truncate font-mono text-xs text-paper/60">{short(item.input, 90)}</code>
                        </p>
                        <span className="flex items-center gap-1.5 text-xs text-paper/70">
                          {item.status === "running" && <Loader2 className="size-3.5 animate-spin" />}
                          {item.status === "done" && <Check className="size-3.5 text-mint" />}
                          {item.status === "denied" && <X className="size-3.5 text-[#3d7a00]" />}
                          {item.status === "error" && <X className="size-3.5 text-[#3d7a00]" />}
                          {{ waiting: "Needs approval", running: "Running", done: "Done", error: "Failed", denied: "Denied" }[item.status]}
                        </span>
                      </div>
                      {item.name === "deploy_contract" && (
                        <div className="mt-3 rounded-xl bg-black/25 p-3 text-sm">
                          <p className="text-paper/90">{String(item.input.summary ?? "")}</p>
                          <p className="mt-2 font-mono text-xs text-paper/60">
                            {NETWORKS[network].name} · new contract{" "}
                            {artifacts.current.get(String(item.input.artifact_id ?? ""))?.name ?? String(item.input.artifact_id ?? "")}
                            {item.input.value_eth ? ` · ${String(item.input.value_eth)} ETH` : ""}
                          </p>
                        </div>
                      )}
                      {item.name === "chain_send" && (
                        <div className="mt-3 rounded-xl bg-black/25 p-3 text-sm">
                          <p className="text-paper/90">{String(item.input.summary ?? "")}</p>
                          <p className="mt-2 font-mono text-xs text-paper/60">
                            {NETWORKS[network].name} · to {String(item.input.to ?? "")}
                            {item.input.value_eth ? ` · ${String(item.input.value_eth)} ETH` : ""}
                            {item.input.signature ? ` · ${String(item.input.signature).replace(/^function /, "").split(")")[0]})` : ""}
                          </p>
                        </div>
                      )}
                      {item.status === "waiting" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => approvals.current.get(item.id)?.(true)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-mint px-4 text-sm font-semibold text-ink"
                          >
                            {item.name === "chain_send" || item.name === "deploy_contract" ? <PenLine className="size-4" /> : <Check className="size-4" />}
                            {item.name === "chain_send" || item.name === "deploy_contract" ? "Sign in wallet" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => approvals.current.get(item.id)?.(false)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-paper/30 px-4 text-sm font-semibold"
                          >
                            <X className="size-4" /> Deny
                          </button>
                        </div>
                      )}
                      {item.result && (
                        <details className="mt-3 text-xs text-paper/70">
                          <summary className="cursor-pointer select-none">Result</summary>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/25 p-3 font-mono" data-lenis-prevent>
                            {item.result}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  {item.kind === "final" && (
                    <div className="rounded-2xl bg-paper p-5 text-ink md:p-6">
                      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#3d7a00]">
                        <Check className="size-4" /> Result
                      </p>
                      <div className="prose-kindle text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text) }} />
                      {item.sources.length > 0 && (
                        <div className="mt-5 border-t border-ink/10 pt-4">
                          <p className="mb-2 text-xs font-semibold opacity-60">Sources</p>
                          <ul className="flex flex-wrap gap-2">
                            {item.sources.map((s) => (
                              <li key={s.url}>
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block max-w-[260px] truncate rounded-full bg-peach px-3 py-1 text-xs hover:bg-mint"
                                >
                                  {s.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {item.kind === "error" && (
                    <p role="alert" className="rounded-2xl border border-coral/50 bg-coral/10 p-4 text-sm">
                      {item.text}
                    </p>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>

          {busy && status === "running" && (
            <p className="mt-4 flex items-center gap-2 text-sm text-paper/60">
              <Loader2 className="size-4 animate-spin" /> Kindle is thinking…
            </p>
          )}

          {notes.length > 0 && (
            <div className="mt-6 rounded-2xl border border-mint/30 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-mint">
                <NotebookPen className="size-4" /> Notes
              </p>
              <ul className="space-y-2 text-sm">
                {notes.map((n, i) => (
                  <li key={i}>
                    <span className="font-semibold">{n.title}:</span> <span className="text-paper/80">{n.content}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(status === "done" || status === "stopped" || status === "error") && !demo && msgsRef.current.length > 0 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
              className="mt-6 flex gap-2"
            >
              <label htmlFor="follow" className="sr-only">
                Ask a follow-up
              </label>
              <input
                id="follow"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Ask a follow-up or give feedback"
                className="h-12 min-w-0 flex-1 rounded-full border border-paper/20 bg-black/20 px-5 text-base text-paper outline-none placeholder:text-paper/40 focus:border-mint"
              />
              <button type="submit" aria-label="Send follow-up" className="grid size-12 shrink-0 place-items-center rounded-full bg-mint text-ink">
                <Send className="size-4" />
              </button>
            </form>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </section>
  );
}

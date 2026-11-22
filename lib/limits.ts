import { parseEther } from "viem";
import { coerceArgs, fnFromSignature } from "./abi";
import { splitList, type Limits } from "./agent-tools";

/** Returns a reason when a proposed transaction breaks the user's signing limits, else null. */
export function checkLimits(input: Record<string, unknown>, l: Limits, endsAt: number | null): string | null {
  if (endsAt && Date.now() > endsAt) return "the signing session has expired — renew it in Signing limits";

  let value = 0n;
  try {
    value = input.value_eth ? parseEther(String(input.value_eth)) : 0n;
  } catch {
    return `"${String(input.value_eth)}" is not a valid ETH amount`;
  }
  let cap = 0n;
  try {
    cap = parseEther(l.spendCapEth || "0");
  } catch {
    cap = 0n;
  }
  if (value > cap) return `it sends ${String(input.value_eth)} ETH, above your cap of ${l.spendCapEth || "0"} ETH per transaction`;

  const to = String(input.to ?? "").toLowerCase();
  const allowedTo = splitList(l.contracts).map((x) => x.toLowerCase());
  if (allowedTo.length && !allowedTo.includes(to)) return `${input.to} is not in your allowed contracts/recipients`;

  const allowedFns = splitList(l.functions).map((x) => x.toLowerCase());
  let fnName: string | null = null;
  let args: unknown[] = [];
  if (input.signature) {
    try {
      const { fn } = fnFromSignature(String(input.signature));
      fnName = fn.name;
      args = coerceArgs(fn, Array.isArray(input.args) ? input.args : []);
    } catch (e) {
      return e instanceof Error ? e.message : "the function signature is invalid";
    }
  } else if (input.data && String(input.data) !== "0x") {
    if (allowedFns.length || l.blockUnlimited) return "raw calldata can't be checked against your limits — the agent must use a function signature";
  }
  if (allowedFns.length && fnName && !allowedFns.includes(fnName.toLowerCase())) return `${fnName}() is not in your allowed functions`;
  if (allowedFns.length && !fnName && input.data) return "only allowed functions may be called";

  if (l.blockUnlimited && fnName && /^(approve|increaseallowance)$/i.test(fnName)) {
    const amount = args[1];
    if (typeof amount === "bigint" && amount >= 2n ** 255n) return "it grants an unlimited token approval";
  }
  if (l.blockUnlimited && fnName && /^setapprovalforall$/i.test(fnName) && args[1] === true) {
    return "it approves an operator for all of your NFTs";
  }
  return null;
}

/** Limits for a contract deployment: session, ETH sent to the constructor, and the functions allowlist. */
export function checkDeployLimits(input: Record<string, unknown>, l: Limits, endsAt: number | null): string | null {
  if (endsAt && Date.now() > endsAt) return "the signing session has expired — renew it in Signing limits";
  try {
    const value = input.value_eth ? parseEther(String(input.value_eth)) : 0n;
    const cap = parseEther(l.spendCapEth || "0");
    if (value > cap) return `it sends ${String(input.value_eth)} ETH, above your cap of ${l.spendCapEth || "0"} ETH per transaction`;
  } catch {
    return `"${String(input.value_eth)}" is not a valid ETH amount`;
  }
  const allowedFns = splitList(l.functions).map((x) => x.toLowerCase());
  if (allowedFns.length && !allowedFns.includes("deploy")) return 'contract deployments are not in your allowed functions (add "deploy")';
  return null;
}

import { encodeFunctionData, parseAbi, type Abi, type AbiFunction, type Hex } from "viem";

// Shared by the server tools and the in-browser wallet flow.

/** Parse one human-readable function signature, e.g. "function balanceOf(address) view returns (uint256)". */
export function fnFromSignature(signature: string): { abi: Abi; fn: AbiFunction } {
  const sig = signature.trim().startsWith("function ") ? signature.trim() : `function ${signature.trim()}`;
  let abi: Abi;
  try {
    abi = parseAbi([sig]) as Abi;
  } catch {
    throw new Error(`Couldn't parse the function signature "${signature}". Example: function balanceOf(address) view returns (uint256)`);
  }
  const fn = abi.find((x) => x.type === "function") as AbiFunction | undefined;
  if (!fn) throw new Error("The signature must describe a function.");
  return { abi, fn };
}

/** JSON args → viem values (numbers as bigint for int/uint types, recursively for arrays). */
export function coerceArgs(fn: AbiFunction, args: unknown[]): unknown[] {
  const conv = (type: string, v: unknown): unknown => {
    if (type.endsWith("]")) {
      const inner = type.slice(0, type.lastIndexOf("["));
      return (Array.isArray(v) ? v : []).map((x) => conv(inner, x));
    }
    if (/^u?int\d*$/.test(type)) return BigInt(String(v));
    if (type === "bool") return v === true || v === "true";
    return v;
  };
  return fn.inputs.map((inp, i) => conv(inp.type, args[i]));
}

export function buildCalldata(input: Record<string, unknown>): Hex | undefined {
  if (input.data) {
    const d = String(input.data);
    if (!/^0x[0-9a-fA-F]*$/.test(d)) throw new Error('"data" must be 0x-prefixed hex.');
    return d as Hex;
  }
  if (!input.signature) return undefined;
  const { abi, fn } = fnFromSignature(String(input.signature));
  return encodeFunctionData({ abi, functionName: fn.name, args: coerceArgs(fn, Array.isArray(input.args) ? input.args : []) });
}


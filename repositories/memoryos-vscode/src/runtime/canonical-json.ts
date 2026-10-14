import { createHash } from "node:crypto";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort(compareAscii)
      .map((name) => `${JSON.stringify(name)}:${canonicalJson(record[name])}`)
      .join(",")}}`;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("Canonical JSON numbers must be non-negative-zero safe integers.");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  throw new TypeError("Canonical JSON contains a non-JSON value.");
}

export function rawSha256(bytes: Uint8Array | string): string {
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (!DIGEST_PATTERN.test(digest)) throw new Error("Unable to produce a SHA-256 digest.");
  return digest;
}

export function assertDigest(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a lowercase sha256 digest.`);
  }
}

export { compareAscii };

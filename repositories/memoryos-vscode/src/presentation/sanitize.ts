import { Buffer } from "node:buffer";

export const PRESENTATION_TEXT_MAX_BYTES = 512;
export const PRESENTATION_LABEL_MAX_BYTES = 256;

// C0/C1 controls, DEL, bidi overrides/isolates, zero-width direction marks,
// and Unicode line/paragraph separators are unsafe in single-line workbench UI.
const UNSAFE_PRESENTATION_SCALAR = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/gu;

function truncateUtf8(value: string, maximumBytes: number): string {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new RangeError("Presentation byte bound must be a positive safe integer.");
  }
  if (Buffer.byteLength(value, "utf8") <= maximumBytes) return value;

  const suffix = "…";
  const suffixBytes = Buffer.byteLength(suffix, "utf8");
  let retained = "";
  let retainedBytes = 0;
  const target = Math.max(0, maximumBytes - suffixBytes);
  for (const scalar of value) {
    const scalarBytes = Buffer.byteLength(scalar, "utf8");
    if (retainedBytes + scalarBytes > target) break;
    retained += scalar;
    retainedBytes += scalarBytes;
  }
  return retained + (maximumBytes >= suffixBytes ? suffix : "");
}

/**
 * Produce inert, single-line, bounded workbench text. Exact canonical virtual
 * document bytes deliberately do not pass through this presentation helper.
 */
export function sanitizePresentationText(
  value: unknown,
  maximumBytes = PRESENTATION_TEXT_MAX_BYTES,
): string {
  const stringValue = typeof value === "string" ? value : String(value);
  const inert = stringValue.replace(UNSAFE_PRESENTATION_SCALAR, "�");
  return truncateUtf8(inert, maximumBytes);
}

export function sanitizePresentationLabel(value: unknown): string {
  return sanitizePresentationText(value, PRESENTATION_LABEL_MAX_BYTES);
}

export function boundedPresentationJson(value: unknown, maximumBytes = 1_024): string {
  let serialized: string;
  try {
    serialized = JSON.stringify(value) ?? "null";
  } catch {
    serialized = "[unavailable presentation value]";
  }
  return sanitizePresentationText(serialized, maximumBytes);
}

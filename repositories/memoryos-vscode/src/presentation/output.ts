import { Buffer } from "node:buffer";

import type * as vscode from "vscode";

import { sanitizePresentationText } from "./sanitize.js";

export type MemoryOSLogLevel = "info" | "warn" | "error";
export type MemoryOSLogMetadataValue = string | number | boolean | null;

export const MEMORYOS_LOG_ENTRY_MAX_BYTES = 4_096;
export const MEMORYOS_LOG_RETAINED_MAX_BYTES = 262_144;
const MACHINE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function boundedMetadata(
  metadata: Readonly<Record<string, MemoryOSLogMetadataValue>> | undefined,
): string {
  if (metadata === undefined) return "";
  const keys = Object.keys(metadata).sort().slice(0, 16);
  const safe: Record<string, MemoryOSLogMetadataValue> = Object.create(null) as Record<
    string,
    MemoryOSLogMetadataValue
  >;
  for (const key of keys) {
    const safeKey = sanitizePresentationText(key, 64);
    const value = metadata[key];
    safe[safeKey] = typeof value === "string" ? sanitizePresentationText(value, 256) : value ?? null;
  }
  return ` ${JSON.stringify(safe)}`;
}

/** A bounded, non-authoritative operational facade over the single MemoryOS channel. */
export class MemoryOSBoundedOutput implements vscode.Disposable {
  #retainedBytes = 0;
  #disposed = false;

  constructor(readonly channel: vscode.LogOutputChannel) {
    if (channel.name !== "MemoryOS") {
      throw new Error("The MemoryOS log facade requires the MemoryOS LogOutputChannel.");
    }
  }

  write(
    level: MemoryOSLogLevel,
    code: string,
    message: string,
    metadata?: Readonly<Record<string, MemoryOSLogMetadataValue>>,
  ): void {
    if (this.#disposed) return;
    if (!MACHINE_CODE_PATTERN.test(code)) {
      throw new Error("MemoryOS output requires an exact stable ASCII machine code.");
    }
    const line = sanitizePresentationText(
      `[${code}] ${sanitizePresentationText(message, MEMORYOS_LOG_ENTRY_MAX_BYTES / 2)}`
        + boundedMetadata(metadata),
      MEMORYOS_LOG_ENTRY_MAX_BYTES,
    );
    const lineBytes = Buffer.byteLength(`${line}\n`, "utf8");
    if (this.#retainedBytes + lineBytes > MEMORYOS_LOG_RETAINED_MAX_BYTES) {
      this.channel.clear();
      this.#retainedBytes = 0;
    }
    this.channel[level](line);
    this.#retainedBytes += lineBytes;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#retainedBytes = 0;
    this.channel.dispose();
  }
}

import { deflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CONFORMANCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const WORKSPACE_ROOT = resolve(CONFORMANCE_ROOT, "../..");
export const WORKFLOW_PATH = resolve(WORKSPACE_ROOT, ".github/workflows/memoryos-policy-gate.yml");
export const SUPPORT_ACTION_ROOT = resolve(
  WORKSPACE_ROOT,
  ".github/actions/memoryos-policy-gate-workflow-support",
);
export const INVENTORY_PATH = resolve(CONFORMANCE_ROOT, "mo1302-conformance-inventory.json");

const require = createRequire(import.meta.url);

export function loadSupportRuntime() {
  const path = resolve(SUPPORT_ACTION_ROOT, "dist/index.js");
  delete require.cache[require.resolve(path)];
  return require(path);
}

export async function readWorkflow() {
  return readFile(WORKFLOW_PATH, "utf8");
}

export async function readInventory() {
  return JSON.parse(await readFile(INVENTORY_PATH, "utf8"));
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ CRC_TABLE[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

function nameBytes(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
}

function extraField(identifier, data = Buffer.alloc(0)) {
  const field = Buffer.alloc(4 + data.length);
  field.writeUInt16LE(identifier, 0);
  field.writeUInt16LE(data.length, 2);
  data.copy(field, 4);
  return field;
}

export const zipExtra = Object.freeze({
  unix: (data = Buffer.alloc(0)) => extraField(0x000d, data),
  ntfs: (data = Buffer.alloc(0)) => extraField(0x000a, data),
  zip64: (data = Buffer.alloc(0)) => extraField(0x0001, data),
});

export function createZip(entries, options = {}) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const centralName = nameBytes(entry.name);
    const localName = nameBytes(entry.localName ?? entry.name);
    const data = Buffer.from(entry.data ?? "");
    const method = entry.method ?? 0;
    const localMethod = entry.localMethod ?? method;
    const compressed = method === 8 ? deflateRawSync(data) : Buffer.from(data);
    const localCompressed = entry.localData === undefined
      ? compressed
      : Buffer.from(entry.localData);
    const crc = entry.crc ?? crc32(data);
    const dataDescriptor = entry.dataDescriptor === true;
    const flags = entry.flags ?? (0x0800 | (dataDescriptor ? 0x0008 : 0));
    const localFlags = entry.localFlags ?? flags;
    const localCrc = entry.localCrc ?? (dataDescriptor ? 0 : crc);
    const extra = Buffer.from(entry.extra ?? Buffer.alloc(0));
    const localExtra = Buffer.from(entry.localExtra ?? extra);
    const mode = entry.mode ?? (String(entry.name).endsWith("/") ? 0o040755 : 0o100644);
    const externalAttributes = entry.externalAttributes ?? ((mode << 16) >>> 0);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(localFlags, 6);
    local.writeUInt16LE(localMethod, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(localCrc >>> 0, 14);
    local.writeUInt32LE(entry.localCompressedSize ?? (dataDescriptor ? 0 : localCompressed.length), 18);
    local.writeUInt32LE(entry.localUncompressedSize ?? (dataDescriptor ? 0 : data.length), 22);
    local.writeUInt16LE(localName.length, 26);
    local.writeUInt16LE(localExtra.length, 28);
    localParts.push(local, localName, localExtra, localCompressed);
    let descriptorLength = 0;
    if (dataDescriptor) {
      const descriptor = Buffer.alloc(entry.descriptorSignature === false ? 12 : 16);
      let descriptorOffset = 0;
      if (entry.descriptorSignature !== false) {
        descriptor.writeUInt32LE(0x08074b50, 0);
        descriptorOffset = 4;
      }
      descriptor.writeUInt32LE(entry.descriptorCrc ?? crc, descriptorOffset);
      descriptor.writeUInt32LE(entry.descriptorCompressedSize ?? compressed.length, descriptorOffset + 4);
      descriptor.writeUInt32LE(entry.descriptorUncompressedSize ?? data.length, descriptorOffset + 8);
      localParts.push(descriptor);
      descriptorLength = descriptor.length;
    }

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.versionMadeBy ?? 0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(entry.compressedSize ?? compressed.length, 20);
    central.writeUInt32LE(entry.uncompressedSize ?? data.length, 24);
    central.writeUInt16LE(centralName.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(externalAttributes >>> 0, 38);
    central.writeUInt32LE(entry.localHeaderOffset ?? offset, 42);
    centralParts.push(central, centralName, extra);

    offset += local.length + localName.length + localExtra.length + localCompressed.length + descriptorLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(options.diskNumber ?? 0, 4);
  end.writeUInt16LE(options.centralDiskNumber ?? 0, 6);
  end.writeUInt16LE(options.entriesOnDisk ?? entries.length, 8);
  end.writeUInt16LE(options.entryCount ?? entries.length, 10);
  end.writeUInt32LE(options.centralSize ?? centralDirectory.length, 12);
  end.writeUInt32LE(options.centralOffset ?? offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function parseEnvironmentFile(text) {
  const output = {};
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^([^=<>\r\n]+)<<([^\r\n]+)$/u.exec(lines[index]);
    if (match) {
      const values = [];
      index += 1;
      while (index < lines.length && lines[index] !== match[2]) {
        values.push(lines[index]);
        index += 1;
      }
      output[match[1]] = values.join("\n");
      continue;
    }
    const equals = lines[index].indexOf("=");
    if (equals > 0) output[lines[index].slice(0, equals)] = lines[index].slice(equals + 1);
  }
  return output;
}

export function workflowUses(workflow) {
  return [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gmu)].map((match) => match[1]);
}

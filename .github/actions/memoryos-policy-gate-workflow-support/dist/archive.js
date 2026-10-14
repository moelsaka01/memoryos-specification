"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");

const MAX_ARCHIVE_BYTES = 256 * 1024 * 1024;
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_ENTRIES = 1024;
const ALLOWED_FLAGS = 0x080e; // deflate options, data descriptor, UTF-8.

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

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ CRC_TABLE[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

function ensureRange(bytes, offset, length, label) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset + length > bytes.length) {
    throw new Error(`${label} is outside the archive`);
  }
}

function decodeName(raw, flags) {
  if ((flags & 0x0800) === 0 && raw.some((byte) => byte > 0x7f)) {
    throw new Error("non-ASCII archive name lacks the UTF-8 flag");
  }
  let value;
  try {
    value = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new Error("archive name is not strict UTF-8");
  }
  if (value === "" || /[\0-\x1f\x7f\\:]/u.test(value)
      || value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:/u.test(value)) {
    throw new Error("archive path is unsafe");
  }
  const directory = value.endsWith("/");
  const body = directory ? value.slice(0, -1) : value;
  const segments = body.split("/");
  if (body === "" || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("archive path is unsafe");
  }
  const normalized = segments.map((segment) => segment.normalize("NFC")).join("/");
  return { directory, normalized, rawValue: value };
}

function parseExtra(extra) {
  let offset = 0;
  const identifiers = [];
  while (offset < extra.length) {
    if (offset + 4 > extra.length) throw new Error("archive extra field is truncated");
    const identifier = extra.readUInt16LE(offset);
    const length = extra.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + length > extra.length) throw new Error("archive extra field is truncated");
    identifiers.push(identifier);
    offset += length;
  }
  if (identifiers.includes(0x0001)) throw new Error("ZIP64 is unsupported");
  if (identifiers.includes(0x000d) || identifiers.includes(0x756e)) {
    throw new Error("hard-link-capable archive metadata is unsupported");
  }
  return identifiers;
}

function memberType(nameInfo, externalAttributes) {
  const unixMode = externalAttributes >>> 16;
  const unixType = unixMode & 0o170000;
  const dosAttributes = externalAttributes & 0xffff;
  if ((dosAttributes & 0x0400) !== 0) throw new Error("reparse archive member is unsupported");
  if ((dosAttributes & 0x0040) !== 0) throw new Error("device archive member is unsupported");
  if (unixType === 0o120000) throw new Error("symlink archive member is unsupported");
  if (unixType === 0o020000 || unixType === 0o060000) {
    throw new Error("device archive member is unsupported");
  }
  if (unixType === 0o010000) throw new Error("FIFO archive member is unsupported");
  if (unixType === 0o140000) throw new Error("socket archive member is unsupported");
  const isDirectory = unixType === 0o040000 || (unixType === 0 && (dosAttributes & 0x10) !== 0);
  const isRegular = unixType === 0o100000 || unixType === 0;
  if ((!isDirectory && !isRegular) || isDirectory !== nameInfo.directory) {
    throw new Error("unsupported or contradictory archive member type");
  }
  return isDirectory ? "directory" : "file";
}

function findEndRecord(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  throw new Error("ZIP end record is missing");
}

function parseCentralDirectory(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_ARCHIVE_BYTES) {
    throw new Error("archive size is invalid");
  }
  const endOffset = findEndRecord(bytes);
  const diskNumber = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== entryCount) {
    throw new Error("multi-disk ZIP archives are unsupported");
  }
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 is unsupported");
  }
  if (entryCount > MAX_ENTRIES) throw new Error("archive entry count is unsupported");
  ensureRange(bytes, centralOffset, centralSize, "central directory");
  if (centralOffset + centralSize !== endOffset) throw new Error("central directory extent is invalid");

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    ensureRange(bytes, cursor, 46, "central member");
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("central member signature is invalid");
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const diskStart = bytes.readUInt16LE(cursor + 34);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const variableLength = nameLength + extraLength + commentLength;
    ensureRange(bytes, cursor + 46, variableLength, "central member fields");
    if ((flags & ~ALLOWED_FLAGS) !== 0 || (flags & 1) !== 0) throw new Error("encrypted or unsupported ZIP flags");
    if (method !== 0 && method !== 8) throw new Error("unsupported ZIP compression method");
    if (diskStart !== 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff
        || localOffset === 0xffffffff) throw new Error("ZIP64 or multi-disk member is unsupported");
    if (compressedSize > MAX_ENTRY_BYTES || uncompressedSize > MAX_ENTRY_BYTES) {
      throw new Error("archive member is too large");
    }
    const rawName = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const extra = bytes.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength);
    const name = decodeName(rawName, flags);
    parseExtra(extra);
    const type = memberType(name, externalAttributes);
    entries.push({
      compressedSize,
      crc,
      externalAttributes,
      flags,
      index,
      localOffset,
      method,
      name,
      rawName: Buffer.from(rawName),
      type,
      uncompressedSize,
    });
    cursor += 46 + variableLength;
  }
  if (cursor !== endOffset) throw new Error("central directory member count is inconsistent");
  return { centralOffset, entries };
}

function verifyDescriptor(bytes, start, end, entry) {
  const length = end - start;
  let cursor = start;
  if (length === 16) {
    if (bytes.readUInt32LE(cursor) !== 0x08074b50) throw new Error("data descriptor signature is invalid");
    cursor += 4;
  } else if (length !== 12) {
    throw new Error("data descriptor extent is invalid");
  }
  if (bytes.readUInt32LE(cursor) !== entry.crc
      || bytes.readUInt32LE(cursor + 4) !== entry.compressedSize
      || bytes.readUInt32LE(cursor + 8) !== entry.uncompressedSize) {
    throw new Error("data descriptor disagrees with the central directory");
  }
}

function inflateMember(compressed, entry) {
  let body;
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.uncompressedSize) throw new Error("stored member sizes differ");
    body = Buffer.from(compressed);
  } else {
    try {
      body = zlib.inflateRawSync(compressed, { maxOutputLength: entry.uncompressedSize });
    } catch {
      throw new Error("deflated archive member is invalid");
    }
  }
  if (body.length !== entry.uncompressedSize || crc32(body) !== entry.crc) {
    throw new Error("archive member integrity check failed");
  }
  return body;
}

function validateLocalMembers(bytes, parsed) {
  const ordered = [...parsed.entries].sort((left, right) => left.localOffset - right.localOffset);
  const ranges = [];
  for (let position = 0; position < ordered.length; position += 1) {
    const entry = ordered[position];
    const nextBoundary = position + 1 < ordered.length
      ? ordered[position + 1].localOffset
      : parsed.centralOffset;
    ensureRange(bytes, entry.localOffset, 30, "local member");
    if (bytes.readUInt32LE(entry.localOffset) !== 0x04034b50) throw new Error("local member signature is invalid");
    const flags = bytes.readUInt16LE(entry.localOffset + 6);
    const method = bytes.readUInt16LE(entry.localOffset + 8);
    const localCrc = bytes.readUInt32LE(entry.localOffset + 14);
    const localCompressedSize = bytes.readUInt32LE(entry.localOffset + 18);
    const localUncompressedSize = bytes.readUInt32LE(entry.localOffset + 22);
    const nameLength = bytes.readUInt16LE(entry.localOffset + 26);
    const extraLength = bytes.readUInt16LE(entry.localOffset + 28);
    const nameOffset = entry.localOffset + 30;
    ensureRange(bytes, nameOffset, nameLength + extraLength, "local member fields");
    const rawName = bytes.subarray(nameOffset, nameOffset + nameLength);
    const extra = bytes.subarray(nameOffset + nameLength, nameOffset + nameLength + extraLength);
    parseExtra(extra);
    if (flags !== entry.flags || method !== entry.method || !rawName.equals(entry.rawName)) {
      throw new Error("local and central member metadata disagree");
    }
    const descriptor = (entry.flags & 0x0008) !== 0;
    if (!descriptor) {
      if (localCrc !== entry.crc || localCompressedSize !== entry.compressedSize
          || localUncompressedSize !== entry.uncompressedSize) {
        throw new Error("local and central member sizes disagree");
      }
    } else {
      if ((localCrc !== 0 && localCrc !== entry.crc)
          || (localCompressedSize !== 0 && localCompressedSize !== entry.compressedSize)
          || (localUncompressedSize !== 0 && localUncompressedSize !== entry.uncompressedSize)) {
        throw new Error("streamed local metadata disagrees with the central directory");
      }
    }
    const dataStart = nameOffset + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    ensureRange(bytes, dataStart, entry.compressedSize, "member data");
    if (dataEnd > nextBoundary) throw new Error("archive member ranges overlap");
    if (descriptor) verifyDescriptor(bytes, dataEnd, nextBoundary, entry);
    else if (dataEnd !== nextBoundary) throw new Error("archive contains an unindexed local extent");
    entry.compressed = bytes.subarray(dataStart, dataEnd);
    ranges.push([entry.localOffset, nextBoundary]);
  }
  if (ordered.length > 0 && ordered[0].localOffset !== 0) {
    throw new Error("archive contains an unindexed prefix");
  }
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index - 1][1] > ranges[index][0]) throw new Error("archive member ranges overlap");
  }
}

function validateNamesAndTree(entries) {
  const rawNames = new Set();
  const normalizedNames = new Set();
  const caseNames = new Set();
  const files = [];
  const directories = [];
  for (const entry of entries) {
    const rawIdentity = entry.rawName.toString("hex");
    const normalizedIdentity = entry.name.normalized;
    const caseIdentity = normalizedIdentity.toLowerCase();
    if (rawNames.has(rawIdentity)) throw new Error("duplicate archive entry");
    if (normalizedNames.has(normalizedIdentity)) throw new Error("duplicate normalized archive entry");
    if (caseNames.has(caseIdentity)) throw new Error("case-conflicting archive entry");
    rawNames.add(rawIdentity);
    normalizedNames.add(normalizedIdentity);
    caseNames.add(caseIdentity);
    if (entry.type === "file") files.push(entry);
    else directories.push(normalizedIdentity);
  }
  if (files.length !== 1) throw new Error("archive must contain exactly one regular file");
  const leaf = files[0].name.normalized;
  const segments = leaf.split("/");
  const allowedDirectories = new Set();
  for (let index = 1; index < segments.length; index += 1) {
    allowedDirectories.add(segments.slice(0, index).join("/"));
  }
  for (const directory of directories) {
    if (!allowedDirectories.has(directory)) throw new Error("archive contains an unrelated directory");
  }
  return files[0];
}

function validateArchive(bytes) {
  const parsed = parseCentralDirectory(bytes);
  validateLocalMembers(bytes, parsed);
  const file = validateNamesAndTree(parsed.entries);
  for (const entry of parsed.entries) {
    if (entry.type === "directory" && (entry.method !== 0 || entry.compressedSize !== 0
        || entry.uncompressedSize !== 0 || entry.crc !== 0)) {
      throw new Error("directory member contains data");
    }
  }
  const body = inflateMember(file.compressed, file);
  return Object.freeze({
    body: Buffer.from(body),
    path: file.name.normalized,
  });
}

async function extractArchive({ archiveDirectory, artifactRole, workspace }) {
  if (artifactRole !== "candidate" && artifactRole !== "baseline") {
    throw new Error("artifact role is invalid");
  }
  if (typeof archiveDirectory !== "string" || !path.isAbsolute(archiveDirectory)) {
    throw new Error("archive directory is invalid");
  }
  if (typeof workspace !== "string" || !path.isAbsolute(workspace)) throw new Error("workspace is invalid");
  const members = await fsp.readdir(archiveDirectory, { withFileTypes: true });
  if (members.length !== 1 || !members[0].isFile() || members[0].isSymbolicLink()) {
    throw new Error("raw artifact download must contain exactly one regular archive");
  }
  const archivePath = path.join(archiveDirectory, members[0].name);
  const archiveStat = await fsp.lstat(archivePath);
  if (!archiveStat.isFile() || archiveStat.isSymbolicLink() || archiveStat.size > MAX_ARCHIVE_BYTES) {
    throw new Error("raw artifact archive is invalid");
  }
  const archiveBytes = await fsp.readFile(archivePath);
  // No extraction-root write occurs before this complete validation returns.
  const validated = validateArchive(archiveBytes);
  const resolvedWorkspace = path.resolve(workspace);
  const physicalWorkspace = await fsp.realpath(resolvedWorkspace);
  // mkdtemp creates this child atomically; no attacker-controlled fixed parent
  // exists between the checked-out workspace and the private root.
  const root = await fsp.mkdtemp(path.join(resolvedWorkspace, `.memoryos-policy-gate-${artifactRole}-`));
  try {
    await fsp.chmod(root, 0o700);
    const physicalRoot = await fsp.realpath(root);
    if (path.dirname(physicalRoot) !== physicalWorkspace) {
      throw new Error("private extraction root escaped the physical workspace");
    }
    const destination = path.join(root, ...validated.path.split("/"));
    const resolvedDestination = path.resolve(destination);
    if (!resolvedDestination.startsWith(`${path.resolve(root)}${path.sep}`)) {
      throw new Error("extraction destination escaped its private root");
    }
    await fsp.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await fsp.writeFile(destination, validated.body, { flag: "wx", mode: 0o600 });
    const stat = await fsp.lstat(destination);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("private MIP snapshot is invalid");
    const relative = path.relative(resolvedWorkspace, resolvedDestination).split(path.sep).join("/");
    if (relative === "" || relative.startsWith("../") || path.posix.isAbsolute(relative)) {
      throw new Error("private MIP path is invalid");
    }
    return Object.freeze({ mipPath: relative, root, absolutePath: resolvedDestination });
  } catch (error) {
    await fsp.rm(root, { force: true, recursive: true });
    throw error;
  }
}

module.exports = { crc32, extractArchive, parseCentralDirectory, validateArchive };

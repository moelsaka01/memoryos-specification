// MO-1308 history file store (Contract Freeze 1, Stream 2C; sections 9.1-9.5, 10.2, 12).
// The CLI owns all file transport (H06). This module is Node-only by owner risk acceptance (H40):
// no helper process, no PowerShell, no new compiled helper. Every path component is checked with
// lstat (no symlink or junction), the root is compared with its realpath, every new name is created
// exclusively (`wx`), publication is a hard link that never replaces a name, and a handle fstat is
// compared with a path lstat after writing. A concurrent directory swap is detected after the fact,
// not prevented; the store never overwrites existing content and every later read fails closed.
//
// Identities, chains, admission and verification are not defined here: they are the SDK history
// functions (section 13.2), supplied as `engine`. The store reads bytes, hands them to the engine, and
// writes the bytes the engine returns. It uses no timer, clock or randomness (section 9.5, R35).
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";

// Frozen layout and limits (sections 9.1, 12, 14.2). Duplicated here because the CLI consumes only the
// SDK facade (ARCHITECTURE section 5); tests pin these values to the contract module.
export const STORE_LAYOUT = Object.freeze({
  descriptor: "memoryos-history-ledger.json",
  entries: "entries",
  records: "records",
  pending: ".pending",
  entryDigits: 20,
  exportManifest: "memoryos-history-export.json",
  exportComplete: "memoryos-history-export-complete.json",
});
export const STORE_LIMITS = Object.freeze({
  entries: 100_000,
  entryBytes: 16_384,
  descriptorBytes: 1024,
  reported: 1000,
  // Largest member file the store will read for each closed member name (section 7.1).
  memberBytes: Object.freeze({
    "package.mip": 16_777_216,
    "checkpoint.json": 33_554_432,
    "regression-report.json": 16_777_216,
    "memoryos-readiness-result.json": 4_194_304,
    "human-decision.json": 8192,
    "evaluation-identity.json": 49_152,
    "policy-outcome.json": 49_152,
    "memoryos-ci-result.json": 49_152,
    "memoryos-ci-evidence.json": 49_152,
    "memoryos-ci-artifacts.json": 49_152,
    "memoryos-ci-complete.json": 49_152,
  }),
  exportFiles: 400_000,
  stdoutBytes: 4_194_304, // CLI JSON stdout
});
// A read that combines the entry listing with member listings is repeated when an entry was committed while it ran.
// Eight passes: a pass is overtaken only by a writer's commit, so a few suffice for a purge (one tombstone) plus a
// burst of appends, while sustained writing is cut off after at most eight scans with LEDGER_CONFLICT (the caller
// may simply retry). A quiescent ledger is always read in exactly one pass.
export const STORE_SNAPSHOT_ATTEMPTS = 8;
export const STORE_MEMBER_NAMES = Object.freeze(Object.keys(STORE_LIMITS.memberBytes).sort());
// What each CLI append input becomes (section 13.3): a single named member, or a bundle directory.
export const STORE_RECORD_FILE_MEMBER = Object.freeze({
  MIP_PACKAGE: Object.freeze({ name: "package.mip", maxBytes: 16_777_216 }),
  INVESTIGATION_CHECKPOINT: Object.freeze({ name: "checkpoint.json", maxBytes: 33_554_432 }),
  REGRESSION_REPORT: Object.freeze({ name: "regression-report.json", maxBytes: 16_777_216 }),
  READINESS_RESULT: Object.freeze({ name: "memoryos-readiness-result.json", maxBytes: 4_194_304 }),
  HUMAN_DECISION_CLAIM: Object.freeze({ name: "human-decision.json", maxBytes: 8192 }),
});
export const STORE_POLICY_MEMBERS = Object.freeze({ identity: "evaluation-identity.json", outcome: "policy-outcome.json", maxBytes: 4060 });
export const STORE_RUN_MAX = Object.freeze({ files: 6, totalBytes: 49_152 });

const ENTRY_NAME = /^[0-9]{20}\.json$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const before = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

export function createHistoryStore({ engine, fs = nodeFs, platform = process.platform } = {}) {
  if (engine === undefined || engine === null || typeof engine.MemoryOSHistoryError !== "function") {
    throw new TypeError("A history engine is required.");
  }
  const Failure = engine.MemoryOSHistoryError;
  const fail = (code, stage) => { throw new Failure(code, stage); };
  const failIo = (stage = "ACQUISITION") => fail("IO", stage);
  const boundary = (stage = "ACQUISITION") => fail("FILESYSTEM_BOUNDARY", stage);
  const isFailure = (error) => error instanceof Failure;
  // Any unexpected file-system error becomes IO; a store or engine failure keeps its own code.
  const guarded = (stage, action) => {
    try {
      return action();
    } catch (error) {
      if (isFailure(error)) throw error;
      return failIo(stage);
    }
  };
  const ownedBy = (st) => ({ dev: st.dev, ino: st.ino });
  const sameIdentity = (left, right) => left.dev === right.dev && left.ino === right.ino && left.ino !== 0n;
  const join = nodePath.join;
  const lstat = (path) => {
    try {
      return fs.lstatSync(path, { bigint: true });
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  };
  const entryFile = (index) => `${String(index).padStart(STORE_LAYOUT.entryDigits, "0")}.json`;
  const sortNames = (names) => [...names].sort(before);

  // ---- Path boundary: lstat every component, then realpath equality (section 9.4) ----

  function checkComponents(absolute, leaf, stage) {
    const parsed = nodePath.parse(absolute);
    const parts = absolute.slice(parsed.root.length).split(nodePath.sep).filter((part) => part.length > 0);
    let current = parsed.root;
    for (let index = 0; index < parts.length; index += 1) {
      current = join(current, parts[index]);
      const last = index === parts.length - 1;
      const st = lstat(current);
      if (st === null) {
        if (last && leaf === "absent") return;
        if (last && leaf === "required") fail("LEDGER_NOT_FOUND", stage);
        return boundary(stage); // also an "existing" parent or ancestor that is missing
      }
      if (st.isSymbolicLink() || !st.isDirectory()) return boundary(stage);
      if (last && leaf === "absent") fail("LEDGER_EXISTS", stage);
    }
    if (parts.length === 0 && leaf === "absent") fail("LEDGER_EXISTS", stage);
  }

  function canonicalRoot(absolute, stage) {
    const real = guarded(stage, () => fs.realpathSync.native(absolute));
    const same = platform === "win32" ? real.toLowerCase() === absolute.toLowerCase() : real === absolute;
    if (!same) boundary(stage);
    return real;
  }
  // After a write or a link: the directory that received it must still be its own canonical path. A swap
  // of a directory for a link during the operation is detected here, after the fact (section 9.4).
  const assertCanonical = (directory, stage) => canonicalRoot(directory, stage);

  function openRoot(path, leaf, stage = "ACQUISITION") {
    if (typeof path !== "string" || path.length === 0 || path.includes("\0")) fail("USAGE", "USAGE");
    const absolute = nodePath.resolve(path);
    guarded(stage, () => checkComponents(absolute, leaf, stage));
    return leaf === "absent" ? absolute : canonicalRoot(absolute, stage);
  }

  // The parent of a new location must be an existing real directory.
  function openParent(path, stage) {
    if (typeof path !== "string" || path.length === 0 || path.includes("\0")) fail("USAGE", "USAGE");
    const absolute = nodePath.resolve(path);
    const parent = nodePath.dirname(absolute);
    if (parent === absolute) boundary(stage);
    guarded(stage, () => checkComponents(parent, "existing", stage));
    guarded(stage, () => checkComponents(absolute, "absent", stage));
    return { parent: canonicalRoot(parent, stage), name: nodePath.basename(absolute) };
  }

  // A location equal to or below `root` by spelling. `nodePath.relative` is case-insensitive on Windows and returns
  // an absolute path across drives, which is never inside.
  function insideOrEqual(root, candidate) {
    const rel = nodePath.relative(root, candidate);
    if (rel === "") return true;
    return rel !== ".." && !rel.startsWith(`..${nodePath.sep}`) && !nodePath.isAbsolute(rel);
  }

  // A location equal to or below the ledger by file identity: `candidate` or any ancestor of it (existing or not)
  // is the ledger root. This catches a spelling the lexical test cannot (another drive-letter, UNC or case form of
  // the same directory). A path that cannot be examined is not a match here; the boundary checks that follow
  // refuse it exactly as before.
  function withinLedger(rootIdentity, candidate) {
    for (let current = candidate; ;) {
      let st = null;
      try {
        st = fs.statSync(current, { bigint: true });
      } catch {
        st = null;
      }
      if (st !== null && sameIdentity(ownedBy(st), rootIdentity)) return true;
      const parent = nodePath.dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  }

  // ---- Reading: lstat, then handle fstat identity, then the bytes (sections 9.2, 11.1) ----

  const NO_FOLLOW = fs.constants?.O_NOFOLLOW ?? 0;
  function readFileBytes(path, maxBytes, stage = "ACQUISITION") {
    return guarded(stage, () => {
      const before = lstat(path);
      if (before === null) return failIo(stage);
      if (before.isSymbolicLink() || !before.isFile()) return boundary(stage);
      if (before.size > BigInt(maxBytes)) return fail("RESOURCE_LIMIT", stage);
      const fd = fs.openSync(path, fs.constants.O_RDONLY | NO_FOLLOW);
      try {
        const handle = fs.fstatSync(fd, { bigint: true });
        if (!handle.isFile() || !sameIdentity(ownedBy(handle), ownedBy(before)) || handle.size !== before.size) return boundary(stage);
        const size = Number(handle.size);
        const bytes = new Uint8Array(size);
        let offset = 0;
        while (offset < size) {
          const read = fs.readSync(fd, bytes, offset, size - offset, offset);
          if (read === 0) return failIo(stage);
          offset += read;
        }
        const after = lstat(path);
        if (after === null || after.isSymbolicLink() || !sameIdentity(ownedBy(after), ownedBy(handle))) return boundary(stage);
        return bytes;
      } finally {
        fs.closeSync(fd);
      }
    });
  }

  function listDirectory(path, stage = "ACQUISITION") {
    return guarded(stage, () => {
      const st = lstat(path);
      if (st === null) return null;
      if (st.isSymbolicLink() || !st.isDirectory()) return boundary(stage);
      return sortNames(fs.readdirSync(path));
    });
  }

  const regularFile = (path, stage) => {
    const st = guarded(stage, () => lstat(path));
    if (st === null) return failIo(stage);
    if (st.isSymbolicLink() || !st.isFile()) return boundary(stage);
    return st;
  };

  // ---- Reading a whole ledger (sections 9.1, 11.1) ----

  // One pass over the ledger. `seen.entryNames` records the entry listing this pass is based on, as soon as it exists.
  function readLedgerOnce(root, { members }, seen) {
    const top = listDirectory(root);
    const names = new Set([STORE_LAYOUT.descriptor, STORE_LAYOUT.entries, STORE_LAYOUT.records, STORE_LAYOUT.pending]);
    if (top === null || !top.includes(STORE_LAYOUT.descriptor)) fail("LEDGER_NOT_FOUND", "ACQUISITION");
    if (top.some((name) => !names.has(name))) fail("LEDGER_CORRUPT", "VERIFICATION"); // an extra file
    regularFile(join(root, STORE_LAYOUT.descriptor), "ACQUISITION");
    const descriptorBytes = readFileBytes(join(root, STORE_LAYOUT.descriptor), STORE_LIMITS.descriptorBytes);

    const entryNames = listDirectory(join(root, STORE_LAYOUT.entries)) ?? [];
    seen.entryNames = entryNames;
    if (entryNames.length > STORE_LIMITS.entries) fail("RESOURCE_LIMIT", "VERIFICATION");
    entryNames.forEach((name, index) => {
      if (!ENTRY_NAME.test(name) || name !== entryFile(index)) fail("LEDGER_CORRUPT", "VERIFICATION"); // gap, extra or foreign file
    });
    const entries = entryNames.map((name) => readFileBytes(join(root, STORE_LAYOUT.entries, name), STORE_LIMITS.entryBytes));

    const memberMap = new Map();
    if (members) {
      for (const hex of listDirectory(join(root, STORE_LAYOUT.records)) ?? []) {
        if (!HEX64.test(hex)) fail("LEDGER_CORRUPT", "VERIFICATION");
        const files = listDirectory(join(root, STORE_LAYOUT.records, hex)) ?? [];
        if (files.length === 0) continue; // a purged record's emptied directory
        const read = [];
        for (const name of files) {
          if (!Object.hasOwn(STORE_LIMITS.memberBytes, name)) fail("LEDGER_CORRUPT", "VERIFICATION");
          const path = join(root, STORE_LAYOUT.records, hex, name);
          try {
            read.push({ name, bytes: readFileBytes(path, STORE_LIMITS.memberBytes[name]) });
          } catch (error) {
            // A member that vanished between the directory listing and its read is absent, exactly as if it had
            // been listed a moment later (a purge deletes members). The engine decides what an absent member
            // means: a retained record's missing member is RECORD_BYTES_MISMATCH on a stable snapshot.
            if (!(isFailure(error) && error.code === "MO1308_IO" && guarded("ACQUISITION", () => lstat(path)) === null)) throw error;
          }
        }
        if (read.length > 0) memberMap.set(`sha256:${hex}`, read);
      }
    }
    const pending = listDirectory(join(root, STORE_LAYOUT.pending)) ?? [];
    return { descriptorBytes, entries, members: memberMap, pendingArtifacts: pending.length };
  }

  // A consistent snapshot (section 10.2 purge ordering): the entry listing, the member listings and the entry
  // listing again. Entries are only ever added, so an unchanged listing means no entry was committed during the
  // read, and a purge (which follows its tombstone entry) cannot have completed unseen. A pass whose listing
  // changed, including one that failed part-way, is discarded and repeated from the start. Anything observed on
  // a stable listing is reported exactly as it was found. When every pass is overtaken by a writer the read
  // fails with LEDGER_CONFLICT (a concurrency error, exit category 4), never with an integrity-class code.
  function readLedger(root, options) {
    for (let attempt = 0; attempt < STORE_SNAPSHOT_ATTEMPTS; attempt += 1) {
      const seen = { entryNames: null };
      let state = null;
      let failure = null;
      try {
        state = readLedgerOnce(root, options, seen);
      } catch (error) {
        if (seen.entryNames === null) throw error; // before the entry listing: nothing here can be a race
        failure = error;
      }
      const again = listDirectory(join(root, STORE_LAYOUT.entries)) ?? [];
      const stable = again.length === seen.entryNames.length && again.every((name, index) => name === seen.entryNames[index]);
      if (stable) {
        if (failure !== null) throw failure;
        return state;
      }
    }
    return fail("LEDGER_CONFLICT", "ACQUISITION");
  }

  const verifyLedger = (state) => engine.verifyHistoryLedger({
    descriptorBytes: state.descriptorBytes, entries: state.entries, members: state.members,
  });
  // Staging files are a filesystem fact only the store sees (section 11.1 anomalies).
  const withPending = (verification, count) => Object.freeze({ ...verification, pendingArtifacts: count });

  // ---- Writing: exclusive create, flush, identity check, re-read (sections 9.2, 9.4) ----

  // Returns the new file's identity, or null when `skipExisting` is set and the name already exists.
  function writeFileExclusive(path, bytes, stage = "PUBLICATION", skipExisting = false) {
    return guarded(stage, () => {
      // A link already at the name (planted: an exclusive create follows a dangling link on Windows and would create its target) is refused
      // before any create. A swap after this check remains the H40-accepted, detected-after-the-fact case.
      const planted = lstat(path);
      if (planted !== null && planted.isSymbolicLink()) return boundary(stage);
      let fd;
      try {
        fd = fs.openSync(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | NO_FOLLOW, 0o644);
      } catch (error) {
        if (skipExisting && error?.code === "EEXIST") return null;
        throw error;
      }
      let handle;
      try {
        let offset = 0;
        while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset, bytes.length - offset);
        fs.fsyncSync(fd);
        handle = fs.fstatSync(fd, { bigint: true });
      } finally {
        fs.closeSync(fd);
      }
      const named = lstat(path);
      if (named === null || named.isSymbolicLink() || !named.isFile() || !sameIdentity(ownedBy(named), ownedBy(handle))
          || handle.size !== BigInt(bytes.length)) return boundary(stage);
      const again = readFileBytes(path, bytes.length, stage);
      if (again.length !== bytes.length || again.some((byte, index) => byte !== bytes[index])) return failIo(stage);
      assertCanonical(nodePath.dirname(path), stage);
      return ownedBy(named);
    });
  }

  function ensureDirectory(path, stage = "PUBLICATION") {
    return guarded(stage, () => {
      try {
        fs.mkdirSync(path);
        return;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
      const st = lstat(path);
      if (st === null || st.isSymbolicLink() || !st.isDirectory()) boundary(stage);
    });
  }

  // A staging name that cannot collide with a leftover: role plus the first free counter.
  function stageFile(root, role, bytes) {
    ensureDirectory(join(root, STORE_LAYOUT.pending));
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const path = join(root, STORE_LAYOUT.pending, `${role}.${attempt}`);
      const identity = writeFileExclusive(path, bytes, "PUBLICATION", true);
      if (identity !== null) return { path, identity };
      // The name existed before this attempt: try the next free one.
    }
    return failIo("PUBLICATION");
  }

  const bytesEqual = (left, right) => left.length === right.length && left.every((byte, index) => byte === right[index]);

  // Hard-link a staged file to its final name. A hard link never replaces an existing name.
  // Returns false when the name already existed.
  function publish(staged, finalPath, stageName = "PUBLICATION") {
    let linked = false;
    guarded(stageName, () => {
      try {
        fs.linkSync(staged.path, finalPath);
        linked = true;
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
      }
    });
    if (!linked) return false;
    const named = guarded(stageName, () => lstat(finalPath));
    if (named === null || named.isSymbolicLink() || !named.isFile() || !sameIdentity(ownedBy(named), staged.identity)) boundary(stageName);
    assertCanonical(nodePath.dirname(finalPath), stageName);
    return true;
  }
  // Best effort: a leftover staging name is a disclosed anomaly, never history.
  function discard(staged) {
    try { fs.unlinkSync(staged.path); } catch { /* reported by verify as a pending artifact */ }
  }

  // ---- init (section 13.3) ----

  function init(ledgerPath, { ledgerName, workspaceIdentifier }) {
    const created = engine.createHistoryLedger({ ledgerName, workspaceIdentifier });
    const { parent, name } = openParent(ledgerPath, "PUBLICATION");
    const root = join(parent, name);
    guarded("PUBLICATION", () => {
      try {
        fs.mkdirSync(root);
      } catch (error) {
        if (error?.code === "EEXIST") fail("LEDGER_EXISTS", "PUBLICATION");
        throw error;
      }
    });
    for (const directory of [STORE_LAYOUT.entries, STORE_LAYOUT.records, STORE_LAYOUT.pending]) ensureDirectory(join(root, directory));
    // The descriptor is created once and never changed; its link is the creation commit.
    const staged = stageFile(root, "descriptor", created.descriptorBytes);
    if (!publish(staged, join(root, STORE_LAYOUT.descriptor))) fail("LEDGER_EXISTS", "PUBLICATION");
    discard(staged);
    return Object.freeze({ ledgerIdentifier: created.ledgerIdentifier });
  }

  // ---- verify, query (read-only) ----

  function verify(ledgerPath) {
    const root = openRoot(ledgerPath, "required");
    const state = readLedger(root, { members: true });
    return withPending(verifyLedger(state), state.pendingArtifacts);
  }

  function query(ledgerPath, queryValue) {
    const root = openRoot(ledgerPath, "required");
    const state = readLedger(root, { members: false }); // a query verifies the chain, not member bytes (section 11.2)
    return engine.queryHistoryLedger({ descriptorBytes: state.descriptorBytes, entries: state.entries, query: queryValue });
  }

  // ---- append (section 9.2) ----

  function publishMember(root, hex, name, bytes) {
    const directory = join(root, STORE_LAYOUT.records, hex);
    ensureDirectory(join(root, STORE_LAYOUT.records));
    ensureDirectory(directory);
    const finalPath = join(directory, name);
    const sameBytes = () => {
      // An existing name is read at its own member limit: different bytes there are corruption, not a size error.
      const existing = readFileBytes(finalPath, STORE_LIMITS.memberBytes[name]);
      if (!bytesEqual(existing, bytes)) fail("RECORD_BYTES_MISMATCH", "PUBLICATION");
    };
    if (guarded("PUBLICATION", () => lstat(finalPath)) !== null) return sameBytes(); // an identical member is accepted after a byte comparison
    const staged = stageFile(root, `member-${hex}-${name}`, bytes);
    if (!publish(staged, finalPath)) sameBytes();
    discard(staged);
  }

  function append(ledgerPath, { recordKind, members }) {
    const root = openRoot(ledgerPath, "required");
    const state = readLedger(root, { members: true });
    const ledger = verifyLedger(state); // 1. read and verify the whole chain
    const admission = engine.admitHistoryRecord({ recordKind, members, ledger }); // 2. admit and build entry n
    const built = engine.appendHistoryEntry({ ledger, admission });
    if (built.index !== state.entries.length) fail("INTERNAL", "INTERNAL");
    const record = JSON.parse(new TextDecoder().decode(built.entryBytes)).record;
    const hex = record.recordDigest.slice("sha256:".length);
    if (!HEX64.test(hex)) fail("INTERNAL", "INTERNAL");
    const byName = new Map(members.map((member) => [member.name, member.bytes]));
    openRoot(ledgerPath, "required", "PUBLICATION"); // the boundary is re-checked before anything is published
    for (const member of record.members) { // 3. members, one by one
      const bytes = byName.get(member.name);
      if (bytes === undefined) fail("INTERNAL", "INTERNAL");
      publishMember(root, hex, member.name, bytes);
    }
    openRoot(ledgerPath, "required", "PUBLICATION");
    const staged = stageFile(root, `entry-${String(built.index).padStart(STORE_LAYOUT.entryDigits, "0")}`, built.entryBytes); // 4. the commit point
    if (!publish(staged, join(root, STORE_LAYOUT.entries, entryFile(built.index)))) {
      discard(staged);
      fail("LEDGER_CONFLICT", "PUBLICATION"); // nothing is published
    }
    discard(staged); // 5.
    return Object.freeze({ index: built.index, entryDigest: built.entryDigest });
  }

  // ---- tombstone and purge (section 10.2) ----

  const parseEntry = (bytes) => JSON.parse(new TextDecoder().decode(bytes));

  function purgeMembers(root, target) {
    const hex = target.record.recordDigest.slice("sha256:".length);
    const directory = join(root, STORE_LAYOUT.records, hex);
    for (const member of target.record.members) {
      const path = join(directory, member.name);
      const st = guarded("PUBLICATION", () => lstat(path));
      if (st === null) continue;
      if (st.isSymbolicLink() || !st.isFile()) boundary("PUBLICATION");
      guarded("PUBLICATION", () => fs.unlinkSync(path));
    }
    // Removing the emptied directory is cosmetic and best effort: the purge is complete once every member is gone,
    // and an empty record directory is neither a record nor an anomaly.
    const left = listDirectory(directory, "PUBLICATION");
    if (left !== null && left.length === 0) {
      try { fs.rmdirSync(directory); } catch { /* an empty directory is harmless */ }
    }
  }

  function tombstone(ledgerPath, { targetIndex, reason, authorityReference }) {
    const root = openRoot(ledgerPath, "required");
    const state = readLedger(root, { members: true });
    const ledger = verifyLedger(state);
    const target = state.entries[targetIndex] === undefined ? null : parseEntry(state.entries[targetIndex]);
    if (target === null) fail("TOMBSTONE_INVALID", "ADMISSION");
    if (ledger.purgePending.includes(targetIndex)) {
      // Re-running the same command finishes an interrupted purge without a new entry.
      const committed = state.entries.map(parseEntry)
        .find((entry) => entry.entryType === "TOMBSTONE" && entry.tombstone.targetIndex === targetIndex);
      if (committed === undefined || committed.tombstone.reason !== reason
          || committed.tombstone.authorityReference !== authorityReference) fail("TOMBSTONE_INVALID", "ADMISSION");
      purgeMembers(root, target);
      return Object.freeze({ index: committed.index, entryDigest: committed.entryDigest });
    }
    const built = engine.tombstoneHistoryEntry({ ledger, targetIndex, reason, authorityReference });
    if (built.index !== state.entries.length) fail("INTERNAL", "INTERNAL");
    openRoot(ledgerPath, "required", "PUBLICATION");
    const staged = stageFile(root, `entry-${String(built.index).padStart(STORE_LAYOUT.entryDigits, "0")}`, built.entryBytes);
    if (!publish(staged, join(root, STORE_LAYOUT.entries, entryFile(built.index)))) { // the tombstone entry is committed first
      discard(staged);
      fail("LEDGER_CONFLICT", "PUBLICATION");
    }
    discard(staged);
    purgeMembers(root, target); // then every member of the target record is deleted
    return Object.freeze({ index: built.index, entryDigest: built.entryDigest });
  }

  // ---- export, verify-export (section 12) ----

  function exportLedger(ledgerPath, outputPath) {
    const root = openRoot(ledgerPath, "required");
    // An export is never written into the ledger it is made from (root, entries/, records/, .pending/, or any
    // spelling that resolves there, such as `..`): checked before anything is read or created, by spelling and by
    // file identity. Links and junctions are refused separately by openParent.
    if (typeof outputPath !== "string" || outputPath.length === 0 || outputPath.includes("\0")) fail("USAGE", "USAGE");
    const absoluteOutput = nodePath.resolve(outputPath);
    const rootIdentity = ownedBy(guarded("ACQUISITION", () => fs.statSync(root, { bigint: true })));
    if (insideOrEqual(root, absoluteOutput) || withinLedger(rootIdentity, absoluteOutput)) boundary("PUBLICATION");
    const state = readLedger(root, { members: true });
    const ledger = verifyLedger(state);
    const built = engine.buildHistoryExport({ descriptorBytes: state.descriptorBytes, entries: state.entries, members: state.members });
    const { parent, name } = openParent(outputPath, "PUBLICATION");
    const output = join(parent, name);
    guarded("PUBLICATION", () => {
      try {
        fs.mkdirSync(output);
      } catch (error) {
        if (error?.code === "EEXIST") fail("LEDGER_EXISTS", "PUBLICATION");
        throw error;
      }
    });
    // The completion marker is the commit point and is created last.
    const files = built.files.filter((file) => file.path !== STORE_LAYOUT.exportComplete);
    const marker = built.files.find((file) => file.path === STORE_LAYOUT.exportComplete);
    if (marker === undefined) fail("INTERNAL", "INTERNAL");
    for (const file of [...files, marker]) {
      const segments = file.path.split("/");
      let directory = output;
      for (const segment of segments.slice(0, -1)) {
        directory = join(directory, segment);
        ensureDirectory(directory);
      }
      writeFileExclusive(join(directory, segments.at(-1)), file.bytes);
    }
    return Object.freeze({ ledgerIdentifier: ledger.ledgerIdentifier, entryCount: ledger.entryCount, headDigest: ledger.headDigest });
  }

  function verifyExport(exportPath) {
    const root = openRoot(exportPath, "required");
    const files = [];
    const walk = (directory, prefix) => {
      for (const name of listDirectory(directory) ?? []) {
        const full = join(directory, name);
        const st = guarded("ACQUISITION", () => lstat(full));
        if (st === null || st.isSymbolicLink()) return boundary();
        if (st.isDirectory()) {
          walk(full, `${prefix}${name}/`);
        } else if (st.isFile()) {
          if (files.length >= STORE_LIMITS.exportFiles) return fail("RESOURCE_LIMIT", "ACQUISITION");
          const limit = Object.hasOwn(STORE_LIMITS.memberBytes, name) ? STORE_LIMITS.memberBytes[name] : 64 * 1024 * 1024;
          files.push({ path: `${prefix}${name}`, bytes: readFileBytes(full, limit) });
        } else {
          boundary();
        }
      }
    };
    walk(root, "");
    return engine.verifyHistoryExport({ files });
  }

  // ---- Inputs for append (section 13.3): files and a bundle directory, read through the same boundary ----

  function readInputFile(path, maxBytes) {
    if (typeof path !== "string" || path.length === 0 || path.includes("\0")) fail("USAGE", "USAGE");
    const absolute = nodePath.resolve(path);
    guarded("ACQUISITION", () => checkComponents(nodePath.dirname(absolute), "existing", "ACQUISITION"));
    return readFileBytes(absolute, maxBytes);
  }

  function readRunDirectory(path) {
    const root = openRoot(path, "required");
    const names = listDirectory(root) ?? [];
    if (names.length === 0 || names.length > STORE_RUN_MAX.files) fail("RECORD_INVALID", "ADMISSION");
    let total = 0;
    return names.map((name) => {
      if (!Object.hasOwn(STORE_LIMITS.memberBytes, name)) fail("RECORD_INVALID", "ADMISSION");
      const bytes = readFileBytes(join(root, name), STORE_RUN_MAX.totalBytes);
      total += bytes.length;
      if (total > STORE_RUN_MAX.totalBytes) fail("RESOURCE_LIMIT", "ACQUISITION");
      return { name, bytes };
    });
  }

  return Object.freeze({ init, verify, query, append, tombstone, exportLedger, verifyExport, readInputFile, readRunDirectory });
}

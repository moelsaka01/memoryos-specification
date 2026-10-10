// MO-1309 Phase 2B (Contract Freeze 1 sections 5, 9.4, 11, 13): the generator and loader.
// Requirements: DB01, DB02, DB03, DB04, DB05, DB09, DB18, DB19, DB20, DB21 (and the DB06 policy construction).
// Page sources here are the stand-in contract sources; Phase 3 runs the same generator over the Phase 2A page.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboardViewModel, canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { DASHBOARD_GENERATOR_VERSION, WORDING_MARK, assembleSnapshot, cspSourceOf, escapeJsonForHtml } from "../web/js/memoryos-dashboard-snapshot.js";
import { MEMORYOS_HISTORY_LIMITS } from "../web/js/memoryos-history-contract.js";
import { WORDING } from "../web/js/memoryos-dashboard-wording.js";
import { generateSnapshot, loadPageSources, main, publishExclusively, readExportDirectory } from "../scripts/memoryos-dashboard-generator.mjs";
import { FIXTURE_NAMES, FIXTURE_ROOT, readExportFiles } from "./support-dashboard-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
// Phase 3: the generator tests run over the real Phase 2A page sources (the Phase 2B stand-in page is gone).
const PAGE_SOURCES = Object.freeze(loadPageSources());
const count = (text, needle) => text.split(needle).length - 1;
const addedOccurrences = (text, allowed, needle) => count(text, needle) > count(allowed, needle);
const studio = path.join(here, "..");
const exportDirectoryOf = (name) => path.join(FIXTURE_ROOT, name, "export");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-gen-"));
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
let counter = 0;
const fresh = (label = "d") => { counter += 1; const p = path.join(scratch, `${label}-${counter}`); fs.mkdirSync(p); return p; };
const copyTree = (from, to) => fs.cpSync(from, to, { recursive: true });
const copyExport = (name) => { const to = path.join(fresh("export"), "export"); copyTree(exportDirectoryOf(name), to); return to; };
const codeOf = (fn) => { try { fn(); } catch (error) { return { code: error.code, historyCode: error.historyCode }; } return null; };
const listing = (dir) => fs.readdirSync(dir).sort();
const generate = (name, extra = {}) => {
  const out = path.join(fresh("out"), "snapshot.html");
  const result = generateSnapshot({ exportDirectory: exportDirectoryOf(name), outputFile: out, sources: PAGE_SOURCES, ...extra });
  return { out, bytes: fs.readFileSync(out), ...result };
};

// ---- the assembler ----
test("DB06 the policy meta pins script and style by SHA-256 and has no unsafe source; the hash equals node:crypto's", () => {
  const viewModel = buildDashboardViewModel({ files: readExportFiles("claims-only") });
  const { html, csp } = assembleSnapshot({ viewModel, sources: PAGE_SOURCES });
  const script = PAGE_SOURCES.script.replace(WORDING_MARK, () => `${escapeJsonForHtml(JSON.stringify(WORDING))};`);
  const sha = (text) => `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;
  assert.equal(csp, `default-src 'none'; script-src ${sha(script)}; style-src ${sha(PAGE_SOURCES.style)}; base-uri 'none'; form-action 'none'`);
  assert.doesNotMatch(csp, /unsafe|data:|blob:|\*/u);
  assert.ok(html.includes(`<script>${script}</script>`) && html.includes(`<style>${PAGE_SOURCES.style}</style>`));
  for (const text of ["", "a", "ab", "abc", "é€", "x".repeat(1000)]) assert.equal(cspSourceOf(text), sha(text));
});

test("DB05 DB09 one file, no external reference; data block is escaped, parses to the canonical view model and cannot close itself", () => {
  for (const name of FIXTURE_NAMES) {
    const viewModel = buildDashboardViewModel({ files: readExportFiles(name) });
    const { html, digest } = assembleSnapshot({ viewModel, sources: PAGE_SOURCES });
    const block = /<script type="application\/json" id="memoryos-dashboard-data">([\s\S]*?)<\/script>/u.exec(html)[1];
    assert.doesNotMatch(block, /[<>&\u2028\u2029]/u);
    assert.equal(`${JSON.stringify(JSON.parse(block))}`.length > 0, true);
    assert.equal(new TextDecoder().decode(canonicalViewModelBytes(JSON.parse(block))), new TextDecoder().decode(canonicalViewModelBytes(viewModel)));
    assert.equal(html.match(/<script\b/gu).length, 2);
    assert.equal(html.match(/<\/script>/gu).length, 2);
    const outside = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/u, "").replace(/<script type="application\/json"[\s\S]*?<\/script>/u, "");
    assert.doesNotMatch(outside, /https?:|\/\/|data:|blob:|\bsrc\s*=|\bhref\s*=|<link\b|<iframe\b|<img\b/iu);
    assert.equal(digest, `sha256:${crypto.createHash("sha256").update(html.replace(digest, ""), "utf8").digest("hex")}`);
    assert.equal(html.split(digest).length, 2, "the digest appears once, in the footer");
  }
  // The adversarial export really carries markup in its untrusted data, and it stays inside the block.
  const adversarial = buildDashboardViewModel({ files: readExportFiles("adversarial-wording") });
  assert.match(adversarial.source.workspaceIdentifier, /<script>/u);
  assert.doesNotMatch(assembleSnapshot({ viewModel: adversarial, sources: PAGE_SOURCES }).html, /<script>alert/u);
});

test("the assembler refuses a malformed argument or page source (no partial result); CRLF sources give identical bytes", () => {
  const viewModel = buildDashboardViewModel({ files: readExportFiles("single-entry") });
  const base = assembleSnapshot({ viewModel, sources: PAGE_SOURCES });
  const refuse = (arguments_) => assert.equal(codeOf(() => assembleSnapshot(arguments_)).code, "DASH_USAGE");
  refuse({ viewModel: { ...viewModel, version: "9" }, sources: PAGE_SOURCES });
  refuse({ viewModel, sources: null });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, template: PAGE_SOURCES.template.replace("@@DATA@@", "") } });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, template: PAGE_SOURCES.template.replace("@@TITLE@@", "@@TITLE@@@@TITLE@@") } });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, template: `${PAGE_SOURCES.template}@@UNKNOWN@@` } });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, script: PAGE_SOURCES.script.replace(WORDING_MARK, "null;") } });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, script: `${PAGE_SOURCES.script}${WORDING_MARK}` } });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, script: `${PAGE_SOURCES.script}"</script>"` } });
  refuse({ viewModel, sources: { ...PAGE_SOURCES, style: "</style>" } });
  refuse({ viewModel, sources: PAGE_SOURCES, generatorVersion: "<b>" });
  refuse({ viewModel, sources: PAGE_SOURCES, generatorVersion: "" });
  const crlf = Object.fromEntries(Object.entries(PAGE_SOURCES).map(([k, v]) => [k, v.replace(/\n/gu, "\r\n")]));
  assert.equal(assembleSnapshot({ viewModel, sources: crlf }).html, base.html);
  assert.ok(!base.html.includes("\r"));
  assert.ok(base.html.includes(DASHBOARD_GENERATOR_VERSION));
});

// ---- the loader ----
test("DB02 each export file is read exactly once; the view model comes from those bytes even if the directory is swapped afterwards", () => {
  const exportDir = copyExport("all-kinds-tombstoned");
  const opens = new Map();
  const spy = { ...fs,
    openSync: (target, ...rest) => {
      if (String(target).startsWith(exportDir)) opens.set(target, (opens.get(target) ?? 0) + 1);
      else if (String(target).includes(".staging-")) { // publication started: swap the export now, after the only read
        for (const file of fs.readdirSync(path.join(exportDir, "entries"))) fs.writeFileSync(path.join(exportDir, "entries", file), "swapped");
        fs.rmSync(path.join(exportDir, "memoryos-history-export.json"));
      }
      return fs.openSync(target, ...rest);
    } };
  const out = path.join(fresh("out"), "snapshot.html");
  generateSnapshot({ exportDirectory: exportDir, outputFile: out, sources: PAGE_SOURCES, fs: spy });
  const expectedFiles = readExportFiles("all-kinds-tombstoned").length;
  assert.equal(opens.size, expectedFiles);
  assert.ok([...opens.values()].every((count) => count === 1), "one open per file");
  const baseline = generate("all-kinds-tombstoned");
  assert.deepEqual(fs.readFileSync(out), baseline.bytes, "a swap after the read changes nothing");
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: exportDir, outputFile: path.join(fresh("out"), "x.html"), sources: PAGE_SOURCES })).code, "DASH_EXPORT_INVALID", "the swapped export is itself rejected");
});

test("DB01 the only input is one export directory and one output name", () => {
  for (const argv of [[], ["a"], ["a", "b", "c"]]) {
    const errors = [];
    assert.equal(main(argv, { stderr: { write: (t) => errors.push(t) }, stdout: { write() {} } }), 2);
    assert.match(errors.join(""), /^DASH_USAGE [^\n]*\n$/u);
  }
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: 5, outputFile: "x" })).code, "DASH_USAGE");
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: "", outputFile: "x" })).code, "DASH_USAGE");
});

test("DB03 a verification failure emits nothing and carries the MO-1308 code (tamper corpus)", () => {
  const corpus = {
    "flipped entry byte": (d) => { const f = path.join(d, "entries", "00000000000000000001.json"); const b = fs.readFileSync(f); b[b.length - 5] ^= 1; fs.writeFileSync(f, b); },
    "deleted last entry (tail truncation)": (d) => fs.rmSync(path.join(d, "entries", "00000000000000000009.json")),
    "deleted marker": (d) => fs.rmSync(path.join(d, "memoryos-history-export-complete.json")),
    "altered manifest": (d) => { const f = path.join(d, "memoryos-history-export.json"); fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("sha256:", "sha256:0")); },
    "altered descriptor": (d) => { const f = path.join(d, "memoryos-history-ledger.json"); const b = fs.readFileSync(f); b[b.length - 4] ^= 1; fs.writeFileSync(f, b); },
    "altered member": (d) => { const dir = path.join(d, "records"); const sub = path.join(dir, fs.readdirSync(dir)[0]); const f = path.join(sub, fs.readdirSync(sub)[0]); fs.appendFileSync(f, " "); },
    "removed member": (d) => { const dir = path.join(d, "records"); const sub = path.join(dir, fs.readdirSync(dir)[0]); fs.rmSync(path.join(sub, fs.readdirSync(sub)[0])); },
  };
  for (const [label, tamper] of Object.entries(corpus)) {
    const exportDir = copyExport("all-kinds-tombstoned");
    tamper(exportDir);
    const outDir = fresh("out");
    const failure = codeOf(() => generateSnapshot({ exportDirectory: exportDir, outputFile: path.join(outDir, "s.html"), sources: PAGE_SOURCES }));
    assert.ok(failure && ["DASH_EXPORT_INVALID", "DASH_EXPORT_UNREADABLE"].includes(failure.code), `${label}: ${JSON.stringify(failure)}`);
    if (failure.code === "DASH_EXPORT_INVALID") assert.match(failure.historyCode, /^MO1308_[A-Z_]+$/u, label);
    assert.deepEqual(listing(outDir), [], `${label}: nothing emitted, no staging file left`);
  }
  // A file the manifest does not list is a verification failure, not a silent extra.
  const extra = copyExport("single-entry");
  fs.writeFileSync(path.join(extra, "entries", "00000000000000000001.json"), "{}");
  const failure = codeOf(() => generateSnapshot({ exportDirectory: extra, outputFile: path.join(fresh("out"), "s.html"), sources: PAGE_SOURCES }));
  assert.equal(failure.code, "DASH_EXPORT_INVALID");
});

test("DASH_EXPORT_UNREADABLE: missing, symbolic-link, special, undefined-path and oversize inputs are refused without being followed", (t) => {
  const outOf = () => path.join(fresh("out"), "s.html");
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: path.join(scratch, "absent"), outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE");
  const file = path.join(fresh("f"), "file");
  fs.writeFileSync(file, "x");
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: file, outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE");
  const stray = copyExport("single-entry");
  fs.writeFileSync(path.join(stray, "stray.txt"), "x");
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: stray, outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE");
  const big = copyExport("single-entry");
  fs.writeFileSync(path.join(big, "entries", "00000000000000000000.json"), Buffer.alloc(MEMORYOS_HISTORY_LIMITS.entryBytes + 1, 65));
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: big, outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE");
  let linked = false;
  try {
    const realRoot = copyExport("single-entry");
    const linkRoot = path.join(fresh("l"), "link");
    fs.symlinkSync(realRoot, linkRoot, "junction");
    assert.equal(codeOf(() => generateSnapshot({ exportDirectory: linkRoot, outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE", "linked root");
    const inner = copyExport("single-entry");
    const target = path.join(inner, "entries", "00000000000000000000.json");
    const hidden = path.join(fresh("h"), "real.json");
    fs.copyFileSync(target, hidden);
    fs.rmSync(target);
    fs.symlinkSync(hidden, target, "file");
    assert.equal(codeOf(() => generateSnapshot({ exportDirectory: inner, outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE", "linked file");
    linked = true;
  } catch (error) { if (!["EPERM", "EACCES", "ENOSYS"].includes(error.code)) throw error; }
  t.diagnostic(`symbolic-link cases executed: ${linked}`);
  if (process.platform !== "win32") {
    const special = copyExport("single-entry");
    assert.equal(spawnSync("mkfifo", [path.join(special, "pipe")]).status, 0);
    assert.equal(codeOf(() => generateSnapshot({ exportDirectory: special, outputFile: outOf(), sources: PAGE_SOURCES })).code, "DASH_EXPORT_UNREADABLE");
    assert.ok(linked, "the symbolic-link cases must run on this platform");
  }
});

test("DB21 an over-limit entry count is DASH_LIMIT_EXCEEDED before any file is read; the limit itself is not", () => {
  const names = (count) => Array.from({ length: count }, (_, i) => `${String(i).padStart(20, "0")}.json`);
  const fake = (count) => {
    const reads = [];
    return { reads, fs: {
      lstatSync: (p) => (p.endsWith("entries") || p === "/virtual" ? { isDirectory: () => true, isFile: () => false } : { isDirectory: () => false, isFile: () => true, size: 10, ino: 1, dev: 1 }),
      readdirSync: (p) => (p === "/virtual" ? ["entries"] : names(count)),
      openSync: (p) => { reads.push(p); throw new Error("no"); },
    } };
  };
  const over = fake(MEMORYOS_HISTORY_LIMITS.entriesPerLedger + 1);
  assert.equal(codeOf(() => readExportDirectory("/virtual", over.fs)).code, "DASH_LIMIT_EXCEEDED");
  assert.equal(over.reads.length, 0, "no file was read");
  const exact = fake(MEMORYOS_HISTORY_LIMITS.entriesPerLedger);
  assert.equal(codeOf(() => readExportDirectory("/virtual", exact.fs)).code, "DASH_EXPORT_UNREADABLE", "100,000 passes the count check");
  assert.equal(MEMORYOS_HISTORY_LIMITS.entriesPerLedger, 100_000);
});

// ---- determinism, privacy, content ----
test("DB18 same export and version give identical bytes across runs and directory enumeration orders", () => {
  for (const name of FIXTURE_NAMES) {
    const first = generate(name);
    const second = generate(name);
    assert.deepEqual(second.bytes, first.bytes, name);
    const reversed = { ...fs, readdirSync: (...a) => fs.readdirSync(...a).reverse() };
    assert.deepEqual(generate(name, { fs: reversed }).bytes, first.bytes, `${name} reversed listing`);
    const shuffled = { ...fs, readdirSync: (...a) => { const l = fs.readdirSync(...a); return l.map((_, i) => l[(i * 7 + 3) % l.length]).filter((v, i, arr) => arr.indexOf(v) === i).concat(l).filter((v, i, arr) => arr.indexOf(v) === i); } };
    assert.deepEqual(generate(name, { fs: shuffled }).bytes, first.bytes, `${name} shuffled listing`);
    const copy = path.join(fresh("export"), "elsewhere");
    copyTree(exportDirectoryOf(name), copy);
    const out = path.join(fresh("out"), "different-name.html");
    generateSnapshot({ exportDirectory: copy, outputFile: out, sources: PAGE_SOURCES });
    assert.deepEqual(fs.readFileSync(out), first.bytes, `${name}: path and name do not matter`);
  }
});

test("DB18 DB19 a fresh process under a different time zone, locale, working directory and clock gives the same bytes with no path, host, user or time", () => {
  const tree = fresh("tree");
  copyTree(path.join(studio, "scripts", "memoryos-dashboard-generator.mjs"), path.join(tree, "scripts", "memoryos-dashboard-generator.mjs"));
  copyTree(path.join(studio, "web", "js"), path.join(tree, "web", "js"));
  fs.mkdirSync(path.join(tree, "web", "dashboard"));
  for (const [file, key] of [["page.html", "template"], ["page.css", "style"], ["page.js", "script"]]) fs.writeFileSync(path.join(tree, "web", "dashboard", file), PAGE_SOURCES[key]);
  const run = (name, environment, cwd) => {
    const out = path.join(fresh("out"), "snapshot.html");
    const result = spawnSync(process.execPath, [...(environment.PRELOAD ? ["--import", environment.PRELOAD] : []), path.join(tree, "scripts", "memoryos-dashboard-generator.mjs"), exportDirectoryOf(name), out],
      { cwd, encoding: "utf8", env: { PATH: process.env.PATH, ...environment } });
    return { ...result, out };
  };
  const freezeClock = path.join(fresh("pre"), "clock.mjs");
  fs.writeFileSync(freezeClock, "const f = Date.UTC(2001, 8, 9, 1, 46, 40); Date.now = () => f; Math.random = () => 0.123;\n");
  for (const name of FIXTURE_NAMES) {
    const a = run(name, { TZ: "UTC", LC_ALL: "C" }, studio);
    const b = run(name, { TZ: "Pacific/Kiritimati", LC_ALL: "tr_TR.UTF-8", LANG: "tr_TR.UTF-8", PRELOAD: pathToUrl(freezeClock), USER: "someone-else", HOSTNAME: "elsewhere" }, scratch);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.match(a.stdout, /^snapshot sha256:[0-9a-f]{64}\n$/u);
    assert.deepEqual(fs.readFileSync(b.out), fs.readFileSync(a.out), name);
    const text = fs.readFileSync(a.out, "utf8");
    // Phase 3: the real page legitimately contains short tokens (CSS `:root`), so a leak is an occurrence the generator ADDED beyond what
    // the page sources, the registry and the view model already carry. The negative control below proves an added occurrence is caught.
    const allowed = `${PAGE_SOURCES.template}${PAGE_SOURCES.style}${PAGE_SOURCES.script}${JSON.stringify(WORDING)}${new TextDecoder().decode(canonicalViewModelBytes(buildDashboardViewModel({ files: readExportFiles(name) })))}${DASHBOARD_GENERATOR_VERSION}`;
    for (const secret of [scratch, os.tmpdir(), os.homedir(), os.hostname(), os.userInfo().username, studio, process.cwd(), "tr_TR"]) {
      if (secret.length > 3) assert.ok(!addedOccurrences(text, allowed, secret), `${name} leaks ${secret}`);
    }
    assert.ok(addedOccurrences(`${text}/home/${os.userInfo().username}/x`, allowed, os.userInfo().username), "negative control: an added occurrence is a leak");
    assert.doesNotMatch(text, /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/u, "no timestamp");
  }
});

test("DB04 retained member contents are never embedded (every member's bytes are absent from the output)", () => {
  for (const name of FIXTURE_NAMES) {
    const text = generate(name).bytes.toString("latin1");
    for (const file of readExportFiles(name)) {
      if (!file.path.startsWith("records/")) continue;
      const body = Buffer.from(file.bytes).toString("latin1");
      for (const sample of [body.slice(0, 48), body.slice(Math.floor(body.length / 2), Math.floor(body.length / 2) + 48)]) {
        if (/^[\x20-\x7e]{48}$/u.test(sample) && !/[0-9a-f]{16}/u.test(sample)) assert.ok(!text.includes(sample), `${name}/${file.path} content`);
      }
    }
  }
});

// ---- exclusive output ----
test("DB20 output creation is exclusive: an existing name is never overwritten, staging failure is typed and not retried", () => {
  const dir = fresh("out");
  const out = path.join(dir, "snapshot.html");
  fs.writeFileSync(out, "precious");
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: exportDirectoryOf("single-entry"), outputFile: out, sources: PAGE_SOURCES })).code, "DASH_OUTPUT_EXISTS");
  assert.equal(fs.readFileSync(out, "utf8"), "precious");
  fs.rmSync(out);
  fs.symlinkSync(path.join(dir, "nowhere"), out); // even a dangling link is an existing name
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: exportDirectoryOf("single-entry"), outputFile: out, sources: PAGE_SOURCES })).code, "DASH_OUTPUT_EXISTS");
  fs.rmSync(out);

  // The staging name already exists: one exclusive create, typed failure, the foreign file untouched, nothing published.
  const staging = path.join(dir, `.snapshot.html.staging-${process.pid}`);
  fs.writeFileSync(staging, "foreign");
  let attempts = 0;
  const counting = { ...fs, openSync: (target, flags, ...rest) => { if (flags === "wx") attempts += 1; return fs.openSync(target, flags, ...rest); } };
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: exportDirectoryOf("single-entry"), outputFile: out, sources: PAGE_SOURCES, fs: counting })).code, "DASH_IO_FAILURE");
  assert.equal(attempts, 1, "not retried");
  assert.equal(fs.readFileSync(staging, "utf8"), "foreign");
  assert.ok(!fs.existsSync(out));
  fs.rmSync(staging);

  // A name that appears between the early check and publication loses the race without being replaced.
  const racing = { ...fs, linkSync: (from, to) => { fs.writeFileSync(to, "winner"); return fs.linkSync(from, to); } };
  assert.equal(codeOf(() => generateSnapshot({ exportDirectory: exportDirectoryOf("single-entry"), outputFile: out, sources: PAGE_SOURCES, fs: racing })).code, "DASH_OUTPUT_EXISTS");
  assert.equal(fs.readFileSync(out, "utf8"), "winner");
  assert.deepEqual(listing(dir), ["snapshot.html"], "staging removed");
  fs.rmSync(out);

  // Other failures are typed IO failures and leave nothing behind.
  const failing = (method) => ({ ...fs, [method]: () => { const error = new Error("boom"); error.code = "EIO"; throw error; } });
  for (const method of ["writeSync", "fsyncSync", "linkSync"]) {
    assert.equal(codeOf(() => publishExclusively(out, new Uint8Array([1, 2, 3]), failing(method))).code, "DASH_IO_FAILURE", method);
    assert.deepEqual(listing(dir), [], method);
  }
  assert.equal(codeOf(() => publishExclusively(path.join(dir, "missing", "x.html"), new Uint8Array([1]))).code, "DASH_IO_FAILURE", "output directory is not created");
  // Success publishes the whole file, and the staging name is gone.
  publishExclusively(out, new Uint8Array([1, 2, 3]));
  assert.deepEqual([...fs.readFileSync(out)], [1, 2, 3]);
  assert.deepEqual(listing(dir), ["snapshot.html"]);
});

// ---- the process ----
function pathToUrl(file) { return new URL(`file://${file.startsWith("/") ? "" : "/"}${file.split(path.sep).join("/")}`).href; }

test("the command line: exit status and the single standard-error line (first token is the code)", () => {
  const tree = fresh("tree");
  copyTree(path.join(studio, "scripts", "memoryos-dashboard-generator.mjs"), path.join(tree, "scripts", "memoryos-dashboard-generator.mjs"));
  copyTree(path.join(studio, "web", "js"), path.join(tree, "web", "js"));
  fs.mkdirSync(path.join(tree, "web", "dashboard"));
  for (const [file, key] of [["page.html", "template"], ["page.css", "style"], ["page.js", "script"]]) fs.writeFileSync(path.join(tree, "web", "dashboard", file), PAGE_SOURCES[key]);
  const cli = (...args) => spawnSync(process.execPath, [path.join(tree, "scripts", "memoryos-dashboard-generator.mjs"), ...args], { encoding: "utf8" });
  const out = path.join(fresh("out"), "s.html");
  const ok = cli(exportDirectoryOf("all-kinds-tombstoned"), out);
  assert.equal(ok.status, 0);
  assert.equal(ok.stderr, "");
  assert.ok(fs.existsSync(out));
  const again = cli(exportDirectoryOf("all-kinds-tombstoned"), out);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /^DASH_OUTPUT_EXISTS [^\n]+\n$/u);
  const tampered = copyExport("all-kinds-tombstoned");
  fs.rmSync(path.join(tampered, "entries", "00000000000000000009.json"));
  const bad = cli(tampered, path.join(fresh("out"), "t.html"));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /^DASH_EXPORT_INVALID MO1308_[A-Z_]+ [^\n]+\n$/u);
  assert.equal(cli().status, 2);
  assert.match(cli("only-one").stderr, /^DASH_USAGE /u);
  const missing = cli(path.join(scratch, "nope"), path.join(fresh("out"), "m.html"));
  assert.match(missing.stderr, /^DASH_EXPORT_UNREADABLE /u);
  assert.ok(!bad.stderr.includes(scratch) && !missing.stderr.includes(scratch), "the error line carries no path");
  assert.equal(ok.stdout.trim().split(" ")[0], "snapshot");
});

// ---- source scans ----
test("the generator and assembler open no socket, read no clock, random source, locale or environment value; the assembler is pure", () => {
  const generator = fs.readFileSync(path.join(studio, "scripts", "memoryos-dashboard-generator.mjs"), "utf8");
  const snapshot = fs.readFileSync(path.join(studio, "web", "js", "memoryos-dashboard-snapshot.js"), "utf8");
  const strip = (text) => text.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n").replace(/"[^"\n]*"/gu, '""');
  const common = [/node:(net|http|https|dns|tls|dgram|child_process|worker_threads|os|crypto|zlib)\b/u, /\bfetch\b/u, /\bDate\b/u, /Math\.random/u, /\bIntl\b/u, /toLocale/u,
    /localeCompare/u, /process\.env/u, /\bperformance\b/u, /\bhrtime\b/u, /\brequire\s*\(/u, /\beval\s*\(/u, /new Function/u, /import\s*\(/u, /\bWebSocket\b/u, /\bXMLHttpRequest\b/u];
  for (const [name, text] of [["generator", generator], ["snapshot", snapshot]]) for (const pattern of common) assert.ok(!pattern.test(strip(text)), `${name}: ${pattern}`);
  for (const pattern of [/node:/u, /\bprocess\b/u, /\bBuffer\b/u, /\bglobalThis\b/u, /\bwindow\b/u, /\bdocument\b/u]) assert.ok(!pattern.test(strip(snapshot)), `snapshot: ${pattern}`);
  const imports = (text) => [...text.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gmu)].map((m) => m[1]).sort();
  assert.deepEqual(imports(snapshot), ["./memoryos-dashboard-contract.js", "./memoryos-dashboard-wording.js", "./mip-canonical.js"]);
  assert.deepEqual(imports(generator), ["../web/js/memoryos-dashboard-contract.js", "../web/js/memoryos-dashboard-snapshot.js", "../web/js/memoryos-dashboard-viewmodel.js",
    "../web/js/memoryos-history-contract.js", "node:fs", "node:path", "node:url"]);
  // Negative control: the scan catches a real violation.
  assert.ok(common.some((pattern) => pattern.test('import net from "node:net"; const t = Date.now();')));
  // The generator never calls the verifier's helpers itself: verification is the view-model unit's single call.
  assert.ok(!/verifyHistoryExport|decodeHistoryBytes|parseStrictJson/u.test(strip(generator)), "no verification or member parsing in the generator");
});

test("Phase 3: the end-to-end generator output equals the unit assembly the page tests use, for every fixture", async () => {
  const { generateFixtureSnapshot, assembleTestSnapshot } = await import("./support-dashboard-snapshot.mjs");
  for (const name of FIXTURE_NAMES) {
    const generated = generateFixtureSnapshot(name);
    const unit = assembleTestSnapshot({ viewModel: buildDashboardViewModel({ files: readExportFiles(name) }) });
    assert.equal(generated.html, unit.html, name);
    assert.equal(generated.digest, unit.digest, name);
  }
});

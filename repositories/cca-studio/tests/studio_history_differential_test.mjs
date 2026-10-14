// MemoryOS 1.3.1 SH09: the standalone MO-1309 generator's output is byte-identical to v1.3.0 on every fixture and corpus.
// Two independent proofs: (1) golden digests recorded from the v1.3.0 generator before the bounds extraction; (2) a live differential
// that extracts the generator tree at the v1.3.0 commit and runs it next to the current one. (2) needs the baseline commit in the
// repository (a full clone); its absence FAILS the test, it is never skipped.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { generateSnapshot } from "../scripts/memoryos-dashboard-generator.mjs";
import { BASELINE_COMMIT, GOLDEN_PATH, STUDIO_ROOT, differentialInputs, makeScratch, sha256Hex } from "./support-studio-history.mjs";

const REPO_ROOT = path.join(STUDIO_ROOT, "..", "..");
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf8"));

test("SH09 the golden record covers every fixture and the corpora and names the v1.3.0 baseline", () => {
  assert.equal(golden.baseline, BASELINE_COMMIT);
  const scratch = makeScratch("diff-inputs");
  try {
    const ids = differentialInputs(scratch).map(([id]) => id);
    assert.deepEqual(Object.keys(golden.outputs).sort(), [...ids].sort());
    assert.ok(ids.length >= 7 && ids.some((id) => id.startsWith("corpus:")) && ids.some((id) => id.startsWith("fixture:")));
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test("SH09 the refactored generator reproduces the golden v1.3.0 output byte for byte on every fixture and corpus", () => {
  const scratch = makeScratch("diff-golden");
  try {
    for (const [id, directory] of differentialInputs(scratch)) {
      const output = path.join(scratch, `${id.replace(":", "-")}.html`);
      const { digest } = generateSnapshot({ exportDirectory: directory, outputFile: output });
      const bytes = fs.readFileSync(output);
      assert.deepEqual({ snapshotDigest: digest, fileSha256: `sha256:${sha256Hex(bytes)}`, bytes: bytes.length }, golden.outputs[id], id);
    }
    // Negative control: the comparison sees a one-byte difference.
    const [firstId, first] = Object.entries(golden.outputs)[0];
    const tampered = Buffer.from(fs.readFileSync(path.join(scratch, `${firstId.replace(":", "-")}.html`)));
    tampered[tampered.length - 2] ^= 1;
    assert.notEqual(`sha256:${sha256Hex(tampered)}`, first.fileSha256);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test("SH09 the v1.3.0 generator, extracted from the baseline commit, and the current generator write identical bytes", () => {
  const present = spawnSync("git", ["cat-file", "-e", `${BASELINE_COMMIT}^{commit}`], { cwd: REPO_ROOT });
  assert.equal(present.status, 0, `the baseline commit ${BASELINE_COMMIT} is not in this repository; fetch full history and tags (this test is never skipped)`);
  const scratch = makeScratch("diff-live");
  try {
    const tree = path.join(scratch, "baseline");
    fs.mkdirSync(tree);
    const archive = path.join(scratch, "baseline.tar");
    execFileSync("git", ["archive", "--format=tar", "-o", archive, BASELINE_COMMIT, "repositories/cca-studio/package.json", "repositories/cca-studio/scripts", "repositories/cca-studio/web"], { cwd: REPO_ROOT });
    execFileSync("tar", ["-xf", archive, "-C", tree]);
    const baselineGenerator = path.join(tree, "repositories", "cca-studio", "scripts", "memoryos-dashboard-generator.mjs");
    assert.ok(fs.existsSync(baselineGenerator));
    assert.ok(!fs.existsSync(path.join(tree, "repositories", "cca-studio", "web", "js", "memoryos-dashboard-export-bounds.js")), "the baseline tree is the pre-refactor one");
    const generators = { baseline: baselineGenerator, current: path.join(STUDIO_ROOT, "scripts", "memoryos-dashboard-generator.mjs") };
    let compared = 0;
    for (const [id, directory] of differentialInputs(scratch)) {
      const outputs = {};
      for (const [label, generator] of Object.entries(generators)) {
        const output = path.join(scratch, `${label}-${id.replace(":", "-")}.html`);
        const run = spawnSync(process.execPath, [generator, directory, output], { encoding: "utf8" });
        assert.equal(run.status, 0, `${label} ${id}: ${run.stderr}`);
        outputs[label] = { bytes: fs.readFileSync(output), stdout: run.stdout };
      }
      assert.equal(Buffer.compare(outputs.baseline.bytes, outputs.current.bytes), 0, id);
      assert.equal(outputs.baseline.stdout, outputs.current.stdout, `${id}: the digest line`);
      compared += 1;
    }
    assert.ok(compared >= 7);
    // The error behaviour is unchanged as well: the same typed line for an unreadable and an invalid export.
    const bad = path.join(scratch, "bad-export");
    fs.mkdirSync(bad);
    fs.writeFileSync(path.join(bad, "notes.txt"), "x");
    const lines = Object.values(generators).map((generator) => spawnSync(process.execPath, [generator, bad, path.join(scratch, `bad-${path.basename(path.dirname(path.dirname(generator)))}.html`)], { encoding: "utf8" }));
    assert.equal(lines[0].stderr, lines[1].stderr);
    assert.match(lines[0].stderr, /^DASH_EXPORT_UNREADABLE /u);
    assert.equal(lines[0].status, lines[1].status);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

// MO-1309 Phase 3 harness fix: profile removal retries (Node's maxRetries) and a persistent failure is not swallowed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeProfile } from "./support-devtools.mjs";

test("removeProfile requests retries and removes a real directory tree", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mo1309-harness-"));
  fs.mkdirSync(path.join(dir, "Default"));
  fs.writeFileSync(path.join(dir, "Default", "x"), "x");
  removeProfile(dir);
  assert.equal(fs.existsSync(dir), false);
  let seen = null;
  removeProfile("ignored", (target, options) => { seen = options; });
  assert.ok(seen.maxRetries >= 10 && seen.retryDelay > 0 && seen.recursive === true);
});

test("negative control: a removal that keeps failing still throws", () => {
  assert.throws(() => removeProfile("ignored", () => { throw Object.assign(new Error("ENOTEMPTY"), { code: "ENOTEMPTY" }); }), /ENOTEMPTY/);
});

test("closing the browser kills its whole process tree and removes the profile (the Phase 3 root cause: surviving helper processes)", async () => {
  const { findBrowser, launchBrowser } = await import("./support-devtools.mjs");
  if (findBrowser() === null) return;
  for (let round = 0; round < 6; round += 1) {
    const before = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith("mo1309-browser-"));
    const browser = await launchBrowser();
    const page = await browser.openPage({ width: 800, height: 600 });
    await page.navigate("about:blank");
    await browser.close();
    const after = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith("mo1309-browser-"));
    assert.deepEqual(after.sort(), before.sort(), `round ${round}: no profile directory left behind`);
  }
});

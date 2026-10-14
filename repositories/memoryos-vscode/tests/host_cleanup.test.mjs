import assert from "node:assert/strict";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  HOST_PROFILE_CLEANUP_MAX_RETRIES,
  HOST_PROFILE_CLEANUP_RETRY_DELAY_MS,
  removeHostProfile,
  withHostProfileCleanup,
} from "../test-host/cleanup.mjs";

function cleanupError(code) {
  return Object.assign(new Error(`cleanup ${code}`), { code });
}

test("host profile cleanup removes a normal temporary profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "memoryos-host-cleanup-test-"));
  await removeHostProfile(root);
  await assert.rejects(access(root), (error) => error?.code === "ENOENT");
});

test("host profile cleanup retries only transient Windows lock errors", async (t) => {
  for (const code of ["EBUSY", "EPERM"]) {
    await t.test(code, async () => {
      let attempts = 0;
      const waits = [];
      await removeHostProfile("profile", {
        platform: "win32",
        remove: async () => {
          attempts += 1;
          if (attempts === 1) throw cleanupError(code);
        },
        wait: async (milliseconds) => waits.push(milliseconds),
      });
      assert.equal(attempts, 2);
      assert.deepEqual(waits, [HOST_PROFILE_CLEANUP_RETRY_DELAY_MS]);
    });
  }
});

test("host profile cleanup has a closed retry budget", async () => {
  const failure = cleanupError("EBUSY");
  let attempts = 0;
  const waits = [];
  await assert.rejects(removeHostProfile("profile", {
    platform: "win32",
    remove: async () => {
      attempts += 1;
      throw failure;
    },
    wait: async (milliseconds) => waits.push(milliseconds),
  }), (error) => error === failure);
  assert.equal(attempts, HOST_PROFILE_CLEANUP_MAX_RETRIES + 1);
  assert.deepEqual(waits, Array.from(
    { length: HOST_PROFILE_CLEANUP_MAX_RETRIES },
    (_, index) => HOST_PROFILE_CLEANUP_RETRY_DELAY_MS * (index + 1),
  ));
});

test("host profile cleanup fails unexpected and non-Windows errors immediately", async (t) => {
  for (const [name, platform, code] of [
    ["unexpected Windows error", "win32", "EACCES"],
    ["non-Windows lock error", "linux", "EBUSY"],
  ]) {
    await t.test(name, async () => {
      const failure = cleanupError(code);
      let attempts = 0;
      let waits = 0;
      await assert.rejects(removeHostProfile("profile", {
        platform,
        remove: async () => {
          attempts += 1;
          throw failure;
        },
        wait: async () => { waits += 1; },
      }), (error) => error === failure);
      assert.equal(attempts, 1);
      assert.equal(waits, 0);
    });
  }
});

test("profile cleanup starts only after host execution completes", async () => {
  const events = [];
  let releaseHost;
  let markStarted;
  const hostGate = new Promise((resolveHost) => { releaseHost = resolveHost; });
  const hostStarted = new Promise((resolveStarted) => { markStarted = resolveStarted; });
  const execution = withHostProfileCleanup("profile", async () => {
    events.push("host-started");
    markStarted();
    await hostGate;
    events.push("host-completed");
    return "receipt";
  }, {
    platform: "win32",
    remove: async () => { events.push("profile-removed"); },
  });
  await hostStarted;
  assert.deepEqual(events, ["host-started"]);
  releaseHost();
  assert.equal(await execution, "receipt");
  assert.deepEqual(events, ["host-started", "host-completed", "profile-removed"]);
});

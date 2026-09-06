import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { referenceSnapshot } from "../../cca-studio/web/data/studio-snapshot.js";
import {
  InvestigationCore,
  InvestigationCoreError,
  TransitionLog,
  projectInvestigation,
} from "../../cca-studio/web/js/investigation-core.js";
import { canonicalize } from "../../cca-studio/web/js/mip-canonical.js";
import { WORKSPACE_ROOT } from "./support/conformance-support.mjs";

const transitionLimit = 10_000;
const transitionPayloadLimit = 16 * 1024 * 1024;

function assertResourceLimit(action, operation, message) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof InvestigationCoreError);
    assert.equal(error.code, "RESOURCE_LIMIT_EXCEEDED");
    assert.equal(error.operation, operation);
    assert.equal(error.message, message);
    assert.equal(error.diagnostics.length, 1);
    assert.deepEqual(error.diagnostics[0], {
      code: "RESOURCE_LIMIT_EXCEEDED",
      operation,
      message,
    });
    assert.equal(Object.isFrozen(error.diagnostics), true);
    assert.equal(Object.isFrozen(error.diagnostics[0]), true);
    return true;
  });
}

function locatePython() {
  const configured = [
    process.env.MEMORYOS_CONFORMANCE_PYTHON,
    process.env.Python3_EXECUTABLE,
    process.env.PYTHON,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const candidates = [...configured, "python3", "python"];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (!probe.error && probe.status === 0) return candidate;
  }
  assert.fail(
    "CCA-MOS-SDK-010 requires the public Python SDK; set MEMORYOS_CONFORMANCE_PYTHON to its Python executable.",
  );
}

function faultHostSource(coreUrl, canonicalUrl) {
  return `import { createInterface } from "node:readline";
import { writeFileSync } from "node:fs";
import { InvestigationCore } from ${JSON.stringify(coreUrl)};
import { canonicalize } from ${JSON.stringify(canonicalUrl)};

const protocolVersion = "1.0.0";
const auditPath = process.env.MEMORYOS_FAULT_AUDIT;
const core = new InvestigationCore();
const requests = [];
let investigation = null;

function write(value) {
  process.stdout.write(canonicalize(value) + "\\n");
}

function persistAudit() {
  const transitions = investigation?.transitionLog.transitions ?? [];
  writeFileSync(auditPath, canonicalize({
    exactSnapshotTransport: investigation === null
      ? null
      : canonicalize(requests.at(-1).params.snapshot)
        === canonicalize(transitions.at(-1).payload.snapshot),
    observedTransitionCount: transitions.filter(({ kind }) => kind === "OBSERVED").length,
    requestMethods: requests.map(({ method }) => method),
    transitionKinds: transitions.map(({ kind }) => kind),
  }) + "\\n", "utf8");
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of input) {
  const request = JSON.parse(line);
  requests.push(request);
  if (request.method === "health") {
    write({
      id: request.id,
      ok: true,
      result: { investigationCoreVersion: "1.0.0", protocolVersion },
      version: protocolVersion,
    });
    continue;
  }
  if (request.method !== "observe") throw new Error("Unexpected fault-injection method");
  investigation = investigation === null
    ? core.create({
      identifier: request.params.identifier,
      operation: request.params.operation,
      query: request.params.query,
      resultCode: request.params.resultCode,
      snapshot: request.params.snapshot,
      workspaceIdentifier: request.params.workspaceIdentifier,
    })
    : core.observe(investigation.identifier, {
      operation: request.params.operation,
      query: request.params.query,
      resultCode: request.params.resultCode,
      snapshot: request.params.snapshot,
    });
  persistAudit();
  write({
    error: {
      code: "INJECTED_BINDING_FAILURE",
      diagnostics: [{
        code: "INJECTED_BINDING_FAILURE",
        message: "The binding lost the successful Core response.",
        operation: "binding",
      }],
      message: "The binding lost the successful Core response.",
      operation: "binding",
    },
    id: request.id,
    ok: false,
    version: protocolVersion,
  });
}
`;
}

test("CCA-MOS-CORE-011: Core resource limits reject oversized transition candidates atomically", () => {
  const core = new InvestigationCore();
  const identifier = "conformance-core-resource-limits";
  const published = core.create({ identifier, snapshot: referenceSnapshot });
  const beforeDigest = published.transitionLog.digest;
  const beforeCount = published.transitionLog.transitions.length;
  const beforeProjection = canonicalize(structuredClone(projectInvestigation(published)));

  const tooMany = new Array(transitionLimit + 1);
  assertResourceLimit(
    () => new TransitionLog("conformance-transition-limit", tooMany),
    "transitionLog",
    "TransitionLog exceeds the Investigation Core resource policy.",
  );
  assert.equal(tooMany.length, transitionLimit + 1);

  const oversizedSnapshot = structuredClone(referenceSnapshot);
  oversizedSnapshot.observationIdentifier = "observation-oversized-core-payload";
  oversizedSnapshot.reflections[0].knowledge = "x".repeat(transitionPayloadLimit + 1);
  assertResourceLimit(
    () => core.observe(identifier, { snapshot: oversizedSnapshot }),
    "transition",
    "Transition payload exceeds the Investigation Core resource policy.",
  );

  const after = core.load(identifier);
  assert.equal(after.transitionLog.digest, beforeDigest);
  assert.equal(after.transitionLog.transitions.length, beforeCount);
  assert.equal(
    canonicalize(structuredClone(projectInvestigation(after))),
    beforeProjection,
  );
});

test("CCA-MOS-SDK-010: public SDK binding failure is single-attempt and adds no transition", () => {
  const python = locatePython();
  const directory = mkdtempSync(resolve(tmpdir(), "memoryos-sdk-no-retry-"));
  try {
    const auditPath = resolve(directory, "binding-audit.json");
    const hostPath = resolve(directory, "fault-host.mjs");
    const snapshotPath = resolve(directory, "snapshot.json");
    const coreUrl = pathToFileURL(resolve(
      WORKSPACE_ROOT,
      "repositories/cca-studio/web/js/investigation-core.js",
    )).href;
    const canonicalUrl = pathToFileURL(resolve(
      WORKSPACE_ROOT,
      "repositories/cca-studio/web/js/mip-canonical.js",
    )).href;
    writeFileSync(hostPath, faultHostSource(coreUrl, canonicalUrl), "utf8");
    writeFileSync(snapshotPath, `${canonicalize(referenceSnapshot)}\n`, "utf8");

    const program = `import json
import sys
from pathlib import Path
from memoryos import MemoryOS, MemoryOSBindingError

snapshot = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
failure = None
with MemoryOS(node_executable=sys.argv[3], binding_host=sys.argv[2]) as memory:
    workspace = memory.open_workspace(snapshot["workspaceIdentifier"])
    try:
        memory.observe(workspace, snapshot, identifier="conformance-sdk-no-retry")
    except MemoryOSBindingError as error:
        failure = {
            "code": error.code,
            "diagnostics": [
                {
                    "code": diagnostic.code,
                    "message": diagnostic.message,
                    "operation": diagnostic.operation,
                }
                for diagnostic in error.diagnostics
            ],
            "message": str(error),
            "operation": error.operation,
        }
if failure is None:
    raise AssertionError("the injected binding failure was not preserved")
print(json.dumps(failure, separators=(",", ":"), sort_keys=True))
`;
    const pythonPath = resolve(WORKSPACE_ROOT, "repositories/cca-sdk/python/src");
    const result = spawnSync(
      python,
      ["-c", program, snapshotPath, hostPath, process.execPath],
      {
        cwd: WORKSPACE_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          MEMORYOS_FAULT_AUDIT: auditPath,
          PYTHONPATH: process.env.PYTHONPATH
            ? `${pythonPath}${delimiter}${process.env.PYTHONPATH}`
            : pythonPath,
        },
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, `Python SDK failure injection failed:\n${result.stderr}`);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      code: "INJECTED_BINDING_FAILURE",
      diagnostics: [{
        code: "INJECTED_BINDING_FAILURE",
        message: "The binding lost the successful Core response.",
        operation: "binding",
      }],
      message: "The binding lost the successful Core response.",
      operation: "binding",
    });

    const audit = JSON.parse(readFileSync(auditPath, "utf8"));
    assert.deepEqual(audit, {
      exactSnapshotTransport: true,
      observedTransitionCount: 1,
      requestMethods: ["health", "observe"],
      transitionKinds: ["CREATED", "OBSERVED"],
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

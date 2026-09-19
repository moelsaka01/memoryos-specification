# MemoryOS private VS Code host harness

This directory is test-only. The extension's deny-by-default `.vscodeignore`
does not admit it or the generated `test-host/out/runner.cjs` bundle into a
VSIX.

The driver downloads or reuses exactly VS Code Desktop `1.137.0`, builds the
private Extension Host runner, and launches every suite with a fresh workspace,
user-data directory, and extensions directory. Development mode loads the
unpacked extension. Installed and Restricted Mode install a caller-supplied
VSIX and load only the private runner as a development extension, so source
files cannot shadow the packaged product.

Acquire the exact host while network access is available:

```text
npm run test:host:acquire
```

After the production extension and VSIX have been built, the single strict
offline closure command is:

```text
npm run test:host:offline
```

`npm run test:host` is the corresponding all-mode entry point that may
acquire the exact host before launching the same network-denied runtime.

`MEMORYOS_VSCODE_TEST_CACHE` may select an external persistent cache. Without
it, the cache is in the operating-system temporary directory. Offline mode
requires the exact platform's completed `1.137.0` cache entry and never falls
back to acquisition. `--mode all` runs development, restricted, and installed
hosts; it therefore always requires `--vsix`.

On Ubuntu, invoke the driver beneath `xvfb-run -a`. A pre-downloaded executable
can be supplied with `--vscode-executable`; the runner still rejects any host
whose `vscode.version` is not exactly `1.137.0`.

Each suite emits one canonical JSON receipt bounded to 256 KiB. Trusted and
installed receipts retain the preparation result and exact canonical
Evaluation Identity and Outcome text and digests for PASS, FAIL, and
COULD_NOT_EVALUATE. Restricted receipts record the untrusted precondition and
handler-level rejection of all four semantic commands. The external driver
adds assertions for isolated directories and cleanup after Extension Host
deactivation. A successful all-mode run also checks development/installed
semantic parity and writes the bounded `hosted-facts.json` consumed by hosted
evidence composition.

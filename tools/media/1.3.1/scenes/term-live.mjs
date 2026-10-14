// Scene: MO-1301 to MO-1307 as LIVE runs on the pinned Node (C:\mos-node is a junction to the pinned toolchain; its SHA-256 is shown in term-export).
//   MO-1301 policy evaluation (FAIL, exit 6) - MO-1304 MCP server answering a real request - MO-1302/1306 CI/CD runner producing and verifying a real bundle
//   - MO-1307 readiness evaluation over the released fixture inputs. MO-1303 (VS Code) and MO-1305 (REST) are labelled FILE scenes: shipped file contents.
import fs from 'node:fs';
import { sleep } from '../lib/winauto.mjs';

export const name = 'term-live';
export const kind = 'terminal';
export const terminalOptions = { startDir: 'C:/mos-demo' };
const REAL_NODE = 'C:/Users/melsa/Documents/Codex/cca-workspace/.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'; // the CI runner refuses a node.exe reached through the C:/mos-node junction
const FIXTURE = 'C:/mos-media/repo131/repositories/cca-conformance/fixtures';

export async function setup() {
  // fresh inputs for the CI/CD workspace and the readiness bundle (copied from the released fixtures), and a clean output location
  fs.rmSync('C:/mos-media/live/ci/work', { recursive: true, force: true });
  fs.cpSync(`${FIXTURE}/mo1306/evaluate-policy-pass`, 'C:/mos-media/live/ci/work', { recursive: true });
  fs.rmSync('C:/mos-media/live/readiness/out', { recursive: true, force: true });
  fs.mkdirSync('C:/mos-demo/out', { recursive: true });
}

export default async function run(T, { mark }) {
  const B = String.fromCharCode(92);
  const win = (p) => p.replaceAll('/', B);
  const typed = (command, options = {}) => T.run(command, { mark, ...options });
  mark('start');
  await sleep(1000);

  // setup lines: plain variables, typed on screen
  await typed(`$node = '${win(REAL_NODE)}'`, { cps: 44, after: 300 });
  await typed(`$repo = '${win('C:/mos-media/repo131')}'`, { cps: 44, after: 300 });
  await typed(`$w = '${win('C:/mos-media/live/ci/work')}'`, { cps: 44, after: 300 });
  await typed(`$ci = "$repo${B}repositories${B}memoryos-ci${B}bin${B}memoryos-ci.mjs"`, { cps: 44, after: 900 });
  await T.clear();

  // MO-1301 Investigation Policies: a real evaluation, exit 6 means FAIL
  mark('policy-start');
  await typed(`memoryos policy evaluate --policy policy${B}fail${B}policy.json --package policy${B}fail${B}candidate.mip --outcome out${B}fail.outcome.json --identity-output out${B}fail.identity.json --evaluation-identity-digest-output out${B}fail.identity.sha256 --outcome-digest-output out${B}fail.outcome.sha256`, { cps: 70, after: 700 });
  await typed('$LASTEXITCODE', { cps: 30, after: 1800 });
  mark('policy-done');
  await T.clear();

  // MO-1304 MCP server: starts the released server and sends it real requests
  mark('mcp-start');
  await typed(`& $node "$repo${B}tools${B}media${B}mcp-call.mjs" ${win('C:/mos-media/live/memoryos-mcp/bin/memoryos-mcp.mjs')}`, { cps: 46, after: 3200 });
  mark('mcp-done');
  await T.clear();

  // MO-1302 / MO-1306 CI/CD runner: a real run produces a bundle, and the verifier re-checks it
  mark('ci-start');
  await typed(`$r = & $node --max-old-space-size=128 $ci run --workspace $w --config "$w${B}memoryos-ci.json" | ConvertFrom-Json`, { cps: 46, after: 600, timeoutMs: 180000 });
  mark('ci-run-done');
  await typed('$r | Format-List classification, exitCode, publication, runId', { cps: 40, after: 1400 });
  await typed(`Get-ChildItem "$w${B}.memoryos-ci${B}out${B}$($r.runId)" | Select-Object Name`, { cps: 44, after: 1400 });
  await typed(`& $node --max-old-space-size=128 $ci verify --bundle "$w${B}.memoryos-ci${B}out${B}$($r.runId)"`, { cps: 46, after: 2200, timeoutMs: 180000 });
  mark('ci-done');
  await T.clear();

  // MO-1307 Release Governance and Readiness: a real evaluation over the released fixture inputs
  mark('readiness-start');
  await typed(`$in = '${win('C:/mos-media/live/readiness/input')}'`, { cps: 46, after: 300 });
  await typed(`$pins = Get-Content "$in${B}pins.json" | ConvertFrom-Json`, { cps: 46, after: 500 });
  await typed(`& $node "$repo${B}repositories${B}memoryos-readiness${B}bin${B}memoryos-readiness.mjs" evaluate --input-root $in --config configuration.json --authority authority.json --authority-sha256 $pins.trustedAuthorityDigest --candidate-sha256 $pins.expectedCandidateDigest --output-root ${win('C:/mos-media/live/readiness/out')}`, { cps: 70, after: 2800, timeoutMs: 180000 });
  mark('readiness-done');
  await T.clear();

  // File scenes (labelled in the edit): shipped file contents, not live runs
  mark('files-start');
  await typed(`Select-String -Path "$repo${B}repositories${B}memoryos-vscode${B}package.json" -Pattern '"title"' | ForEach-Object { $_.Line.Trim() } | Select-Object -First 8`, { cps: 60, after: 2200 });
  mark('vscode-file');
  await typed(`(Get-Content "$repo${B}repositories${B}memoryos-rest${B}contracts${B}openapi.json" -Raw | ConvertFrom-Json).paths.PSObject.Properties.Name`, { cps: 60, after: 3000 });
  mark('rest-file');
  mark('end');
}

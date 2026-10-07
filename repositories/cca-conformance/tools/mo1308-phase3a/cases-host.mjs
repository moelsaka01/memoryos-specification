// MO-1308 Phase 3A step A on the Windows host: A1 (host identity), A2 (Node executable), A4 and A5 (gate inputs read from the seal),
// A6 (environment capture) and A7 (idle load sample). A3 is platform-neutral and lives in cases-det.mjs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conclude, work } from './env.mjs';
import { HERE, dirSymlink, fileSymlink, junction, removeTree, runPowerShell, runPython, sha256, sleep } from './win.mjs';
import { walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { sharedToolPaths } from '../mo1308-phase3/lib/seal.mjs';
import { validateReview } from '../mo1308-phase3/lib/receipts.mjs';

export const PINNED_NODE = Object.freeze({ version: 'v24.21.0', sha256: 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32', byteLength: 93580104 });
export const BASELINE_COMMIT = '1dd1e8c82fe0ed5a32a894744392f2c279f89d4c';
const PRECONDITION_RECEIPT = 'repositories/cca-conformance/evidence/mo1308/phase3-precondition-g3/receipt.json';
const PRECONDITION_BINDING = 'repositories/cca-conformance/evidence/mo1308/phase3-precondition-g3/binding.json';
export const GATE_INPUTS = Object.freeze([PRECONDITION_RECEIPT, PRECONDITION_BINDING]);
export const HARNESS_REVIEW = 'repositories/cca-conformance/evidence/mo1308/phase3a-harness-review/review.json';

const capture = (env) => (env.cache.capture ??= (() => {
  const result = runPython(env, 'hostcapture.py', [work(env, 'host')], { purpose: 'host identity and configuration (3A-A1, 3A-A6)' });
  if (result.status !== 0 || result.json === null) throw new Error(`hostcapture.py failed: ${String(result.stderr).slice(0, 200)}`);
  return result.json;
})());

const loadSeal = (env) => {
  if (env.evidenceDir === null || !fs.existsSync(path.join(env.evidenceDir, 'seal.json'))) throw new Error('no sealed generation: the gate inputs are read from seal.json');
  return JSON.parse(fs.readFileSync(path.join(env.evidenceDir, 'seal.json'), 'utf8'));
};

export const hostCases = {
  '3A-A1': (h, env) => {
    const problems = [];
    const host = capture(env);
    const build = Number(host.version.currentBuild);
    if (process.platform !== 'win32') problems.push(`platform ${process.platform}`);
    if (process.arch !== 'x64') problems.push(`architecture ${process.arch}`);
    if (!(build >= 22000)) problems.push(`Windows build ${host.version.currentBuild} is not Windows 11 (22000 or later)`);
    if (host.volume.fileSystem !== 'NTFS') problems.push(`the work volume is ${host.volume.fileSystem}, not NTFS`);
    const repoVolume = runPython(env, 'hostcapture.py', [env.repo], { purpose: 'worktree volume (3A-A1)' }).json;
    if (repoVolume?.volume?.fileSystem !== 'NTFS') problems.push('the worktree volume is not NTFS');
    if (host.volume.freeBytes < 8 * 1024 ** 3) problems.push(`free space ${host.volume.freeBytes} is below the 8 GiB the ceiling run needs`);
    conclude(h, problems, { windowsBuild: `build ${host.version.currentBuild}.${host.version.ubr} (${host.version.displayVersion}; the registry product name reads "${host.version.productName}" on every Windows 11 build; build 22000 or later is Windows 11)`, windows11: build >= 22000, osRelease: os.release(), arch: process.arch, volume: host.volume, worktreeVolumeSerial: repoVolume?.volume?.serial ?? null, freeSpaceGiB: Math.round(host.volume.freeBytes / 1024 ** 3) });
  },
  '3A-A2': (h) => {
    const problems = [];
    const bytes = fs.readFileSync(process.execPath);
    const digest = sha256(bytes);
    if (process.version !== PINNED_NODE.version) problems.push(`Node ${process.version}`);
    if (digest !== PINNED_NODE.sha256) problems.push(`executable SHA-256 ${digest}`);
    if (bytes.length !== PINNED_NODE.byteLength) problems.push(`executable length ${bytes.length}`);
    if (process.platform !== 'win32' || process.arch !== 'x64') problems.push('not win-x64');
    conclude(h, problems, { version: process.version, sha256: digest, byteLength: bytes.length, execPath: path.basename(process.execPath) });
  },
  '3A-A4': (h, env) => {
    const problems = [];
    const seal = loadSeal(env);
    const bound = new Map(seal.inputs.map((input) => [input.path, input]));
    for (const file of GATE_INPUTS) if (!bound.has(file)) problems.push(`${file} is not a bound input`);
    let verdict = null;
    let candidateCommit = null;
    if (problems.length === 0) {
      const receiptBytes = fs.readFileSync(path.join(env.repo, PRECONDITION_RECEIPT));
      if (sha256(receiptBytes) !== bound.get(PRECONDITION_RECEIPT).sha256) problems.push('the receipt changed since the seal');
      const receipt = JSON.parse(receiptBytes.toString('utf8'));
      const binding = JSON.parse(fs.readFileSync(path.join(env.repo, PRECONDITION_BINDING), 'utf8'));
      if (sha256(fs.readFileSync(path.join(env.repo, PRECONDITION_BINDING))) !== bound.get(PRECONDITION_BINDING).sha256) problems.push('the binding changed since the seal');
      if (binding.receipt?.sha256 !== sha256(receiptBytes)) problems.push('the binding does not hash this receipt');
      verdict = receipt.verdict;
      candidateCommit = receipt.candidate?.commit ?? null;
      if (verdict !== 'PASS') problems.push(`the receipt verdict is ${verdict}`);
      if (receipt.kind !== 'MO1308Phase3PreconditionG3Receipt') problems.push(`receipt kind ${receipt.kind}`);
      if (receipt.baseline?.commit !== BASELINE_COMMIT) problems.push(`baseline ${receipt.baseline?.commit}`);
      if (candidateCommit !== env.identity.baseCommit) problems.push(`the receipt is about candidate ${candidateCommit}, not ${env.identity.baseCommit}`);
      if (Object.values(receipt.rules ?? {}).some((value) => value !== true) || Object.keys(receipt.rules ?? {}).length < 4) problems.push('a precondition rule is not true');
    }
    conclude(h, problems, { verdict, baseline: BASELINE_COMMIT, candidate: candidateCommit, receiptSha256: bound.get(PRECONDITION_RECEIPT)?.sha256 ?? null });
  },
  '3A-A5': (h, env) => {
    const problems = [];
    const seal = loadSeal(env);
    // the sealed tool inventory equals what is on disk now: the shared tools plus every file of this stream's harness
    const expected = [...sharedToolPaths(env.repo), ...walkRecords(HERE).map((row) => `repositories/cca-conformance/tools/mo1308-phase3a/${row.path}`)].sort();
    const sealed = seal.tools.map((tool) => tool.path).sort();
    if (JSON.stringify(expected) !== JSON.stringify(sealed)) problems.push(`the tool set differs from the sealed inventory (${expected.length} on disk, ${sealed.length} sealed)`);
    for (const tool of seal.tools) {
      let current = null;
      try { current = sha256(fs.readFileSync(path.join(env.repo, tool.path))); } catch { current = null; }
      if (current !== tool.sha256) problems.push(`${tool.path}: not the sealed bytes`);
    }
    for (const input of seal.inputs) if (/rehearsal/i.test(input.path)) problems.push(`${input.path}: rehearsal evidence is bound as an input`);
    for (const required of GATE_INPUTS) if (!seal.inputs.some((input) => input.path === required)) problems.push(`${required}: not bound`);
    let review = null;
    if (seal.certifying) {
      if (seal.harnessReview === null) problems.push('no harness review is bound');
      else {
        const value = JSON.parse(fs.readFileSync(path.join(env.repo, seal.harnessReview.path), 'utf8'));
        const reviewProblems = validateReview(value);
        if (reviewProblems.length > 0) problems.push(`the review is invalid: ${reviewProblems[0]}`);
        if (value.conclusion !== 'NO_BLOCKING_FINDINGS') problems.push('the review has open blocking findings');
        if (value.reviewer.role !== 'INDEPENDENT_SUB_AGENT') problems.push(`reviewer role ${value.reviewer.role}`);
        // the review is of the final harness bytes: every subject hash is a sealed tool hash
        const sealedByPath = new Map(seal.tools.map((tool) => [tool.path, tool.sha256]));
        const harness = seal.tools.filter((tool) => tool.path.startsWith('repositories/cca-conformance/tools/mo1308-phase3a/'));
        for (const subject of value.subject) if (sealedByPath.get(subject.path) !== subject.sha256) problems.push(`review subject ${subject.path} is not the sealed byte hash`);
        for (const tool of harness) if (!value.subject.some((subject) => subject.path === tool.path)) problems.push(`harness file ${tool.path} was not reviewed`);
        review = { reviewer: value.reviewer, findings: value.findings.length, subjectFiles: value.subject.length };
      }
    } else if (seal.harnessReview !== null) review = { boundInRehearsal: seal.harnessReview.path };
    conclude(h, problems, { toolsSealed: sealed.length, inputs: seal.inputs.map((input) => input.path), certifying: seal.certifying, harnessReview: seal.certifying ? review : 'not required for a rehearsal (the review follows the final rehearsal)' });
  },
  '3A-A6': (h, env) => {
    const host = capture(env);
    const defender = runPowerShell(env, 'Get-MpComputerStatus | Select-Object AntivirusEnabled,AMServiceEnabled,RealTimeProtectionEnabled,BehaviorMonitorEnabled,IoavProtectionEnabled,OnAccessProtectionEnabled,AntivirusSignatureVersion | ConvertTo-Json -Compress', { purpose: 'Defender state (3A-A6)' });
    let antivirus = null;
    try { antivirus = JSON.parse(defender.stdout); } catch { antivirus = { unreadable: String(defender.stderr).slice(0, 120) }; }
    const probe = work(env, 'a6');
    const privilege = {};
    const target = path.join(probe, 'target'); fs.mkdirSync(target); fs.writeFileSync(path.join(probe, 'file.txt'), 'x');
    for (const [name, make, at] of [['directorySymlink', dirSymlink, 'ds'], ['fileSymlink', (t, a) => fileSymlink(path.join(probe, 'file.txt'), a), 'fs'], ['junction', junction, 'jn']]) {
      try { make(target, path.join(probe, at)); privilege[name] = 'created'; } catch (error) { privilege[name] = `refused ${error.code}`; }
    }
    removeTree(env.workRoot, probe);
    const cpus = os.cpus();
    h.observe({
      windows: host.version, fileSystemSettings: host.fileSystemSettings, shortNames: host.shortNames, security: host.security, antivirus,
      unprivilegedLinkCreation: privilege, cpu: { count: cpus.length, model: cpus[0]?.model ?? null }, memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
      volume: host.volume, nodeOptionsAtStart: process.env.NODE_OPTIONS ?? null,
    });
  },
  '3A-A7': async (h) => {
    const before = os.cpus().map((cpu) => cpu.times);
    await sleep(1000);
    const after = os.cpus().map((cpu) => cpu.times);
    let busy = 0; let total = 0;
    after.forEach((times, index) => {
      const delta = Object.fromEntries(Object.keys(times).map((key) => [key, times[key] - before[index][key]]));
      const sum = Object.values(delta).reduce((left, right) => left + right, 0);
      total += sum; busy += sum - delta.idle;
    });
    h.observe({ cpuBusyPercentOverOneSecond: total === 0 ? null : Math.round((busy / total) * 1000) / 10, freeMemoryMiB: Math.round(os.freemem() / 1048576), uptimeHours: Math.round(os.uptime() / 360) / 10 });
  },
};

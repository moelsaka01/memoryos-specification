// New generation only: N15 once first, then the other106 exact selected callbacks after filesystem preservation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, absolute, toolRoot, evidenceRoot, record, write, regressionCases, beginCampaign, verifyBindings, finishCampaign } from './validation-bindings.mjs';

const n15Id = 'native-foundation-016';
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function inventory() {
  const relative = toolRoot + '/regression-inventory.json';
  const value = JSON.parse(fs.readFileSync(absolute(relative), 'utf8'));
  assert.equal(value.kind, 'MO1307N15CorrectionExactRegressionInventory');
  assert.equal(value.total, 107); assert.equal(value.suites.length, regressionCases.length);
  for (const [index, suite] of value.suites.entries()) {
    const [id, file, expected] = regressionCases[index];
    assert.equal(suite.id, id); assert.equal(suite.file, 'repositories/cca-conformance/tests/' + file);
    assert.equal(suite.expectedTests, expected); assert.equal(suite.names.length, expected);
    assert.equal(new Set(suite.names).size, expected); assert.deepEqual(record(suite.file), suite.source);
    for (const name of suite.names) {
      assert.equal(typeof name, 'string'); assert.ok(name.length > 0 && !/[\r\n]/u.test(name));
      const pattern = new RegExp('^' + escapePattern(name) + '$');
      assert.deepEqual(suite.names.filter(candidate => pattern.test(candidate)), [name]);
    }
  }
  const cases = value.suites.flatMap(suite => suite.names.map((name, index) => ({
    id: suite.id + '-' + String(index + 1).padStart(3, '0'), suite: suite.id, file: suite.file,
    testName: name, suiteNames: suite.names, sourceSuiteTests: suite.expectedTests,
  })));
  assert.equal(cases.length, 107); assert.equal(new Set(cases.map(row => row.id)).size, 107);
  assert.equal(cases.find(row => row.id === n15Id)?.testName, 'N15 native fixed PowerShell snapshots and checked inspection sanitization');
  return { relative, value, cases };
}

function parseTap(stdout, command) {
  const tap = stdout.toString('utf8');
  const count = key => Number(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'm').exec(tap)?.[1] ?? NaN);
  const tests = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, count(key)]));
  const testNames = [...tap.matchAll(/^# Subtest: (.+)\r?$/gm)].map(match => match[1].trimEnd());
  const outcomes = [...tap.matchAll(/^(ok|not ok) \d+ - (.+)\r?$/gm)].map(match => {
    const detail = match[2].trimEnd(), directive = /\s+#\s+(SKIP|TODO)\b.*$/iu.exec(detail);
    return { status: match[1], name: directive ? detail.slice(0, directive.index) : detail, directive: directive?.[1].toUpperCase() ?? null };
  });
  const selected = outcomes.filter(outcome => outcome.name === command.testName);
  const excludedRegistrations = outcomes.filter(outcome => outcome.name !== command.testName);
  const selectedPass = selected.length === 1 && selected[0].status === 'ok' && selected[0].directive === null;
  const excludedOnly = excludedRegistrations.every(outcome => command.suiteNames.includes(outcome.name) && outcome.status === 'ok' && outcome.directive === 'SKIP');
  const countsMatch = tests.pass === 1 && tests.tests === outcomes.length && tests.skipped === excludedRegistrations.length && ['fail', 'cancelled', 'todo'].every(key => tests[key] === 0);
  const registrationsMatch = testNames.length === outcomes.length && new Set(testNames).size === testNames.length && new Set(outcomes.map(outcome => outcome.name)).size === outcomes.length && testNames.every(name => command.suiteNames.includes(name)) && testNames.includes(command.testName);
  return { tests, testNames, selected, excludedRegistrations, passed: selectedPass && excludedOnly && countsMatch && registrationsMatch };
}

function captureN15(context, pid) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0, 'Actual selected Node process PID required');
  // Node24.21 --test-isolation=none makes this exact spawn PID the fixture process.pid.
  // https://r2.nodejs.org/docs/latest-v24.x/api/cli.html#--test-isolationmode
  const directory = path.join(root, '.cache', 'mo1307', 'phase1', 'native-foundation-' + pid);
  const target = context.output + '/native-capture';
  const files = [];
  function copy(prefix = '') {
    for (const entry of fs.readdirSync(path.join(directory, prefix), { withFileTypes: true }).sort((a,b) => a.name < b.name ? -1 : 1)) {
      assert.equal(entry.isSymbolicLink(), false, 'N15 capture cannot follow links');
      const relative = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        assert.ok(['native-input','native-result','native-output'].includes(relative), 'Only N15 fixture directories may be retained');
        copy(relative);
      }
      else {
        assert.equal(entry.isFile(), true);
        assert.ok(/^(?:helper-(?:[1-9]|10)\.(?:request|stdout|stderr)|native-input\/(?:authority|config|candidate|manifest|evidence)\.json|native-result\/result\.json|native-output\/memoryos-readiness-result\.json\.pending)$/u.test(relative), 'Only predeclared N15 capture members');
        assert.ok(files.length < 37, 'N15 capture member ceiling');
        const bytes = fs.readFileSync(path.join(directory, relative));
        assert.ok(bytes.length <= 16777216, 'Bounded N15 retained file');
        fs.mkdirSync(path.dirname(absolute(target + '/' + relative)), { recursive: true });
        write(target + '/' + relative, bytes);
        files.push({ originalPath: path.join(directory, relative), ...record(target + '/' + relative) });
      }
    }
  }
  if (fs.existsSync(directory)) copy();
  const frames = [];
  for (let ordinal = 1; ordinal <= 10; ordinal++) {
    const requestPath = target + '/helper-' + ordinal + '.request', responsePath = target + '/helper-' + ordinal + '.stdout', stderrPath = target + '/helper-' + ordinal + '.stderr';
    if (!fs.existsSync(absolute(requestPath))) break;
    const entry = { ordinal, request: record(requestPath), response: record(responsePath), stderr: record(stderrPath) };
    try {
      const request = fs.readFileSync(absolute(requestPath)), response = fs.readFileSync(absolute(responsePath));
      assert.ok(request.length >= 4 && response.length >= 4); assert.equal(request.readUInt32BE(0), request.length - 4); assert.equal(response.readUInt32BE(0), response.length - 4);
      const req = JSON.parse(request.subarray(4)), res = JSON.parse(response.subarray(4));
      Object.assign(entry, { sequence: req.sequence, operation: req.operation, responseSequence: res.sequence, responseOperation: res.operation, responseSessionMatches: res.session === req.session, status: res.status, code: res.code, stderrBytes: fs.statSync(absolute(stderrPath)).size });
    } catch (error) { entry.decodeFailure = { name: error.name, message: error.message }; }
    frames.push(entry);
  }
  const capture = { kind: 'MO1307N15CorrectionExactTestCapture', directory, selectedProcessPid: pid, derivation: 'Exact spawnSync PID with documented --test-isolation=none; no directory search or alternate PID selection', files, frames, originalTestHelperInvocationsExpectedOnPass: 10, freshnessScope: 'A complete N15 PASS proves its30 raw exchange files were created with exclusive wx by this selected test. Failed-test partial captures are retained as observed bytes without claiming unrecorded process events or attributing preexisting contamination to this invocation.', scope: 'Original request/response/stderr and fixture files retained after the one selected test. Helper exit0/stderr0 are assertions inside unchanged runHelper; per-helper exit events and elapsed times are not separately serialized.' };
  write(context.output + '/native-capture.json', capture);
  return capture;
}

export function runSelectedRegressionStage(mode) {
  assert.ok(mode === 'n15' || mode === 'regressions');
  const declared = inventory();
  const context = beginCampaign(mode);
  const selectedCases = mode === 'n15' ? declared.cases.filter(row => row.id === n15Id) : declared.cases.filter(row => row.id !== n15Id);
  assert.equal(selectedCases.length, mode === 'n15' ? 1 : 106);
  let priorN15 = null;
  if (mode === 'regressions') {
    priorN15 = JSON.parse(fs.readFileSync(absolute(evidenceRoot + '/n15/receipt.json'), 'utf8'));
    assert.equal(priorN15.result, 'PASS'); assert.equal(priorN15.sourcesUnchanged, true);
    assert.equal(priorN15.sourceIdentity, context.manifest.sourceIdentity); assert.deepEqual(priorN15.source, context.manifestBinding);
    assert.equal(priorN15.selectedTestPasses, 1); assert.deepEqual(priorN15.commands.map(row => row.id), [n15Id]);
    assert.equal(priorN15.commands[0].result, 'PASS');
  }
  const commands = [
    ...(mode === 'regressions' ? [{ id: 'package-check', args: ['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check'], expectedTests: null, outerGuardMs: 60000 }] : []),
    ...selectedCases.map(row => ({ ...row, args: ['--test','--test-reporter=tap','--test-concurrency=1',...(mode === 'n15' ? ['--test-isolation=none'] : []),'--test-name-pattern=^' + escapePattern(row.testName) + '$',row.file], expectedTests: 1, outerGuardMs: 90000 })),
  ];
  write(context.output + '/plan.json', { mode, commands, inventory: record(declared.relative), freshSelectedTests: selectedCases.length, fullInventory: 107, n15NeverRerun: true, predecessor: mode === 'n15' ? 'approved correction/source seal' : 'same-generation N15 and filesystem preservation PASS', stopBoundary: 'One exact selected callback per fresh process, no later command after first mandatory failure.', productDeadlinesUnchanged: true });
  const rows = []; let failure = null;
  try {
    for (const command of commands) {
      verifyBindings(context);
      const started = performance.now();
      const result = spawnSync(process.execPath, command.args, { cwd: root, windowsHide: true, shell: false, encoding: null, timeout: command.outerGuardMs, maxBuffer: 16 * 1024 * 1024 });
      const stdout = result.stdout ?? Buffer.alloc(0), stderr = result.stderr ?? Buffer.alloc(0);
      const out = context.output + '/' + command.id + '.stdout.txt', err = context.output + '/' + command.id + '.stderr.txt'; write(out, stdout); write(err, stderr);
      const row = { ...command, executable: process.execPath, pid: result.pid, exitCode: result.status, signal: result.signal, error: result.error ? {code:result.error.code??null,message:result.error.message}:null, elapsedMs: performance.now() - started, stdout: record(out), stderr: record(err), result: result.status === 0 && !result.error && result.signal === null ? 'PASS' : 'FAIL' };
      if (command.expectedTests === 1) {
        const parsed = parseTap(stdout, command); Object.assign(row, parsed); if (!parsed.passed) row.result = 'FAIL';
      } else if (row.result === 'PASS') {
        try { row.packageCheck = JSON.parse(stdout); assert.equal(row.packageCheck.members,89); assert.equal(row.packageCheck.contractMembers,53); assert.equal(row.packageCheck.externalProductionDependencies,0); } catch { row.result = 'FAIL'; }
      }
      if (mode === 'n15') {
        try {
          const capture = captureN15(context, result.pid); row.nativeCapture = record(context.output + '/native-capture.json');
          if (row.result === 'PASS') {
            assert.equal(capture.frames.length, 10); assert.equal(capture.files.filter(file => /\/helper-\d+\.(request|stdout|stderr)$/u.test(file.path)).length, 30);
            assert.deepEqual(capture.frames.map(frame => [frame.sequence, frame.operation, frame.status]), [[1,'READ_SET','OK'],[2,'READ_SET','OK'],[3,'READ_SET','OK'],[4,'READ_SET','OK'],[4,'CHECK_OUTPUT','ABSENT'],[5,'CHECK_OUTPUT','ABSENT'],[6,'INSPECT_OUTPUT_ROOT','OK'],[7,'CHECK_STAGE_ROOT','OK'],[8,'INSPECT_PENDING','OK'],[9,'CHECK_FINALIZATION','FINAL_ABSENT']]);
            assert.ok(capture.frames.every(frame => !frame.decodeFailure && frame.code === null && frame.stderrBytes === 0 && frame.responseSessionMatches && frame.responseSequence === frame.sequence && frame.responseOperation === frame.operation));
          }
        } catch (error) { row.captureFailure = {name:error.name,message:error.message}; row.result = 'FAIL'; }
      }
      rows.push(row); write(context.output + '/' + command.id + '.receipt.json', row);
      console.log(JSON.stringify({stage:mode,id:row.id,result:row.result,tests:row.tests??null}));
      if (row.result !== 'PASS') throw new Error('Required selected test or command failed: ' + command.id);
    }
  } catch (error) { failure = { name:error.name,message:error.message,stack:error.stack }; }
  finally {
    const sameGenerationN15 = mode === 'regressions' ? record(evidenceRoot + '/n15/receipt.json') : null;
    const freshIds = rows.filter(row => row.expectedTests === 1 && row.result === 'PASS').map(row => row.id);
    const combinedIds = mode === 'regressions' ? [n15Id,...freshIds] : freshIds;
    if (failure === null) {
      try { assert.deepEqual([...combinedIds].sort(), (mode === 'regressions' ? declared.cases : selectedCases).map(row => row.id).sort()); }
      catch (error) { failure = {name:error.name,message:error.message}; }
    }
    finishCampaign(context, { suite: mode === 'n15' ? 'N15-first' : 'existing107-completed', result: failure === null && rows.length === commands.length ? 'PASS' : 'FAIL', expectedTests: mode === 'n15' ? 1 : 107, freshSelectedTests: selectedCases.length, freshSelectedTestPasses:freshIds.length, selectedTestPasses:combinedIds.length, completedSelectedIds:combinedIds, sameGenerationN15, historicalResultsPromoted:0, commands:rows, notRun:commands.filter(command => !rows.some(row => row.id === command.id)).map(row=>row.id), failure, scope:'One exact current-source generation. N15 is counted once; native filesystem already ran once as immediate preservation and full native regression. Two TOCTOU controls remain separately mandatory.' });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runSelectedRegressionStage('regressions');

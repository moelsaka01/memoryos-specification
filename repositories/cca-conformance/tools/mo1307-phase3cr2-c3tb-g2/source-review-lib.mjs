// Dependency-aware source/security review for exact MO-1307 C3RB -> C3TB.
// This module reads Git objects and evidence only. It never launches product or helper code.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
export const TOOL_RELATIVE = 'repositories/cca-conformance/tools/mo1307-phase3cr2-c3tb-g2';
export const MANIFEST_RELATIVE = `${TOOL_RELATIVE}/source-review-manifest.json`;
export const REUSE_RELATIVE = 'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2/dependency-reuse.json';
const GIT = 'C:/Program Files/Git/cmd/git.exe';
const CATEGORIES = Object.freeze([
  'AUTHORIZED_HEADLESS_CORRECTION',
  'AUTHORIZED_NATIVE_LASTERROR_CORRECTION',
  'AUTHORIZED_OPEN_CHAIN_CORRECTION',
  'AUTHORIZED_DEADLINE_CORRECTION',
  'DERIVED_METADATA_CHANGE',
  'DOCUMENTATION_ONLY',
  'UNEXPECTED_CHANGE',
]);
const CHANGED_DEPENDENCY_PATHS = Object.freeze([
  'repositories/memoryos-readiness/contracts/definitions.json',
  'repositories/memoryos-readiness/src/constants.mjs',
]);

export class SourceReviewFailure extends Error {
  constructor(code, message, details = null, action = 'STOP') {
    super(message);
    this.name = 'SourceReviewFailure';
    this.code = code;
    this.details = details;
    this.action = action;
  }
}

export const UNEXPECTED_SOURCE_DELTA = 'PHASE3CR2_UNEXPECTED_SOURCE_DELTA';

function requireReview(condition, code, message, details = null, action = 'STOP') {
  if (!condition) throw new SourceReviewFailure(code, message, details, action);
}

function requireAuthorizedDelta(condition, reason, message, details = null) {
  if (!condition) {
    throw new SourceReviewFailure(UNEXPECTED_SOURCE_DELTA, message, {
      category: 'UNEXPECTED_CHANGE',
      reason,
      details,
    });
  }
}

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export const sha256 = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
export const valueSha256 = value => sha256(Buffer.from(canonical(value)));
const slash = value => value.replaceAll('\\', '/');
const ordinal = values => [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
const sameOrdinalSet = (left, right) => canonical(ordinal(new Set(left))) === canonical(ordinal(new Set(right)));
const count = (text, expression) => [...text.matchAll(expression)].length;

function rawGit(args, input = undefined) {
  const result = spawnSync(GIT, [
    '-c', 'core.longpaths=true',
    '-c', `safe.directory=${slash(path.resolve(ROOT))}`,
    ...args,
  ], {
    cwd: ROOT,
    input,
    windowsHide: true,
    shell: false,
    maxBuffer: 512 * 1024 * 1024,
  });
  requireReview(!result.error, 'GIT_EXECUTION_FAILURE', `${GIT}: ${result.error?.message ?? 'spawn failed'}`);
  requireReview(result.status === 0, 'GIT_EXECUTION_FAILURE', `${GIT} ${args.join(' ')} failed`, {
    status: result.status,
    stderr: result.stderr?.toString('utf8'),
  });
  return result.stdout;
}

const gitText = (args, input = undefined) => rawGit(args, input).toString('utf8').trim();
const gitShow = (commit, relative) => rawGit(['show', `${commit}:${relative}`]);

function pinBytes(relative, bytes, extra = {}) {
  return { path: relative, byteLength: bytes.length, sha256: sha256(bytes), ...extra };
}

function gitPin(commit, relative) {
  const bytes = gitShow(commit, relative);
  const gitBlob = gitText(['rev-parse', `${commit}:${relative}`]);
  requireReview(gitText(['hash-object', '--stdin'], bytes) === gitBlob, 'GIT_OBJECT_MISMATCH', relative);
  return pinBytes(relative, bytes, { commit, gitBlob });
}

export function filePin(relative) {
  const absolute = path.join(ROOT, relative);
  const stat = fs.lstatSync(absolute);
  requireReview(stat.isFile() && !stat.isSymbolicLink(), 'TOOL_SOURCE_NOT_REGULAR', relative);
  const bytes = fs.readFileSync(absolute);
  return pinBytes(relative, bytes, { gitBlob: gitText(['hash-object', '--stdin'], bytes) });
}

export function loadSourceReviewManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_RELATIVE), 'utf8'));
  requireReview(manifest.kind === 'MO1307Phase3CR2DependencyAwareSourceReviewManifest', 'MANIFEST_KIND', manifest.kind);
  requireReview(manifest.version === '1.0.0', 'MANIFEST_VERSION', manifest.version);
  requireReview(manifest.expectedDiff.hunkCount === manifest.hunks.length, 'MANIFEST_HUNK_COUNT', 'Manifest hunk count mismatch');
  requireReview(manifest.files.length === 9, 'MANIFEST_FILE_COUNT', 'Expected nine changed product members');
  requireReview(manifest.hunks.every(row => CATEGORIES.includes(row.category)), 'MANIFEST_CATEGORY', 'Unknown category');
  return manifest;
}

const hunkKey = row => `${row.path}@-${row.oldStart},${row.oldCount}+${row.newStart},${row.newCount}`;

export function parseUnifiedZeroDiff(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const text = bytes.toString('utf8');
  requireReview(!text.includes('\r'), 'DIFF_NOT_LF', 'Git source diff must use LF bytes');
  const lines = text.split('\n');
  const files = [];
  const hunks = [];
  let currentFile = null;
  let currentHunk = null;
  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
      requireReview(Boolean(match) && match[1] === match[2], 'DIFF_PATH_HEADER', line);
      currentFile = { path: match[2], oldBlob: null, newBlob: null, hunks: [] };
      files.push(currentFile);
      currentHunk = null;
      continue;
    }
    if (line.startsWith('index ') && currentFile) {
      const match = /^index ([0-9a-f]{7,40})\.\.([0-9a-f]{7,40})(?: [0-7]{6})?$/u.exec(line);
      requireReview(Boolean(match), 'DIFF_INDEX_HEADER', line);
      currentFile.oldBlob = match[1];
      currentFile.newBlob = match[2];
      continue;
    }
    if (line.startsWith('@@ ')) {
      requireReview(Boolean(currentFile), 'DIFF_HUNK_WITHOUT_FILE', line);
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/u.exec(line);
      requireReview(Boolean(match), 'DIFF_HUNK_HEADER', line);
      currentHunk = {
        path: currentFile.path,
        header: line,
        oldStart: Number(match[1]), oldCount: match[2] === undefined ? 1 : Number(match[2]),
        newStart: Number(match[3]), newCount: match[4] === undefined ? 1 : Number(match[4]),
        removed: [], added: [], noNewlineMarker: false,
      };
      currentHunk.id = hunkKey(currentHunk);
      currentFile.hunks.push(currentHunk);
      hunks.push(currentHunk);
      continue;
    }
    if (currentHunk && line.startsWith('-') && !line.startsWith('---')) currentHunk.removed.push(line.slice(1));
    else if (currentHunk && line.startsWith('+') && !line.startsWith('+++')) currentHunk.added.push(line.slice(1));
    else if (currentHunk && line === '\\ No newline at end of file') currentHunk.noNewlineMarker = true;
  }
  for (const hunk of hunks) {
    requireReview(hunk.removed.length === hunk.oldCount, 'DIFF_OLD_COUNT', hunk.id);
    requireReview(hunk.added.length === hunk.newCount, 'DIFF_NEW_COUNT', hunk.id);
  }
  return { bytes, text, files, hunks };
}

function stripJavaScriptComments(lines) {
  let block = false;
  const projected = [];
  for (const line of lines) {
    let output = '';
    let quote = null;
    let escaped = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (block) {
        if (char === '*' && next === '/') { block = false; index += 1; }
        continue;
      }
      if (quote !== null) {
        output += char;
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"' || char === '`') { quote = char; output += char; continue; }
      if (char === '/' && next === '/') break;
      if (char === '/' && next === '*') { block = true; index += 1; continue; }
      output += char;
    }
    if (output.trim().length > 0) projected.push(output.trimEnd());
  }
  return projected;
}

function stripPowerShellComments(lines) {
  const projected = [];
  for (const line of lines) {
    let output = '';
    let quote = null;
    let escaped = false;
    for (const char of line) {
      if (quote !== null) {
        output += char;
        if (escaped) escaped = false;
        else if (char === '`') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"') { quote = char; output += char; continue; }
      if (char === '#') break;
      output += char;
    }
    if (output.trim().length > 0) projected.push(output.trimEnd());
  }
  return projected;
}

export function executableProjection(lines, relative) {
  if (/\.ps1$/iu.test(relative)) return stripPowerShellComments(lines);
  if (/\.(?:mjs|js|cjs)$/iu.test(relative)) return stripJavaScriptComments(lines);
  return [...lines];
}

export function projectHunkExecutable(hunk) {
  const before = executableProjection(hunk.removed, hunk.path);
  const after = executableProjection(hunk.added, hunk.path);
  return {
    before,
    after,
    beforeSha256: valueSha256(before),
    afterSha256: valueSha256(after),
    equivalent: canonical(before) === canonical(after),
  };
}

export function classifySyntheticCommentHunk(hunk) {
  const projection = projectHunkExecutable(hunk);
  return {
    category: projection.equivalent ? 'DOCUMENTATION_ONLY' : 'UNEXPECTED_CHANGE',
    executableEquivalent: projection.equivalent,
    beforeSha256: projection.beforeSha256,
    afterSha256: projection.afterSha256,
  };
}

function hunkContentFingerprint(hunk) {
  return valueSha256({
    path: hunk.path,
    oldStart: hunk.oldStart, oldCount: hunk.oldCount,
    newStart: hunk.newStart, newCount: hunk.newCount,
    removed: hunk.removed, added: hunk.added,
    noNewlineMarker: hunk.noNewlineMarker,
  });
}

export function classifyAuthorizedHunks(parsed, manifest = loadSourceReviewManifest(), { exactDiff = true } = {}) {
  if (exactDiff) {
    requireAuthorizedDelta(parsed.bytes.length === manifest.expectedDiff.byteLength, 'DIFF_BYTE_LENGTH', 'Unexpected source diff byte length');
    requireAuthorizedDelta(sha256(parsed.bytes) === manifest.expectedDiff.sha256, 'DIFF_DIGEST', 'Unexpected source diff digest');
  }
  const expected = new Map(manifest.hunks.map(row => [hunkKey(row), row]));
  requireReview(expected.size === manifest.hunks.length, 'MANIFEST_DUPLICATE_HUNK', 'Duplicate expected hunk identity');
  const seen = new Set();
  const rows = [];
  const unexpected = [];
  for (const hunk of parsed.hunks) {
    const expectation = expected.get(hunk.id);
    if (!expectation || seen.has(hunk.id)) {
      unexpected.push({ id: hunk.id, path: hunk.path, category: 'UNEXPECTED_CHANGE', contentSha256: hunkContentFingerprint(hunk) });
      continue;
    }
    seen.add(hunk.id);
    const projection = projectHunkExecutable(hunk);
    if (expectation.commentOnly) {
      requireAuthorizedDelta(projection.equivalent, 'COMMENT_PROJECTION_CHANGED_EXECUTABLE', hunk.id, {
        before: projection.before, after: projection.after,
      });
      requireAuthorizedDelta(expectation.category === 'DOCUMENTATION_ONLY', 'COMMENT_HUNK_NOT_DOCUMENTATION_ONLY', hunk.id);
    }
    const contentSha256 = hunkContentFingerprint(hunk);
    if (expectation.contentSha256) {
      requireAuthorizedDelta(contentSha256 === expectation.contentSha256, 'HUNK_CONTENT_DIGEST', hunk.id);
    }
    rows.push({
      id: hunk.id,
      path: hunk.path,
      header: hunk.header,
      category: expectation.category,
      topicalAuthorization: expectation.topicalAuthorization ?? null,
      securityCritical: expectation.securityCritical,
      commentOnly: expectation.commentOnly,
      executableEquivalent: expectation.commentOnly ? projection.equivalent : null,
      executableBeforeSha256: expectation.commentOnly ? projection.beforeSha256 : null,
      executableAfterSha256: expectation.commentOnly ? projection.afterSha256 : null,
      contentSha256,
      freshReviews: manifest.authorization[expectation.category].freshReviews,
      reviewed: true,
    });
  }
  if (unexpected.length > 0) {
    throw new SourceReviewFailure(UNEXPECTED_SOURCE_DELTA, 'One or more source hunks are not authorized', {
      category: 'UNEXPECTED_CHANGE',
      reason: 'UNATTRIBUTED_SOURCE_HUNK',
      details: unexpected,
    });
  }
  const missing = manifest.hunks.filter(row => !seen.has(hunkKey(row))).map(hunkKey);
  requireAuthorizedDelta(missing.length === 0, 'MISSING_AUTHORIZED_HUNK', 'Expected source hunks are missing', missing);
  const categoryCounts = Object.fromEntries(CATEGORIES.map(category => [category, rows.filter(row => row.category === category).length]));
  requireAuthorizedDelta(canonical(categoryCounts) === canonical(manifest.expectedDiff.categoryCounts), 'CATEGORY_COUNTS', 'Hunk category counts differ', categoryCounts);
  requireAuthorizedDelta(rows.length === manifest.expectedDiff.hunkCount, 'CLASSIFIED_HUNK_COUNT', 'Not every hunk was classified');
  return { rows, categoryCounts, unexpectedChangeCount: 0 };
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  requireReview(start >= 0, 'SOURCE_FUNCTION_MISSING', name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

function semanticCheck(id, pass, evidence) {
  return { id, result: pass ? 'PASS' : 'FAIL', evidence };
}

export function inspectSecuritySemantics(sources) {
  const helper = sources['repositories/memoryos-readiness/helpers/windows-inspect.ps1'];
  const transport = sources['repositories/memoryos-readiness/src/helper-transport.mjs'];
  const runtime = sources['repositories/memoryos-readiness/src/runtime.mjs'];
  const protocol = sources['repositories/memoryos-readiness/src/helper-protocol.mjs'];
  const definitions = JSON.parse(sources['repositories/memoryos-readiness/contracts/definitions.json']);
  const constants = sources['repositories/memoryos-readiness/src/constants.mjs'];
  requireReview([helper, transport, runtime, protocol, constants].every(value => typeof value === 'string'), 'SEMANTIC_SOURCE_MISSING', 'Source set incomplete');
  const consoleFunction = extractFunction(helper, 'Confirm-ConsoleQuiescence');
  const openChain = extractFunction(helper, 'Open-Chain');
  const invokeInspection = extractFunction(helper, 'Invoke-Inspection');
  const checks = [
    semanticCheck('initial-console-query-failure-fails-closed',
      consoleFunction.includes("if ($count -ne 1 -or [Runtime.InteropServices.Marshal]::ReadInt32($buffer) -ne $PID) { Reject-Protocol 'MO1307_INTERNAL' }")
        && !/\$count\s+-eq\s+0[\s\S]{0,160}\breturn\b/iu.test(consoleFunction),
      'The sole success predicate is count=1 and member PID=self; zero and API failures have no success branch.'),
    semanticCheck('positive-sole-helper-membership',
      consoleFunction.includes('$count = $script:native::GetConsoleProcessList($buffer, 1)')
        && consoleFunction.includes('$count -ne 1')
        && consoleFunction.includes('ReadInt32($buffer) -ne $PID')
        && consoleFunction.includes('AllocHGlobal(4)'),
      'A one-PID buffer must report exactly the helper PID.'),
    semanticCheck('freeconsole-required',
      consoleFunction.includes("if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }")
        && count(consoleFunction, /::FreeConsole\(\)/gu) === 1,
      'FreeConsole is called exactly once and false rejects.'),
    semanticCheck('no-post-detach-second-membership-query',
      count(consoleFunction, /::GetConsoleProcessList\(/gu) === 1
        && consoleFunction.indexOf('::GetConsoleProcessList(') < consoleFunction.indexOf('::FreeConsole()'),
      'The only membership query precedes FreeConsole.'),
    semanticCheck('no-numeric-ppid-ownership',
      !/(?:CreateToolhelp32Snapshot|Process32FirstW|Process32NextW|th32ParentProcessID|ReadInt32\(\$buffer,\s*32\))/u.test(helper),
      'No process snapshot or numeric parent-PID ownership predicate exists.'),
    semanticCheck('no-getconsolewindow-ownership', !/GetConsoleWindow/u.test(helper),
      'No console-window ownership inference exists.'),
    semanticCheck('no-speculative-conhost-termination',
      !/(?:OpenProcess|QueryFullProcessImageNameW|TerminateProcess|WaitForSingleObject|conhost\.exe)/iu.test(helper),
      'No host discovery, opening, waiting, or termination primitive exists.'),
    semanticCheck('startup-standard-streams-are-pipes',
      helper.includes("foreach ($selector in @(-10, -11, -12))")
        && helper.includes('$script:native::GetStdHandle($selector)')
        && helper.includes('$script:native::GetFileType($standardHandle) -ne 3')
        && helper.includes('$savedStderr = [Console]::OpenStandardError()')
        && helper.includes('-not $stdin.CanRead -or -not $savedStdout.CanWrite -or -not $savedStderr.CanWrite'),
      'All three borrowed standard handles must be pipes and the saved streams must have the required direction.'),
    semanticCheck('console-policy-exact',
      count(transport, /HELPER_SELF_DETACH_AND_CLOSED_PROCESS_PIPES/gu) === 1
        && !transport.includes('HELPER_NATIVE_DETACH_AND_CONFIRMED_HOST_EXIT'),
      'The transport advertises only the self-detachment plus closed-process/pipes policy.'),
    semanticCheck('supervisor-process-pipe-quiescence-required',
      transport.includes('let processCode = null, streamFailure = null, consoleQuiescent = false;')
        && transport.includes('if (!processClosed || !outputClosed || !errorClosed || !inputClosed) return;')
        && transport.includes('decodeHelperResponse(responseBytes, request); consoleQuiescent = true;')
        && transport.includes("if (!consoleQuiescent) fail('INPUT', 'ACQUISITION');")
        && transport.includes('quiescence: () => consoleQuiescent')
        && runtime.includes('await Promise.race([child.closed, stopped]);')
        && runtime.includes("if (!owner.quiescence()) fail('INTERNAL', stage);")
        && runtime.includes('owner.cleanupConfirmed = result === true && readNow() <= cleanupDeadline && owner.quiescence();'),
      'Validated response, process/pipe closure, and owner quiescence are all required.'),
    semanticCheck('createfilew-setlasterror-effective',
      helper.includes("if ($definition[0] -ceq 'CreateFileW')")
        && helper.includes('$method = $builder.DefineMethod($definition[0]')
        && helper.includes("[Runtime.InteropServices.DllImportAttribute].GetField('SetLastError')")
        && helper.includes('$createFileFields, [object[]] @($definition[0], $true, $true, $true,')
        && helper.includes("[Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling')"),
      'CreateFileW receives one complete DllImport attribute with SetLastError and ExactSpelling true.'),
    semanticCheck('open-chain-redundant-assert-root-only',
      !/\bAssert-Root\b/u.test(openChain)
        && invokeInspection.includes('Assert-Root $root.path')
        && count(helper, /\bAssert-Root\s+\$root\.path\b/gu) === 1,
      'Root validation remains at request admission and is not redundantly repeated inside Open-Chain.'),
    semanticCheck('prospective-helper-bound-strict',
      definitions.limits?.helperDeadlineMs === 8000
        && constants.includes('"helperDeadlineMs":8000')
        && !constants.includes('"helperDeadlineMs":5000')
        && protocol.includes('current >= state.launched + LIMITS.helperDeadlineMs')
        && runtime.includes('launch + L.helperDeadlineMs'),
      'The generated 8,000 ms bound is prospective and equality times out.'),
    semanticCheck('fixed-launch-is-nondetached-piped',
      transport.includes('windowsHide: true, detached: false,')
        && transport.includes("shell: false, stdio: Object.freeze(['pipe', 'pipe', 'pipe'])"),
      'The fixed launch is non-detached, shell-free, and uses three pipes.'),
    semanticCheck('helper-capability-surface-not-expanded',
      !/(?:Invoke-WebRequest|Invoke-RestMethod|System\.Net|WebClient|HttpClient|Write-Host|Write-Verbose|Write-Debug|Stopwatch|Get-Date)/iu.test(helper),
      'The helper adds no network, provider, diagnostic, or clock capability.'),
  ];
  return {
    result: checks.every(row => row.result === 'PASS') ? 'PASS' : 'FAIL',
    checks,
    failedChecks: checks.filter(row => row.result === 'FAIL').map(row => row.id),
  };
}

export function inspectReuseProof(record, {
  manifest = loadSourceReviewManifest(),
  expectedReuseIds = null,
  selectedFreshIds = [],
} = {}) {
  const failures = [];
  const check = (condition, id) => { if (!condition) failures.push(id); };
  const expectation = manifest.reuse;
  check(record?.kind === expectation.kind, 'kind');
  check(record?.version === '1.0.0', 'version');
  check(record?.result === 'PASS', 'result');
  check(record?.candidate === manifest.identity.handoff.commit, 'candidate');
  check(record?.candidateImplementation === manifest.identity.implementation.commit, 'candidateImplementation');
  check(record?.historicalAcceptedPhase3C === manifest.identity.historicalAcceptedPhase3C, 'historicalAcceptedPhase3C');
  check(record?.counts?.historicalInventory === expectation.historicalInventory, 'historicalInventory');
  check(record?.counts?.selectedFreshHistoricalControls === expectation.selectedFreshHistoricalControls, 'selectedFreshHistoricalControls');
  check(record?.counts?.reusedHistoricalControls === expectation.reusedHistoricalControls, 'reusedHistoricalControls');
  check(record?.counts?.candidateSpecificSupplementalControls === expectation.candidateSpecificSupplementalControls, 'candidateSpecificSupplementalControls');
  check(record?.counts?.omittedHistoricalControls === expectation.omittedHistoricalControls, 'omittedHistoricalControls');
  check(record?.map?.gitBlob === manifest.handoffAuthority.refreshMap.gitBlob, 'map.gitBlob');
  check(record?.map?.sha256 === manifest.handoffAuthority.refreshMap.sha256, 'map.sha256');
  check(record?.candidatePins?.c3t === manifest.identity.implementation.commit, 'candidatePins.c3t');
  check(record?.candidatePins?.c3tb === manifest.identity.handoff.commit, 'candidatePins.c3tb');
  check(record?.candidatePins?.productionTree === manifest.identity.handoff.productTree, 'candidatePins.productionTree');
  check(record?.dependencyDisposition?.phase === 'SEALED_CAMPAIGN', 'dependencyDisposition.phase');
  check(record?.dependencyDisposition?.reusedExact === expectation.reusedHistoricalControls, 'dependencyDisposition.reusedExact');
  check(Array.isArray(record?.dependencyDisposition?.movedToFresh) && record.dependencyDisposition.movedToFresh.length === 0,
    'dependencyDisposition.movedToFresh');
  check(Array.isArray(record?.dependencyDisposition?.unresolved) && record.dependencyDisposition.unresolved.length === 0,
    'dependencyDisposition.unresolved');
  check(Array.isArray(record?.dependencyDisposition?.mismatches) && record.dependencyDisposition.mismatches.length === 0,
    'dependencyDisposition.mismatches');
  check(record?.accounting?.movedToFreshBeforeSeal === 0, 'accounting.movedToFreshBeforeSeal');
  check(record?.accounting?.postSealAdaptiveMoveAllowed === false, 'accounting.postSealAdaptiveMoveAllowed');
  check(record?.certificationExecuted === false, 'certificationExecuted');
  check(record?.productionExecuted === false, 'productionExecuted');
  check(record?.helperExecuted === false, 'helperExecuted');
  check(record?.networkUsed === false, 'networkUsed');
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  check(rows.length === expectation.reusedHistoricalControls, 'rows.length');
  const ids = rows.map(row => row.id);
  check(new Set(ids).size === rows.length, 'rows.unique');
  check(canonical(ids) === canonical(ordinal(ids)), 'rows.ordinal');
  if (expectedReuseIds) check(sameOrdinalSet(ids, expectedReuseIds), 'rows.inventory');
  const selected = new Set(selectedFreshIds);
  for (const row of rows) {
    const prefix = `row:${row?.id ?? '<missing>'}:`;
    check(!selected.has(row?.id), `${prefix}notSelectedFresh`);
    check(row?.disposition === 'REUSED_EXACT', `${prefix}disposition`);
    check(row?.equalityProof?.allExercisedFacetsEqual === true, `${prefix}allExercisedFacetsEqual`);
    check(row?.equalityProof?.expectedTupleBound === true, `${prefix}expectedTupleBound`);
    check(row?.equalityProof?.receiptBytesBound === true, `${prefix}receiptBytesBound`);
    check(row?.equalityProof?.candidateIdentityBound === true, `${prefix}candidateIdentityBound`);
    check(row?.equalityProof?.selectedIntersection === false, `${prefix}selectedIntersection`);
    check(row?.candidatePins?.c3t === manifest.identity.implementation.commit
      && row?.candidatePins?.c3tb === manifest.identity.handoff.commit
      && row?.candidatePins?.productionTree === manifest.identity.handoff.productTree, `${prefix}candidatePins`);
    check(Array.isArray(row?.exercisedDependencies) && row.exercisedDependencies.length > 0
      && row.exercisedDependencies.every(dependency => dependency.equal === true), `${prefix}dependencyEquality`);
    check(Array.isArray(row?.packageDiffApplicability?.unhandledChangedDependencyPaths)
      && row.packageDiffApplicability.unhandledChangedDependencyPaths.length === 0, `${prefix}unhandledChangedDependencyPaths`);
    const changed = row?.packageDiffApplicability?.changedDependencyPaths ?? [];
    const fieldCompared = row?.packageDiffApplicability?.fieldComparedChangedPaths ?? [];
    const selectedOnly = row?.packageDiffApplicability?.selectedOnlyChangedPaths ?? [];
    check(sameOrdinalSet(changed, fieldCompared), `${prefix}fieldComparedChangedPaths`);
    check(changed.length === 0 || sameOrdinalSet(changed, CHANGED_DEPENDENCY_PATHS), `${prefix}changedDependencyPaths`);
    check(sameOrdinalSet(selectedOnly, manifest.files.map(file => file.path).filter(relative => !changed.includes(relative))),
      `${prefix}selectedOnlyChangedPaths`);
  }
  return {
    result: failures.length === 0 ? 'PASS' : 'FAIL',
    action: failures.length === 0 ? 'REUSE_EXACT' : expectation.mismatchDisposition,
    failures,
    count: rows.length,
    negativeCount: rows.filter(row => row.negative === true).length,
    rowsSha256: valueSha256(rows),
    phase: record?.dependencyDisposition?.phase ?? null,
    movedToFresh: Array.isArray(record?.dependencyDisposition?.movedToFresh)
      ? [...record.dependencyDisposition.movedToFresh] : null,
    unresolved: Array.isArray(record?.dependencyDisposition?.unresolved)
      ? [...record.dependencyDisposition.unresolved] : null,
    mismatches: Array.isArray(record?.dependencyDisposition?.mismatches)
      ? [...record.dependencyDisposition.mismatches] : null,
    movedToFreshBeforeSeal: record?.accounting?.movedToFreshBeforeSeal ?? null,
    postSealAdaptiveMoveAllowed: record?.accounting?.postSealAdaptiveMoveAllowed ?? null,
  };
}

function verifyIdentity(manifest, { requireCheckout = true } = {}) {
  const { historical, implementation, handoff } = manifest.identity;
  for (const identity of [historical, implementation, handoff]) {
    requireReview(gitText(['rev-parse', `${identity.commit}^{commit}`]) === identity.commit, 'COMMIT_IDENTITY', identity.role);
    requireReview(gitText(['show', '-s', '--format=%T', identity.commit]) === identity.rootTree, 'ROOT_TREE_IDENTITY', identity.role);
    requireReview(gitText(['rev-parse', `${identity.commit}:${manifest.productRoot}`]) === identity.productTree, 'PRODUCT_TREE_IDENTITY', identity.role);
  }
  requireReview(gitText(['show', '-s', '--format=%P', implementation.commit]) === implementation.parent, 'IMPLEMENTATION_PARENT', implementation.commit);
  requireReview(gitText(['show', '-s', '--format=%P', handoff.commit]) === handoff.parent, 'HANDOFF_PARENT', handoff.commit);
  requireReview(gitText(['merge-base', historical.commit, implementation.commit]) === historical.commit, 'BASELINE_NOT_ANCESTOR', historical.commit);
  requireReview(gitText(['diff', '--name-only', implementation.commit, handoff.commit, '--', manifest.productRoot]) === '', 'HANDOFF_PRODUCTION_DELTA', handoff.commit);
  if (requireCheckout) {
    requireReview(gitText(['rev-parse', 'HEAD']) === handoff.commit, 'HEAD_NOT_HANDOFF', 'HEAD is not exact C3TB');
    requireReview(gitText(['status', '--porcelain=v1', '--untracked-files=all', '--', manifest.productRoot]) === '', 'CHECKOUT_PRODUCT_DIRTY', manifest.productRoot);
  }
  return { historical, implementation, handoff, head: requireCheckout ? handoff.commit : null };
}

export function verifyHistoricalBaseline(manifest = loadSourceReviewManifest()) {
  const identity = verifyIdentity(manifest, { requireCheckout: false });
  const filePins = manifest.files.map(expected => {
    const actual = gitPin(manifest.identity.historical.commit, expected.path);
    requireReview(actual.gitBlob === expected.oldBlob, 'BASELINE_BLOB', expected.path);
    return actual;
  });
  requireReview(rawGit(['diff', '--no-ext-diff', '--unified=0', manifest.identity.historical.commit,
    manifest.identity.historical.commit, '--', manifest.productRoot]).length === 0, 'BASELINE_SELF_DIFF', 'C3RB self diff is not empty');
  return {
    result: 'PASS',
    candidate: manifest.identity.historical.commit,
    candidateTree: manifest.identity.historical.rootTree,
    productionTree: manifest.identity.historical.productTree,
    changedFileCount: 0,
    exactHistoricalBlobs: filePins.length,
    identity: identity.historical,
  };
}

function verifyHandoffAuthority(manifest) {
  const bindingPin = gitPin(manifest.identity.handoff.commit, manifest.handoffAuthority.binding.path);
  const verificationPin = gitPin(manifest.identity.handoff.commit, manifest.handoffAuthority.bindingVerification.path);
  const mapPin = gitPin(manifest.identity.handoff.commit, manifest.handoffAuthority.refreshMap.path);
  for (const [pin, expected] of [
    [bindingPin, manifest.handoffAuthority.binding],
    [verificationPin, manifest.handoffAuthority.bindingVerification],
    [mapPin, manifest.handoffAuthority.refreshMap],
  ]) {
    requireReview(pin.gitBlob === expected.gitBlob && pin.sha256 === expected.sha256, 'HANDOFF_AUTHORITY_PIN', expected.path);
  }
  const binding = JSON.parse(gitShow(manifest.identity.handoff.commit, bindingPin.path).toString('utf8'));
  const verification = JSON.parse(gitShow(manifest.identity.handoff.commit, verificationPin.path).toString('utf8'));
  const refreshMap = JSON.parse(gitShow(manifest.identity.handoff.commit, mapPin.path).toString('utf8'));
  requireReview(binding.kind === 'MO1307ProspectiveHelperBoundCandidateBinding' && binding.result === 'NEW_PRODUCTION_CANDIDATE_READY_FOR_PHASE3', 'BINDING_RESULT', binding.result);
  requireReview(binding.candidateRole === 'C3T' && binding.bindingRole === 'C3TB', 'BINDING_ROLES', 'C3T/C3TB');
  requireReview(binding.implementation?.commit === manifest.identity.implementation.commit
    && binding.implementation?.rootTree === manifest.identity.implementation.rootTree
    && binding.implementation?.productionTree === manifest.identity.implementation.productTree, 'BINDING_IMPLEMENTATION', 'C3T');
  requireReview(binding.binding?.soleParent === manifest.identity.implementation.commit
    && binding.binding?.productionChanges === false, 'BINDING_HANDOFF', 'C3TB');
  const corrections = new Map((binding.includedCorrections ?? []).map(row => [row.id, row]));
  for (const category of ['AUTHORIZED_HEADLESS_CORRECTION', 'AUTHORIZED_NATIVE_LASTERROR_CORRECTION', 'AUTHORIZED_OPEN_CHAIN_CORRECTION']) {
    const expected = manifest.authorization[category];
    const actual = corrections.get(expected.id);
    requireReview(actual?.implementation === expected.implementation && actual?.binding === expected.binding, 'CORRECTION_AUTHORITY', category);
  }
  requireReview(verification.kind === 'MO1307ProspectiveHelperBoundBindingVerification'
    && verification.result === 'PASS'
    && verification.candidateCommit === manifest.identity.implementation.commit
    && verification.candidateRootTree === manifest.identity.implementation.rootTree
    && verification.productionTree === manifest.identity.implementation.productTree
    && verification.productionChangesInBindingCommit === false, 'BINDING_VERIFICATION', verification.result);
  requireReview(refreshMap.kind === 'MO1307ProspectiveBoundPhase3CRefreshMap'
    && refreshMap.consumeRule === 'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION', 'REFRESH_MAP_IDENTITY', refreshMap.kind);
  requireReview(refreshMap.accounting?.historicalInventory === manifest.reuse.historicalInventory
    && refreshMap.accounting?.selectedFreshHistoricalControls === manifest.reuse.selectedFreshHistoricalControls
    && refreshMap.accounting?.dependencyReuseCandidates === manifest.reuse.reusedHistoricalControls
    && refreshMap.accounting?.omitted === manifest.reuse.omittedHistoricalControls
    && refreshMap.candidateSpecificSupplementalControls?.length === manifest.reuse.candidateSpecificSupplementalControls,
  'REFRESH_MAP_ACCOUNTING', '89/462/2/0');
  const requiredReviews = new Set(refreshMap.requiredSourceAndSecurityReviews ?? []);
  for (const authority of Object.values(manifest.authorization)) {
    for (const review of authority.freshReviews) requireReview(requiredReviews.has(review), 'FRESH_REVIEW_MAPPING', review);
  }
  return { binding: bindingPin, bindingVerification: verificationPin, refreshMap: mapPin, parsedRefreshMap: refreshMap };
}

function verifyFileAndDiffIdentity(manifest) {
  const { historical, handoff } = manifest.identity;
  const diff = rawGit(['diff', '--no-ext-diff', '--unified=0', historical.commit, handoff.commit, '--', manifest.productRoot]);
  let parsed;
  try {
    parsed = parseUnifiedZeroDiff(diff);
  } catch (error) {
    if (!(error instanceof SourceReviewFailure)) throw error;
    throw new SourceReviewFailure(UNEXPECTED_SOURCE_DELTA, 'Production source diff could not be attributed', {
      category: 'UNEXPECTED_CHANGE',
      reason: 'DIFF_PARSE',
      inner: { code: error.code, message: error.message, details: error.details },
    });
  }
  requireAuthorizedDelta(parsed.files.length === manifest.files.length, 'CHANGED_FILE_COUNT', 'Unexpected changed-file count');
  const expectedFiles = new Map(manifest.files.map(row => [row.path, row]));
  for (const file of parsed.files) {
    const expected = expectedFiles.get(file.path);
    requireAuthorizedDelta(Boolean(expected), 'UNEXPECTED_CHANGED_FILE', file.path);
    requireAuthorizedDelta(file.oldBlob === expected.oldBlob.slice(0, file.oldBlob.length)
      && file.newBlob === expected.newBlob.slice(0, file.newBlob.length), 'DIFF_BLOB_HEADER', file.path);
    requireAuthorizedDelta(gitText(['rev-parse', `${historical.commit}:${file.path}`]) === expected.oldBlob, 'OLD_BLOB', file.path);
    requireAuthorizedDelta(gitText(['rev-parse', `${handoff.commit}:${file.path}`]) === expected.newBlob, 'NEW_BLOB', file.path);
    const checkout = fs.readFileSync(path.join(ROOT, file.path));
    requireAuthorizedDelta(gitText(['hash-object', '--stdin'], checkout) === expected.newBlob, 'CHECKOUT_BLOB', file.path);
  }
  const classification = classifyAuthorizedHunks(parsed, manifest, { exactDiff: true });
  return { diff, parsed, classification };
}

function sourceSet(commit, paths) {
  return Object.fromEntries(paths.map(relative => [relative, gitShow(commit, relative).toString('utf8')]));
}

function changedDependencyMapping(manifest, classification, refreshMap) {
  const required = new Set(refreshMap.requiredSourceAndSecurityReviews);
  return manifest.files.map(file => {
    const hunks = classification.rows.filter(row => row.path === file.path);
    const categories = ordinal(new Set(hunks.map(row => row.category)));
    const freshReviews = ordinal(new Set(hunks.flatMap(row => row.freshReviews)));
    requireReview(freshReviews.length > 0 && freshReviews.every(review => required.has(review)), 'CHANGED_DEPENDENCY_UNMAPPED', file.path);
    return {
      path: file.path,
      oldBlob: file.oldBlob,
      newBlob: file.newBlob,
      categories,
      freshReviews,
      hunkCount: hunks.length,
      disposition: 'FRESH_REVIEW_REQUIRED_AND_MAPPED',
    };
  });
}

export function reviewRepositorySource({
  reuseProofPath = REUSE_RELATIVE,
  requireReuseProof = true,
  requireCheckout = true,
} = {}) {
  const manifest = loadSourceReviewManifest();
  const identity = verifyIdentity(manifest, { requireCheckout });
  const baselineReview = verifyHistoricalBaseline(manifest);
  const handoffAuthority = verifyHandoffAuthority(manifest);
  const diffReview = verifyFileAndDiffIdentity(manifest);
  const semanticPaths = [
    'repositories/memoryos-readiness/helpers/windows-inspect.ps1',
    'repositories/memoryos-readiness/src/helper-transport.mjs',
    'repositories/memoryos-readiness/src/runtime.mjs',
    'repositories/memoryos-readiness/src/helper-protocol.mjs',
    'repositories/memoryos-readiness/contracts/definitions.json',
    'repositories/memoryos-readiness/src/constants.mjs',
  ];
  const currentSources = sourceSet(manifest.identity.handoff.commit, semanticPaths);
  const securitySemantics = inspectSecuritySemantics(currentSources);
  requireReview(securitySemantics.result === 'PASS', 'SECURITY_SEMANTICS', 'Security semantics review failed', securitySemantics.failedChecks);
  const oldHelper = gitShow(manifest.identity.historical.commit, 'repositories/memoryos-readiness/helpers/windows-inspect.ps1').toString('utf8');
  const newHelper = currentSources['repositories/memoryos-readiness/helpers/windows-inspect.ps1'];
  const readSetUnchanged = extractFunction(oldHelper, 'Invoke-ReadSet') === extractFunction(newHelper, 'Invoke-ReadSet');
  requireReview(readSetUnchanged, 'READ_SET_SOURCE_CHANGED', 'Invoke-ReadSet must remain byte-identical');
  const unchangedSecurityDependencies = manifest.unchangedSecurityDependencies.map(expected => {
    const oldPin = gitPin(manifest.identity.historical.commit, expected.path);
    const newPin = gitPin(manifest.identity.handoff.commit, expected.path);
    requireReview(oldPin.gitBlob === expected.gitBlob && newPin.gitBlob === expected.gitBlob
      && oldPin.sha256 === expected.sha256 && newPin.sha256 === expected.sha256, 'UNCHANGED_SECURITY_DEPENDENCY', expected.path);
    return { path: expected.path, gitBlob: expected.gitBlob, sha256: expected.sha256, equal: true };
  });
  const changedDependencies = changedDependencyMapping(manifest, diffReview.classification, handoffAuthority.parsedRefreshMap);
  let reuse = { result: 'NOT_EVALUATED', action: 'FRESH_VALIDATION_ONLY', count: 0, negativeCount: 0, rowsSha256: null };
  let reusePin = null;
  if (requireReuseProof) {
    const absolute = path.join(ROOT, reuseProofPath);
    const bytes = fs.readFileSync(absolute);
    const record = JSON.parse(bytes.toString('utf8'));
    reuse = inspectReuseProof(record, {
      manifest,
      expectedReuseIds: handoffAuthority.parsedRefreshMap.dependencyReuseIds,
      selectedFreshIds: handoffAuthority.parsedRefreshMap.selectedHistoricalIds,
    });
    requireReview(reuse.result === 'PASS', 'REUSE_DEPENDENCY_MISMATCH', 'A reused dependency changed', reuse.failures, reuse.action);
    reusePin = pinBytes(reuseProofPath, bytes);
  }
  const securityCriticalRows = diffReview.classification.rows.filter(row => row.securityCritical);
  requireReview(securityCriticalRows.every(row => row.reviewed) && securityCriticalRows.length === 14,
    'SECURITY_CRITICAL_HUNK_REVIEW', 'Every security-critical hunk must be reviewed');
  return {
    kind: 'MO1307Phase3CR2DependencyAwareSourceReview',
    version: '1.0.0',
    result: 'PASS',
    mode: requireReuseProof ? 'ACTUAL_CAMPAIGN' : 'ZERO_PRODUCT_ENGINEERING_VALIDATION',
    candidate: manifest.identity.handoff.commit,
    candidateTree: manifest.identity.handoff.rootTree,
    candidateImplementation: manifest.identity.implementation.commit,
    productionTree: manifest.identity.handoff.productTree,
    historicalBaseline: manifest.identity.historical.commit,
    historicalProductTree: manifest.identity.historical.productTree,
    authorizedDiff: {
      result: 'PASS',
      from: manifest.identity.historical.commit,
      to: manifest.identity.handoff.commit,
      byteLength: diffReview.diff.length,
      sha256: sha256(diffReview.diff),
      changedFileCount: diffReview.parsed.files.length,
      hunkCount: diffReview.classification.rows.length,
      categoryCounts: diffReview.classification.categoryCounts,
      unexpectedChangeCount: diffReview.classification.unexpectedChangeCount,
      allHunksClassified: true,
      noUnauthorizedSourceDelta: true,
      securityCriticalHunkCount: securityCriticalRows.length,
      everySecurityCriticalHunkReviewed: true,
      hunks: diffReview.classification.rows,
    },
    dependencySelection: {
      result: 'PASS',
      changedDependencies: {
        result: 'PASS', count: changedDependencies.length,
        disposition: 'FRESH_REVIEW_REQUIRED_AND_MAPPED', rows: changedDependencies,
      },
      reusedDependencies: {
        result: reuse.result,
        action: reuse.action,
        count: reuse.count,
        negativeCount: reuse.negativeCount,
        rowsSha256: reuse.rowsSha256,
        failures: reuse.failures ?? [],
        phase: reuse.phase ?? null,
        movedToFresh: reuse.movedToFresh ?? [],
        unresolved: reuse.unresolved ?? [],
        mismatches: reuse.mismatches ?? [],
        movedToFreshBeforeSeal: reuse.movedToFreshBeforeSeal ?? 0,
        postSealAdaptiveMoveAllowed: reuse.postSealAdaptiveMoveAllowed ?? false,
      },
    },
    securitySemantics,
    commentHandling: {
      method: 'PER_HUNK_LANGUAGE_AWARE_EXECUTABLE_PROJECTION_NO_GLOBAL_SOURCE_ELISION',
      commentOnlyHunkCount: diffReview.classification.rows.filter(row => row.commentOnly).length,
      allCommentOnlyExecutableProjectionsEqual: diffReview.classification.rows.filter(row => row.commentOnly).every(row => row.executableEquivalent),
      globallyStrippedSourceEqualityUsed: false,
    },
    unchangedSourceReview: {
      result: 'PASS',
      readSetBodyByteIdentical: readSetUnchanged,
      dependencies: unchangedSecurityDependencies,
    },
    baselineReview,
    handoffAuthority: {
      result: 'PASS',
      binding: handoffAuthority.binding,
      bindingVerification: handoffAuthority.bindingVerification,
      refreshMap: handoffAuthority.refreshMap,
    },
    sourcePins: [
      filePin(MANIFEST_RELATIVE),
      filePin(`${TOOL_RELATIVE}/source-review-lib.mjs`),
      ...manifest.files.map(row => gitPin(manifest.identity.handoff.commit, row.path)),
      ...manifest.unchangedSecurityDependencies.map(row => gitPin(manifest.identity.handoff.commit, row.path)),
      ...(reusePin ? [reusePin] : []),
    ],
    productionExecuted: false,
    helperExecuted: false,
    securityControlExecuted: false,
    certificationClaims: 0,
    productionChanged: false,
    identity,
  };
}

import { errorExit, fail, operationalError } from './errors.mjs';
import { assertDistinctFiles, assertDistinctRoots, resolveContained, validateAbsoluteRoot, validateRelativeFile } from './windows-paths.mjs';

const COMMON = ['--input-root', '--config', '--authority', '--authority-sha256', '--candidate-sha256'];
const COMMANDS = Object.freeze({
  evaluate: Object.freeze({ required: [...COMMON, '--output-root'], optional: ['--format'] }),
  verify: Object.freeze({ required: [...COMMON, '--result-root'], optional: ['--decision', '--format'] }),
});
const DIGEST = /^sha256:[a-f0-9]{64}$/;

export function parseCliArgs(argv) {
  const usage = () => fail('USAGE', 'LAUNCH', null);
  if (!Array.isArray(argv) || argv.some(item => typeof item !== 'string')
      || !Object.hasOwn(COMMANDS, argv[0])) usage();
  const command = argv[0];
  const spec = COMMANDS[command];
  const allowed = new Set([...spec.required, ...spec.optional]);
  const options = Object.create(null);
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index]; const value = argv[index + 1];
    if (!allowed.has(flag) || Object.hasOwn(options, flag) || value === undefined
        || value === '' || value.startsWith('--')) usage();
    options[flag] = value;
  }
  if (spec.required.some(flag => !Object.hasOwn(options, flag))
      || !DIGEST.test(options['--authority-sha256']) || !DIGEST.test(options['--candidate-sha256'])
      || (Object.hasOwn(options, '--format') && !['json', 'text'].includes(options['--format']))) usage();
  // Pin/argv syntax belongs to LAUNCH; filesystem spelling/boundaries belong
  // to CONFIGURATION, matching the frozen phase precedence.
  const context = { stage: 'CONFIGURATION', reference: null };
  const failures = [];
  const check = action => {
    try { action(); return true; } catch (error) { failures.push(operationalError(error, context.stage)); return false; }
  };
  let inputRoot = options['--input-root'];
  let otherRoot = options[command === 'evaluate' ? '--output-root' : '--result-root'];
  const inputValid = check(() => { inputRoot = validateAbsoluteRoot(inputRoot, context); });
  const otherValid = check(() => { otherRoot = validateAbsoluteRoot(otherRoot, context); });
  if (inputValid && otherValid) check(() => assertDistinctRoots([inputRoot, otherRoot], context));
  const config = options['--config'];
  const authority = options['--authority'];
  const decision = options['--decision'] ?? null;
  let relativesValid = true;
  for (const [reference, relative] of [['config', config], ['authority', authority], ...(decision === null ? [] : [['decision', decision]])]) {
    const valid = check(() => validateRelativeFile(relative, { ...context, reference }));
    relativesValid = relativesValid && valid;
    if (valid && inputValid) check(() => resolveContained(inputRoot, relative, { ...context, reference }));
  }
  if (relativesValid) check(() => assertDistinctFiles([config, authority, ...(decision === null ? [] : [decision])], context));
  if (otherValid) {
    check(() => resolveContained(otherRoot, 'memoryos-readiness-result.json', { ...context, reference: 'result' }));
    if (command === 'evaluate') check(() => resolveContained(otherRoot, 'memoryos-readiness-result.json.pending', context));
  }
  if (failures.length !== 0) {
    failures.sort((a, b) => errorExit(a) - errorExit(b)
      || ((a.reference ?? '') < (b.reference ?? '') ? -1 : (a.reference ?? '') > (b.reference ?? '') ? 1 : 0));
    throw failures[0];
  }
  return Object.freeze({ command, inputRoot, config, authority,
    trustedAuthorityDigest: options['--authority-sha256'], expectedCandidateDigest: options['--candidate-sha256'],
    outputRoot: command === 'evaluate' ? otherRoot : null,
    resultRoot: command === 'verify' ? otherRoot : null,
    decision, format: options['--format'] ?? 'json' });
}

export function validateLaunch({ platform, arch, version, execArgv, environment }) {
  if (platform !== 'win32' || arch !== 'x64' || version !== 'v24.21.0'
      || !Array.isArray(execArgv) || execArgv.length !== 0
      || !environment || typeof environment !== 'object'
      || Object.keys(environment).some(key => ['NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase()))) {
    fail('USAGE', 'LAUNCH', null);
  }
}

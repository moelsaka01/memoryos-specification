import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const manifestPath = fileURLToPath(new URL('./engineering-toolchain.json', import.meta.url));
const MAX_CAPTURE_BYTES = 128 * 1024 * 1024;
const sha = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function failure(code, detail, capture) {
  const error = new Error(code + ': ' + detail);
  error.code = code;
  if (capture) error.capture = capture;
  throw error;
}

export function validateIdentity(record) {
  if (!record || typeof record.absolute !== 'string' || !path.isAbsolute(record.absolute)) {
    failure('ENGINEERING_GIT_PATH', 'absolute path required');
  }
  let bytes;
  try {
    const stat = fs.lstatSync(record.absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) failure('ENGINEERING_GIT_FILE', 'ordinary file required');
    bytes = fs.readFileSync(record.absolute);
  } catch (error) {
    if (error.code?.startsWith('ENGINEERING_')) throw error;
    failure('ENGINEERING_GIT_MISSING', error.code ?? 'unreadable');
  }
  const digest = sha(bytes);
  if (bytes.length !== record.byteLength || digest !== record.sha256) {
    failure('ENGINEERING_GIT_IDENTITY', 'length or SHA256 mismatch');
  }
  return {absolute: record.absolute, byteLength: bytes.length, sha256: digest};
}

// Pure classification is exported for engineering-only synthetic checks. It cannot
// replace the spawnSync result inside gitCapture, and never certifies a Git command.
export function classifyProcessResult(result, outputExceeded = false) {
  const actualExitCode = Number.isInteger(result.status) ? result.status : null;
  const signal = result.signal ?? null;
  const executionError = result.error ? {
    code: result.error.code ?? result.error.name,
    message: result.error.message,
  } : null;
  const base = {actualExitCode, signal, executionError};
  if (executionError?.code === 'ETIMEDOUT') {
    return {...base, classification: 'WRAPPER_FAILURE', code: 'ENGINEERING_GIT_TIMEOUT', outputComplete: false};
  }
  if (outputExceeded || executionError?.code === 'ENOBUFS') {
    return {...base, classification: 'WRAPPER_FAILURE', code: 'ENGINEERING_GIT_OUTPUT_LIMIT', outputComplete: false};
  }
  if (executionError) {
    return {...base, classification: 'WRAPPER_FAILURE', code: 'ENGINEERING_GIT_EXECUTION', outputComplete: false};
  }
  if (actualExitCode === null || signal !== null) {
    return {...base, classification: 'WRAPPER_FAILURE', code: 'ENGINEERING_GIT_EXIT_UNOBSERVED', outputComplete: false};
  }
  return {...base, classification: actualExitCode === 0 ? 'GIT_SUCCESS' : 'GIT_FAILURE',
    code: actualExitCode === 0 ? 'ENGINEERING_GIT_SUCCESS' : 'ENGINEERING_GIT_EXIT', outputComplete: true};
}

function serializeCapture(capture) {
  const {stdout, stderr, ...rest} = capture;
  return {...rest,
    stdout: {byteLength: stdout.length, sha256: sha(stdout), base64: stdout.toString('base64')},
    stderr: {byteLength: stderr.length, sha256: sha(stderr), base64: stderr.toString('base64')},
  };
}

export function gitCapture(args, options = {}, manifest) {
  const capture = {
    kind: 'EngineeringGitProcessCapture',
    invocationId: randomUUID(),
    startedAt: new Date().toISOString(),
    wrapperProcessId: process.pid,
    productCertification: false,
    ambientPathFallback: false,
    shell: false,
    classification: 'WRAPPER_FAILURE',
    code: 'ENGINEERING_GIT_WRAPPER',
    actualExitCode: null,
    signal: null,
    childProcessId: null,
    outputComplete: false,
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
  };
  let directory;
  let evidenceDirectoryReady = false;
  try {
    manifest ??= JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    directory = options.captureDirectory ?? manifest.captureDirectory;
    if (directory !== undefined) {
      if (typeof directory !== 'string' || !path.isAbsolute(directory)) {
        failure('ENGINEERING_GIT_EVIDENCE', 'captureDirectory must be absolute');
      }
      fs.mkdirSync(directory, {recursive: true});
      if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) {
        failure('ENGINEERING_GIT_EVIDENCE', 'ordinary evidence directory required');
      }
      evidenceDirectoryReady = true;
    }
    if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string' || arg.includes('\0'))) {
      failure('ENGINEERING_GIT_ARGUMENTS', 'string argument array without NUL required');
    }
    const timeout = options.timeout ?? 60000;
    const maxBuffer = options.maxBuffer ?? MAX_CAPTURE_BYTES;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 60000) {
      failure('ENGINEERING_GIT_BOUNDS', 'timeout must be an integer from 1 to 60000 ms');
    }
    if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 1 || maxBuffer > MAX_CAPTURE_BYTES) {
      failure('ENGINEERING_GIT_BOUNDS', 'maxBuffer must be an integer from 1 to 134217728 bytes');
    }
    capture.command = {executable: manifest.git?.absolute, arguments: [...args], cwd: options.cwd ?? process.cwd()};
    capture.bounds = {timeoutMs: timeout, maxBufferBytes: maxBuffer, retainedBytesPerStreamMaximum: maxBuffer};
    capture.environment = {SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows'};
    capture.identityBefore = {git: validateIdentity(manifest.git)};
    if (manifest.core) capture.identityBefore.core = validateIdentity(manifest.core);
    // Construct the process options explicitly: caller shell, env, stdio and PATH
    // options cannot redirect execution or suppress either captured stream.
    const observed = spawnSync(capture.identityBefore.git.absolute, args, {
      cwd: options.cwd,
      input: options.input,
      timeout,
      maxBuffer,
      encoding: null,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      windowsVerbatimArguments: false,
      killSignal: 'SIGTERM',
      env: capture.environment,
    });
    capture.childProcessId = Number.isInteger(observed.pid) && observed.pid > 0 ? observed.pid : null;
    const stdout = Buffer.isBuffer(observed.stdout) ? observed.stdout : Buffer.alloc(0);
    const stderr = Buffer.isBuffer(observed.stderr) ? observed.stderr : Buffer.alloc(0);
    // spawnSync can receive one final chunk beyond maxBuffer before terminating.
    // Keep finite prefixes and explicitly mark any truncation as wrapper failure.
    const outputExceeded = stdout.length > maxBuffer || stderr.length > maxBuffer;
    capture.stdout = Buffer.from(stdout.subarray(0, maxBuffer));
    capture.stderr = Buffer.from(stderr.subarray(0, maxBuffer));
    capture.receivedBytes = {stdout: stdout.length, stderr: stderr.length};
    capture.retainedPrefixesOnly = outputExceeded;
    Object.assign(capture, classifyProcessResult(observed, outputExceeded));
    if (!Buffer.isBuffer(observed.stdout) || !Buffer.isBuffer(observed.stderr)) {
      if (capture.classification !== 'WRAPPER_FAILURE') {
        capture.classification = 'WRAPPER_FAILURE';
        capture.code = 'ENGINEERING_GIT_CAPTURE_UNOBSERVED';
        capture.outputComplete = false;
      }
    }
    capture.identityAfter = {git: validateIdentity(manifest.git)};
    if (manifest.core) capture.identityAfter.core = validateIdentity(manifest.core);
  } catch (error) {
    capture.classification = 'WRAPPER_FAILURE';
    capture.code = error.code?.startsWith('ENGINEERING_') ? error.code : 'ENGINEERING_GIT_WRAPPER';
    capture.wrapperError = {name: error.name, code: error.code ?? null, message: error.message};
  }
  capture.finishedAt = new Date().toISOString();
  if (evidenceDirectoryReady) {
    try {
      capture.evidencePath = path.join(directory, `${capture.startedAt.replaceAll(':', '-')}-${process.pid}-${capture.invocationId}.json`);
      const fd = fs.openSync(capture.evidencePath, 'wx');
      try {
        fs.writeFileSync(fd, JSON.stringify(serializeCapture(capture), null, 2) + '\n');
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
    } catch (error) {
      capture.classification = 'WRAPPER_FAILURE';
      capture.code = 'ENGINEERING_GIT_EVIDENCE';
      capture.evidenceError = {name: error.name, code: error.code ?? null, message: error.message};
    }
  }
  return capture;
}

export function gitExecute(args, options = {}, manifest) {
  const captured = gitCapture(args, options, manifest);
  if (captured.classification !== 'GIT_SUCCESS') {
    failure(captured.code,
      `classification=${captured.classification}; actualGitExit=${captured.actualExitCode === null ? 'UNOBSERVED' : captured.actualExitCode}; signal=${captured.signal ?? 'none'}; evidence=${captured.evidencePath ?? 'not-requested'}`,
      captured);
  }
  if (options.encoding && options.encoding !== 'buffer') return captured.stdout.toString(options.encoding);
  return captured.stdout;
}

export function validateToolchain(manifest) {
  manifest ??= JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const identity = validateIdentity(manifest.git);
  const capture = gitCapture(['--version'], {timeout: 10000, maxBuffer: 16384}, manifest);
  if (capture.classification !== 'GIT_SUCCESS') failure(capture.code, 'Git version process failed', capture);
  const version = capture.stdout.toString('utf8').trim();
  if (version !== manifest.git.version) failure('ENGINEERING_GIT_VERSION', 'unexpected version', capture);
  return {result: 'PASS_ENGINEERING_ONLY', identity, version, actualGitExitCode: capture.actualExitCode,
    stdoutBase64: capture.stdout.toString('base64'), stderrBase64: capture.stderr.toString('base64'),
    outputComplete: capture.outputComplete, evidencePath: capture.evidencePath ?? null, ambientPathFallback: false};
}

if (process.argv[2] === '--validate-only') {
  try {
    const manifest = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : undefined;
    console.log(JSON.stringify(validateToolchain(manifest)));
  } catch (error) {
    console.error(JSON.stringify({result: 'REFUSED_ENGINEERING_TOOLCHAIN', code: error.code ?? error.name,
      message: error.message, capture: error.capture ? serializeCapture(error.capture) : null,
      ambientPathFallback: false}));
    process.exitCode = 1;
  }
}

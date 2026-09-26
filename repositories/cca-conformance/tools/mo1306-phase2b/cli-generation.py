"""Exercise the real frozen CLI generation contract in an offline Windows stage.

No product module imports: launch the verified pinned executable and inspect
its actual files with independently implemented provider parsers.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[4]
CACHE = ROOT / '.cache/mo1306/phase2b'
EVIDENCE = ROOT / 'repositories/cca-conformance/evidence/mo1306/phase2b'
sys.path.insert(0, str(ROOT / '.cache/mo1306/validators'))
from gitlab_validator import validate_gitlab
from jenkins_validator import validate_jenkins


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def j(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def sha(data):
    return 'sha256:' + hashlib.sha256(data).hexdigest()


def file_sha(path):
    with path.open('rb') as stream:
        return 'sha256:' + hashlib.file_digest(stream, 'sha256').hexdigest()


def safe_child(path, parent):
    resolved = Path(path).resolve(strict=True)
    require(resolved.is_relative_to(parent.resolve(strict=True)), 'path escapes Phase 2B cache')
    return resolved


def offline(*args, **kwargs):
    raise RuntimeError('offline CLI generation validation forbids network')


def snapshot(path):
    """Record names, content and file identity; absent is distinct from empty."""
    if not path.exists():
        return None
    entries = [path]
    if path.is_dir():
        entries.extend(sorted(path.rglob('*')))
    result = []
    for item in entries:
        require(not item.is_symlink(), 'unexpected link in test output')
        stat = item.stat()
        row = dict(path='.' if item == path else item.relative_to(path).as_posix(),
                   kind='directory' if item.is_dir() else 'file',
                   inode=stat.st_ino, modifiedNs=stat.st_mtime_ns)
        if item.is_file():
            row.update(byteLength=stat.st_size, sha256=file_sha(item))
        result.append(row)
    return result


def main():
    socket.socket = socket.create_connection = socket.getaddrinfo = offline
    state_path = CACHE / 'active-stage.json'
    state_bytes = state_path.read_bytes()
    state = json.loads(state_bytes)
    stage = safe_child(state['stage'], CACHE)
    node = safe_child(state['nodePath'], CACHE)
    require(node.is_file() and node.stat().st_size == 93580104, 'pinned Node length')
    node_digest = file_sha(node)
    require(node_digest == state['node']['sha256'] ==
            'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32', 'pinned Node identity')
    manifest_bytes = (stage / 'distribution-manifest.json').read_bytes()
    require(sha(manifest_bytes) == state['distributionDigest'], 'active stage distribution identity')
    distribution = json.loads(manifest_bytes)
    require(distribution['files'] == state['stagedFiles'], 'active stage member identity')
    for member in state['stagedFiles']:
        target = safe_child(stage / member['path'], stage)
        require(target.stat().st_size == member['byteLength'] and file_sha(target) == member['sha256'], 'staged file digest: ' + member['path'])
    entry = stage / 'bin/memoryos-ci.mjs'
    stage_before = snapshot(stage)
    environment = {name: os.environ[name] for name in ('SystemRoot', 'WINDIR')}
    attempt = Path(tempfile.mkdtemp(prefix='cli-generation-', dir=CACHE))
    input_dir = attempt / 'inputs'
    input_dir.mkdir()
    base_path = ROOT / 'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'
    base_bytes = base_path.read_bytes()
    base = json.loads(base_bytes)
    normalized = dict(base, timeoutMs=60000, providerExtensions={})
    config_bytes = j(normalized)
    config_digest = sha(config_bytes)
    label = 'windows_2022'
    cases = []
    providers = []

    def invoke(case_id, config, deployment, output, code=0, diagnostic=None, locale=None):
        args = [str(node), '--max-old-space-size=128', str(entry), 'generate',
                '--config', str(config), '--deployment', str(deployment), '--output', str(output)]
        env = dict(environment)
        if locale:
            env.update(LANG=locale, LC_ALL=locale)
        started = time.perf_counter()
        result = subprocess.run(args, cwd=ROOT, env=env, shell=False,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                timeout=80, creationflags=subprocess.CREATE_NO_WINDOW)
        record = dict(id=case_id, argv=args, exitCode=result.returncode, expectedExitCode=code,
                      elapsedMs=round((time.perf_counter() - started) * 1000),
                      stdoutByteLength=len(result.stdout), stderrByteLength=len(result.stderr),
                      stdout=result.stdout.decode('utf-8', errors='strict'),
                      stderr=result.stderr.decode('utf-8', errors='strict'), status='FAIL')
        cases.append(record)
        (attempt / 'cases.json').write_bytes(j(cases))
        require(result.returncode == code, case_id + ': unexpected exit ' + str(result.returncode))
        # Section 4 explicitly forbids evaluation summaries for generate.
        require(result.stdout == b'', case_id + ': generation stdout must be empty')
        if code == 0:
            require(result.stderr == b'', case_id + ': unexpected success diagnostic')
        else:
            require(bool(result.stderr), case_id + ': missing failure diagnostic')
            parsed = json.loads(result.stderr)
            require(parsed['kind'] == 'MemoryOSCICDDiagnostic' and parsed['version'] == '1.0.0' and parsed['code'] == diagnostic, case_id + ': wrong diagnostic')
            require(j(parsed) == result.stderr, case_id + ': diagnostic is not canonical single record')
        record['status'] = 'PASS'
        print(case_id + ' PASS', flush=True)
        return record

    def files_for(output, provider, deployment):
        primary = '.gitlab-ci.yml' if provider == 'gitlab' else 'Jenkinsfile'
        expected = sorted([primary, 'memoryos-ci.json', 'memoryos-ci-generation.json'])
        require(output.is_dir() and sorted(item.name for item in output.iterdir()) == expected, 'missing/extra CLI artifacts')
        files = {}
        for name in expected:
            item = output / name
            require(item.is_file() and not item.is_symlink(), 'nonregular artifact')
            data = item.read_bytes()
            text = data.decode('utf-8', errors='strict')
            require(bool(data) and not text.startswith('\ufeff') and '\r' not in text
                    and text.endswith('\n') and not text.endswith('\n\n'), 'UTF-8/LF artifact')
            files[name] = data
        require(files['memoryos-ci.json'] == config_bytes, 'canonical normalized configuration')
        generation = json.loads(files['memoryos-ci-generation.json'])
        require(j(generation) == files['memoryos-ci-generation.json'], 'canonical generation manifest')
        require(set(generation) == {'kind', 'version', 'generator', 'configurationSha256', 'deploymentSha256', 'provider', 'files'}, 'closed manifest')
        require(generation['kind'] == 'MemoryOSCICDGeneration' and generation['version'] == '1.0.0' and generation['provider'] == provider, 'manifest identity')
        require(generation['configurationSha256'] == config_digest and generation['deploymentSha256'] == sha(j(deployment)), 'manifest input pins')
        require(generation['generator']['id'] == 'memoryos.cicd.generator' and generation['generator']['version'] == '1.0.0'
                and re.fullmatch(r'sha256:[0-9a-f]{64}', generation['generator']['sha256']), 'generator identity')
        members = [dict(path=name, byteLength=len(files[name]), sha256=sha(files[name]))
                   for name in sorted([primary, 'memoryos-ci.json'])]
        require(generation['files'] == members, 'manifest members, names, ordering, lengths and digests')
        validator = validate_gitlab if provider == 'gitlab' else validate_jenkins
        descriptor = validator(files[primary], label, config_digest, state['distributionDigest'])
        require(descriptor['provider'] == provider and descriptor['runner'] == 'scripts/Invoke-MemoryOSCI.ps1', 'decoded common runner')
        return files, generation, descriptor

    report = dict(kind='MemoryOSPhase2BCLIGenerationValidation', version='1.0.0', status='FAIL',
                  stageDistributionDigest=state['distributionDigest'], activeStageSha256=sha(state_bytes),
                  nodeSha256=node_digest, validatorToolSha256=file_sha(Path(__file__)),
                  configFixtureSha256=sha(base_bytes), attempt=str(attempt), cases=cases, providers=providers,
                  stdoutPolicy='generate emits no evaluation summary: empty stdout required on success and rejection',
                  network='Python socket/DNS denied; product CLI installs Node network boundary; no provider network',
                  liveProviderExecution=False)
    try:
        for provider in ('gitlab', 'jenkins'):
            option = 'runnerTag' if provider == 'gitlab' else 'agentLabel'
            deployment = dict(kind='MemoryOSCICDDeployment', version='1.0.0', provider=provider,
                              distributionDigest=state['distributionDigest'], options={option: label})
            outputs = []
            captures = []
            for index in range(3):
                config = input_dir / (provider + '-' + str(index) + '-config.json')
                deploy = input_dir / (provider + '-' + str(index) + '-deployment.json')
                if index == 0:
                    config.write_bytes(base_bytes)
                    deploy.write_bytes(j(deployment))
                else:
                    ordered_config = dict(reversed(list((normalized if index == 1 else base).items())))
                    config.write_bytes((json.dumps(ordered_config, indent=2) + '\n').encode())
                    deploy.write_bytes((json.dumps(dict(reversed(list(deployment.items()))), indent=2) + '\n').encode())
                output = attempt / (provider + '-fresh-' + str(index))
                invoke(provider + '-fresh-' + str(index), config, deploy, output, locale='tr_TR.UTF-8' if index == 2 else None)
                files, generation, descriptor = files_for(output, provider, deployment)
                if captures:
                    require(files == captures[0], provider + ': bytes changed across roots/key order/default/locale variants')
                captures.append(files)
                outputs.append(output)
            config = input_dir / (provider + '-0-config.json')
            deploy = input_dir / (provider + '-0-deployment.json')
            existing = outputs[0]
            empty = attempt / (provider + '-existing-empty')
            empty.mkdir()
            dirty = attempt / (provider + '-existing-dirty')
            dirty.mkdir()
            (dirty / 'memoryos-ci-generation.json').write_bytes(b'UNRELATED EXISTING MANIFEST\n')
            (dirty / 'nested').mkdir()
            (dirty / 'nested/sentinel.bin').write_bytes(b'\x00PRESERVE\xff')
            occupied = attempt / (provider + '-existing-file')
            occupied.write_bytes(b'PRESERVE EXISTING FILE\n')
            for name, output in [('generated', existing), ('empty', empty), ('dirty', dirty), ('file', occupied)]:
                before = snapshot(output)
                record = invoke(provider + '-no-overwrite-' + name, config, deploy, output, 17, 'MO1306_OUTPUT_EXISTS')
                after = snapshot(output)
                require(before == after, provider + ': existing target changed: ' + name)
                record.update(unchanged=True, originalSnapshot=before)
            providers.append(dict(provider=provider, status='PASS', repetitions=3,
                                  noOverwriteCases=4, generatorDigest=generation['generator']['sha256'],
                                  artifactRows=[dict(path=name, byteLength=len(data), sha256=sha(data)) for name, data in sorted(captures[0].items())],
                                  structuralValidator='official Draft-07 plus independent restricted subset' if provider == 'gitlab' else 'independent restricted Declarative AST parser',
                                  launch={key: value for key, value in descriptor.items() if key != 'script'}))
        config = input_dir / 'gitlab-0-config.json'
        for provider, options, diagnostic in [
            ('unknown', {}, 'MO1306_GENERATION_INVALID'),
            ('azure', {'pool': label}, 'MO1306_PROVIDER_UNSUPPORTED'),
            ('github', {'repository': 'owner/repo', 'toolRevision': '1d43584cef532ebcdf1e87b0cba277d2d7180a63', 'configPath': 'memoryos-ci.json'}, 'MO1306_PROVIDER_UNSUPPORTED'),
        ]:
            deploy = input_dir / (provider + '-unsupported-deployment.json')
            deploy.write_bytes(j(dict(kind='MemoryOSCICDDeployment', version='1.0.0', provider=provider,
                                     distributionDigest=state['distributionDigest'], options=options)))
            output = attempt / (provider + '-unsupported-output')
            record = invoke(provider + '-unsupported', config, deploy, output, 10, diagnostic)
            require(not output.exists(), provider + ': rejected provider produced output')
            record['outputAbsent'] = True
        require(snapshot(stage) == stage_before, 'engineering stage changed during generation checks')
        require(file_sha(node) == node_digest, 'Node changed during generation checks')
        report.update(status='PASS', caseCount=len(cases), successfulGenerations=6, noOverwriteRejections=8,
                      unsupportedProviderRejections=3, exactRepeatedBytes=True, stageUnchanged=True)
    except Exception as error:
        report.update(errorType=type(error).__name__, error=str(error), caseCount=len(cases))
        raise
    finally:
        (attempt / 'report.json').write_bytes(j(report))
        EVIDENCE.mkdir(parents=True, exist_ok=True)
        (EVIDENCE / 'cli-generation.json').write_bytes(j(report))
    print(json.dumps(dict(status=report['status'], cases=len(cases), attempt=str(attempt))))


if __name__ == '__main__':
    main()

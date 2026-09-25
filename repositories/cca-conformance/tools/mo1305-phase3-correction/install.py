"""Bounded Phase 3 correction installation and execution with copied tools outside the checkout.

Run with the pinned Node/npm, a verified distribution archive and an output receipt.
This harness intentionally does not run the Phase 2C acceptance/resource campaign.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
NODE_SHA256 = 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
PWSH = Path('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')
OPENSSL = Path('C:/Program Files/Git/usr/bin/openssl.exe')
FIXTURES = ('identities.json', 'evaluate-policy-pass.json')


def identity(path):
    digest = hashlib.sha256()
    length = 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(65536), b''):
            length += len(block)
            digest.update(block)
    return {'byteLength': length, 'sha256': digest.hexdigest()}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def inventory(folder):
    rows = []
    for path in sorted(folder.rglob('*')):
        stat = path.lstat()
        assert not path.is_symlink() and not getattr(path, 'is_junction', lambda: False)(), 'INVENTORY_LINK'
        if path.is_file():
            assert stat.st_nlink == 1, 'INVENTORY_HARDLINK'
            rows.append({'path': path.relative_to(folder).as_posix(), **identity(path)})
        else:
            assert path.is_dir(), 'INVENTORY_SPECIAL_FILE'
    return sorted(rows, key=lambda row: row['path'])


def package_inventory(folder, expected):
    actual = inventory(folder)
    assert actual == expected, 'INSTALLED_INVENTORY_DRIFT'
    expected_directories = {str(Path(row['path']).parent).replace('\\', '/') for row in expected}
    expected_directories |= {parent.as_posix() for row in expected for parent in Path(row['path']).parents}
    for path in folder.rglob('*'):
        if path.is_dir():
            assert path.relative_to(folder).as_posix() in expected_directories, 'UNEXPECTED_DIRECTORY'
    assert not (folder / 'node_modules').exists(), 'NESTED_NODE_MODULES'
    return actual


def install(args):
    from distribution import verify_archive
    archive, node, npm = (Path(value).resolve(strict=True) for value in (args.archive, args.node, args.npm))
    assert all(Path(value).is_absolute() for value in (args.archive, args.node, args.npm, args.output)), 'ABSOLUTE_INPUTS_REQUIRED'
    expected_sha = args.expected_sha256
    verified_source = verify_archive(archive, expected_sha)
    archive_identity = verified_source['archive']
    assert identity(node)['sha256'] == NODE_SHA256, 'NODE_PIN'
    assert npm.name == 'npm-cli.js' and npm.parent.name == 'bin', 'NPM_CLI'
    npm_root = npm.parent.parent
    assert npm_root.parent == node.parent / 'node_modules', 'NPM_TOOLCHAIN_LOCATION'
    assert json.loads((npm_root / 'package.json').read_bytes())['version'] == '11.19.0', 'NPM_PIN'
    temp_parent = Path(tempfile.gettempdir()).resolve()
    stage = Path(tempfile.mkdtemp(prefix='memoryos-rest-phase3-correction-', dir=temp_parent)).resolve()
    assert stage.parent == temp_parent and not stage.is_relative_to(ROOT), 'ISOLATION_DIRECTORY'
    record = {'kind': 'MemoryOSRESTPhase3CorrectionInstalledValidation', 'version': '1.0.0', 'state': 'RUNNING',
              'scope': 'one metadata correction offline install and bounded smoke; Phase 3 certification requires refresh',
              'archive': archive_identity, 'commands': [], 'installations': [],
              'sourceIndependence': {'stageOutsideCheckout': True, 'freshDirectory': True,
                  'gatewayCwdInitiallyEmpty': True, 'copiedArchive': True,
                  'copiedNodeAndNpmToolchain': True, 'copiedProbeAndFixtures': True,
                  'gatewayEnvironmentKeys': ['SYSTEMROOT', 'TEMP', 'TMP', 'WINDIR'],
                  'checkoutHiddenByOS': False}}
    clean = {key: value for key, value in os.environ.items() if key.upper() in ('SYSTEMROOT', 'WINDIR')}
    for name in ('empty', 'private', 'fixtures', 'tmp', 'home', 'project', 'ci-cache', 'install-cache'):
        (stage / name).mkdir()
    clean.update({'TEMP': str(stage / 'tmp'), 'TMP': str(stage / 'tmp')})
    replacements = [(str(stage), '$ISOLATED'), (str(ROOT), '$CHECKOUT'), (str(PWSH), '$TRUSTED_PWSH'), (str(OPENSSL), '$TRUSTED_OPENSSL')]

    def redacted(value):
        for source, replacement in replacements:
            value = value.replace(source, replacement).replace(source.replace('\\', '/'), replacement)
        return value

    def command(argv, cwd, *, env=None, timeout=60, expected=0, evidence=True):
        print(json.dumps({'command': [Path(str(item)).name for item in argv[:3]], 'state': 'RUNNING'}), flush=True)
        try:
            completed = subprocess.run([str(item) for item in argv], cwd=cwd, env=env or clean,
                                       capture_output=True, timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW)
        except subprocess.TimeoutExpired as error:
            record['commands'].append({'argv': [redacted(str(item)) for item in argv],
                'cwd': redacted(str(cwd)), 'exitCode': None, 'timeoutSeconds': timeout, 'state': 'TIMEOUT',
                'stdout': {'byteLength': len(error.stdout or b''), 'sha256': hashlib.sha256(error.stdout or b'').hexdigest()},
                'stderr': {'byteLength': len(error.stderr or b''), 'sha256': hashlib.sha256(error.stderr or b'').hexdigest()},
                'diagnostic': redacted((error.stderr or b'').decode('utf-8', errors='replace'))[:1024]})
            raise TimeoutError('COMMAND_TIMEOUT:' + Path(argv[0]).name) from None
        assert len(completed.stdout) <= 1048576 and len(completed.stderr) <= 1048576, 'COMMAND_OUTPUT_BOUND'
        if evidence:
            record['commands'].append({'argv': [redacted(str(item)) for item in argv],
                'cwd': redacted(str(cwd)), 'exitCode': completed.returncode,
                'stdout': {'byteLength': len(completed.stdout), 'sha256': hashlib.sha256(completed.stdout).hexdigest()},
                'stderr': {'byteLength': len(completed.stderr), 'sha256': hashlib.sha256(completed.stderr).hexdigest()}})
        if expected is not None:
            assert completed.returncode == expected, 'COMMAND_FAILED:' + Path(argv[0]).name + ':' + str(completed.returncode)
        return completed

    try:
        # The service and npm receive no executable/module path that points into the checkout.
        source_toolchain = inventory(node.parent)
        shutil.copytree(node.parent, stage / 'toolchain')
        assert inventory(stage / 'toolchain') == source_toolchain, 'COPIED_TOOLCHAIN_DRIFT'
        tool_node = stage / 'toolchain' / node.name
        tool_npm = stage / 'toolchain' / npm.relative_to(node.parent)
        shutil.copyfile(archive, stage / archive.name)
        isolated_archive = stage / archive.name
        verified_copy = verify_archive(isolated_archive, expected_sha)
        assert identity(isolated_archive) == archive_identity, 'COPIED_ARCHIVE_DRIFT'
        shutil.copyfile(HERE / 'installed-probe.mjs', stage / 'installed-probe.mjs')
        shutil.copyfile(HERE.parent / 'mo1305-phase1' / 'validate-launch.ps1', stage / 'validate-launch.ps1')
        source_fixtures = ROOT / 'repositories/cca-conformance/fixtures/mo1305-phase1'
        fixture_index = {row['path']: row for row in json.loads((source_fixtures / 'index.json').read_bytes())['files']}
        for name in FIXTURES:
            row = fixture_index[name]
            assert identity(source_fixtures / name) == {key: row[key] for key in ('byteLength', 'sha256')}, 'FIXTURE_IDENTITY'
            shutil.copyfile(source_fixtures / name, stage / 'fixtures' / name)
        record['fixtures'] = inventory(stage / 'fixtures')
        record['probe'] = identity(stage / 'installed-probe.mjs')
        record['trustedValidator'] = identity(stage / 'validate-launch.ps1')
        node_version = command([tool_node, '-p', 'JSON.stringify(process.versions)'], stage / 'empty')
        npm_version = command([tool_node, tool_npm, '--version'], stage / 'empty')
        assert npm_version.stdout.strip() == b'11.19.0', 'NPM_VERSION'
        process_versions = json.loads(node_version.stdout)
        assert process_versions['node'] == '24.21.0', 'NODE_VERSION'
        record['tools'] = {'node': identity(tool_node), 'npmCli': identity(tool_npm),
            'npmPackageJson': identity(stage / 'toolchain' / npm_root.relative_to(node.parent) / 'package.json'),
            'npmVersion': '11.19.0', 'processVersions': process_versions,
            'toolchainFileCount': len(source_toolchain),
            'toolchainInventorySha256': hashlib.sha256(canonical(source_toolchain)).hexdigest(),
            'powershell': identity(PWSH), 'openssl': identity(OPENSSL)}
        # Materialize the bytes already verified in memory, without reopening the archive.
        for name, content in sorted(verified_copy['files'].items()):
            assert all(part not in ('', '.', '..') for part in name.split('/')), 'EXTRACTION_PATH'
            destination = stage / 'extracted/package' / name
            assert destination.resolve().is_relative_to(stage / 'extracted/package'), 'EXTRACTION_ESCAPE'
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(content)
        extracted = stage / 'extracted/package'
        expected_inventory = inventory(extracted)
        manifest_identity = identity(extracted / 'distribution-manifest.json')
        manifest = json.loads((extracted / 'distribution-manifest.json').read_bytes())
        assert expected_inventory == sorted([*manifest['files'], {'path': 'distribution-manifest.json', **manifest_identity}], key=lambda row: row['path']), 'ARCHIVE_MANIFEST_DRIFT'
        record['distributionManifest'] = manifest_identity
        record['packageInventory'] = expected_inventory
        record['packageInventorySha256'] = hashlib.sha256(canonical(expected_inventory)).hexdigest()
        (stage / 'home/empty-user.npmrc').write_bytes(b'')
        (stage / 'home/empty-global.npmrc').write_bytes(b'')
        npm_env = {**clean, 'USERPROFILE': str(stage / 'home'), 'HOME': str(stage / 'home'),
                   'APPDATA': str(stage / 'home'), 'LOCALAPPDATA': str(stage / 'home')}
        npm_flags = ['--offline', '--ignore-scripts', '--no-audit', '--no-fund',
                     '--userconfig', str(stage / 'home/empty-user.npmrc'), '--globalconfig', str(stage / 'home/empty-global.npmrc')]
        (stage / 'project/package.json').write_bytes(canonical({'name': 'memoryos-rest-isolated-check', 'version': '1.0.0', 'private': True}))
        assert not list((stage / 'install-cache').iterdir()), 'NONEMPTY_INSTALL_CACHE'
        command([tool_node, tool_npm, 'install', *npm_flags, '--cache', stage / 'install-cache', isolated_archive], stage / 'project', env=npm_env, timeout=180)
        installed = stage / 'project/node_modules/memoryos-rest'
        package_inventory(installed, expected_inventory)
        install_lock = json.loads((stage / 'project/package-lock.json').read_bytes())
        assert install_lock['lockfileVersion'] == 3, 'PROJECT_LOCK_VERSION'
        assert set(install_lock['packages']) == {'', 'node_modules/memoryos-rest'}, 'UNEXPECTED_INSTALLED_DEPENDENCIES'
        assert {p.name for p in (stage / 'project/node_modules').iterdir()} == {'.bin', '.package-lock.json', 'memoryos-rest'}, 'UNEXPECTED_NODE_MODULES'
        record['offline'] = {'installCacheInitiallyEmpty': True,
            'offlineMode': True, 'scriptsDisabled': True, 'auditDisabled': True, 'fundDisabled': True,
            'registryConfiguration': 'default registry; offline flag forbids fetching and input caches are empty',
            'projectLockPackages': sorted(install_lock['packages']), 'externalProductionDependencies': 0,
            'installedPackageMatchesArchive': True, 'installCacheAfter': inventory(stage / 'install-cache')}
        import ipaddress
        interfaces = json.loads(subprocess.check_output([str(tool_node), '-p', 'JSON.stringify(Object.values(require("node:os").networkInterfaces()).flat())'], env=clean, timeout=15))
        private_networks = [ipaddress.IPv4Network(x) for x in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')]
        remote_addresses = [x['address'] for x in interfaces if x['family']=='IPv4' and not x['internal'] and x.get('cidr') and any(ipaddress.IPv4Address(x['address']) in network for network in private_networks) and ipaddress.IPv4Interface(x['cidr']).network.prefixlen <= 30]
        assert remote_addresses, 'ASSIGNED_RFC1918_ADDRESS_REQUIRED'
        record['remoteScope'] = 'same-host assigned RFC1918 address; no off-host reachability claim'
        private = stage / 'private'
        (private / 'token').write_text(secrets.token_hex(32), encoding='ascii')
        command([OPENSSL, 'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes',
                 '-keyout', private / 'key.pem', '-out', private / 'cert.pem', '-days', '1',
                 '-subj', '/CN=MO1305 isolated packaging check', '-addext', 'subjectAltName=IP:127.0.0.1,' + ','.join('IP:'+address for address in remote_addresses)], stage / 'empty')
        # Select a currently available loopback port; binding failure remains a failure, never a success.
        import socket
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        configuration = {'version': '1.0.0', 'port': port, 'tokenFile': str(private / 'token'),
                         'privateKeyFile': str(private / 'key.pem'), 'certificateFile': str(private / 'cert.pem')}
        (private / 'config.json').write_bytes(canonical(configuration))
        acl_script = stage / 'set-private-acl.ps1'
        acl_script.write_text('''param([string]$PrivateDirectory)
$ErrorActionPreference='Stop'
$serviceSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach($name in @('token','key.pem','config.json')){
  $acl=[System.Security.AccessControl.FileSecurity]::new();$acl.SetOwner($serviceSid);$acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($serviceSid.Value,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
  Set-Acl -LiteralPath (Join-Path $PrivateDirectory $name) -AclObject $acl
}
''', encoding='utf-8')
        command([PWSH, '-NoLogo', '-NoProfile', '-NonInteractive', '-File', acl_script, '-PrivateDirectory', private], stage / 'empty')
        trusted_args = [PWSH, '-NoLogo', '-NoProfile', '-NonInteractive', '-File', stage / 'validate-launch.ps1', '-NodePath', tool_node, '-ConfigPath', private / 'config.json']
        for label, package in [('npm-offline-install', installed)]:
            before = package_inventory(package, expected_inventory)
            trusted = command(trusted_args, stage / 'empty')
            assert trusted.stdout.strip() == b'MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS', 'TRUSTED_LAUNCH_REFUSED'
            probe_output = stage / (label + '-execution.json')
            command([tool_node, stage / 'installed-probe.mjs', package, private / 'config.json', stage / 'fixtures',
                     manifest_identity['sha256'], probe_output], stage / 'empty', timeout=180, expected=0)
            probe = json.loads(probe_output.read_bytes())
            record['lastProbe'] = probe
            assert probe['state'] == 'PASS', 'PROBE_FAILED'
            after = package_inventory(package, expected_inventory)
            assert before == after, 'EXECUTION_MUTATED_PACKAGE'
            record['installations'].append({'method': label, 'state': 'PASS', 'fileCount': len(after),
                'beforeInventorySha256': hashlib.sha256(canonical(before)).hexdigest(),
                'afterInventorySha256': hashlib.sha256(canonical(after)).hexdigest(),
                'everyFileMatchesBeforeAndAfter': True, 'execution': probe})
        assert not list((stage / 'empty').iterdir()), 'SERVICE_WROTE_CWD'
        record['sourceIndependence']['gatewayCwdRemainedEmpty'] = True
        record.pop('lastProbe', None)
        record['state'] = 'PASS'
    except Exception as error:
        record['state'] = 'FAIL'
        record['failure'] = {'type': type(error).__name__, 'reason': redacted(str(error))[:512] if isinstance(error, (AssertionError, TimeoutError)) else 'HARNESS_OPERATION_FAILED'}
        raise
    finally:
        # Only this freshly created and resolved temporary directory may be removed.
        cleanup_target = stage.resolve(strict=True)
        assert cleanup_target == stage and cleanup_target.parent == temp_parent and cleanup_target.name.startswith('memoryos-rest-phase3-correction-'), 'CLEANUP_SCOPE'
        assert not stage.is_symlink() and not getattr(stage, 'is_junction', lambda: False)(), 'CLEANUP_LINK'
        shutil.rmtree(cleanup_target)
        record['temporaryCredentialsRemoved'] = True
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(canonical(record))
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('archive', 'node', 'npm', 'output'):
        parser.add_argument('--' + flag, required=True)
    parser.add_argument('--expected-sha256', required=True, help='Archive SHA-256 from independently trusted distribution evidence')
    arguments = parser.parse_args()
    try:
        result = install(arguments)
        print(json.dumps({'state': result['state'], 'installations': len(result['installations']),
                          'archiveSha256': result['archive']['sha256']}))
    except Exception:
        print('Phase 3 correction installed validation failed; inspect the bounded receipt.', file=sys.stderr)
        sys.exit(1)

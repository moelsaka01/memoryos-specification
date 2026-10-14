"""Two clean independent assemblies; no registry or source-tree fallback."""
from pathlib import Path
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from distribution import ROOT, HERE, j, sha, identity, checked_read, verify_archive, require


def reproduce(archive, node, npm, output):
    started = time.monotonic_ns()
    reference = checked_read(archive, 16 * 1024 * 1024)
    verified = verify_archive(archive, sha(reference))
    inputs = json.loads((archive.parent / 'source-tree.json').read_bytes())
    require(sha(j(inputs['files'])) == inputs['sha256'], 'SOURCE_TREE_DIGEST')
    clean = {k: v for k, v in os.environ.items() if k.upper() in ('SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP')}
    builds = []
    cache = ROOT / '.cache/mo1305-phase2b/reproduction'
    cache.mkdir(parents=True, exist_ok=True)
    for index in range(2):
        stage = Path(tempfile.mkdtemp(prefix='clean-', dir=cache)).resolve()
        for row in inputs['files']:
            data = checked_read(ROOT / row['path'])
            require(identity(data) == {k: row[k] for k in ('byteLength', 'sha256')}, 'SOURCE_INPUT_DRIFT')
            destination = stage / row['path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        builder = stage / HERE.relative_to(ROOT) / 'distribution.py'
        command = [sys.executable, '-B', str(builder), 'build', '--root', str(stage), '--node', str(node), '--npm', str(npm), '--output', str(stage / 'output')]
        run = subprocess.run(command, cwd=stage, env=clean, capture_output=True, timeout=90, creationflags=subprocess.CREATE_NO_WINDOW)
        require(run.returncode == 0, 'INDEPENDENT_BUILD_FAILED:' + run.stderr.decode('utf-8', 'replace')[-1000:])
        result = checked_read(stage / 'output/memoryos-rest-0.1.0.tgz', 16 * 1024 * 1024)
        require(result == reference, 'REPRODUCIBILITY_DRIFT')
        tree = json.loads((stage / 'output/source-tree.json').read_bytes())
        require(tree == inputs, 'SOURCE_TREE_DRIFT')
        builds.append({'treeSha256': tree['sha256'], 'archiveSha256': sha(result)})
        # Keep the two clean build archives locally for integration inspection.
    value = {'kind': 'MemoryOSRESTPhase2BReproducibility', 'version': '1.0.0', 'state': 'PASS',
             'archive': identity(reference), 'builds': builds, 'distinctCleanDirectories': True,
             'sourceInputsVerified': len(inputs['files']), 'byteForByteEqual': True,
             'pythonVersion': sys.version.split()[0], 'elapsedNanoseconds': time.monotonic_ns() - started}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(j(value))
    print(json.dumps({'state': 'PASS', 'builds': 2, 'archiveSha256': sha(reference)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('archive', 'node', 'npm', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    reproduce(args.archive.resolve(), args.node.resolve(), args.npm.resolve(), args.output.resolve())

"""Read-only integrated archive, installed membership and source provenance gate."""
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from distribution import ROOT, PKG_REL, verify_archive, j, sha


def verify(expected):
    archive = ROOT / '.cache/mo1305-phase2d/build/memoryos-rest-0.1.0.tgz'
    result = verify_archive(archive, expected)
    for name, data in result['files'].items():
        assert (ROOT / PKG_REL / name).read_bytes() == data, 'ARCHIVE_CHECKOUT_DRIFT'
    tree = json.loads((ROOT / '.cache/mo1305-phase2d/build/source-tree.json').read_bytes())
    assert tree['sha256'] == sha(j(tree['files'])), 'SOURCE_TREE_DIGEST'
    for row in tree['files']:
        data = (ROOT / row['path']).read_bytes()
        assert len(data) == row['byteLength'] and sha(data) == row['sha256'], 'SOURCE_TREE_MEMBER'
    dependency = json.loads(result['files']['dependency-manifest.json'])
    assert dependency['sourceTreeSha256'] == tree['sha256'], 'SOURCE_PROVENANCE'
    print(json.dumps({k: v for k, v in result.items() if k != 'files'}))


if __name__ == '__main__':
    verify(sys.argv[1])

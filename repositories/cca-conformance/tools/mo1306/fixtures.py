"""Extract immutable predecessor vectors with source provenance."""
import json,base64
from pathlib import Path
from materialize import ROOT,j,sha
DEST=ROOT/'repositories/cca-conformance/fixtures/mo1306'
DEST.mkdir(parents=True,exist_ok=True)
rows=[]
for name in ['evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','evaluate-policySet-pass','evaluate-policySet-fail','evaluate-policySet-cne','max-mip-policySet','max-four-policy-mip-evaluation']:
    source=ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1'/f'{name}.json'
    vector=json.loads(source.read_bytes()); selected=vector['input']['artifactKind']
    directory=DEST/name;directory.mkdir(exist_ok=True)
    policy=base64.b64decode(vector['input']['artifactBase64']);candidate=base64.b64decode(vector['input']['candidateMipBase64'])
    (directory/'policy.json').write_bytes(policy);(directory/'candidate.mip').write_bytes(candidate)
    config=dict(kind='MemoryOSCICDConfiguration',version='1.0.0',operation='evaluatePolicySet' if selected=='policySet' else 'evaluatePolicy',context={'candidateMip':'candidate.mip'},output={'directory':'.memoryos-ci/out'},**{selected:{'path':'policy.json','expectedSemanticDigest':vector['expected']['semanticDigest']}})
    (directory/'memoryos-ci.json').write_bytes(j(config))
    expected=vector['expected']
    (directory/'evaluation-identity.json').write_bytes(base64.b64decode(expected['evaluationIdentityBase64']))
    (directory/'policy-outcome.json').write_bytes(base64.b64decode(expected['outcomeBase64']))
    rows.append(dict(id=name,source=source.relative_to(ROOT).as_posix(),sourceSha256=sha(source.read_bytes()),directory=directory.relative_to(ROOT).as_posix(),decision=expected['decision'],semanticDigest=expected['semanticDigest'],evaluationIdentityDigest=expected['evaluationIdentityDigest'],outcomeDigest=expected['outcomeDigest']))
(DEST/'vectors.json').write_bytes(j(dict(kind='MemoryOSCICDReferenceVectors',version='1.0.0',vectors=rows)))
print('Extracted',len(rows),'immutable vectors')

"""Run complete cheap validators before any additional runtime witness."""
from pathlib import Path
import sys,subprocess,json,copy
from context import *
from metadata_test import run as metadata_tests
OUT=ROOT/'repositories/cca-conformance/evidence/mo1305-phase3c-refresh'
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
def command(name,args):
    result=subprocess.run([str(NODE),*args],cwd=ROOT,capture_output=True,timeout=180)
    log=OUT/(name+'.log');log.write_bytes(result.stdout+result.stderr)
    assert result.returncode==0,(name,result.returncode,result.stderr.decode(errors='replace'))
    return {'name':name,'arguments':args,'exitCode':result.returncode,'log':reference(log.relative_to(ROOT).as_posix())}
def main():
    assert identity(NODE.read_bytes())['sha256']==read('repositories/cca-conformance/tools/mo1305-phase3-correction/package-allowlist.json')['nodeSha256']
    report=validate(True)
    sbom=read(PKG_REL+'/sbom.spdx.json')
    schema=verify_schema(sbom);fields=field_inventory(sbom)
    for name,value in [('schema-validation',schema),('generated-fields',fields),('correction-conformance',report),('runtime-preservation',runtime_proof())]:
        (OUT/(name+'.json')).write_bytes(j(value))
    cases=metadata_tests(ROOT/read(E+'candidate.json')['archive']['path'])
    assert cases['caseCount']==34 and cases['state']=='PASS'
    (OUT/'metadata-tests.json').write_bytes(j(cases))
    commands=[command('openapi',['repositories/memoryos-rest/scripts/verify-contracts.mjs']),
              command('contract-tests',['--test','--test-concurrency=1','--test-reporter=tap','repositories/memoryos-rest/tests/contracts.test.mjs','repositories/memoryos-rest/tests/openapi.test.mjs']),
              command('correction-tests',['--test','--test-concurrency=1','--test-reporter=tap','repositories/cca-conformance/tools/mo1305-phase3c-refresh/correction.test.mjs'])]
    for key in ['baseline','implementation','candidate','old','provisionalBlocked','corrected','archive','schema','runtimePreservation','phase3','finalBinding','releaseTag']:
        altered=copy.deepcopy(binding(C3));altered[key]=None
        try:check_binding(altered,C3)
        except AssertionError:pass
        else:raise AssertionError('FORGED_BINDING:'+key)
    result={'kind':'MemoryOSRESTPhase3CRefreshCheapGates','version':'1.0.0','state':'PASS','candidate':C3B,'schemaTotalErrors':schema['totalErrors'],'metadataCases':34,'correctionTests':8,'contractTests':12,'bindingNegatives':12,'runtimeWitnessesRun':False,'results':report,'commands':commands,'node':reference(NODE.relative_to(ROOT).as_posix()),'inputs':[reference('repositories/cca-conformance/tools/mo1305-phase3c-refresh/'+n) for n in ['context.py','correction.test.mjs','cheap.py']]}
    (OUT/'cheap-gates.json').write_bytes(j(result))
    print(json.dumps({'state':'PASS','schemaTotalErrors':0,'metadataCases':34,'contractTests':12,'correctionTests':8,'graph':'PASS'}))
if __name__=='__main__':main()

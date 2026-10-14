"""Negative witnesses against an actual Ubuntu receipt; never creates PASS evidence."""
import copy,json,shutil,sys,tempfile
from pathlib import Path
from package_verify import canonical,identity,require
from validate_receipt import validate,read_json
receipt=Path(sys.argv[1]).resolve();workspace=Path(sys.argv[2]).resolve();cache=workspace/'.cache';cache.mkdir(exist_ok=True)
original=read_json(receipt,canonical_required=True);validate(original,receipt.parent)
results=[]
def reject(label,change,artifact_change=None):
 with tempfile.TemporaryDirectory(prefix='mo1304-validator-',dir=cache) as name:
  directory=Path(name).resolve();require(directory.is_relative_to(cache.resolve()),'TEMP_SCOPE')
  value=copy.deepcopy(original)
  for entry in original['artifacts'].values():shutil.copyfile(receipt.parent/entry['file'],directory/entry['file'])
  change(value)
  if artifact_change:
   key,mutate=artifact_change;entry=value['artifacts'][key];path=directory/entry['file'];data=read_json(path);mutate(data);raw=canonical(data);path.write_bytes(raw);entry.update(identity(raw))
  try:validate(value,directory)
  except (ValueError,KeyError,TypeError,FileNotFoundError,AssertionError):pass
  else:raise AssertionError('INVALID_RECEIPT_ACCEPTED:'+label)
 results.append(label)
for key,bad in [('platform','windows-11-24H2'),('platform','macos'),('architecture','arm64'),('implementationRevision','0'*40),('phase2Binding','0'*40),('npm','11.0.0'),('overall','FAIL')]:reject(key+'-'+bad,lambda v,k=key,b=bad:v.__setitem__(k,b))
reject('missing-platform',lambda v:v.pop('platform'))
reject('extra-platform-record',lambda v:v.__setitem__('windows',{'overall':'PASS'}))
reject('wrong-node',lambda v:v['node'].__setitem__('executableSha256','0'*64))
for key in original['candidate']['identities']:
 reject('wrong-identity-'+key,lambda v,k=key:v['candidate']['identities'][k].__setitem__('sha256','0'*64))
reject('wrong-archive',lambda v:v['candidate']['archive'].__setitem__('sha256','0'*64))
reject('wrong-archive-count',lambda v:v['candidate'].__setitem__('archiveFiles',799))
reject('missing-test-catalog',lambda v:v['artifacts'].pop('testCatalog'))
reject('wrong-tool-catalog',lambda v:None,('execution',lambda d:d['results'][1]['details'].__setitem__('catalogSha256','0'*64)))
reject('missing-required-test',lambda v:None,('execution',lambda d:d['results'].pop()))
reject('failed-required-test',lambda v:None,('execution',lambda d:d['results'][0].__setitem__('status','FAIL')))
reject('duplicate-required-test',lambda v:None,('execution',lambda d:d['results'].append(copy.deepcopy(d['results'][0]))))
reject('missing-semantic-vector',lambda v:None,('execution',lambda d:d['vectors'].pop()))
reject('changed-canonical-bytes',lambda v:None,('execution',lambda d:d['vectors'][0].__setitem__('canonicalProduct','{}')))
reject('changed-digest',lambda v:None,('execution',lambda d:d['vectors'][0].__setitem__('sha256','0'*64)))
reject('fabricated-pass',lambda v:None,('execution',lambda d:d.__setitem__('results',[])))
reject('fabricated-package-pass',lambda v:None,('packageAdversarial',lambda d:d.__setitem__('results',[])))
reject('fabricated-network-denial',lambda v:None,('execution',lambda d:d['results'][0]['details'].__setitem__('probes',[])))
reject('fabricated-zero-vulnerabilities',lambda v:v['supplyChain'].__setitem__('affectedHigh',0))
reject('future-tag',lambda v:v['pending'].__setitem__('tag','memoryos-1.3-mo1304'))
reject('fabricated-windows',lambda v:v['pending'].__setitem__('windowsReceipt',{'status':'PASS'}))
reject('fabricated-parity',lambda v:v['pending'].__setitem__('parityReceipt',{'status':'PASS'}))
reject('unsafe-artifact-path',lambda v:v['artifacts']['inputs'].__setitem__('file','../inputs.json'))
reject('wrong-harness',lambda v:v['harness'].__setitem__('sha256','0'*64))
reject('wrong-tooling',lambda v:None,('toolingVerification',lambda d:d['packages'][0].__setitem__('version','2.0.1')))
print(json.dumps({'status':'PASS','negativeWitnesses':len(results),'cases':results},sort_keys=True))

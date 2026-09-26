from common import *
from datetime import datetime,timezone
states=[]
for name in ['3a','3b','3c']:
 wt=ROOT.parent/('cca-mo1306-'+name);prefix=['-c','safe.directory='+wt.as_posix(),'-C',str(wt)]
 state={'workstream':name,'root':str(wt),'observedAt':datetime.now(timezone.utc).isoformat(),'head':git(*prefix,'rev-parse','HEAD'),'status':git(*prefix,'status','--porcelain=v1','--untracked-files=all'),'touchedByCorrection':False}
 inputs=[]
 for p in sorted((wt/('repositories/cca-conformance/evidence/mo1306/phase'+name)).glob('*.json')):
  raw=p.read_bytes()
  try:v=json.loads(raw)
  except ValueError:continue
  needles={'baseline':B2.encode(),'oldArchive':b'6541e2a935f7bd0d5580b32fc9f17a07d471bc16486fd2a044ecef7628d2458b','oldDistribution':b'bd154a7a972395b801b3cb0189a728b7e9870eb05f90558346eb7fee7055fe77'}
  hits=[key for key,value in needles.items() if value in raw]
  inputs.append({**row(p,wt),'status':v.get('status'),'identityDependencies':hits})
 state['evidence']=inputs
 if name=='3a':
  state.update(disposition='TARGETED_REFRESH_REQUIRED',reason='Actual candidate/baseline receipts and native/hosted preparation explicitly bind B2 and old archive/distribution. Existing execution evidence remains historical. Refresh corrected installed CLI entrypoints, Windows artifact-bound execution receipts and reviewed hosted source/distribution pins; complete any unexecuted hosted work only in a separately authorized recertification task. Unchanged SDK/provider/lifecycle source evidence can be reused with explicit closure comparisons.')
 elif name=='3b':
  state.update(disposition='TARGETED_REFRESH_REQUIRED',reason='Actual package, installed and supply-chain receipts bind old B2 archive/distribution/source tree. Refresh corrected archive allowlist/content/source identities, archive-bound SBOM/provenance, installed smoke and receipt graph. Reuse unchanged Node/npm/SDK/actions/dependency advisory review only if still applicable; preserve existing advisory disposition and lack of release acceptance. No full new campaign solely for this CLI check.')
 else:
  state.update(disposition='TARGETED_REFRESH_REQUIRED',originalDisposition='BLOCKED / PRODUCTION_DEFECT',reason='Original stopped audit remains permanently BLOCKED. Independently verify corrected own-property dispatch, consume new package identity and resume the unfinished provider/security/release audit. This is not a certificate yet; passed partial suites may only be reused through unchanged-byte dependency checks.')
 states.append(state)
put('recertification-impact.json',{'status':'PASS','analysisOnly':True,'recertificationExecuted':False,'workstreams':states,'nextTask':'MO-1306 Phase 3 targeted recertification against actual C3AB and corrected memoryos-ci@0.1.0 archive: refresh 3A archive-bound Windows/hosted identities and outstanding execution, refresh 3B changed artifact/SBOM/provenance/binding identities with applicable unchanged supply-chain evidence retained, resume independent 3C after verifying this correction, then perform separately authorized 3D integration. Preserve all B2 and blocked 3C evidence; do not promote certification labels in this correction.','observationLimit':'Worktrees may continue independently after this point-in-time snapshot; no running work is stopped or modified.'})
print(json.dumps([{'workstream':s['workstream'],'head':s['head'],'dirtyFiles':len(s['status'].splitlines()),'disposition':s['disposition'],'archiveOrDistributionBoundReceipts':sum(any(x in e['identityDependencies'] for x in ['oldArchive','oldDistribution']) for e in s['evidence'])} for s in states]))

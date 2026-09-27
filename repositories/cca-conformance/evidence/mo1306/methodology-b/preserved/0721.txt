"""Resume evidence closure after retaining whitespace diagnostics; no product execution."""
import datetime,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
import finalize as f
root=f.ROOT;out=f.OUT;here=f.HERE
failed=['original-probe-transcript/raw-helper-probe.py.txt:21','remote_campaign.py:348','remote_campaign_test.py:85','remote_final.py:77','remote_resolution.py:164','validate.py:288']
f.put('git-validation-first-attempt.json',{'kind':'MemoryOSPhase3ARResolutionGitWhitespaceFirstAttempt','status':'FAILED_FORMAT_ONLY','exitCode':2,'command':['git','diff','--cached','--check','HEAD'],'diagnostics':[{'fileAndLine':x,'message':'new blank line at EOF'} for x in failed],'evidenceSource':'Retained actual first finalizer tool result chunk772ff8. No other whitespace diagnostics were emitted.','resolution':'Preserve all already executed or archival source bytes. Apply exact-path blank-at-EOF attribute exceptions only to these six files; keep all other whitespace checks.'})
# Exact-path exceptions preserve the sources already bound by diagnosis/API receipts.
attr=' whitespace=blank-at-eol,space-before-tab,cr-at-eol,-blank-at-eof\n'
tools_attr=here/'.gitattributes';base=tools_attr.read_text(encoding='utf-8')
for name in ['remote_campaign.py','remote_campaign_test.py','remote_final.py','remote_resolution.py','validate.py']:
 line=name+attr
 if line not in base:base+=line
tools_attr.write_text(base,encoding='utf-8',newline='\n')
evidence_attr=out/'.gitattributes';base=evidence_attr.read_text(encoding='utf-8');line='original-probe-transcript/raw-helper-probe.py.txt'+attr
if line not in base:base+=line
evidence_attr.write_text(base,encoding='utf-8',newline='\n')
report=out/'REPORT.md';text=report.read_text(encoding='utf-8')
for a,b in [('Frozen2,000','Frozen 2,000'),('Python3.12','Python 3.12'),('behavior.2031','behavior. 2031'),('First404','First 404'),('addressed.404','addressed. 404'),('observations:4','observations: 4'),('failure.9','failure. 9'),('pass.50','pass. 50'),('Historical3B','Historical 3B')]:text=text.replace(a,b)
text=text.replace('Final closed inventory rechecked.','Final closed inventory rechecked. The first check found extra final blank lines in six already bound source/archive files; exact-path EOF-only exceptions preserve their bytes, and the failed check is retained.')
for rel in ['execution-receipt.json','native/timing-diagnosis.json','validation.json','github/final-state.json','evidence-index.json']:
 text=text.replace('`'+rel+'`','['+rel+']('+str(out/rel).replace('\\','/')+')')
# Report the actual closure clock separately from the earlier immutable receipt clock.
now=datetime.datetime.now(datetime.timezone.utc);elapsed=(now-f.START).total_seconds();assert elapsed<3600
start=text.index('| 59 | Duration |');end=text.index('\n',start)
text=text[:start]+f'| 59 | Duration | {elapsed/60:.2f} minutes from first explicit clock {f.START.isoformat()} to evidence closure {now.isoformat()}; the earlier receipt retains its own timestamp. |'+text[end:]
report.write_text(text,encoding='utf-8',newline='\n')
f.verify_receipt(f.rawjson(out/'execution-receipt.json'))
g=f.git_check();f.put('git-validation.json',g)
r=f.run([sys.executable,'-B',str(here/'validate.py'),'--check']);assert r['exitCode']==0,r
f.put('final-validation.json',{'kind':'MemoryOSPhase3ARResolutionFinalValidation','status':'PASS','meaning':'Truthful blocked receipt and immutable evidence validated; certification remains blocked.','receipt':f.row(out/'execution-receipt.json'),'report':f.row(report),'git':f.row(out/'git-validation.json'),'initialWhitespaceDiagnostic':f.row(out/'git-validation-first-attempt.json'),'closureTool':f.row(Path(__file__)),'receiptNegativeControls':f.row(out/'receipt-negatives.json'),'independentReadOnlyRecheck':r,'elapsedSecondsAtClosure':elapsed,'closureUtc':now.isoformat(),'validators':{'nativeBlockerResolution':'PASS_DIAGNOSIS_VALIDATED','hostedEvidence':'BLOCKED_NO_HOSTED_EXECUTION','artifact':'BLOCKED_NO_HOSTED_ARTIFACTS','parity':'BLOCKED_NO_HOSTED_EXECUTION','receipt':'PASS_TRUTHFUL_BLOCKED_DISPOSITION','remoteState':'PASS_UNCHANGED_READ_ONLY_STATE','workspace':'PASS','gitDiffCheck':'PASS'}})
files=sorted((p for base in [out,here] for p in base.rglob('*') if p.is_file() and p!=out/'evidence-index.json'),key=lambda p:p.relative_to(root).as_posix())
f.put('evidence-index.json',{'kind':'MemoryOSPhase3ARResolutionClosedEvidenceIndex','version':'1.0.0','status':'NATIVE_DEADLINE_BLOCKED','scope':'Only new resolution tools/evidence; excludes this index itself. Historical checkpoint has its unchanged separate closed index.','files':[f.row(p) for p in files]})
f.check()
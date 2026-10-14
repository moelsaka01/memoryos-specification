from common import *
import re,collections,shutil
# Full first-party deadline/cancellation search. Runtime SDK bytes unchanged and
# contain no child/timer acceptance authority; packaged validators are separate.
pattern=re.compile(r'deadline|setTimeout|clearTimeout|on\(.close|signal|abort|resolve\(',re.I)
rows=[]
for p in sorted(PKG.rglob('*.mjs')):
 if 'runtime' in p.relative_to(PKG).parts:continue
 name=p.relative_to(PKG).as_posix()
 for n,line in enumerate(p.read_text().splitlines(),1):
  if not pattern.search(line):continue
  kind='NOT_SUCCESS_ACCEPTANCE';why='Deadline propagation, cancellation setup, or interruption scheduling; no independent success acceptance.'
  if 'reap=setTimeout' in line or 'reapTimer=setTimeout' in line:kind='CLEANUP_ONLY';why='Separate 2000 ms cleanup rejection, never success.'
  elif name=='src/publication.mjs' and n>=61:kind='CLEANUP_ONLY';why='Known-file cleanup guarded by checkPaths; failure becomes CLEANUP_FAILED.'
  elif name in ['scripts/github-transport.mjs','scripts/verify-provider-result.mjs','src/verification.mjs','src/github-transport.mjs']:kind='VALIDATOR_ONLY';why='Consumes/verifies existing completed bundles; helper calls inherit the corrected guard, cannot mint semantic success.'
  elif name=='src/filesystem.mjs' and ('effectiveDeadline' in line or "on('close'" in line or 'resolve();' in line):kind='SAFE_ABSOLUTE_GUARD';why='Corrected helper closes only before min(invocation+2000, overall), checked before parse and acceptance.'
  elif name=='src/supervisor.mjs' and ('performance.now()' in line and '>=' in line or 'resolve(' in line or "on('close'" in line):kind='SAFE_ABSOLUTE_GUARD';why='Semantic close awaits verification then explicitly checks overall and semantic monotonic time before resolve.'
  elif name=='src/core.mjs' and 'performance.now()>=' in line or name=='src/publication.mjs' and 'checkTerminal()' in line:kind='SAFE_ABSOLUTE_GUARD';why='Explicit overall/cancellation guard; publication marker follows final guard without await.'
  rows.append({'path':name,'line':n,'text':line,'classification':kind,'reason':why})
for p in sorted([*PKG.rglob('*.ps1'),*PKG.rglob('*.tpl')]):
 for n,line in enumerate(p.read_text().splitlines(),1):
  if re.search(r'timeout|cancel',line,re.I):rows.append({'path':p.relative_to(PKG).as_posix(),'line':n,'text':line,'classification':'NOT_SUCCESS_ACCEPTANCE','reason':'Provider job or bootstrap network-operation limit outside the supervised invocation; cannot authorize helper or semantic success.'})
rows.append({'path':'C3AB:src/filesystem.mjs','line':98,'classification':'TIMER_ONLY_AFFECTED','reason':'Close cleared the pending timer, checked terminal flag and response only, then resolved. The sole affected acceptance path.'})
rows.append({'path':'phase3ar-resolution observation 7 and 2032 history','classification':'HISTORICAL','reason':'Observation 7 is product violation; old outer 2032 stopwatch remains MEASUREMENT_DEFECT.'})
freeze=ROOT/'docs/mo1306-contract-freeze-1.md';lines=freeze.read_text().splitlines()
put('deadline-audit.json',{'status':'PASS','siteCount':len(rows),'counts':dict(collections.Counter(x['classification'] for x in rows)),'sites':rows,'productionFilesInspected':[row(p) for p in sorted(PKG.rglob('*.mjs')) if 'runtime' not in p.relative_to(PKG).parts],'freeze':row(freeze),'frozenText':[{'startLine':a,'endLine':b,'text':'\n'.join(lines[a-1:b])} for a,b in [(539,546),(662,673),(1163,1174)]],'additionalIndependentDefect':False,'otherAffectedCallers':['installation verification','input acquisition','output directory checks','publication staging','CLI generation','bundle verification'],'sameRootCauseNaturallyCovered':True,'exactBoundary':'Success requires now < effectiveDeadline. Equality is terminal, matching frozen at-a-deadline language and existing semantic worker >= checks. IEEE-754 neighboring clock values tested, no rounding/grace.'})
# Mechanically compare all peer package files with the baseline and current source.
peer_rows=[]
for name,scope,files in [('cca-mo1306-3b-refresh2','phase3b-r2',['certification-receipt.json','provenance.json','sbom-candidate.spdx.json','advisory-undici.json','advisory-xml.json','supply-workflow-crosscheck.json']),('cca-mo1306-3c-refresh','phase3cr',['authority.json','audit-validation.json','release-closure.json','security-audit.json','provider-audit.json','external-dependencies.json'])]:
 peer=ROOT.parent/name;old=peer/'repositories/memoryos-ci';assert inventory(old)==inventory(CACHE/'c3ab-package')
 changes=[p['path'] for p in inventory(PKG) if p not in inventory(old)]
 bound=[]
 for file in files:
  p=peer/'repositories/cca-conformance/evidence/mo1306'/scope/file
  raw=p.read_bytes();value=json.loads(raw);dest=OUT/'peer-authority'/scope/file;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dest)
  bound.append({'source':row(p,peer),'copy':row(dest),'baselineIdentityReferences':{'C3AB':raw.count(C3AB.encode()),'archive':raw.count(b'2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d'),'distribution':raw.count(b'311927a980bd397ab70b95da77d546e4b212968d05973ecf998817764431d773'),'filesystem':raw.count(b'src/filesystem.mjs')}})
 peer_rows.append({'workspace':str(peer),'packageEqualsC3AB':True,'currentDelta':changes,'records':bound})
put('recertification-impact.json',{'status':'PASS','peers':peer_rows,'3A-R':{'disposition':'TARGETED_REFRESH_REQUIRED','scope':'Corrected installed helper deadline, cancellation/cleanup/topology/native affected boundaries and package identity; hosted certification has never run and remains a separate later authorized task.'},'3B-R2':{'disposition':'TARGETED_IDENTITY_REFRESH_REQUIRED','scope':'New archive/distribution/source inventory plus affected expanded SBOM/provenance and installed identity bindings. Reuse unchanged Action bytes and advisory reasoning; no new advisory research or Action update.'},'3C-R':{'disposition':'TARGETED_REFRESH_REQUIRED','scope':'Generic filesystem/helper absolute deadline, affected overall/cancellation/publication dependencies and current package bindings. Reuse unchanged semantic, CLI, provider/parser/schema/label/Action-pin evidence subject to exact identity comparison.'},'advisories':{'Undici':'NOT_REACHABLE_IN_FROZEN_USAGE','fast-xml-parser':'REACHABLE_NOT_ATTACKER_CONTROLLED','actionUpdateRequired':False},'recertificationStarted':False,'remote':{'freshVerification':False,'operationsPerformed':False,'historicalDefault':'main','historicalMain':'5955af062152a84c10de17860ba0bcabe8b3555f','historicalCertificationBranch':'mo1306-certification','historicalCertificationHead':'3096139e0108be22528859e4f462356dddf6ef29','requiresLaterRefresh':True}})
print('Deadline audit',len(rows),'sites; no additional independent deadline defect; peer dependencies retained')

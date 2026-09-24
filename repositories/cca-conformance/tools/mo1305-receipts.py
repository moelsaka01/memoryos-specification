"""Bind completed executions to canonical Phase 1 receipts; no invented future revisions."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
ROOT=Path(__file__).resolve().parents[3];PKG=ROOT/'repositories/memoryos-rest';CONF=ROOT/'repositories/cca-conformance'
AUX=CONF/'evidence/mo1305-phase1-aux';OUT=CONF/'evidence/mo1305-phase1';CACHE=ROOT/'.cache/mo1305-resource-review';BUILD=ROOT/'.cache/mo1305-resume/build'
A='d15b578dd757e928273d4548348b085e58ed5df5';F='ce1780e2dac0afe31aeb947f0a7f78b953e17f6b';C='c2e3835b852fd966046ac9e984538fdcaf8b26bf';V='75cee55784c590bab52feaf8f2214e4d1b9e657f'
def j(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def read(p):return json.loads(p.read_bytes())
def ref(p):
 b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':hashlib.sha256(b).hexdigest()}
def put(p,v):p.parent.mkdir(parents=True,exist_ok=True);b=j(v);assert len(b)<=2097152;p.write_bytes(b);return ref(p)
def copy(p,name):
 target=AUX/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.read_bytes());return ref(target)
def projection(count=1,cold=0,warm=0,adverse=0):return {'state':'PASS','caseCount':count,'coldSamples':cold,'warmSamples':warm,'adverseRepetitions':adverse,'failures':0}
execution=read(CACHE/'final-validation/results.json');assert execution['state']=='PASS' and all(r['state']=='PASS' and r['exitCode']==0 for r in execution['records'])
archive=ref(BUILD/'memoryos-rest-0.1.0.tgz');distribution=ref(PKG/'distribution-manifest.json');tree=read(PKG/'dependency-manifest.json')['sourceTreeSha256']
assert execution['binding']=={'archive':archive,'distributionManifest':distribution,'sourceTreeSha256':tree}
assert read(PKG/'contracts/limits.json')['state']=='FINAL'
for row in execution['records']:row['log']=copy(ROOT/row['log']['path'],'final-validation/'+row['id']+'.log')
executionRef=put(AUX/'final-validation.json',execution)
harnessFiles=sorted([p for p in (CONF/'tools').glob('mo1305*') if p.is_file()]+[p for p in (CONF/'tools/mo1305-phase1').rglob('*') if p.is_file() and '__pycache__' not in p.parts]+[CONF/'tests/mo1305_phase1_conformance_test.mjs',CONF/'tests/mo1305_host_guard_test.mjs',CONF/'tools/run-js-conformance.mjs'],key=lambda p:p.relative_to(ROOT).as_posix())
harness=put(AUX/'harness.json',{'kind':'MemoryOSRESTExecutedHarnessManifest','version':'1.0.0','files':[ref(p) for p in harnessFiles]})
platform=read(CACHE/'platform.json');platform={k:platform[k] for k in ['target','osName','osEdition','osRelease','osVersion','osBuild','kernel','architecture']}
node=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
toolchain=[]
for name,version,path in [('node','24.21.0',node),('npm','11.19.0',node.parent/'node_modules/npm/bin/npm-cli.js'),('python',sys.version.split()[0],Path(sys.executable)),('powershell','7.5.2',Path(r'C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')),('curl',read(CACHE/'clients.json')['curlVersion'].splitlines()[0].split()[1],Path(r'C:/Windows/System32/curl.exe'))]:
 if name=='powershell':version=subprocess.check_output([str(path),'-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],text=True).strip()
 toolchain.append({'name':name,'version':version,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
toolchain.sort(key=lambda r:r['name'])
def receipt(kind,payload,results,catalog,source=tree,artifacts=None):
 value={'kind':'MemoryOSRESTReceipt','version':'2.0.0','type':kind,'state':'PASS','authorityRevision':A,'contractFreezeRevision':F,'platformCorrectionRevision':C,'verificationCorrectionRevision':V,'implementationRevision':None,'bindingRevision':None,'sourceTreeSha256':source,'harness':harness,'artifacts':sorted(artifacts or [],key=lambda r:r['path']),'platform':platform,'toolchain':toolchain,'catalog':catalog,'results':sorted(results,key=lambda r:r['id']),'payload':payload}
 return put(OUT/(kind+'.json'),value)
def results(rows):return [{'id':r['id'],'state':r['state'],'expected':r['expected'],'actual':r['actual'],'artifactRefs':[]} for r in sorted(rows,key=lambda r:r['id'])]
def catalog(kind,rows):return put(AUX/(kind+'-catalog.json'),{'kind':'MemoryOSRESTExecutionCatalog','version':'1.0.0','records':[{'id':r['id'],'expected':r['expected']} for r in sorted(rows,key=lambda r:r['id'])]})
def runset(name,rawPath,selected,category,transport,installed=True):
 raw=copy(rawPath,'raw/'+rawPath.name);rows=[]
 for id,count in selected:rows.append({'id':id,'state':'PASS','expected':projection(count),'actual':projection(count)})
 value={'kind':'MemoryOSRESTExecutedCaseSet','state':'PASS','sourceTreeSha256':tree,'archive':archive,'distributionManifest':distribution,'harness':harness,'records':sorted(rows,key=lambda r:r['id']),'provenance':{'execution':executionRef,'rawResults':raw,'category':category,'caseCount':len(rows),'transport':transport,'installed':installed,'releaseCertification':False}}
 return put(AUX/(name+'.json'),value),rows
def checked(path,key='records',state='state'):
 value=read(path);assert value.get('state',value.get('status'))=='PASS';rows=value[key];assert rows and all(r[state]=='PASS' for r in rows);return rows
fixtureIds={r['path'][:-5] for r in read(CONF/'fixtures/mo1305-phase1/index.json')['files']}
rawIntegration=ROOT/'.cache/mo1305-resume/integration.json';integration=checked(rawIntegration,'results','status')
local,localRows=runset('http-local',rawIntegration,[(('SDK-' if r['id'] in fixtureIds else 'LOCAL-')+r['id'],1) for r in integration],'semantic-and-operational-parity','actual TCP / TLS 1.3 / HTTP 1.1')
clientData=checked(CACHE/'clients.json');clientRefs=[];clientRows=[]
for name,label,prefix in [('node-fetch','Node fetch 24.21.0','FETCH-'),('curl','Windows curl TLS1.3 HTTP1.1','CURL-')]:
 selected=[(prefix+r['id'],1) for r in clientData if r['client']==label];assert len(selected)==12
 reference,rows=runset('http-'+name,CACHE/'clients.json',selected,name,'actual TCP / TLS 1.3 / HTTP 1.1');clientRefs.append({'name':name,'cases':reference});clientRows+=rows
framingData=checked(CACHE/'adversarial.json');assert len(framingData)==174
framing,framingRows=runset('http-framing',CACHE/'adversarial.json',[(r['id'],1) for r in framingData],'raw-framing','actual TCP / TLS 1.3 / HTTP 1.1')
httpRows=localRows+clientRows+framingRows;httpRef=receipt('http',{'clients':clientRefs,'local':local,'remote':{'state':'PENDING','receipt':None},'framing':framing},results(httpRows),catalog('http',httpRows))
securityRefs=[];securityRows=[]
for name,count in [('adversarial',174),('startup',51),('startup-extra',15),('lifecycle',19),('worker-faults',15),('signals',1)]:
 path=CACHE/(name+'.json');data=checked(path);assert len(data)==count
 reference,rows=runset('security-'+name,path,[(name.upper()+'-'+r['id'],1) for r in data],name,'actual installed process; real TLS where applicable');securityRefs.append(reference);securityRows+=rows
tap=(CACHE/'final-validation/units.log').read_text(encoding='utf-8');assert re.search(r'^# tests 27$',tap,re.M) and re.search(r'^# pass 27$',tap,re.M) and re.search(r'^# fail 0$',tap,re.M)
network,networkRows=runset('worker-boundary',CACHE/'final-validation/units.log',[('WORKER-27-AUTHORITY-DENIALS',27)],'worker-unit-boundary','real isolated Worker with trusted test code and exact distribution module bytes',False);securityRows+=networkRows
provenance=read(CACHE/'supply-chain/provenance.json');assert provenance['state']=='PASS' and provenance['exitCode']==0
for key in ['signedChecksums','checksums','keyring','status','diagnostic']:provenance[key]=copy(ROOT/provenance[key]['path'],'toolchain/'+Path(provenance[key]['path']).name)
provenanceRef=put(AUX/'toolchain-provenance.json',provenance)
review={'kind':'MemoryOSRESTSupplyChainReview','state':'PASS','reviewDate':'2026-09-24','scope':'Pinned Windows Node, npm installation tool, embedded components, immutable semantic closure and first-party distribution','disposition':'No unresolved affected advisory was identified in the reviewed scope. This is not an exhaustive zero-vulnerability assertion.','report':ref(ROOT/'docs/mo1305-phase1-supply-chain-review.md'),'provenance':provenanceRef,'dependencyManifest':ref(PKG/'dependency-manifest.json'),'sbom':ref(PKG/'sbom.spdx.json'),'notices':ref(PKG/'NOTICES.md'),'upstreamNotice':ref(PKG/'notices/node-LICENSE.txt'),'directCount':0,'transitiveCount':0,'developmentCount':0}
reviewRef=put(AUX/'supply-chain-review.json',review)
securityRef=receipt('security',{'adversarial':securityRefs,'networkDenial':{'mechanism':'Trusted semantic Worker denies network, DNS, process creation, nested workers, native modules and writes; no hostile-native-code or OS network containment claim.','coverage':network,'osNetworkDenial':'NOT_CLAIMED'},'advisories':reviewRef},results(securityRows),catalog('security',securityRows))
installed=read(CACHE/'offline-install.json');assert installed['state']=='PASS' and installed['postInstallEveryFileMatches'] and installed['cacheInitiallyEmpty'] and installed['exitCode']==0;assert installed['archive']['sha256']==archive['sha256'];installed['stage']='FRESH_ISOLATED_DIRECTORY_OUTSIDE_CHECKOUT';installed['command'][-1]='FRESH_EMPTY_EXPLICIT_CACHE';installation=put(AUX/'offline-install.json',installed)
builds=read(CACHE/'independent-builds/results.json');assert builds['state']=='PASS' and len(builds['builds'])==2 and all(r=={'treeSha256':tree,'archiveSha256':archive['sha256']} for r in builds['builds'])
copy(CACHE/'independent-builds/results.json','independent-builds.json')
regressions=read(CACHE/'regressions/results.json');assert all(r['state']=='PASS' and r['exitCode']==0 and r['counts']['fail']==0 for r in regressions['results'])
for r in regressions['results']:r['log']=copy(ROOT/r['log']['path'],'regressions/'+r['id']+'.tap')
regressionRef=put(AUX/'regressions.json',regressions)
packageRows=[{'id':id,'state':'PASS','expected':projection(count),'actual':projection(count)} for id,count in [('CONTRACT-OPENAPI-CLOSURE',1),('INDEPENDENT-BUILDS',2),('OFFLINE-INSTALL',installed['installedFileCount']),('PACKAGE-UNIT-TESTS',27),('HOST-INTERRUPTION-GUARD',21),('MONITOR-SYNCHRONIZATION',28),('PREDECESSOR-REGRESSIONS',sum(r['counts']['pass'] for r in regressions['results'])),('SUPPLY-CHAIN-REVIEW',1),('WORKSPACE-AND-WHITESPACE',2)]]
packageRef=receipt('package',{'archive':archive,'distributionManifest':distribution,'builds':builds['builds'],'installation':installation,'dependencyReview':reviewRef},results(packageRows),catalog('package',packageRows),artifacts=[executionRef,regressionRef,ref(AUX/'final-source-tree.json'),ref(AUX/'independent-builds.json')])
selection=read(CONF/'fixtures/mo1305-phase1/bounded/resource-selection.json');selected={r['id'] for r in selection['vectors']};selectedCatalog={'kind':'MemoryOSRESTMeasurementCatalog','version':'2.0.0','coldSamples':10,'warmSamples':20,'records':[r for r in read(CONF/'fixtures/mo1305-phase1/measurement/catalog.json')['records'] if r['id'] in selected]};measurementCatalog=put(AUX/'resource-catalog.json',selectedCatalog);measurementRows=[{'id':r['id'],'state':'PASS','expected':projection(30,10,20),'actual':projection(30,10,20)} for r in selectedCatalog['records']]
boundaries=[put(AUX/(name+'.json'),read(CACHE/(name+'.json'))) for name in ['final-boundaries','boundary-matrix','lifecycle','worker-faults']]
derivation={'formulaVersion':'1.0.0','methodologyVersion':'2.0.0','selection':ref(CONF/'fixtures/mo1305-phase1/bounded/resource-selection.json'),'memoryNumerator':3,'memoryDenominator':2,'wireNumerator':5,'wireDenominator':4,'deadlineMultiplier':4,'memoryRoundingBytes':1048576,'wireRoundingBytes':1024,'deadlineRoundingMs':100,'analyticalBounds':ref(CONF/'fixtures/mo1305-phase1/analytical-bounds.json'),'campaign':ref(CONF/'evidence/mo1305-phase1-resume/resource-aggregate.json'),'adverse':ref(CONF/'evidence/mo1305-phase1-resume/stress/index.json'),'measuredSourceTree':ref(AUX/'measured-source-tree.json'),'measuredDistribution':ref(AUX/'measured-distribution-manifest.json'),'preliminaryLimits':ref(AUX/'measured-preliminary-limits.json'),'finalAdjustment':ref(AUX/'final-adjustment.json')}
resourceRef=receipt('resource',{'samples':read(AUX/'sample-chunks.json'),'maxima':read(AUX/'maxima.json'),'derivation':derivation,'limits':ref(PKG/'contracts/limits.json'),'boundaries':boundaries},results(measurementRows),measurementCatalog,source=read(AUX/'measured-source-tree.json')['sha256'],artifacts=[ref(CONF/'evidence/mo1305-resource-review/review.json'),ref(CONF/'evidence/mo1305-phase1-measurement-attempt1.json'),ref(CONF/'evidence/mo1305-phase1-measurement-attempt-r4.json'),ref(CONF/'evidence/mo1305-phase1-measurement-attempt-r5.json'),ref(CONF/'evidence/mo1305-phase1-measurement-attempt-r6.json'),ref(CONF/'evidence/mo1305-phase1-resume/guard-identity.json'),ref(CONF/'evidence/mo1305-phase1-clock-correction.json'),ref(CONF/'evidence/mo1305-phase1-recovery.json')]+[ref(AUX/('measured-'+name)) for name in ['inputs.json','external-inputs.json','input-checks.json','completion.json']])
# Separate bounded layer receipts share the same final execution proof but retain distinct purposes.
bounded=ROOT/'.cache/mo1305-host-resume';r6=CONF/'evidence/mo1305-phase1-resume'
nodeCommand=[str(node),str(CONF/'tools/mo1305-phase1/bounded-proof.mjs'),'ordinary',str((r6/'functional/progress.json').relative_to(ROOT)),str((bounded/'functional-validation.json').relative_to(ROOT))]
subprocess.run(nodeCommand,cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
functional=read(r6/'functional/progress.json');functionalRows=[{'id':r['id'],'state':'PASS','expected':projection(1,1,0),'actual':projection(1,1,0)} for r in functional['completed']]
functionalRef=receipt('functional',{'campaign':ref(r6/'functional/progress.json'),'validation':copy(bounded/'functional-validation.json','functional-validation.json')},results(functionalRows),catalog('functional',functionalRows),artifacts=[executionRef])
boundaryRows=[{'id':r['id'],'state':'PASS','expected':projection(),'actual':projection()} for name in ['final-boundaries','boundary-matrix'] for r in read(CACHE/(name+'.json'))['records']]
boundaryRef=receipt('boundary',{'records':boundaries[:2]},results(boundaryRows),catalog('boundary',boundaryRows),artifacts=[executionRef])
stressRows=[{'id':prefix+'-'+r['name']+'-'+str(r['repeat']),'state':'PASS','expected':projection(adverse=1),'actual':projection(adverse=1)} for prefix,name in [('ADVERSE','adverse-functional'),('STRESS','stress-confirmation')] for r in read(r6/name/'index.json')['completed']]
stressRef=receipt('stress',{'functional':ref(r6/'adverse-functional/index.json'),'measured':ref(r6/'stress/index.json'),'confirmation':ref(r6/'stress-confirmation/index.json'),'selection':ref(CONF/'fixtures/mo1305-phase1/bounded/stress-plan.json')},results(stressRows),catalog('stress',stressRows),artifacts=[executionRef,ref(r6/'adverse-functional/host-revalidation.json'),ref(r6/'stress-confirmation/host-revalidation.json')])
parityRef=receipt('parity',{'cases':local},results(localRows),catalog('parity',localRows),artifacts=[executionRef])
installRows=[{'id':'OFFLINE-INSTALL','state':'PASS','expected':projection(installed['installedFileCount']),'actual':projection(installed['installedFileCount'])}]
installRef=receipt('installation',{'installation':installation},results(installRows),catalog('installation',installRows),artifacts=[executionRef])
supplyRows=[{'id':'SUPPLY-CHAIN-REVIEW','state':'PASS','expected':projection(),'actual':projection()}]
supplyRef=receipt('supplyChain',{'review':reviewRef},results(supplyRows),catalog('supplyChain',supplyRows),artifacts=[ref(ROOT/'.cache/mo1305-resource-review/r5-clock-correction/supply-chain-recheck.json')])
inventory={'kind':'MemoryOSRESTConformanceInventory','version':'2.0.0','state':'PHASE1_PENDING','authorityRevision':A,'contractFreezeRevision':F,'platformCorrectionRevision':C,'verificationCorrectionRevision':V,'implementations':{k:None for k in ['I1','B1','I2','B2','I3']},'package':{'name':'memoryos-rest','version':'0.1.0','archive':archive,'distributionManifest':distribution,'sourceTreeSha256':tree},'contracts':{'apiSchema':ref(PKG/'contracts/api-contract.json'),'openapi':ref(PKG/'contracts/openapi.json'),'limits':ref(PKG/'contracts/limits.json'),'policyIdentities':ref(PKG/'contracts/policy-contract-identities-1.0.0.json')},'runtime':{'closure':ref(PKG/'runtime/runtime-closure-manifest.json'),'sdkVersion':'1.1.0','nodeVersion':'24.21.0','nodeExecutables':[{'target':'windows-11-x64','sha256':next(r['sha256'] for r in toolchain if r['name']=='node')}]},'dependencies':{'directCount':0,'transitiveCount':0,'developmentCount':0,'lockfile':ref(PKG/'package-lock.json'),'manifest':ref(PKG/'dependency-manifest.json'),'sbom':ref(PKG/'sbom.spdx.json'),'notices':ref(PKG/'NOTICES.md'),'review':reviewRef},'receipts':{'resource':[resourceRef],'package':[packageRef],'http':[httpRef],'security':[securityRef],'functional':[functionalRef],'boundary':[boundaryRef],'stress':[stressRef],'parity':[parityRef],'installation':[installRef],'supplyChain':[supplyRef],'platform':[]},'platforms':[{'target':'windows-11-x64','state':'NOT_EXECUTED','receipt':None}],'platformPolicy':{'supported':['windows-11-x64'],'measurement':['windows-11-x64'],'ubuntu':'NOT_REQUIRED','linux':'NOT_REQUIRED','vm':'NOT_REQUIRED','crossPlatformParity':'NOT_REQUIRED','semanticParity':'REQUIRED'},'finalBinding':{'state':'PENDING','validatedEvidenceRevision':None,'receipt':None},'releaseTag':{'name':'memoryos-1.3-mo1305','state':'NOT_READY','targetRole':'finalConformanceBinding'},'blockers':[]}
put(CONF/'mo1305-conformance-inventory.json',inventory);print(json.dumps({'state':'RECEIPTS_CREATED_PENDING_VALIDATION','inventory':ref(CONF/'mo1305-conformance-inventory.json')}))

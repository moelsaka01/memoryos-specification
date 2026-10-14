from common import *
record,raw=command('integrated-tamper',[NODE,'--max-old-space-size=128',TOOLS/'security.mjs'],timeout=120)
fresh=json.loads(raw);assert fresh['passed']==9
_,transport_raw=command('integrated-verifier',[NODE,TOOLS/'verifier.mjs'],timeout=120)
transport=json.loads(transport_raw);assert transport['passed']==17
reuse=['security','integration-structure','gitlab-jenkins-api','production-structure','github-transport','azure-github-api','azure-corpus','github-corpus','legacy-launcher-verifier']
records=[]
for name in reuse:
 p=OUT/'commands'/(name+'.json');r=json.loads(p.read_bytes());assert r['status']=='PASS';records.append(row(p))
launch=json.loads((OUT/'launchers.json').read_bytes());wrapper=json.loads((OUT/'github-wrapper.json').read_bytes());assert launch['status']==wrapper['status']=='PASS'
put('security.json',{'status':'PASS','distributionDigest':fresh['distributionDigest'],'freshTamper':fresh,'commonResultVerifier':transport,'affectedCorpora':records,'launcherEnvironmentCases':launch['caseCount'],'githubWrapperCases':wrapper['passed'],'scope':['filesystem and protected paths','runtime and SDK substitution','Node environment poisoning','worker permission/network boundary','YAML/Groovy/PowerShell injection','GitHub/Azure expressions','control characters and multiline values','metadata and secret placeholders','artifact paths and basename allowlist','unknown providers','result/evidence/adapter/generator tamper'],'networkClaim':'SDK worker retains B1 permission-limited execution without network authority; validators use pinned local inputs and offline guards. No OS-wide outbound denial claim. No hosted/account/service execution.'})

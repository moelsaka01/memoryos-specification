"""Support and parity preconditions only; never certifies execution or emits PASS."""
import json,re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'mo1304-phase3'))
from package_verify import require,ARCHIVE_ID
POLICY=json.loads(Path(__file__).with_name('support-policy.json').read_text())

def windows_environment(value):
 require(value['supportedPlatform']==POLICY['windows'],'WINDOWS_SUPPORT_FAMILY')
 env=value['certifiedEnvironment']
 require(set(env)==set(POLICY['windowsActualEnvironmentRequired']),'WINDOWS_ENVIRONMENT_KEYS')
 require(env['os']=='Windows 11' and env['architecture']=='x64','WINDOWS_OS_ARCHITECTURE')
 require(isinstance(env['release'],str) and re.fullmatch(r'[0-9]{2}H[12]',env['release']) is not None,'WINDOWS_RELEASE')
 require(isinstance(env['build'],str) and re.fullmatch(r'[0-9]{5}\.[0-9]+',env['build']) is not None,'WINDOWS_BUILD')
 d=env['detected']
 require(set(d)=={'caption','displayVersion','buildNumber','ubr','architecture'},'DETECTED_KEYS')
 require(d['caption'].startswith('Microsoft Windows 11 ') and d['architecture']=='64-bit','DETECTED_OS_ARCHITECTURE')
 require(d['displayVersion']==env['release'] and str(d['buildNumber'])+'.'+str(d['ubr'])==env['build'],'MISLABELED_ACTUAL_ENVIRONMENT')
 require(int(d['buildNumber'])>=22000,'WINDOWS_11_BUILD')
 require(value['node']['version']=='v'+POLICY['node'],'NODE_PIN')
 require(value['candidate']['archive']==POLICY['archive'],'ARCHIVE_PIN')

def parity_contract(receipts):
 """Check platform/binding preconditions; caller must independently validate both receipts."""
 require(len(receipts)==2,'EXACT_TWO_PLATFORMS')
 by={v['platform']:v for v in receipts}
 require(len(by)==2 and set(by)==set(POLICY['parityPlatforms']),'REQUIRED_PLATFORM_PAIR')
 w=by['windows-11'];u=by['ubuntu-24.04'];windows_environment(w)
 require(u['architecture']=='x64' and u['os']['versionId']=='24.04','UBUNTU_TARGET')
 require(u['node']['version']=='v'+POLICY['node'],'UBUNTU_NODE')
 for k in POLICY['parityEqualFields']: require(w[k]==u[k],'PARITY_'+k)
 require(w['implementationRevision']==POLICY['implementationRevision'] and w['phase2Binding']==POLICY['phase2Binding'],'FROZEN_REVISION')
 # candidate contains distribution, runtime, dependencies, contract and limits.
 # The independent execution validators also enforce the frozen tool catalog.

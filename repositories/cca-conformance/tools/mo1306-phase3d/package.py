"""One independent final assembly; retained installation is reused by identity."""
import tarfile
from support import *
ARCHIVE_PATH = CACHE / 'assembly/memoryos-ci-0.1.0.tgz'
def files_of():
    raw=ARCHIVE_PATH.read_bytes();need(len(raw)==197290 and sha(raw)==ARCHIVE,'STOP_FINAL_CANDIDATE_IDENTITY')
    with tarfile.open(ARCHIVE_PATH,'r:gz') as t:
        members=t.getmembers();need(len(members)==94,'MEMBER_COUNT')
        need(all(m.isfile() and m.uid==m.gid==m.mtime==0 and m.name.startswith('package/') for m in members),'MEMBER_METADATA')
        files={m.name[8:]:t.extractfile(m).read() for m in members}
        need(len(files)==len({p.casefold() for p in files})==94,'MEMBER_COLLISION')
    return files
def verify_package():
    files=files_of();paths=sorted(files)
    source=blobs([C3CB+':repositories/memoryos-ci/'+p for p in paths])
    tracked=git('ls-tree','-r','--name-only',C3CB,'--','repositories/memoryos-ci').decode().splitlines()
    need(set(tracked)=={'repositories/memoryos-ci/'+p for p in paths},'CLOSED_PRODUCT_TREE')
    for p,b in files.items():need(b==(PKG/p).read_bytes()==source[C3CB+':repositories/memoryos-ci/'+p],'MEMBER_SOURCE_PARITY '+p)
    manifest=json.loads(files['distribution-manifest.json']);need(sha(files['distribution-manifest.json'])==DIST,'DISTRIBUTION')
    need({x['path'] for x in manifest['files']}==set(files)-{'distribution-manifest.json'},'DISTRIBUTION_CLOSED')
    for r in manifest['files']:need(identity(files[r['path']])=={k:r[k] for k in ('byteLength','sha256')},'MANIFEST_MEMBER')
    closure=json.loads(files['runtime/runtime-closure-manifest.json'])
    need(len(closure['files'])==25,'SDK_COUNT')
    for r in closure['files']:
        b=files['runtime/'+r['path']];need(b==(ROOT/r['source']).read_bytes(),'SDK_SOURCE_PARITY')
        need(len(b)==r['byteLength'] and sha(b).split(':')[1]==r['sha256'],'SDK_MANIFEST')
    pkg=json.loads(files['package.json']);lock=json.loads(files['package-lock.json'])
    need(pkg['name']=='memoryos-ci' and pkg['version']=='0.1.0' and not pkg.get('dependencies') and not pkg.get('optionalDependencies') and not pkg.get('scripts'),'PRODUCTION_DEPENDENCIES')
    need(set(lock['packages'])=={''},'LOCK_CLOSURE')
    prior=read(E/'phase3-helper-correction/package.json')
    need(prior['status']=='PASS' and prior['byteIdentical'] and prior['memberCount']==94,'CORRECTION_REPRODUCTION')
    for assembly in prior['assemblies']:need(identity(check(assembly['archive']))==identity(ARCHIVE_PATH.read_bytes()),'REPRODUCIBILITY_IDENTITY')
    install=read(E/'phase3-helper-correction/installed-before.json')
    for r in install['files']:need(identity(files[r['path']])=={k:r[k] for k in ('byteLength','sha256')},'OFFLINE_INSTALL_MEMBER')
    need(len(install['files'])==94,'OFFLINE_INSTALL_COUNT')
    offline=json.loads(check(prior['offlineInstall']));need(offline['exitCode']==0 and '--offline' in offline['argv'] and '--ignore-scripts' in offline['argv'],'OFFLINE_INSTALL_OPTIONS')
    return {'status':'PASS','productionAuthority':C3CB,'package':'memoryos-ci@0.1.0','archive':ref(ARCHIVE_PATH),'filename':ARCHIVE_PATH.name,'distribution':ref(PKG/'distribution-manifest.json'),'members':94,'sdkClosure':25,'productionDependencies':0,'sourceTree':git('rev-parse',C3CB+':repositories/memoryos-ci').decode().strip(),'files':[{'path':p,**identity(b)} for p,b in sorted(files.items())],'sdkManifest':ref(PKG/'runtime/runtime-closure-manifest.json'),'reproducibility':{'state':'PASS','integrationBuilds':1,'retainedIndependentBuilds':2,'retainedEvidence':ref(E/'phase3-helper-correction/package.json'),'sameBytes':True},'offlineInstall':{'state':'REUSED_EXACT_CANDIDATE','receipt':prior['offlineInstall'],'members':ref(E/'phase3-helper-correction/installed-before.json'),'newInstallExecutions':0}}
def build():
    need(not ARCHIVE_PATH.exists(),'BUILD_ALREADY_EXISTS')
    paths=git('ls-tree','-r','--name-only',C3CB,'--','repositories/memoryos-ci').decode().splitlines()
    source=blobs([C3CB+':'+p for p in paths])
    root=ARCHIVE_PATH.parent/'package'
    for p in paths:
        b=source[C3CB+':'+p];need((ROOT/p).read_bytes()==b,'BUILD_INPUT_CHANGED')
        target=root/Path(p).relative_to('repositories/memoryos-ci');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
    need(sha(NODE.read_bytes())=='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32','NODE_IDENTITY')
    r=command([NODE,root/'scripts/pack.mjs',ARCHIVE_PATH]);put('package-build-command.json',r);need(r['exitCode']==0,'PACKAGE_BUILD_FAILED')
    v=verify_package();put('package.json',v);print(json.dumps({k:v[k] for k in ('status','archive','members','sdkClosure','productionDependencies')}))
if __name__=='__main__':build()

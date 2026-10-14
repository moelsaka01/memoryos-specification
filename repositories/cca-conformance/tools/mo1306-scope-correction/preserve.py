"""Preserve the complete hosted chain and exact committed audit authority."""
from common import *
need(git('rev-parse','HEAD').decode().strip()==M3 and not OUT.exists(),'BASELINE_OR_ALREADY_PRESERVED')
OUT.mkdir(parents=True)
old=read(ROOT/(PREFIX+'methodology-b/preservation.json'))
reuse={r['originalPath']:r['copy'] for r in old['files']}
rows=[];indexes=[];sources={};serial=0
def retain(owner,path,b,revision=None):
    global serial
    if owner=='3A' and path in reuse:
        r=reuse[path];need(check(r)==b,'M3_HISTORY_DRIFT');mode='REUSED_EXACT_M3_COPY'
    else:
        target=OUT/'preserved'/f'{serial:04d}.data';serial+=1;target.parent.mkdir(exist_ok=True);target.write_bytes(b);r=ref(target);mode='COPIED_EXACT'
    rows.append({'owner':owner,'originalPath':path,'revision':revision,'storage':mode,'file':r})
for name in ['phase3ar','phase3ar-resolution','phase3a-final','phase3a-publication-diagnostic','phase3a-environment-capture','phase3a-certification','phase3a-hosted-resolution','phase3a-hosted-diagnostic']:
    path=PREFIX+name+'/evidence-index.json';p=PEERS['3A']/path;b=p.read_bytes();v=json.loads(b);members=v.get('files',v.get('artifacts'));need(isinstance(members,list),'INDEX_MEMBERS')
    indexes.append({'owner':'3A','path':path,'members':len(members),'sha256':sha(b)})
    sources[path]=b
    for r in members:
        q=PEERS['3A']/r['path'];need(PEERS['3A'] in q.resolve().parents,'SOURCE_ROOT');raw=q.read_bytes();need(len(raw)==r['byteLength'] and sha(raw)==r['sha256'],'SOURCE_INDEX_DRIFT');sources[r['path']]=raw
for path,b in sorted(sources.items()):retain('3A',path,b)
for owner,revision,paths in [
    ('3B-R2',B3,[PREFIX+'phase3b-r2/','repositories/cca-conformance/tools/mo1306-phase3b-r2/','docs/mo1306-phase3b-r2-certification.md','repositories/cca-conformance/docs/mo1306-phase3b-r2-xml.md']),
    ('3C-R',C3,[PREFIX+'phase3cr/','repositories/cca-conformance/tools/mo1306-phase3cr/','docs/mo1306-phase3c-refresh.md','repositories/cca-conformance/mo1306-phase3cr-inventory.json'])]:
    names=git('ls-tree','-r','--name-only',revision,'--',*paths).decode().splitlines();need(names,'AUDIT_FILES_REQUIRED');data=blobs([revision+':'+n for n in names])
    for n in names:
        b=data[revision+':'+n];need((PEERS[owner]/n).read_bytes()==b,'PEER_COMMITTED_BYTES_DRIFT');retain(owner,n,b,revision)
save(OUT/'preservation.json',{'kind':'MemoryOSHostedScopeEvidencePreservation','version':'1.0.0','indexes':indexes,'files':rows,'count':len(rows),'newCopies':serial,'m3Reused':sum(r['storage']=='REUSED_EXACT_M3_COPY' for r in rows),'historicalDispositionsChanged':False})
(OUT/'preserved/.gitattributes').write_bytes(b'* -text whitespace=trailing-space,space-before-tab,cr-at-eol,-blank-at-eof\n')
save(OUT/'baseline.json',{'workspace':str(ROOT),'head':M3,'parent':git('rev-parse','HEAD^').decode().strip(),'subject':git('show','-s','--format=%s','HEAD').decode().strip(),'initialClean':True,'peers':{k:snapshot(p) for k,p in PEERS.items()},'tags':git('for-each-ref','--format=%(refname) %(objectname)','refs/tags').decode(),'productionTree':git('rev-parse',C3CB+':repositories/memoryos-ci').decode().strip()})
for n in ['task-start.json','hosted-historical-validation.json']:(OUT/n).write_bytes((ROOT/'.cache/s3'/n).read_bytes())
(OUT/'owner-request.txt').write_bytes(Path(r'C:\Users\melsa\.codex\attachments\1d0b8139-08cf-45f0-a616-56b70e135a15\Pasted text.txt').read_bytes())
print(json.dumps({'preserved':len(rows),'newCopies':serial,'m3Reused':len(rows)-serial,'originalIndexes':len(indexes)}))

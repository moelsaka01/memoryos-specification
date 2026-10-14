"""One-time byte-preserving import of the complete closed historical chain."""
from common import *
need(git('rev-parse','HEAD').decode().strip()==BASE,'BASELINE')
need(not OUT.exists(),'DO_NOT_REWRITE_PRESERVATION')
OUT.mkdir(parents=True)
sources={}
indexes=[]
for name in ['phase3ar','phase3ar-resolution','phase3a-final','phase3a-publication-diagnostic','phase3a-environment-capture']:
    p=PEER/PREFIX/name/'evidence-index.json';v=read(p);rows=v.get('files',v.get('artifacts'))
    need(isinstance(rows,list),'HISTORICAL_INDEX')
    for r in rows:
        f=PEER/r['path'];b=f.read_bytes();need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'HISTORY_DRIFT')
        need(PEER in f.resolve().parents,'PEER_ROOT');sources[r['path']]=b
    rel=p.relative_to(PEER).as_posix();sources[rel]=p.read_bytes();indexes.append({'name':name,'path':rel,'memberCount':len(rows),'sha256':sha(p.read_bytes())})
saved=[]
for i,(original,b) in enumerate(sorted(sources.items())):
    p=OUT/'preserved'/f'{i:04d}.txt';p.parent.mkdir(exist_ok=True);p.write_bytes(b)
    saved.append({'originalPath':original,'copy':ref(p)})
(OUT/'preserved/.gitattributes').write_bytes(b'* -text whitespace=trailing-space,space-before-tab,cr-at-eol,-blank-at-eof\n')
save(OUT/'preservation.json',{'kind':'MemoryOSMethodologyHistoricalPreservation','version':'1.0.0','sourceRoot':str(PEER),'sourceHead':'f236c4a2f94d8cd8e763aaa4bd6c52d703429692','indexes':indexes,'files':saved,'count':len(saved),'historicalDispositionChanged':False})
for name in ['historical-validator.json','historical-validator-checked.json','task-start.json']:
    p=ROOT/'.cache/m3'/name;need(p.is_file(),'INITIAL_REVIEW_REQUIRED');(OUT/name).write_bytes(p.read_bytes())
save(OUT/'baseline.json',{'root':str(ROOT),'branch':git('branch','--show-current').decode().strip(),'head':BASE,'subject':git('show','-s','--format=%s',BASE).decode().strip(),'graph':GRAPH,'initialCleanVerifiedByHistoricalValidator':True,'protectedTags':git('for-each-ref','--format=%(refname) %(objectname)','refs/tags').decode(),'productExecutions':0,'remoteOperations':0})
print(json.dumps({'preservedFiles':len(saved),'bytes':sum(len(b) for b in sources.values()),'indexes':len(indexes)}))

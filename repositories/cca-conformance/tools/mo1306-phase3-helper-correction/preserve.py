from common import *
import shutil
source=ROOT.parent/'cca-mo1306-3a-refresh';base=source/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution'
index=json.loads((base/'evidence-index.json').read_bytes());preserved=[]
for i,e in enumerate(index['files']+[row(base/'evidence-index.json',source)]):
 p=source/e['path'];assert row(p,source)==e
 target=OUT/'preserved'/('%03d'%i+p.suffix);target.parent.mkdir(exist_ok=True);shutil.copyfile(p,target)
 preserved.append({'original':e,'copy':row(target)})
peers=[]
for name,head in [('cca-mo1306-3a-refresh','f236c4a2f94d8cd8e763aaa4bd6c52d703429692'),('cca-mo1306-3b-refresh2','b47f624c26badd54ee5724e8fe384c80ea083952'),('cca-mo1306-3c-refresh','20aa4e4245643e1c3a7b3f676622c5d2d36015b2')]:
 p=ROOT.parent/name;actual=git('-c','safe.directory='+p.as_posix(),'-C',str(p),'rev-parse','HEAD');assert actual==head
 peers.append({'workspace':str(p),'head':actual,'status':git('-c','safe.directory='+p.as_posix(),'-C',str(p),'status','--porcelain=v1','--untracked-files=all')})
put('preservation.json',{'status':'PASS','disposition':'MO-1306 PHASE 3A NATIVE DEADLINE BLOCKED','original2032':'MEASUREMENT_DEFECT','observation7':'PRODUCT_DEADLINE_VIOLATION','files':preserved,'peers':peers,'graph':{x:git('show','-s','--format=%H %P %s',x) for x in [B2,C3A,C3AB]},'node':row(NODE)})
print('Preserved',len(preserved),'files; peer heads and status retained')

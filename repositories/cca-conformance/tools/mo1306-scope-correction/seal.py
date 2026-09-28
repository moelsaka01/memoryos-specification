"""Acyclic local closure; the inventory excludes its own future bytes."""
from common import *
need(not (OUT/'inventory.json').exists(),'ALREADY_SEALED')
paths=sorted({p for folder in [TOOLS,OUT] for p in folder.rglob('*') if p.is_file()}|{ROOT/'ROADMAP.md',DOC,AUTH})
save(OUT/'inventory.json',{'kind':'MemoryOSHostedScopeInventory','version':'1.0.0','parent':M3,'selfExcluded':True,'files':[ref(p) for p in paths]})
print(json.dumps({'files':len(paths),'selfReference':False}))

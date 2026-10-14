"""Close an acyclic inventory after all pre-commit checks have passed."""
from common import *
need(not (OUT/'inventory.json').exists(),'INVENTORY_ALREADY_SEALED')
paths=sorted({p for base in [TOOLS,OUT] for p in base.rglob('*') if p.is_file()}|{AUTHORITY,DOC})
save(OUT/'inventory.json',{'kind':'MemoryOSMethodologyInventory','version':'1.0.0','authorityParent':BASE,'selfExcluded':True,'files':[ref(p) for p in paths]})
print(json.dumps({'inventoryFiles':len(paths),'selfReference':False}))

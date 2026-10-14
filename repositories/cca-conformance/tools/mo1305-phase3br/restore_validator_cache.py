"""Restore only pip-generated cache timestamps to exact pre-existing pinned bytes.
Never changes pins, validator code, wheel bytes, or release package files.
"""
import base64, hashlib, json, struct, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
CACHE=ROOT/'.cache/mo1305-phase3-correction/schema-runtime'
EVIDENCE=ROOT/'repositories/cca-conformance/evidence/mo1305-phase3br'
def sha(b):return hashlib.sha256(b).hexdigest()
def run():
    pins={x['path']:x for x in json.loads((ROOT/'repositories/cca-conformance/tools/mo1305-phase3-correction/schema-runtime.json').read_bytes())['files']}
    path=CACHE/'bin/jsonschema.exe';raw=path.read_bytes();record=CACHE/'jsonschema-4.25.1.dist-info/RECORD';original_record=record.read_bytes()
    assert len(raw)==pins['bin/jsonschema.exe']['byteLength']
    local=zipfile.ZipFile(path).infolist()[0].header_offset;central=raw.index(b'PK\x01\x02',local)
    base=hashlib.sha256(raw[:local+10]);tail=bytearray(raw[local+10:]);matched=None
    for hour in range(24):
        for minute in range(60):
            for second in range(0,60,2):
                time=(hour<<11)|(minute<<5)|(second//2)
                struct.pack_into('<H',tail,0,time);struct.pack_into('<H',tail,central+12-local-10,time)
                check=base.copy();check.update(tail)
                if check.hexdigest()==pins['bin/jsonschema.exe']['sha256']:
                    matched=(hour,minute,second,raw[:local+10]+bytes(tail));break
            if matched:break
        if matched:break
    assert matched,'No exact pinned timestamp reconstruction; no writes permitted'
    restored=matched[3];old=base64.urlsafe_b64encode(hashlib.sha256(raw).digest()).rstrip(b'=');new=base64.urlsafe_b64encode(hashlib.sha256(restored).digest()).rstrip(b'=')
    assert original_record.count(old)==1
    restored_record=original_record.replace(old,new)
    assert len(restored_record)==pins['jsonschema-4.25.1.dist-info/RECORD']['byteLength'] and sha(restored_record)==pins['jsonschema-4.25.1.dist-info/RECORD']['sha256']
    out={'kind':'MemoryOSRESTPhase3BRValidatorCacheRestoration','state':'PASS','scope':'Only generated launcher ZIP timestamp and its RECORD hash; exact original pins restored','pinnedZipTime':matched[:3],'changedLauncherOffsets':[i for i,(a,b) in enumerate(zip(raw,restored)) if a!=b],'files':[]}
    history=EVIDENCE/'history';history.mkdir(exist_ok=True)
    for name,before,after in [('bin/jsonschema.exe',raw,restored),('jsonschema-4.25.1.dist-info/RECORD',original_record,restored_record)]:
        # Non-executable historical capture is retained inside this task's ignored cache.
        backup=ROOT/'.cache/mo1305-phase3br/validator-before-restoration'/name;backup.parent.mkdir(parents=True,exist_ok=True)
        if not backup.exists():backup.write_bytes(before)
        assert backup.read_bytes()==before
        (CACHE/name).write_bytes(after)
        out['files'].append({'path':name,'beforeSha256':sha(before),'afterSha256':sha(after),'byteLength':len(after),'pinnedSha256':pins[name]['sha256'],'backup':backup.relative_to(ROOT).as_posix()})
    (EVIDENCE/'validator-cache-restoration.json').write_text(json.dumps(out,sort_keys=True,separators=(',',':')),encoding='utf8')
    print(json.dumps(out))
if __name__=='__main__':run()

"""Deterministic offline package builder; engineering only, never installed."""
from pathlib import Path
import hashlib, json, gzip, io, tarfile, subprocess
ROOT=Path(__file__).resolve().parents[4]
PKG=ROOT/'repositories/memoryos-rest'
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
def j(value):return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
def digest(value):return hashlib.sha256(value).hexdigest()
def ref(path,relative):
 b=path.read_bytes();return {'path':relative,'byteLength':len(b),'sha256':digest(b)}
def make_openapi():
 api=json.loads((PKG/'contracts/api-contract.json').read_bytes())
 def projection(value):
  if isinstance(value,list):return [projection(x) for x in value]
  if isinstance(value,dict):return {k:('#/components/schemas/'+v[8:] if k=='$ref' else projection(v)) for k,v in value.items()}
  return value
 schemas=projection(api['schemas']['$defs']);schemas.pop('Config')
 paths={}
 for route in api['routes']:
  responses={'200':{'description':'Completed operation, including every evaluation decision','content':{'application/json':{'schema':{'$ref':'#/components/schemas/'+route['output']}}}}}
  for rule in api['errors'].values():
   if rule['wire']:responses[str(rule['status'])]={'description':'Bounded gateway error','content':{'application/json':{'schema':{'$ref':'#/components/schemas/Error'}}}}
  for status,response in responses.items():
   headers={k:{'schema':{'type':'string','const':v}} for k,v in api['headers']['response'].items() if k!='content-type'}
   headers['content-length']={'schema':{'type':'string','pattern':'^[0-9]+$'}}
   headers['x-request-id']={'schema':{'type':'string','pattern':api['headers']['requestIdPattern']},'description':'Only after authentication and valid supplied correlation ID'}
   if status=='401':headers['www-authenticate']={'schema':{'const':'Bearer realm="memoryos-rest"'}}
   if status=='405':headers['allow']={'schema':{'const':route['method']}}
   if status in ['429','503']:headers['retry-after']={'schema':{'const':'1'},'description':'429 or MO1305_BUSY only'}
   response['headers']=headers
  operation={'operationId':route['operationId'],'security':[{'bearerToken':[]}],'responses':responses,'parameters':[{'in':'header','name':'X-Request-ID','required':False,'schema':{'type':'string','pattern':api['headers']['requestIdPattern']}}]}
  if route['input']:operation['requestBody']={'required':True,'content':{'application/json':{'schema':{'$ref':'#/components/schemas/'+route['input']}}}}
  paths[route['path']]={route['method'].lower():operation}
 return {'openapi':'3.1.1','jsonSchemaDialect':'https://json-schema.org/draft/2020-12/schema','info':{'title':'MemoryOS REST Gateway','version':api['apiVersion']},'security':[{'bearerToken':[]}],'paths':paths,'x-memoryos-http':{'behavior':{'headErrorBody': 'A rejected HEAD sends the selected error headers and content-length but no body.', 'noResponseCodes': ['MO1305_CLIENT_CANCELLED'], 'successStatus': 200, 'evaluationDecisions': ['PASS', 'FAIL', 'COULD_NOT_EVALUATE'], 'remoteMode': 'PHASE_2_PENDING'},'headers':api['headers'],'errors':api['errors'],'limits':json.loads((PKG/'contracts/limits.json').read_bytes())},'components':{'securitySchemes':{'bearerToken':{'type':'http','scheme':'bearer','bearerFormat':'64 lowercase hexadecimal characters'}},'schemas':schemas}}
def shipped():
 names=['package.json','package-lock.json','README.md','NOTICES.md','LICENSE-NOTICE.md','dependency-manifest.json','sbom.spdx.json']
 for directory in ['bin','src','runtime','contracts','notices']:names.extend(p.relative_to(PKG).as_posix() for p in (PKG/directory).rglob('*') if p.is_file())
 names.extend(['scripts/verify-distribution.mjs','scripts/verify-contracts.mjs'])
 return sorted(names)
def build(parent_revision=None):
 (PKG/'contracts/openapi.json').write_bytes(j(make_openapi()))
 versions=json.loads(subprocess.check_output([str(NODE),'-p','JSON.stringify(process.versions)'],text=True))
 closure=json.loads((PKG/'runtime/runtime-closure-manifest.json').read_bytes())
 inputs=[]
 for base in [PKG,Path(__file__).parent,ROOT/'repositories/cca-conformance/fixtures/mo1305-phase1']:
  for p in sorted(base.rglob('*')):
   if p.is_file() and p.name not in ['sbom.spdx.json','dependency-manifest.json','distribution-manifest.json'] and '__pycache__' not in p.parts:inputs.append(ref(p,p.relative_to(ROOT).as_posix()))
 tree=digest(j(sorted(inputs,key=lambda row:row['path'])))
 parent=parent_revision or subprocess.check_output([r'C:/Program Files/Git/cmd/git.exe','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 assert len(parent)==40 and all(c in '0123456789abcdef' for c in parent)
 dependency={'kind':'MemoryOSRESTDependencyManifest','version':'1.0.0','directCount':0,'transitiveCount':0,'developmentCount':0,'lockfile':ref(PKG/'package-lock.json','package-lock.json'),'runtime':{'name':'node','version':'24.21.0','sha256':'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32','npm':'11.19.0','components':versions},'sourceTreeSha256':tree,'parentRevision':parent}
 (PKG/'dependency-manifest.json').write_bytes(j(dependency))
 packages=[]
 declared={'node':'MIT','npm':'Artistic-2.0','acorn':'MIT','ada':'MIT','amaro':'MIT','ares':'MIT','brotli':'MIT','icu':'Unicode-3.0','llhttp':'MIT','merve':'MIT','nghttp2':'MIT','openssl':'Apache-2.0','simdjson':'Apache-2.0','simdutf':'MIT','undici':'MIT','uv':'MIT','uvwasi':'MIT','v8':'BSD-3-Clause','zlib':'Zlib','zstd':'BSD-3-Clause'}
 components={k:v for k,v in versions.items() if v and k not in ['modules','napi','cldr','tz','unicode']}
 for name,version in [('memoryos-rest','0.1.0'),('npm','11.19.0')]+sorted(components.items()):
  packages.append({'SPDXID':'SPDXRef-Package-'+name,'name':name,'versionInfo':version,'downloadLocation':'NOASSERTION','filesAnalyzed':False,'licenseConcluded':'NOASSERTION','licenseDeclared':declared.get(name,'NOASSERTION'),'licenseComments':'Declared primary grant from notices/node-LICENSE.txt; retained nested notices still apply. NOASSERTION conclusion does not override upstream terms. npm is an external installation tool. Runtime ABI and ICU data versions remain in dependency-manifest.json.','copyrightText':'NOASSERTION'})
 files=[{'SPDXID':'SPDXRef-File-'+str(i),'fileName':'./runtime/'+row['path'],'checksums':[{'algorithm':'SHA256','checksumValue':row['sha256']}],'licenseConcluded':'NOASSERTION','licenseInfoInFile':['NOASSERTION'],'copyrightText':'NOASSERTION'} for i,row in enumerate(closure['files'])]
 relationships=[{'spdxElementId':'SPDXRef-DOCUMENT','relationshipType':'DESCRIBES','relatedSpdxElement':'SPDXRef-Package-memoryos-rest'}]
 relationships += [{'spdxElementId':'SPDXRef-Package-memoryos-rest','relationshipType':'CONTAINS','relatedSpdxElement':f['SPDXID']} for f in files]
 relationships += [{'spdxElementId':'SPDXRef-Package-memoryos-rest' if p['name'] in ['node','npm'] else 'SPDXRef-Package-node','relationshipType':'DEPENDS_ON' if p['name'] in ['node','npm'] else 'CONTAINS','relatedSpdxElement':p['SPDXID']} for p in packages if p['name']!='memoryos-rest']
 sbom={'spdxVersion':'SPDX-2.3','dataLicense':'CC0-1.0','SPDXID':'SPDXRef-DOCUMENT','name':'memoryos-rest-0.1.0','documentNamespace':'https://memoryos.invalid/spdx/'+parent+'/'+tree+'/0.1.0','creationInfo':{'creators':['Tool: memoryos-rest-first-party-builder-1.0.0'],'created':'2026-09-23T00:00:00Z'},'packages':packages,'files':files,'relationships':relationships}
 (PKG/'sbom.spdx.json').write_bytes(j(sbom))
 names=shipped();manifest={'kind':'MemoryOSRESTDistributionManifest','version':'1.0.0','package':'memoryos-rest','packageVersion':'0.1.0','files':[ref(PKG/name,name) for name in names]}
 (PKG/'distribution-manifest.json').write_bytes(j(manifest));names.append('distribution-manifest.json');names.sort()
 raw=io.BytesIO()
 with tarfile.open(fileobj=raw,mode='w',format=tarfile.USTAR_FORMAT) as tar:
  for name in names:
   data=(PKG/name).read_bytes();info=tarfile.TarInfo('package/'+name);info.size=len(data);info.mode=0o755 if name.startswith('bin/') else 0o644;info.uid=info.gid=info.mtime=0;info.uname=info.gname='';tar.addfile(info,io.BytesIO(data))
 assert len(names)<=256 and len(raw.getvalue())<=67108864
 compressed=io.BytesIO()
 with gzip.GzipFile(fileobj=compressed,mode='wb',filename='',mtime=0,compresslevel=9) as stream:stream.write(raw.getvalue())
 assert len(compressed.getvalue())<=16777216
 out=ROOT/'.cache/mo1305-resume/build';out.mkdir(parents=True,exist_ok=True)
 archive=out/'memoryos-rest-0.1.0.tgz';archive.write_bytes(compressed.getvalue())
 (out/'source-tree.json').write_bytes(j({'files':sorted(inputs,key=lambda row:row['path']),'sha256':tree}))
 print(json.dumps({'archive':str(archive),'sha256':digest(compressed.getvalue()),'byteLength':archive.stat().st_size,'files':len(names),'sourceTreeSha256':tree}))
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--parent');args=parser.parse_args();build(args.parent)

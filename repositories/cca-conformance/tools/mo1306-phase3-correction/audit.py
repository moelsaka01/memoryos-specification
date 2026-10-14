"""Complete computed-lookup inventory, with production call-chain classifications."""
from common import *
import ast,collections
raw=command([NODE,TOOLS/'scan.mjs',ROOT]);assert raw['exitCode']==0
sites=json.loads(raw['stdout'])
for s in sites:
 f=s['file'];e=s['expression'];reason=None;c='SAFE'
 if '/tools/' in f:
  c='HISTORICAL' if any(x in f for x in ['history.test','preservation.py','mo1306-correction-a']) else 'VALIDATOR-ONLY'
  reason='Engineering/test-only code; not imported by the production package. JS map key trust is bounded by fixtures or validator schemas; not a public command dispatch.'
 elif e.startswith('{run:'):
  c='AFFECTED';reason='Public argv string indexes an ordinary object; inherited truthy values bypass rejection and lack array.filter.'
 elif '/schema.mjs' in f and e.startswith(('root.$defs','schema[')):
  c='NOT USER-CONTROLLED';reason='Frozen inventoried schema and literal validator names; caller contracts.validate uses Map membership before invoking compiler. No external schema loading.'
 elif f.endswith('/metadata.mjs') and (e=='mappings[provider]' and s['line']==13):
  c='NOT USER-CONTROLLED';reason='metadata is invoked only with fixed provider literals by the five adapters and GitHub transport; public provider is first guarded by providerIR. This internal function is not an advertised provider-dispatch API.'
 elif 'projections[' in e:
  reason='Key is own-checked by project/equivalence, from CIError classification, validated Result/Summary enum, or validated SDK WorkerResponse decision before indexing.'
 elif 'catalog.errors[' in e:
  reason='CIError constructor enforces own catalog membership, or Result schema enum validates error code before this lookup.'
 elif e in ['adapters[name]','replacements[name]','slots[key]','paths[deployment.provider]','installation.adapterDigests[result.provider]']:
  reason='Dominating Object.hasOwn check before lookup; unsupported prototype keys are rejected.'
 elif e=='adapterDigests[provider]':reason='readDistribution first closes provider with explicit five-string includes check.'
 elif e=='templates[deployment.provider]':reason='Exact gitlab/jenkins equality branch after closed Deployment schema validation.'
 elif e=='templates[name]':reason='Own template membership check and literal five-provider loop.'
 elif e=='output[key]':reason='Parser output is Object.create(null), rejects duplicate own keys and dangerous key spellings before assignment.'
 elif e in ['schema.properties[key]','input[key]']:reason='Object.keys(input) own-key iteration and dominating own schema-property check.'
 elif e=='item[key]':reason='Canonical serializer enumerates only Object.keys(item); no lookup-based dispatch.'
 elif e.startswith('caps['):reason='Names are fixed constructed artifact names or validated exact directory-name set; schema names are internal literals.'
 elif e.startswith(('mappings[','environment[','process.env[','mapping[','result[field]')):reason='Metadata environment keys and result fields come from fixed provider mapping arrays; readMetadataEnvironment own-checks provider.'
 elif e.startswith(('acquired[','object[')):
  c='NOT USER-CONTROLLED';reason='Key comes from fixed role descriptors or fixed Node API boundary method list.'
 elif e.startswith('result['):reason='CLI flag is restricted by allowed.includes and duplicate own check; required names come from the closed command table. Covered after correcting table membership.'
 else:reason='Numeric/string/array indexing with internal numeric positions or literal keys; not object-map acceptance of an untrusted name.'
 s.update(classification=c,rationale=reason)
# Python dictionaries do not expose Object.prototype lookup semantics. Retain every
# subscript / membership site so validation code is not silently excluded.
for folder in sorted((ROOT/'repositories/cca-conformance/tools').glob('mo1306*')):
 if folder==TOOLS:continue
 for p in sorted(folder.rglob('*.py')):
  source=p.read_text(encoding='utf-8-sig');tree=ast.parse(source)
  for n in ast.walk(tree):
   if isinstance(n,ast.Subscript) or isinstance(n,ast.Compare) and any(isinstance(o,(ast.In,ast.NotIn)) for o in n.ops):
    sites.append({'file':p.relative_to(ROOT).as_posix(),'line':n.lineno,'column':n.col_offset,'expression':ast.get_source_segment(source,n),'type':type(n).__name__,'classification':'HISTORICAL' if any(k in p.name for k in ['history','preservation','predecessor']) or folder.name=='mo1306-correction-a' else 'VALIDATOR-ONLY','rationale':'Python dictionary/list/set membership has no Object.prototype fallback; engineering-only validator, test or evidence processing.'})
put('dispatch-audit.json',{'baseline':B2,'status':'PASS','scope':'All computed JS member lookups and in operators in first-party MO-1306 package excluding immutable SDK runtime, all existing MO-1306 JS tools, and all Python subscript/membership sites. Numeric indexes are explicitly included, not counted as affected dispatch. PowerShell separately AST-inventoried.','sites':sites,'counts':dict(collections.Counter(s['classification'] for s in sites)),'productionSites':sum('/memoryos-ci/' in s['file'] for s in sites),'affectedCount':sum(s['classification']=='AFFECTED' for s in sites),'callChainNotes':['metadata internal provider literals are fixed in all five src/providers modules and src/github-transport; readMetadataEnvironment own-checks public provider.','Schema $defs lookups receive only inventoried references and fixed names from Map validators; external schemas are not loaded.','Frozen SDK runtime is unchanged semantic authority and is excluded from first-party MO-1306 implementation counts.']})
print(json.dumps({'sites':len(sites),'counts':dict(collections.Counter(s['classification'] for s in sites))}))

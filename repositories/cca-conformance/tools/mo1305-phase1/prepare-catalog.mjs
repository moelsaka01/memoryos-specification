import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {catalog,fixture} from './campaign-catalog.mjs';import {root} from './installed.mjs';import {J} from '../../../memoryos-rest/src/serialization.mjs';import {versionProduct} from '../../../memoryos-rest/src/contracts.mjs';
const dir=resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1/measurement');mkdirSync(dir,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');const records=[];
for(const c of catalog()){
 const expected=c.expected??({getHealth:{status:'ok',live:true},getReadiness:{status:'ok',ready:true},getVersion:versionProduct})[c.operation];
 const bytes=Buffer.from(J(c)),path=resolve(dir,c.id+'.json');writeFileSync(path,bytes);
 records.push({id:c.id,operation:c.operation,mechanism:c.mechanism,fixtureSha256:fixture(c),fixture:{path:path.slice(root.length+1).replaceAll('\\','/'),byteLength:bytes.length,sha256:digest(bytes)},expected:{statusCode:c.status,code:expected.error?.code??null,decision:expected.decision??null,responseSha256:digest(Buffer.from(J(expected)))}});
}
const result={kind:'MemoryOSRESTMeasurementCatalog',version:'2.0.0',functionalExecutions:1,resourceSelection:'SEPARATE',records};writeFileSync(resolve(dir,'catalog.json'),J(result));console.log(JSON.stringify({cases:records.length,sha256:digest(Buffer.from(J(result))),bytes:Buffer.byteLength(J(result))}));

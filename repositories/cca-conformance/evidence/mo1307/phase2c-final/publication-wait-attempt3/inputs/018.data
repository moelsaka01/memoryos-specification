import { SCHEMAS } from './schema-data.mjs';
import { fail } from './errors.mjs';

function equal(a,b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ak=Object.keys(a).sort(), bk=Object.keys(b).sort();
  return ak.length===bk.length && ak.every((k,i)=>k===bk[i] && equal(a[k],b[k]));
}
function matchesType(v,type) {
  if(type==='null')return v===null;
  if(type==='object')return v!==null && typeof v==='object' && !Array.isArray(v);
  if(type==='array')return Array.isArray(v);
  if(type==='integer')return Number.isSafeInteger(v);
  return typeof v===type;
}
function stable(value) {
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value!==null && typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
function resolveRef(ref,document) {
  const [path,fragment='']=ref.split('#');
  const next=path || document;
  if(!Object.hasOwn(SCHEMAS,next) || (fragment && !fragment.startsWith('/')))fail('INTERNAL','EVALUATION');
  let schema=SCHEMAS[next];
  for(const token of fragment ? fragment.slice(1).split('/') : []) {
    const key=token.replaceAll('~1','/').replaceAll('~0','~');
    if(!Object.hasOwn(schema,key))fail('INTERNAL','EVALUATION');
    schema=schema[key];
  }
  return [schema,next];
}
function matches(v,s,document,depth=0) {
  if(depth>128)fail('INTERNAL','EVALUATION');
  if(typeof s==='boolean')return s;
  if(s.$ref){const [r,d]=resolveRef(s.$ref,document);if(!matches(v,r,d,depth+1))return false;}
  if(s.type && !(Array.isArray(s.type)?s.type:[s.type]).some(t=>matchesType(v,t)))return false;
  if(Object.hasOwn(s,'const') && !equal(v,s.const))return false;
  if(s.enum && !s.enum.some(x=>equal(x,v)))return false;
  if(s.allOf && !s.allOf.every(x=>matches(v,x,document,depth+1)))return false;
  if(s.anyOf && !s.anyOf.some(x=>matches(v,x,document,depth+1)))return false;
  if(s.oneOf && s.oneOf.filter(x=>matches(v,x,document,depth+1)).length!==1)return false;
  if(s.not && matches(v,s.not,document,depth+1))return false;
  if(s.if){const branch=matches(v,s.if,document,depth+1)?s.then:s.else;if(branch && !matches(v,branch,document,depth+1))return false;}
  if(typeof v==='string'){
    const length=[...v].length;
    if(length<(s.minLength??0)||length>(s.maxLength??Infinity))return false;
    if(s.pattern && !new RegExp(s.pattern,'u').test(v))return false;
  }
  if(typeof v==='number' && (v<(s.minimum??-Infinity)||v>(s.maximum??Infinity)))return false;
  if(Array.isArray(v)){
    if(v.length<(s.minItems??0)||v.length>(s.maxItems??Infinity))return false;
    if(s.uniqueItems && new Set(v.map(stable)).size!==v.length)return false;
    if(s.items!==undefined && !v.every(x=>matches(x,s.items,document,depth+1)))return false;
    if(s.prefixItems && !s.prefixItems.every((x,i)=>i>=v.length || matches(v[i],x,document,depth+1)))return false;
    if(s.contains){const n=v.filter(x=>matches(x,s.contains,document,depth+1)).length;if(n<(s.minContains??1)||n>(s.maxContains??Infinity))return false;}
  }
  if(v!==null && typeof v==='object' && !Array.isArray(v)){
    const keys=Object.keys(v), properties=s.properties??{};
    if(s.required && !s.required.every(k=>Object.hasOwn(v,k)))return false;
    if(keys.length<(s.minProperties??0)||keys.length>(s.maxProperties??Infinity))return false;
    for(const k of keys){
      if(Object.hasOwn(properties,k)){if(!matches(v[k],properties[k],document,depth+1))return false;}
      else if(s.additionalProperties===false)return false;
      else if(typeof s.additionalProperties==='object' && !matches(v[k],s.additionalProperties,document,depth+1))return false;
    }
  }
  return true;
}

// Fixed shipped schemas only. This is not a public general-purpose schema API.
export function validateSchema(definition,value,{code='INPUT',stage='INTEGRITY',reference=null}={}) {
  const document='shared-1.0.0.schema.json';
  const defs=SCHEMAS[document].$defs;
  if(!Object.hasOwn(defs,definition))fail('INTERNAL',stage,reference);
  if(!matches(value,defs[definition],document))fail(code,stage,reference);
  return value;
}
export { equal as structurallyEqual };

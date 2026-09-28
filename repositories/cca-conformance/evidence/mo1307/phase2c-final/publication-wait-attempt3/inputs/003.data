import { createHash } from 'node:crypto';
import { fail } from './errors.mjs';
import { DEFINITIONS } from './constants.mjs';

// Freeze §3/18. These constants are checked against the shared definitions in
// conformance; no environment, time, locale or input-selected serializer exists.
const {jsonDepth:DEPTH,jsonValues:VALUES,objectMembers:MEMBERS,keyCodeUnits:KEY,stringCodeUnits:STRING}=DEFINITIONS.limits;
const decoder = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true});

function bad(stage, reference) { fail('INPUT', stage, reference); }
function limit(stage, reference) { fail('RESOURCE_LIMIT', stage, reference); }
function textValid(value, key, stage, reference) {
  if (value.length > (key ? KEY : STRING)) limit(stage, reference);
  if (/[\u0000-\u001f\u007f]/u.test(value) || !value.isWellFormed() || (key && /[^\x20-\x7e]/u.test(value))) bad(stage, reference);
}

export function canonicalBytes(value, {stage='INTEGRITY',reference=null,maxBytes=4194304} = {}) {
  let count = 0;
  let outputBytes = 1; // Reserve the one trailing LF before materializing output.
  const emit = text => { outputBytes += Buffer.byteLength(text,'utf8'); if(outputBytes>maxBytes)limit(stage,reference); return text; };
  const seen = new Set();
  function encode(v, depth) {
    if (++count > VALUES || depth > DEPTH) limit(stage, reference);
    if (v === null) return emit('null');
    if (typeof v === 'boolean') return emit(v ? 'true' : 'false');
    if (typeof v === 'number') {
      if (!Number.isSafeInteger(v) || v < 0 || Object.is(v, -0)) bad(stage, reference);
      return emit(String(v));
    }
    if (typeof v === 'string') { textValid(v, false, stage, reference); return emit(JSON.stringify(v)); }
    if (typeof v !== 'object' || seen.has(v)) bad(stage, reference);
    if (Object.getOwnPropertySymbols(v).length) bad(stage, reference);
    seen.add(v);
    let out;
    if (Array.isArray(v)) {
      if (v.length > VALUES) limit(stage, reference);
      if (Object.keys(v).length !== v.length) bad(stage, reference);
      if (Object.getOwnPropertyNames(v).length !== v.length + 1) bad(stage, reference);
      const parts = [];
      emit('[');
      for (let i=0; i<v.length; i++) {
        if(i)emit(',');
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !Object.hasOwn(d, 'value')) bad(stage, reference);
        parts.push(encode(d.value, depth+1));
      }
      out = '[' + parts.join(',') + ']';
      emit(']');
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(v))) bad(stage, reference);
      const keys = Object.keys(v).sort();
      if (keys.length > MEMBERS) limit(stage, reference);
      if (Object.getOwnPropertyNames(v).length !== keys.length) bad(stage, reference);
      emit('{');
      out = '{' + keys.map((key,index) => {
        if(index)emit(',');
        textValid(key, true, stage, reference);
        const d = Object.getOwnPropertyDescriptor(v, key);
        if (!Object.hasOwn(d, 'value')) bad(stage, reference);
        return emit(JSON.stringify(key) + ':') + encode(d.value, depth+1);
      }).join(',') + '}';
      emit('}');
    }
    seen.delete(v);
    return out;
  }
  const bytes = Buffer.from(encode(value, 1) + '\n', 'utf8');
  if (bytes.length > maxBytes) limit(stage, reference);
  return bytes;
}

export function snapshotBytes(bytes, maxBytes, stage='INTEGRITY', reference=null) {
  if (!(bytes instanceof Uint8Array) || bytes.buffer instanceof SharedArrayBuffer) bad(stage, reference);
  if (bytes.byteLength > maxBytes) limit(stage, reference);
  return Buffer.from(bytes);
}

export function parseCanonical(input, {maxBytes=4194304,stage='INTEGRITY',reference=null} = {}) {
  const bytes = snapshotBytes(input, maxBytes, stage, reference);
  if (bytes.length >= 3 && bytes[0]===239 && bytes[1]===187 && bytes[2]===191) bad(stage, reference);
  let source;
  try { source = decoder.decode(bytes); } catch { bad(stage, reference); }
  let pos=0, count=0;
  const ws=()=>{while (/[\x20\t\r\n]/u.test(source[pos] ?? '\0')) pos++;};
  function string(key=false) {
    const begin=pos++;
    while(pos<source.length) {
      const ch=source[pos++];
      if(ch==='"') {
        let value;
        try { value=JSON.parse(source.slice(begin,pos)); } catch { bad(stage,reference); }
        textValid(value,key,stage,reference);
        return value;
      }
      if(ch==='\\') pos++;
    }
    bad(stage,reference);
  }
  function value(depth) {
    if(++count>VALUES || depth>DEPTH) limit(stage,reference);
    ws(); const ch=source[pos];
    if(ch==='"') return string();
    if(ch==='[') {
      pos++; ws(); const out=[];
      if(source[pos]===']'){pos++;return out;}
      while(true){out.push(value(depth+1));ws();if(source[pos]===']'){pos++;return out;}if(source[pos++]!==',')bad(stage,reference);}
    }
    if(ch==='{') {
      pos++;ws();const out=Object.create(null);let members=0;
      if(source[pos]==='}'){pos++;return out;}
      while(true){
        ws();if(source[pos]!=='"')bad(stage,reference);
        const key=string(true);if(++members>MEMBERS)limit(stage,reference);
        if(Object.hasOwn(out,key))bad(stage,reference);
        ws();if(source[pos++]!==':')bad(stage,reference);
        out[key]=value(depth+1);ws();
        if(source[pos]==='}'){pos++;return out;}if(source[pos++]!==',')bad(stage,reference);
      }
    }
    for(const [word,v] of [['true',true],['false',false],['null',null]]) if(source.startsWith(word,pos)){pos+=word.length;return v;}
    const match=/^(?:0|[1-9][0-9]*)/u.exec(source.slice(pos));
    if(!match)bad(stage,reference);
    pos+=match[0].length;
    const n=Number(match[0]);if(!Number.isSafeInteger(n))bad(stage,reference);
    return n;
  }
  const result=value(1);ws();if(pos!==source.length)bad(stage,reference);
  const encoded=canonicalBytes(result,{stage,reference,maxBytes});
  if(!bytes.equals(encoded))fail('INTEGRITY',stage,reference);
  return result;
}

export function digest(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.buffer instanceof SharedArrayBuffer) fail('INPUT','INTEGRITY');
  return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}
export function canonicalDigest(value) { return digest(canonicalBytes(value)); }
export const candidateDigest = canonicalDigest;
export const claimDigest = canonicalDigest;
export function readinessDigest(assessment) { return canonicalDigest({kind:'MemoryOSReadinessIdentity',version:'1.0.0',assessment}); }
export function proofBindingDigest(readiness, audit) { return canonicalDigest({kind:'MemoryOSReadinessProofBinding',version:'1.0.0',readinessDigest:readiness,audit}); }
export function blockerId({gateId,reasonCode,checkCode,conditionId}) { return 'blocker.' + canonicalDigest({gateId,reasonCode,checkCode,conditionId}).slice(7); }

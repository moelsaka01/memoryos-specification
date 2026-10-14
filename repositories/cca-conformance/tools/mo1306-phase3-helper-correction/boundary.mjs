/** Deterministic scheduling of the actual checkPaths function; no replacement acceptance logic. */
import fs from 'node:fs';import path from 'node:path';import {EventEmitter} from 'node:events';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const pkg=path.resolve(process.argv[2]),mode=process.argv[3]??'corrected';
const source=fs.readFileSync(path.join(pkg,'src/filesystem.mjs'),'utf8');
const code=source.slice(source.indexOf('export async function checkPaths'),source.indexOf('\nexport async function createDirectory')).replace('export ','');
const {J}=await import(pathToFileURL(path.join(pkg,'src/serialization.mjs'))),{parseJSON}=await import(pathToFileURL(path.join(pkg,'src/json.mjs'))),{CIError,reject}=await import(pathToFileURL(path.join(pkg,'src/errors.mjs')));
const adjacent=(x,step)=>{const b=new ArrayBuffer(8),v=new DataView(b);v.setFloat64(0,x);v.setBigUint64(0,v.getBigUint64(0)+BigInt(step));return v.getFloat64(0);};
const safe=Buffer.from(J({kind:'MemoryOSCICDPathCheck',version:'1.0.0',safe:true}));
const tests=[
 ['clearly-before',500,null],['immediately-before',adjacent(2000,-1),null],['at-boundary',2000,'FILESYSTEM_BOUNDARY'],['immediately-after',adjacent(2000,1),'FILESYSTEM_BOUNDARY'],
 ['delayed-event-loop',2100,'FILESYSTEM_BOUNDARY'],['success-before-delivery-after',2100,'FILESYSTEM_BOUNDARY'],['failure-before-delivery-after',2100,'FILESYSTEM_BOUNDARY'],
 ['timer-already-fired',2100,'FILESYSTEM_BOUNDARY'],['overall-shorter',100,'OVERALL_TIMEOUT'],['overall-immediately-before',adjacent(100,-1),null],['overall-equal-helper',2000,'OVERALL_TIMEOUT'],
 ['cancel-before-result',500,'CANCELLED'],['result-before-cancel',500,null],['cancel-and-deadline',2000,'CANCELLED'],['late-close-after-cancel',2100,'CANCELLED'],['late-success-after-cancel',2100,'CANCELLED'],
 ['deadline-before-cancel',2100,'FILESYSTEM_BOUNDARY'],['validation-crosses-deadline',1999,'FILESYSTEM_BOUNDARY'],['preparation-exhausts-overall',100,'OVERALL_TIMEOUT'],['reap-expired',4000,'CLEANUP_FAILED'],['stderr-terminal',500,'FILESYSTEM_BOUNDARY'],['spawn-error-terminal',500,'FILESYSTEM_BOUNDARY']
];
const results=[];
for(const [name,accept,expected] of tests){
 let clock=0,child,kill=0,settlements=0,continuations=0;const events=[],timers=[];const abort=new AbortController();
 const emit=(event,...args)=>{events.push({event,at:clock});return child.emit(event,...args);};
 const context={Buffer,Promise,CIError,reject,J,parseJSON:(...a)=>{const v=parseJSON(...a);if(name==='validation-crosses-deadline')clock=2000;return v;},path,packageRoot:pkg,absolutePath:x=>x,childEnvironment:()=>({SystemRoot:'C:\\Windows'}),readChecked:()=>Buffer.from('fixed helper'),nodePathCheck:x=>{if(name==='preparation-exhausts-overall')clock=100;return x;},performance:{now:()=>clock},setTimeout:(fn,delay)=>{const h={fn,delay,cleared:false};timers.push(h);return h;},clearTimeout:h=>{if(h)h.cleared=true;},spawn:()=>{child=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=()=>{};child.stdin.destroy=()=>{};child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{kill++;return true;};return child;}};
 context.run=new Function(...Object.keys(context),code+'\nreturn checkPaths;')(...Object.values(context));
 const overall=name.startsWith('overall-')?(name==='overall-equal-helper'?2000:100):name==='preparation-exhausts-overall'?100:10000;
 const pending=context.run([{path:'C:\\fixture',allowMissingLeaf:false}],{deadline:overall,signal:abort.signal}).then(()=>{settlements++;continuations++;return null;},e=>{settlements++;if(!e.code)throw e;return e.code.replace('MO1306_','');});
 if(child){
  clock=50;child.stdout.emit('data',name==='failure-before-delivery-after'?Buffer.from(J({kind:'MemoryOSCICDPathCheck',version:'1.0.0',safe:false})):safe);
  if(['cancel-before-result','cancel-and-deadline','late-close-after-cancel','late-success-after-cancel'].includes(name)){clock=name==='cancel-and-deadline'?2000:75;abort.abort();}
  if(['timer-already-fired','deadline-before-cancel','reap-expired'].includes(name)){clock=2000;timers[0].fn();if(name==='deadline-before-cancel')abort.abort();if(name==='reap-expired'){clock=4000;timers[1].fn();}}
  if(name==='stderr-terminal')child.stderr.emit('data',Buffer.from('failure'));
  if(name==='spawn-error-terminal')emit('error',new Error('controlled'));
  clock=accept;emit('close',name==='failure-before-delivery-after'?1:0);
  if(name==='result-before-cancel')abort.abort();
 }
 const actual=await pending;
 // Repeated late bytes/close after terminalization must never restore success.
 if(child){clock=5000;child.stdout.emit('data',safe);emit('close',0);await Promise.resolve();}
 assert.equal(settlements,1);assert.equal(continuations,actual===null?1:0);
 const pass=actual===expected;results.push({name,acceptAtMs:accept,expected,actual,pass,settlements,continuations,killCount:kill,timers:timers.map(t=>({delay:t.delay,cleared:t.cleared})),events});
}
const failures=results.filter(r=>!r.pass);
if(mode==='baseline'){assert(failures.some(r=>r.name==='success-before-delivery-after'&&r.actual===null));}else assert.deepEqual(failures,[]);
console.log(JSON.stringify({status:mode==='baseline'?'EXPECTED_BASELINE_FAILURE':'PASS',clock:'Injected same-process performance.now readings in unmodified extracted checkPaths function',sourceFunction:code,strictSuccessBoundary:'now < min(invocation + 2000, overall)',count:results.length,failedCount:failures.length,results}));

// Focused source-derived parser and independent provider/projection/error controls.
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import Module from 'node:module';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]),sourceFile=path.resolve(process.argv[3]),expected=process.argv[4];
const pkg=path.join(root,'repositories/memoryos-ci'),source=fs.readFileSync(sourceFile,'utf8');
const parser=new Module('dispatch-test');parser._compile(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],'dispatch-test.cjs');
const ast=parser.exports.parse(source,{ecmaVersion:'latest',sourceType:'module'}),fn=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='argv');
if(!fn)throw Error('argv function missing');
let table;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='ObjectExpression'&&n.properties.some(p=>p.key?.name==='run')){if(table)throw Error('Ambiguous command table');table=n;}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}
walk(fn);if(!table)throw Error('Command table missing');
const commands=Object.fromEntries(table.properties.map(p=>[p.key.name,p.value.elements.map(e=>e.value)]));
const prototypeNames=[...new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype','__lookupGetter__','__lookupSetter__','__defineGetter__','__defineSetter__','name','length','arguments','caller','apply','call','bind'])];
const general=[undefined,'','invalid-command','mo1306-unknown-59c813','RUN','Run','Generate','VERIFY','rυn','ｒｕｎ','run\u200b','\n','run\t','\u0001','x'.repeat(4096),'--help','--run','../run','C:/run','generic','gitlab','jenkins','azure','github'];
const errors=await import(pathToFileURL(path.join(pkg,'src/errors.mjs'))),{providerIR,providerNames}=await import(pathToFileURL(path.join(pkg,'src/provider-ir.mjs'))),{run}=await import(pathToFileURL(path.join(pkg,'src/core.mjs'))),{readMetadataEnvironment}=await import(pathToFileURL(path.join(pkg,'src/metadata.mjs')));
const results=[];
function check(group,name,fn){try{const details=fn();results.push({group,name,status:'PASS',...details});}catch(e){results.push({group,name,status:'FAIL',message:e.message});}}
const must=(value,message)=>{if(!value)throw Error(message);};
function parse(args,mutation=null){
 const context=vm.createContext({input:args,reject(code){throw new errors.CIError(code);}});
 const body=source.slice(fn.start,fn.end);
 const additions=mutation?`const before=Object.getOwnPropertyDescriptor(Object.prototype,${JSON.stringify(mutation.key)});Object.defineProperty(Object.prototype,${JSON.stringify(mutation.key)},{value:${JSON.stringify(mutation.value)},configurable:true});`:'';
 const cleanup=mutation?`if(before)Object.defineProperty(Object.prototype,${JSON.stringify(mutation.key)},before);else delete Object.prototype[${JSON.stringify(mutation.key)}];`:'';
 return vm.runInContext(`${body}\n${additions}\ntry{let entered=0;try{const parsed=argv(input);entered++;({accepted:true,command:parsed.command,handlerInvocations:entered});}catch(e){({accepted:false,code:e.code??null,name:e.name,handlerInvocations:entered});}}finally{${cleanup}}`,context,{timeout:1000});
}
for(const [command,flags]of Object.entries(commands))check('valid-command',command,()=>{const args=[command,...flags.filter(f=>f!=='provider').flatMap(f=>['--'+f,'fixture-'+f])];const r=parse(args);must(r.accepted&&r.command===command&&r.handlerInvocations===1,'valid command failed');return {args,...r};});
for(const key of [...prototypeNames,...general])check(prototypeNames.includes(key)?'prototype-command':'general-command',key??'<missing>',()=>{const args=key===undefined?[]:[key];const r=parse(args);must(!r.accepted&&r.code==='MO1306_USAGE'&&r.handlerInvocations===0,'unknown command did not reject with USAGE: '+JSON.stringify(r));return {args,...r};});
for(const key of ['inheritedCommand','run2','toJSON','then'])check('prototype-mutation',key,()=>{const r=parse([key],{key,value:[]});must(!r.accepted&&r.code==='MO1306_USAGE'&&r.handlerInvocations===0,'inherited added command accepted');return {...r,isolation:'fresh vm context, descriptor restored in finally'};});
for(const [key,flags]of Object.entries(commands))check('prototype-mutation-positive',key,()=>{const args=[key,...flags.filter(f=>f!=='provider').flatMap(f=>['--'+f,'fixture'])];const r=parse(args,{key,value:['attacker']});must(r.accepted&&r.command===key,'inherited shadow alters legitimate own command');return {...r,isolation:'fresh vm context, descriptor restored in finally'};});
for(const key of [...prototypeNames,...['','GENERIC','other']]){
 check('provider-dispatch',key,()=>{let e;try{providerIR(key);}catch(x){e=x;}must(e?.code==='MO1306_PROVIDER_UNSUPPORTED','provider rejection');must(errors.projections[errors.classification(e)].exitCode===10,'provider exit');return {code:e.code,exitCode:10};});
 check('provider-environment',key,()=>{let e;try{readMetadataEnvironment(key);}catch(x){e=x;}must(e?.code==='MO1306_PROVIDER_UNSUPPORTED','metadata provider rejection');return {code:e.code};});
 check('projection-selector',key,()=>{let e;try{errors.project(key);}catch(x){e=x;}must(e?.code==='MO1306_INTERNAL_FAILURE','projection rejected incorrectly');return {code:e.code,exitCode:16};});
 const r=await run({provider:key});check('provider-core',key,()=>{must(r.error?.code==='MO1306_PROVIDER_UNSUPPORTED'&&r.summary.exitCode===10&&r.summary.publication==='NONE'&&r.runDirectory===null,'core provider routing');return {code:r.error.code,exitCode:r.summary.exitCode,publication:r.summary.publication};});
}
for(const provider of providerNames)check('provider-positive',provider,()=>{const adapter=providerIR(provider);must(adapter.id==='memoryos.cicd.adapter.'+provider,'adapter identity');return {id:adapter.id};});
for(const [key,row]of Object.entries(errors.projections))check('projection-positive',key,()=>{must(JSON.stringify(errors.project(key))===JSON.stringify(row.projection),'projection bytes');return {exitCode:row.exitCode};});
for(const [code,row]of Object.entries(errors.catalog.errors))check('error-contract',code,()=>{const e=new errors.CIError(code);must(errors.classification(e)===row[0]&&errors.projections[row[0]].exitCode===row[1]&&errors.errorObject(e).stage===row[2],'error catalog mapping');const output=[];errors.diagnosticWriter(t=>output.push(t))(e);const d=JSON.parse(output[0]);must(d.code===code&&d.message==='The requested operation could not complete.','frozen diagnostic');return {exitCode:row[1],stage:row[2]};});
check('diagnostic-truncation','32nd-record',()=>{const out=[],write=errors.diagnosticWriter(t=>out.push(t));for(let i=0;i<40;i++)write(new errors.CIError('USAGE'));must(out.length===32&&JSON.parse(out[31]).code==='MO1306_DIAGNOSTICS_TRUNCATED','truncation');return {records:out.length};});
const failures=results.filter(r=>r.status==='FAIL');
const report={sourceFile,commands,prototypeNames,general,results,counts:{tests:results.length,pass:results.length-failures.length,fail:failures.length},mode:expected};
console.log(JSON.stringify(report));
if(expected==='corrected'&&failures.length||expected==='b2'&&(!failures.some(r=>r.name==='constructor')||failures.some(r=>!['prototype-command','prototype-mutation'].includes(r.group))))process.exitCode=1;

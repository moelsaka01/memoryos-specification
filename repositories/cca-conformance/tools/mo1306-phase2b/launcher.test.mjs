import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { J } from '../../../memoryos-ci/src/serialization.mjs';

const root=path.resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const state=JSON.parse(fs.readFileSync(path.join(root,'.cache/mo1306/phase2b/active-stage.json')));
const stage=path.resolve(state.stage),node=path.resolve(state.nodePath);
assert.ok(stage.startsWith(path.join(root,'.cache','mo1306','phase2b')+path.sep));
assert.ok(node.startsWith(path.join(root,'.cache','mo1306','phase2b')+path.sep));
const verifier=path.join(stage,'scripts/verify-launch-result.mjs');
assert.deepEqual(fs.readFileSync(verifier),fs.readFileSync(path.join(root,'repositories/memoryos-ci/scripts/verify-launch-result.mjs')),'Restage the current reviewed verifier before launcher tests');
const pin='sha256:'+'a'.repeat(64),sentinel='SECRET-SENTINEL';
const base={kind:'MemoryOSCICDSummary',version:'1.0.0',runId:'11111111-1111-4111-8111-111111111111',classification:'TIMEOUT',exitCode:13,resultSha256:null,publication:'NONE'};
const raw=value=>J(value).slice(0,-1),encoded=value=>Buffer.from(raw(value),'utf8').toString('base64');
const environment={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATHEXT:'.EXE'};
function execute(args) {
  const result=spawnSync(node,['--max-old-space-size=128',verifier,...args],{cwd:root,env:environment,windowsHide:true,timeout:30000,maxBuffer:16384});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);return result;
}
const argumentsFor=overrides=>[root,pin,'gitlab','13',encoded(base)].map((value,index)=>overrides?.[index]??value);
function reject(args,code='MO1306_BUNDLE_INTEGRITY',exit=15) {
  const result=execute(args),stderr=result.stderr.toString('utf8');
  assert.equal(result.status,exit,stderr);assert.equal(result.stdout.length,0);
  assert.ok(result.stderr.length<=1024);assert.ok(!stderr.includes(sentinel));
  const diagnostic=JSON.parse(stderr);assert.equal(diagnostic.code,code);
  assert.equal(diagnostic.message,'The requested operation could not complete.');
  assert.equal(diagnostic.stage,code==='MO1306_USAGE'?'LAUNCH':'VERIFICATION');
}

test('launcher verifier: actual reviewed installation accepts canonical operational NONE',t=>{
  const result=execute(argumentsFor());assert.equal(result.status,0,result.stderr.toString());
  assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);
  t.diagnostic(JSON.stringify({stage:path.relative(root,stage).replaceAll('\\','/'),distributionDigest:state.distributionDigest,transport:'canonical UTF-8 base64 argv',verifier:'scripts/verify-launch-result.mjs'}));
});

const invalidBase64={
  empty:'',alphabet:sentinel+'!',space:'Z g==',newline:'Zg==\n',missingPadding:'Zg',extraPadding:'Zg===',
  internalPadding:'Z=g=',noncanonicalTwoPad:'Zh==',noncanonicalOnePad:'Zm9=',overEncodedBound:'A'.repeat(1368),
  overDecodedBound:Buffer.alloc(1024,32).toString('base64')
};
for(const [name,value] of Object.entries(invalidBase64))test('launcher negative base64: '+name,()=>reject(argumentsFor({4:value})));

const invalidUtf8={overlong:Buffer.from([0xc0,0xaf]),truncated:Buffer.from([0xe2,0x82]),surrogate:Buffer.from([0xed,0xa0,0x80]),illegal:Buffer.from([0xff]),bom:Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(raw(base))])};
for(const [name,value] of Object.entries(invalidUtf8))test('launcher negative UTF8: '+name,()=>reject(argumentsFor({4:value.toString('base64')})));

const malformed={
  invalid:'{SECRET-SENTINEL}',truncated:raw(base).slice(0,-1),duplicate:raw(base).replace('"classification":"TIMEOUT"','"classification":"TIMEOUT","classification":"TIMEOUT"'),
  extraText:raw(base)+' SECRET-SENTINEL',array:'[]',null:'null',scalar:'"SECRET-SENTINEL"',
  unpaired:'{"value":"\\ud800"}',control:'{"value":"SECRET-SENTINEL\\u0000"}',
  whitespace:' '+raw(base),newline:raw(base)+'\n',crlf:raw(base)+'\r\n',
  noncanonicalKeys:JSON.stringify(base),byteLimit:' '.repeat(1023)
};
for(const [name,value] of Object.entries(malformed))test('launcher negative JSON integrity mapping: '+name,()=>reject(argumentsFor({4:Buffer.from(value,'utf8').toString('base64')})));

const schemaMutations={
  field:value=>value.extra=sentinel,version:value=>value.version='2.0.0',kind:value=>value.kind=sentinel,
  classification:value=>value.classification=sentinel,exitType:value=>value.exitCode='13',unknownExit:value=>value.exitCode=1,
  runId:value=>value.runId=sentinel,resultDigest:value=>value.resultSha256=sentinel,publication:value=>value.publication=sentinel,
  missing:value=>delete value.resultSha256
};
for(const [name,mutate] of Object.entries(schemaMutations))test('launcher negative summary schema: '+name,()=>{
  const value=structuredClone(base);mutate(value);reject(argumentsFor({4:encoded(value)}));
});
for(const provider of ['azure','github','unknown','GitLab','__proto__','constructor'])test('launcher negative provider: '+provider,()=>reject(argumentsFor({2:provider}),'MO1306_USAGE',10));
for(const [name,value] of Object.entries({empty:'',uppercase:'sha256:'+'A'.repeat(64),algorithm:'sha1:'+'a'.repeat(64),length:'sha256:'+'a'.repeat(63),expression:'${'+sentinel+'}',newline:pin+'\n'}))test('launcher negative configuration digest: '+name,()=>reject(argumentsFor({1:value}),'MO1306_USAGE',10));
test('launcher negative argv: missing',()=>reject(argumentsFor().slice(0,-1),'MO1306_USAGE',10));
test('launcher negative argv: extra',()=>reject([...argumentsFor(),sentinel],'MO1306_USAGE',10));
for(const value of ['0','14','013','13.0','13\n',sentinel])test('launcher negative captured exit: '+JSON.stringify(value),()=>reject(argumentsFor({3:value})));
test('launcher negative classification/exit projection mismatch',()=>reject(argumentsFor({3:'0',4:encoded({...base,exitCode:0})})));
for(const [classification,exitCode] of [['PASS',0],['FAIL',6],['COULD_NOT_EVALUATE',7]])test('launcher negative semantic NONE: '+classification,()=>{
  reject(argumentsFor({3:String(exitCode),4:encoded({...base,classification,exitCode})}));
});
test('launcher negative operational NONE with fabricated result digest',()=>reject(argumentsFor({4:encoded({...base,resultSha256:pin})})));

test('launcher PowerShell 5.1: encoded summary survives real native argv without a policy override',()=>{
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  // The literal summary is fixed test data. The only native summary argument is
  // produced by exactly the same .NET UTF-8/base64 APIs as the shipped launcher.
  const source=[
    "$ErrorActionPreference = 'Stop'",
    'if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { exit 91 }',
    '$summary = '+quote(raw(base)),
    '$encodedSummary = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($summary))',
    '& '+[quote(node),quote('--max-old-space-size=128'),quote(verifier),quote(root),quote(pin),quote('gitlab'),quote('13'),'$encodedSummary'].join(' '),
    '$nativeExit = $LASTEXITCODE',
    'if ($null -eq $nativeExit) { exit 92 }',
    'exit $nativeExit'
  ].join('\n');
  const powershell=path.join(environment.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(source,'utf16le').toString('base64')],{cwd:root,env:environment,windowsHide:true,timeout:30000,maxBuffer:16384});
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr?.toString());
  assert.equal(result.stdout.length,0);assert.equal(result.stderr.length,0);
});

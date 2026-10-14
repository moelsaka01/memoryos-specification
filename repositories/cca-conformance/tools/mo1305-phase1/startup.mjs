import {scheduleTimeout as setTimeout,cancelTimeout as clearTimeout,bounded} from './clock.mjs';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync,linkSync,copyFileSync,mkdirSync,rmdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {stage,root,launch,wire,response,request} from './installed.mjs';
const clean={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP};
const configPath=resolve(stage,'private/config.json'),originalConfig=readFileSync(configPath),config=JSON.parse(originalConfig),entry=resolve(stage,'package/bin/memoryos-rest.mjs');
const records=[];
async function startup(id,args,environment={},expected=2){
 const child=spawn(process.execPath,args,{cwd:resolve(stage,'empty'),env:{...clean,...environment},windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
 child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
 const exit=await bounded(new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));}),7000,'STARTUP_VALIDATION_TIMEOUT',{onTimeout:()=>child.kill()});
 assert.equal(exit,expected,id+' '+stderr);assert.equal(stdout,'',id);assert.ok(!stderr.includes('startup'),id);assert.ok(!stderr.includes('Bearer'),id);
 const log=JSON.parse(stderr.trim());assert.deepEqual(log,{code:'MO1305_UNAVAILABLE',event:'fatal',operationId:null,requestId:null});records.push({id,state:'PASS',exitCode:exit});
}
async function configCase(id,value){writeFileSync(configPath,typeof value==='string'?value:JSON.stringify(value));try{await startup(id,[entry,'--config',configPath]);}finally{writeFileSync(configPath,originalConfig);}}
for(const [id,value] of [
 ['empty',{}],['unknown',{...config,extra:true}],['bad-version',{...config,version:'2.0.0'}],['string-port',{...config,port:'13050'}],['low-port',{...config,port:1023}],['high-port',{...config,port:65536}],
 ['wildcard',{...config,bindAddress:'0.0.0.0'}],['dns',{...config,bindAddress:'localhost'}],['ipv6',{...config,bindAddress:'::1'}],['remote-implicit',{...config,mode:'remote'}],['remote-loopback',{...config,mode:'remote',bindAddress:'127.0.0.1'}],
 ['token-relative',{...config,tokenFile:'token'}],['token-unc',{...config,tokenFile:'\\\\server\\share'}],['token-device',{...config,tokenFile:'C:/nul'}],['token-uri',{...config,tokenFile:'file:///C:/secret'}],['token-traversal',{...config,tokenFile:resolve(stage,'private')+'/../private/token'}],['token-ads',{...config,tokenFile:config.tokenFile+':stream'}],
 ['key-missing',{...config,privateKeyFile:resolve(stage,'private/missing.key')}],['cert-missing',{...config,certificateFile:resolve(stage,'private/missing.pem')}],['duplicate','{"version":"1.0.0","version":"1.0.0"}'],['oversized',' '.repeat(8193)]
])await configCase('SEC-STARTUP-'+id,value);
for(const args of [[],['--config'],['--host','127.0.0.1'],['--config',configPath,'--debug']])await startup('SEC-ARGV-'+records.length,[entry,...args]);
for(const name of ['NODE_PATH','NODE_OPTIONS','OPENSSL_CONF','SSL_CERT_FILE','UV_THREADPOOL_SIZE','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY']){
 const value=name==='NODE_OPTIONS'?'--require=UNTRUSTED_NEVER_RUN':name==='UV_THREADPOOL_SIZE'?'1':'UNTRUSTED_NEVER_RUN';
 const check=spawnSync('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe',['-NoProfile','-NonInteractive','-File',resolve(import.meta.dirname,'validate-launch.ps1'),'-NodePath',process.execPath,'-ConfigPath',configPath],{env:{...clean,[name]:value},windowsHide:true,encoding:'utf8'});
 assert.equal(check.status,2,name);assert.equal(check.stdout.trim(),'MO1305_TRUSTED_LAUNCH_REFUSED:ENVIRONMENT');records.push({id:'SEC-ENV-'+name,state:'PASS',nodeLaunched:false});
}
const token=readFileSync(config.tokenFile);for(const replacement of ['0'.repeat(63),'A'.repeat(64),'0'.repeat(64)+'\n']){writeFileSync(config.tokenFile,replacement);try{await startup('SEC-TOKEN-'+records.length,[entry,'--config',configPath]);}finally{writeFileSync(config.tokenFile,token);}}
for(const file of ['contracts/policy-contract-identities-1.0.0.json','contracts/api-contract.json','contracts/limits.json','contracts/openapi.json','runtime/authoritative/web/js/memoryos-sdk.js','runtime/runtime-closure-manifest.json','distribution-manifest.json','package-lock.json','bin/memoryos-rest.mjs']){
 const path=resolve(stage,'package',file),original=readFileSync(path);writeFileSync(path,Buffer.concat([original,Buffer.from(' ')]));try{await startup('SEC-INTEGRITY-'+records.length,[entry,'--config',configPath]);}finally{writeFileSync(path,original);}
}
for(const name of ['extra.mjs','native.node','node_modules/unexpected/index.js']){const path=resolve(stage,'package',name);if(name.startsWith('node_modules'))mkdirSync(resolve(stage,'package/node_modules/unexpected'),{recursive:true});writeFileSync(path,'UNEXPECTED');try{await startup('SEC-PACKAGE-extra-'+records.length,[entry,'--config',configPath]);}finally{unlinkSync(path);if(name.startsWith('node_modules')){rmdirSync(resolve(stage,'package/node_modules/unexpected'));rmdirSync(resolve(stage,'package/node_modules'));}}}
const alias=resolve(stage,'package/hardlink'),originalPath=resolve(stage,'package/package.json');linkSync(originalPath,alias);try{await startup('SEC-PACKAGE-hardlink',[entry,'--config',configPath]);}finally{unlinkSync(alias);}
const harmless=await launch({environment:{HOME:resolve(stage,'empty'),PATH:resolve(stage,'empty')}});try{assert.equal(response(await wire(request('getHealth'))).status,200);}finally{await harmless.stop();}records.push({id:'SEC-ENV-HOME-PATH-inert',state:'PASS',exitCode:0});
writeFileSync(resolve(root,'.cache/mo1305-resource-review/startup.json'),JSON.stringify({kind:'MemoryOSRESTStartupTests',state:'PASS',records}));console.log(JSON.stringify({state:'PASS',cases:records.length}));

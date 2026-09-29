import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {evaluateReadiness} from '../../../memoryos-readiness/src/index.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const ev=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3c');
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
if(process.argv.includes('--child')){
 const dir=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles/ready'),read=n=>fs.readFileSync(path.join(dir,n+'.json')),manifest=JSON.parse(read('manifest'));
 const r=await evaluateReadiness({configurationBytes:read('configuration'),candidateBytes:read('candidate'),manifestBytes:read('manifest'),authorityBytes:read('authority'),files:manifest.entries.map(e=>({id:e.id,bytes:fs.readFileSync(path.join(dir,e.path))})),expectedCandidateDigest:sha(read('candidate')),trustedAuthorityDigest:sha(read('authority'))});
 process.stdout.write(JSON.stringify({resultSha256:sha(r.resultBytes),readinessDigest:r.readinessDigest,proofBindingDigest:r.proofBindingDigest,resultBytes:r.resultBytes.length})+'\n');
}else{
 const results=[];
 for(const suffix of ['a','b']){const cwd=path.join(root,'.cache/mo1307-phase3c-isolation/'+suffix);fs.mkdirSync(cwd,{recursive:true});
 const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:'Z:\\sentinel-unavailable',PATHEXT:'.SENTINEL',HOME:'SENTINEL_PRIVATE_HOME_'+suffix,USERPROFILE:'SENTINEL_PRIVATE_PROFILE_'+suffix,HTTP_PROXY:'http://127.0.0.1:9',HTTPS_PROXY:'http://127.0.0.1:9',ALL_PROXY:'http://127.0.0.1:9',GITHUB_TOKEN:'SENTINEL_SECRET_GITHUB_'+suffix,AWS_SECRET_ACCESS_KEY:'SENTINEL_SECRET_AWS_'+suffix,AZURE_CLIENT_SECRET:'SENTINEL_SECRET_AZURE_'+suffix};
 const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--child'],{cwd,env,encoding:'utf8',windowsHide:true,timeout:15000});results.push({safeRoot:suffix,exit:r.status,error:r.error?.code??null,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,0);assert.equal(r.stderr,'');assert.ok(!r.stdout.includes('SENTINEL'));}
 assert.equal(results[0].stdout,results[1].stdout);
 const receipt={result:'PASS',scope:'Two fresh public byte API processes with distinct safe cwd and poison PATH/PATHEXT/HOME/USERPROFILE/proxy and sentinel provider credentials. No real secrets/accounts. Equal authoritative bytes produce equal normative result/proof. This does not assert OS network isolation.',results};fs.writeFileSync(path.join(ev,'safe-root-environment-determinism.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
}

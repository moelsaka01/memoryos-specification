// Finite publication preservation: one expected native CLI refusal, four labelled primitive controls, twelve unchanged selected callbacks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createPublication} from '../../../memoryos-readiness/src/publication.mjs';
import {ReadinessError,serializeError,errorExit} from '../../../memoryos-readiness/src/errors.mjs';
import {fixtureInspection,syntheticChain} from '../mo1307-phase2c-correction/publication-fixture.mjs';
import {root,absolute,evidenceRoot,record,write,beginCampaign,verifyBindings,finishCampaign} from './validation-bindings.mjs';
import {inventory,publicationIds,selectedCommand,executeSelected,observeCommand} from './regressions.mjs';
const context=beginCampaign('publication'),declared=inventory(),rows=[],commands=[];
const base=path.join(root,'.cache','mo1307-n17-publication-'+process.pid);
const names=['native-cli-missing-parent','primitive-missing-parent','primitive-wrong-output-type','primitive-unsafe-output-path','primitive-existing-output'];
let failure=null;
const errorRecord=e=>({name:e.name,code:e.code??null,message:e.message,stack:e.stack});
async function supplemental(id,action){
  const row={id,result:'FAIL'};
  try{verifyBindings(context);await action(row);verifyBindings(context);row.result='PASS';}
  catch(e){row.failure=errorRecord(e);throw e;}
  finally{rows.push(row);write(context.output+'/'+id+'.receipt.json',row);}
}
async function refuses(action,row){
  let observed;
  await assert.rejects(action,error=>{observed=error;return error.code==='MO1307_OUTPUT'&&error.stage==='PUBLICATION'&&error.reference===null;});
  assert.equal(errorExit(observed),21);
  row.refusal={code:observed.code,stage:observed.stage,reference:observed.reference,exitMapping:21};
}
try{
  fs.mkdirSync(path.dirname(base),{recursive:true});fs.mkdirSync(base,{recursive:false});
  const selected=publicationIds.map(id=>{const row=declared.cases.find(candidate=>candidate.id===id);assert.ok(row);return selectedCommand(row,'publication');});
  write(context.output+'/plan.json',{supplemental:names,selectedCallbacks:selected,positivePublication:record(evidenceRoot+'/n17/receipt.json'),supplementalCount:5,selectedCount:12,fullInventory:107,controlScopes:['One actual native CLI expected refusal with original fixed production launch','Four real filesystem/publication primitives with explicitly synthetic inspection authority; no native identity claim','Twelve unchanged selected test callbacks'],retries:0});
  await supplemental(names[0],async row=>{
    const absentParent=path.join(base,'native-missing-parent'),out=path.join(absentParent,'out');
    assert.equal(fs.existsSync(absentParent),false);
    const input=absolute('repositories/cca-conformance/fixtures/mo1307/bundles/ready'),pins=JSON.parse(fs.readFileSync(path.join(input,'pins.json')));
    const command={id:names[0],args:['repositories/memoryos-readiness/bin/memoryos-readiness.mjs','evaluate','--input-root',input,'--config','configuration.json','--authority','authority.json','--authority-sha256',pins.trustedAuthorityDigest,'--candidate-sha256',pins.expectedCandidateDigest,'--output-root',out],env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},outerGuardMs:32000};
    const result=await observeCommand(command);
    const stdout=context.output+'/'+row.id+'.stdout',stderr=context.output+'/'+row.id+'.stderr';
    write(stdout,result.stdout);write(stderr,result.stderr);
    Object.assign(row,{kind:'NATIVE_CLI_EXPECTED_PUBLICATION_REFUSAL',command,pid:result.pid,exitCode:result.exitCode,signal:result.signal,error:result.error,elapsedMs:result.elapsedMs,stdout:record(stdout),stderr:record(stderr),settlement:result.settlement,nativeHelperEventTelemetry:false});
    assert.equal(result.error,null);assert.equal(result.signal,null);assert.equal(result.exitCode,21);assert.equal(result.stdout.length,0);
    assert.deepEqual(result.stderr,serializeError(new ReadinessError('OUTPUT','PUBLICATION')));
    assert.equal(result.settlement.allRequiredObserved,true);assert.equal(result.settlement.guardExpired,false);assert.equal(result.settlement.cleanupExpired,false);
    assert.equal(fs.existsSync(absentParent),false);assert.equal(fs.existsSync(out),false);
    row.parentAbsent=true;row.outputAbsent=true;row.refusal={code:'MO1307_OUTPUT',stage:'PUBLICATION',reference:null,exitMapping:21};
  });
  await supplemental(names[1],async row=>{
    const missing=path.join(base,'primitive-missing-parent'),out=path.join(missing,'out');
    assert.equal(fs.existsSync(missing),false);
    row.kind='SYNTHETIC_ADMISSION_REAL_NONRECURSIVE_MKDIR';row.nativeIdentityClaim=false;
    const inspection=await fixtureInspection(out,{inspect:async(root,relative)=>syntheticChain(root,relative)});
    await refuses(()=>createPublication(out,{inspection}),row);
    assert.equal(fs.existsSync(missing),false);assert.equal(fs.existsSync(out),false);
    row.parentAbsent=true;row.outputAbsent=true;
  });
  await supplemental(names[2],async row=>{
    const out=path.join(base,'wrong-output-type');fs.writeFileSync(out,'retained',{flag:'wx'});
    row.kind='EXISTING_FILE_WITH_ENGINEERING_INSPECTION';row.nativeIdentityClaim=false;
    const inspection=await fixtureInspection(out);await refuses(()=>createPublication(out,{inspection}),row);
    assert.equal(fs.readFileSync(out,'utf8'),'retained');assert.equal(fs.statSync(out).isFile(),true);row.existingBytesRetained=true;
  });
  await supplemental(names[3],async row=>{
    const out=base+'\\unsafe\\..\\outside';row.kind='PRODUCTION_LEXICAL_PUBLICATION_REJECTION';row.nativeIdentityClaim=false;
    await refuses(()=>createPublication(out),row);assert.equal(fs.existsSync(path.join(base,'unsafe')),false);assert.equal(fs.existsSync(path.join(base,'outside')),false);row.noOutputCreated=true;
  });
  await supplemental(names[4],async row=>{
    const out=path.join(base,'existing-output');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'existing.txt'),'retained',{flag:'wx'});
    row.kind='EXISTING_DIRECTORY_WITH_ENGINEERING_INSPECTION';row.nativeIdentityClaim=false;
    const inspection=await fixtureInspection(out);await refuses(()=>createPublication(out,{inspection}),row);
    assert.deepEqual(fs.readdirSync(out),['existing.txt']);assert.equal(fs.readFileSync(path.join(out,'existing.txt'),'utf8'),'retained');row.existingNamespaceRetained=true;
  });
  for(const command of selected){const row=await executeSelected(context,command);commands.push(row);assert.equal(row.result,'PASS','Required publication callback failed: '+command.id);}
}catch(e){failure=errorRecord(e);}
finally{
  const ids=commands.filter(row=>row.result==='PASS').map(row=>row.id);
  if(failure===null){try{assert.deepEqual(ids,publicationIds);assert.deepEqual(rows.map(row=>row.id),names);assert.ok(rows.every(row=>row.result==='PASS'));}catch(e){failure=errorRecord(e);}}
  finishCampaign(context,{suite:'publication-preservation',result:failure?'FAIL':'PASS',supplementalExpected:5,supplementalPasses:rows.filter(row=>row.result==='PASS').length,supplementalRows:rows,expectedTests:12,freshSelectedTests:12,freshSelectedTestPasses:ids.length,selectedTestPasses:ids.length,completedSelectedIds:ids,commands,sameGenerationN17:record(evidenceRoot+'/n17/receipt.json'),historicalResultsPromoted:0,notRun:[...names.filter(id=>!rows.some(row=>row.id===id)),...publicationIds.filter(id=>!commands.some(row=>row.id===id))],failure,scope:'Actual missing-parent CLI negative plus labelled publication primitives. Unchanged twelve callbacks count once toward the new107; no N17 repeat.'});
}

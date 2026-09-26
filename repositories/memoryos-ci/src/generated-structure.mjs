/** Closed first-party YAML grammar; no general YAML parser or executable input. */
import { readFileSync } from 'node:fs';
import { configuration, deployment as normalizeDeployment, digest } from './contracts.mjs';
import { J } from './serialization.mjs';
import { reject } from './errors.mjs';

const templates=Object.freeze({
  gitlab:readFileSync(new URL('../templates/gitlab.yml.tpl',import.meta.url),'utf8'),
  jenkins:readFileSync(new URL('../templates/jenkins.groovy.tpl',import.meta.url),'utf8'),
  azure:readFileSync(new URL('../templates/azure.yml.tpl',import.meta.url),'utf8'),
  github:readFileSync(new URL('../templates/github.yml.tpl',import.meta.url),'utf8'),
});
const paths=Object.freeze({gitlab:'.gitlab-ci.yml',jenkins:'Jenkinsfile',azure:'azure-pipelines.yml',github:'.github/workflows/memoryos-ci.yml'});
const expressions=new Set([
  '${{ github.sha }}','${{ steps.evaluate.outputs.complete }}','${{ steps.evaluate.outputs.exit-code }}',
  '${{ steps.evaluate.outputs.run-id }}','${{ steps.evaluate.outcome }}','${{ steps.upload.outcome }}',
  "always() && steps.evaluate.outputs.complete == 'true'",'always()',
]);
const invalid=()=>reject('GENERATION_INVALID');

/** Typed ordered AST preserves scalar style and every mapping/sequence boundary. */
export function parseGeneratedYaml(bytes) {
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>32768)invalid();
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{invalid();}
  if(text.startsWith('\ufeff')||!text.endsWith('\n')||text.endsWith('\n\n')||/[\x00-\x09\x0b-\x1f\x7f-\x9f]/.test(text)||!text.isWellFormed())invalid();
  const lines=text.slice(0,-1).split('\n');
  if(lines.some(line=>!line.length))invalid();
  // Only U+0020 may indent YAML or the fixed literal script body.
  if(lines.some(line=>/[^ ]/u.test(line.match(/^\s*/u)[0])))invalid();
  let cursor=0,nodes=0;
  const indent=line=>line.match(/^ */)[0].length;
  const scalar=value=>{
    if(value==="{}")return {type:'map',entries:[]};
    if(/^'(?:[^']|'')*'$/.test(value))return {type:'string',value:value.slice(1,-1).replaceAll("''", "'")};
    if(value==='true'||value==='false')return {type:'boolean',value:value==='true'};
    if(/^(?:0|[1-9][0-9]*)$/.test(value)){
      const number=Number(value);if(!Number.isSafeInteger(number))invalid();
      return {type:'integer',value:number};
    }
    if(expressions.has(value))return {type:'expression',value};
    invalid();
  };
  function entry(map,body,column,depth) {
    const match=/^([A-Za-z_][A-Za-z0-9_-]*|'on'):(?: (.*))?$/.exec(body);
    if(!match)invalid();
    const key=match[1]==="'on'"?'on':match[1];
    if(key==='on'&&match[1]!=="'on'"||map.entries.some(([prior])=>prior===key))invalid();
    const value=match[2];let node;
    if(value===undefined){
      if(cursor>=lines.length||indent(lines[cursor])!==column+2)invalid();
      node=block(column+2,depth+1);
    }else if(value==='|'){
      const content=[];
      while(cursor<lines.length&&indent(lines[cursor])>=column+2){
        content.push(lines[cursor].slice(column+2));cursor++;
      }
      if(!content.length)invalid();
      node={type:'block',value:content.join('\n')+'\n'};
    }else node=scalar(value);
    map.entries.push([key,node]);
  }
  function block(column,depth) {
    if(depth>24||++nodes>2048||cursor>=lines.length||indent(lines[cursor])!==column||column%2)invalid();
    const sequence=lines[cursor].slice(column).startsWith('- ');
    const node=sequence?{type:'sequence',items:[]}:{type:'map',entries:[]};
    while(cursor<lines.length&&indent(lines[cursor])>=column){
      if(indent(lines[cursor])!==column)invalid();
      const body=lines[cursor++].slice(column);
      if(sequence){
        if(!body.startsWith('- '))invalid();
        const item=body.slice(2);
        if(/^(?:[A-Za-z_][A-Za-z0-9_-]*|'on'):/.test(item)){
          const mapping={type:'map',entries:[]};entry(mapping,item,column+2,depth+1);
          while(cursor<lines.length&&indent(lines[cursor])>=column+2){
            if(indent(lines[cursor])!==column+2)invalid();
            entry(mapping,lines[cursor++].slice(column+2),column+2,depth+1);
          }
          node.items.push(mapping);
        }else if(item==='|'){
          const content=[];
          while(cursor<lines.length&&indent(lines[cursor])>=column+2){content.push(lines[cursor].slice(column+2));cursor++;}
          if(!content.length)invalid();
          node.items.push({type:'block',value:content.join('\n')+'\n'});
        }else node.items.push(scalar(item));
      }else{
        if(body.startsWith('- '))invalid();
        entry(node,body,column,depth);
      }
    }
    return node;
  }
  const result=block(0,0);
  if(cursor!==lines.length||result.type!=='map')invalid();
  return result;
}

function expectedGrammar(config,deployment) {
  const pin=digest(J(config));
  if(deployment.provider==='gitlab'||deployment.provider==='jenkins'){
    const slots={LABEL:deployment.provider==='gitlab'?deployment.options.runnerTag:deployment.options.agentLabel,CONFIGURATION_DIGEST:pin,DISTRIBUTION_DIGEST:deployment.distributionDigest};
    return templates[deployment.provider].replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!Object.hasOwn(slots,key))invalid();return slots[key];});
  }
  if(deployment.provider==='azure')return templates.azure.replace('{{pool}}',deployment.options.pool).replace('{{configurationDigest}}',pin).replace('{{distributionDigest}}',deployment.distributionDigest);
  const slots={REPOSITORY:deployment.options.repository,TOOL_REVISION:deployment.options.toolRevision,
    CONFIG_PATH:deployment.options.configPath.replaceAll('/','\\'),CONFIGURATION_DIGEST:pin,DISTRIBUTION_DIGEST:deployment.distributionDigest};
  return templates.github.replace(/@@([A-Z_]+)@@/g,(_,key)=>{if(!Object.hasOwn(slots,key))invalid();return slots[key];});
}

/** Parse the closed Jenkins token grammar without evaluating Groovy. */
export function parseGeneratedGroovy(bytes) {
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>32768)invalid();
  let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{invalid();}
  if(text.startsWith('\ufeff')||!text.endsWith('\n')||text.endsWith('\n\n')||/[\x00-\x09\x0b-\x1f\x7f-\x9f]/.test(text))invalid();
  const tokens=[],stack=[];let offset=0;
  while(offset<text.length){
    const remaining=text.slice(offset);
    const space=/^[ \n]+/.exec(remaining);if(space){offset+=space[0].length;continue;}
    const match=/^(?:'''[\s\S]*?'''|'[^'\r\n]*'|[A-Za-z_][A-Za-z0-9_]*|[0-9]+|[{}():,])/.exec(remaining);
    if(!match||tokens.length>=256)invalid();
    const token=match[0];offset+=token.length;tokens.push(token);
    if(token==='{'||token==='('){stack.push(token);if(stack.length>16)invalid();}
    if(token==='}'||token===')'){if(stack.pop()!==(token==='}'?'{':'('))invalid();}
  }
  if(stack.length)invalid();
  return tokens;
}

/** Compare parsed output with the inventoried fixed grammar and closed typed bindings. */
export function validateGeneratedStructure(config,deployment,files) {
  config=configuration(Buffer.from(J(config)));
  deployment=normalizeDeployment(Buffer.from(J(deployment)));
  if(!Array.isArray(files))invalid();
  if(deployment.provider==='generic'){if(files.length)invalid();return;}
  if(!Object.hasOwn(paths,deployment.provider)||files.length!==1)invalid();
  const file=files[0];
  if(!file||Object.keys(file).sort().join(',')!=='bytes,path'||file.path!==paths[deployment.provider])invalid();
  const parse=deployment.provider==='jenkins'?parseGeneratedGroovy:parseGeneratedYaml;
  const expectedBytes=Buffer.from(expectedGrammar(config,deployment),'utf8');
  const actual=parse(file.bytes),expected=parse(expectedBytes);
  if(!Buffer.from(file.bytes).equals(expectedBytes))invalid();
  // JSON.stringify intentionally preserves ordered entries rather than sorting keys.
  if(JSON.stringify(actual)!==JSON.stringify(expected))invalid();
}

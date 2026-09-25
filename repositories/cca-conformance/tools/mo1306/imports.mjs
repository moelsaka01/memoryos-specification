import fs from 'node:fs';import path from 'node:path';import Module from 'node:module';import {createHash} from 'node:crypto';
const root=process.argv[2],source=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
if(typeof source!=='string')throw new Error('Pinned runtime parser unavailable');
const parser=new Module('mo1306-engineering-acorn');parser._compile(source,'mo1306-engineering-acorn.cjs');
const imports=[];
function walk(node,file){
 if(!node||typeof node!=='object')return;
 if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&node.source){
  if(node.source.type!=='Literal'||typeof node.source.value!=='string')throw new Error('Nonliteral import '+file);
  imports.push({module:file,specifier:node.source.value});
 }
 for(const [key,value]of Object.entries(node)){if(key==='start'||key==='end')continue;if(Array.isArray(value)){for(const item of value)walk(item,file);}else if(value&&typeof value==='object')walk(value,file);}
}
function scan(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())scan(p);else if(/\.(?:mjs|js)$/.test(item.name))walk(parser.exports.parse(fs.readFileSync(p,'utf8'),{ecmaVersion:'latest',sourceType:'module'}),path.relative(root,p).replaceAll('\\','/'));}
}
scan(root);console.log(JSON.stringify({parser:'Pinned Node embedded Acorn, engineering only',parserSourceSha256:'sha256:'+createHash('sha256').update(source).digest('hex'),imports}));

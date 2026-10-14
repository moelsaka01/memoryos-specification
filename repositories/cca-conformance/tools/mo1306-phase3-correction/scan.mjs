// Engineering-only syntax inventory using the exact pinned Node parser.
import fs from 'node:fs';import path from 'node:path';import Module from 'node:module';
const root=process.argv[2],parser=new Module('correction-audit');
parser._compile(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],'correction-audit.cjs');
const rows=[];
function scan(p){
 for(const e of fs.readdirSync(p,{withFileTypes:true})){
  const f=path.join(p,e.name);if(e.isDirectory()){if(e.name!=='runtime')scan(f);continue;}
  if(!/\.(mjs|js)$/.test(e.name))continue;
  const source=fs.readFileSync(f,'utf8'),file=path.relative(root,f).replaceAll('\\','/');
  const ast=parser.exports.parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true});
  function walk(n){
   if(!n||typeof n!=='object')return;
   if(n.type==='MemberExpression'&&n.computed||n.type==='BinaryExpression'&&n.operator==='in')rows.push({file,line:n.loc.start.line,column:n.loc.start.column,expression:source.slice(n.start,n.end),type:n.type});
   for(const [key,v]of Object.entries(n)){if(['loc','start','end'].includes(key))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
  }walk(ast);
 }
}
scan(path.join(root,'repositories/memoryos-ci'));
for(const e of fs.readdirSync(path.join(root,'repositories/cca-conformance/tools'),{withFileTypes:true}))if(e.isDirectory()&&e.name.startsWith('mo1306')&&e.name!=='mo1306-phase3-correction')scan(path.join(root,'repositories/cca-conformance/tools',e.name));
console.log(JSON.stringify(rows));

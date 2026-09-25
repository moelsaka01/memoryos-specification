import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { verifyDistribution } from '../src/integrity.mjs';
import { packageRoot } from '../src/filesystem.mjs';
import { digest } from '../src/contracts.mjs';
const installation=verifyDistribution();
const output=process.argv[2];if(!output||process.argv.length!==3)throw new Error('One output path required');
const rows=[...installation.manifest.files.map(r=>r.path),'distribution-manifest.json'].sort();
const blocks=[];
function octal(header,offset,length,number){header.write(number.toString(8).padStart(length-1,'0')+'\0',offset,length,'ascii');}
for(const relative of rows) {
  const name='package/'+relative;if(Buffer.byteLength(name)>100)throw new Error('Tar path too long');
  const bytes=fs.readFileSync(path.join(packageRoot,relative)),header=Buffer.alloc(512);
  header.write(name,0,100,'utf8');octal(header,100,8,relative.startsWith('bin/')?493:420);octal(header,108,8,0);octal(header,116,8,0);octal(header,124,12,bytes.length);octal(header,136,12,0);
  header.fill(32,148,156);header.write('0',156,1,'ascii');header.write('ustar\0',257,6,'ascii');header.write('00',263,2,'ascii');
  const checksum=header.reduce((a,b)=>a+b,0);header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');
  blocks.push(header,bytes,Buffer.alloc((512-bytes.length%512)%512));
}
blocks.push(Buffer.alloc(1024));
const archive=gzipSync(Buffer.concat(blocks),{level:9,mtime:0});archive[9]=255;
fs.writeFileSync(output,archive,{flag:'wx'});
process.stdout.write(JSON.stringify({byteLength:archive.length,sha256:digest(archive),fileCount:rows.length})+'\n');

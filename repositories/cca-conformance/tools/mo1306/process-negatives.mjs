import {spawn} from 'node:child_process';
const count=Number(process.argv[2]);
if(![2,3].includes(count))throw new Error('fixed count required');
const env={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR};
for(const name of ['HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','TEMP','USERDOMAIN','USERNAME','USERPROFILE'])delete process.env[name];
await Promise.all(Array.from({length:count},()=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,['-e','setTimeout(()=>{},3000)'],{env,detached:true,windowsHide:true,shell:false,stdio:'ignore'});
 p.on('error',reject);p.on('close',resolve);
})));
console.log('NEGATIVE_FIXTURE_COMPLETE');

import net from 'node:net';import dgram from 'node:dgram';import assert from 'node:assert/strict';
const probes=[];
for(const [family,host] of [[4,'1.1.1.1'],[6,'::ffff:1.1.1.1']]){
 const code=await new Promise(resolve=>{const s=net.connect({host,port:443,family});s.on('connect',()=>{s.destroy();resolve('CONNECTED');});s.on('error',e=>resolve(e.code));s.setTimeout(3000,()=>{s.destroy();resolve('TIMEOUT');});});probes.push({kind:'TCP',family,host,code});
}
for(const [kind,host] of [['udp4','1.1.1.1'],['udp6','::ffff:1.1.1.1']]){
 const code=await new Promise(resolve=>{const s=dgram.createSocket(kind);let done=false;const finish=code=>{if(done)return;done=true;s.close();resolve(code);};s.on('error',e=>finish(e.code));s.send(Buffer.from('MO1304_CERT_PROBE'),9,host,e=>finish(e?e.code:'SENT'));});probes.push({kind,host,code});
}
console.log(JSON.stringify({mechanism:'HOST_PROVIDED_WINDOWS_PROCESS_SANDBOX_TCP_EGRESS_DENIAL',loopbackDenied:false,dnsDeniedByOSClaimed:false,udpDeniedByOSClaimed:false,probes}));assert.ok(probes.filter(x=>x.kind==='TCP').every(x=>x.code==='EACCES'||x.code==='EPERM'));assert.ok(probes.filter(x=>x.kind.startsWith('udp')).every(x=>x.code==='SENT'));

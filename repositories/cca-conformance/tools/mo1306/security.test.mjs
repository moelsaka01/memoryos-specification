import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import fsp from 'node:fs/promises';import net from 'node:net';import tls from 'node:tls';import http from 'node:http';import https from 'node:https';import http2 from 'node:http2';import dgram from 'node:dgram';import dns from 'node:dns';import child from 'node:child_process';import threads from 'node:worker_threads';
import {installWorkerBoundary} from '../../../memoryos-ci/src/worker-boundary.mjs';
import {childEnvironment} from '../../../memoryos-ci/src/filesystem.mjs';
const before=childEnvironment();
installWorkerBoundary();
const blocked=[
 ['fetch',()=>fetch('http://127.0.0.1:1')],['WebSocket',()=>new WebSocket('ws://127.0.0.1:1')],
 ['net.connect',()=>net.connect(1,'127.0.0.1')],['net.createConnection',()=>net.createConnection(1,'127.0.0.1')],['net.createServer',()=>net.createServer()],
 ['net.Socket.connect',()=>new net.Socket().connect(1,'127.0.0.1')],['net.Server.listen',()=>new net.Server().listen(0,'127.0.0.1')],
 ['tls.connect',()=>tls.connect(1,'127.0.0.1')],['tls.createServer',()=>tls.createServer()],
 ['http.request',()=>http.request('http://127.0.0.1:1')],['http.get',()=>http.get('http://127.0.0.1:1')],['http.createServer',()=>http.createServer()],
 ['http.Agent',()=>new http.Agent().createConnection({host:'127.0.0.1',port:1})],['https.request',()=>https.request('https://127.0.0.1:1')],
 ['https.Agent',()=>new https.Agent().createConnection({host:'127.0.0.1',port:1})],['http2.connect',()=>http2.connect('http://127.0.0.1:1')],
 ['dgram.createSocket',()=>dgram.createSocket('udp4')],['dgram.Socket.send',()=>dgram.Socket.prototype.send.call({},Buffer.from('x'))],
 ['dns.lookup',()=>dns.lookup('invalid',()=>{})],['dns.resolve',()=>dns.resolve('invalid',()=>{})],
 ['dns.promises.lookup',()=>dns.promises.lookup('invalid')],['dns.Resolver',()=>new dns.Resolver().resolve('invalid',()=>{})],['dns.promises.Resolver',()=>new dns.promises.Resolver().resolve('invalid')],
 ['child.spawn',()=>child.spawn(process.execPath,[])],['child.spawnSync',()=>child.spawnSync(process.execPath,[])],['child.exec',()=>child.exec('forbidden')],['child.execFile',()=>child.execFile(process.execPath)],['child.fork',()=>child.fork('forbidden')],
 ['ChildProcess.spawn',()=>new child.ChildProcess().spawn({})],['threads.Worker',()=>new threads.Worker('forbidden')],
 ['fs.writeFile',()=>fs.writeFile('forbidden','x',()=>{})],['fs.openSync(write)',()=>fs.openSync('forbidden','w')],['fs.open(write)',()=>fs.open('forbidden','w',()=>{})],['fs.promises.writeFile',()=>fsp.writeFile('forbidden','x')],['process.dlopen',()=>process.dlopen({},'forbidden')]
];
for(const [name,action] of blocked)test('CF-SECURITY '+name,()=>assert.throws(action,/MO1306_WORKER_AUTHORITY_DENIED/));
test('CF-SECURITY promise writable handle',async()=>assert.rejects(fsp.open('forbidden','w'),/MO1306_WORKER_AUTHORITY_DENIED/));
test('CF-SECURITY environment allowlist',()=>assert.deepEqual(Object.keys(before).sort(),['SystemRoot','WINDIR']));

/** Controlled downstream backpressure: real TLS bytes, withheld Writable callback.
 * A naturally paused client may fit a bounded response in the Windows TCP buffer.
 * This harness holds completion at the owned stream boundary to exercise the deadline. */
import tls from 'node:tls';
const create=tls.createServer;
tls.createServer=function(...args){const server=create.apply(this,args);server.prependListener('secureConnection',socket=>{
 for(const name of ['_write','_writev']){const original=socket[name];socket[name]=function(...values){const done=values.pop();return original.call(this,...values,error=>{if(error)done(error);else this.once('close',()=>done());});};}
});return server;};
await import('./measure-server.mjs');

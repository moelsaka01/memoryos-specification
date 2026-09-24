import { reject } from './errors.mjs';
export const now = () => process.hrtime.bigint();
export const ms = value => BigInt(value) * 1000000n;
export const deadlineReached = (deadline, current = now()) => current >= deadline;
/** Integer nanosecond token units; fixed state, clamped refill, no client maps. */
export class TokenBucket {
  constructor(rate, burst, clock = now) { this.clock=clock; this.rate=BigInt(rate); this.capacity=BigInt(burst)*1000000000n; this.tokens=this.capacity; this.last=clock(); }
  take() {
    const time=this.clock(), elapsed=time > this.last ? time-this.last : 0n;
    if (time > this.last) this.last=time;
    const cap=this.capacity/this.rate+1n;
    this.tokens=this.tokens+(elapsed > cap ? cap : elapsed)*this.rate;
    if (this.tokens > this.capacity) this.tokens=this.capacity;
    if (this.tokens < 1000000000n) return false;
    this.tokens-=1000000000n; return true;
  }
}
export class Slots {
  constructor(maximum) { this.maximum=maximum; this.active=new Set(); }
  acquire(owner) { if (this.active.has(owner)) return true; if(this.active.size>=this.maximum)return false; this.active.add(owner);return true; }
  release(owner) { this.active.delete(owner); }
}
export class Ownership {
  constructor() { this.generation=0;this.owner=null; }
  reserve(socket) {
    if (this.owner) reject('BUSY');
    if (this.generation===Number.MAX_SAFE_INTEGER) reject('UNAVAILABLE');
    const owner={socket,generation:++this.generation,state:'reserved',cancelled:false,worker:null,reaped:false,responseDone:false};
    this.owner=owner;return owner;
  }
  valid(owner) { return this.owner===owner && !owner.cancelled; }
  release(owner) { if(this.owner===owner && owner.reaped && owner.responseDone){ owner.state='released';this.owner=null; } }
}

/** Timers request a wake-up; only the absolute monotonic comparison authorizes expiry. */
export function atDeadline(deadline, callback, clock=now, schedule=setTimeout, cancel=clearTimeout){
 let active=true,timer;
 function arm(){const remaining=deadline-clock();timer=schedule(fire,remaining>0n?Number((remaining+999999n)/1000000n):0);}
 function fire(){if(!active)return;if(!deadlineReached(deadline,clock())){arm();return;}active=false;callback();}
 arm();return {cancel(){active=false;cancel(timer);}};
}
export const cancelDeadline=timer=>{if(timer&&typeof timer.cancel==='function')timer.cancel();else clearTimeout(timer);};

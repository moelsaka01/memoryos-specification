// ENGINEERING OBSERVATION ONLY. Never exported by the production package.
// The unchanged production transport supplies every protocol/pipe/exit rule.
// This single-helper owner mirrors runtime ownership and terminal precedence,
// replacing only 5000-ms refusal with the authorized 20000-ms observation guard.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';

export const PRODUCT_MS = 5000, GUARD_MS = 20000, CLEANUP_MS = 2000;
export function createEngineeringSupervisor() {
  let owner = null, terminal = null, terminalAt = null, origin = null;
  let timer = null, wake = null, launches = 0, completedAt = null;
  const events = [];
  const now = () => performance.now();
  const record = (type, detail = {}) => events.push({type, at:now(), ...detail});
  const stop = error => {
    if (!terminal) {
      terminal = error; terminalAt = now(); clearTimeout(timer);
      record('terminal', {code:error.code ?? error.name, cleanupDeadline:terminalAt+CLEANUP_MS});
      wake?.(terminal);
    }
    return terminal;
  };
  const checkpoint = () => {
    if (terminal) throw terminal;
    if (origin !== null && now() > origin + GUARD_MS) {
      const error = new Error('Engineering observation guard exceeded');
      error.code = 'ENGINEERING_GUARD_EXCEEDED'; throw stop(error);
    }
  };
  const arm = () => {
    clearTimeout(timer);
    if (terminal || origin === null || completedAt !== null) return;
    timer = setTimeout(() => {try {checkpoint(); arm();} catch {/* wakes owner */}},
      Math.max(1, Math.ceil(origin + GUARD_MS - now())));
  };
  return Object.freeze({kind:'cli', checkpoint, abort:stop,
    async runOwned(role, start) {
      assert.equal(role,'helper'); assert.equal(launches,0); assert.equal(owner,null);
      checkpoint(); origin=now(); launches++;
      let rejectStopped;
      const stopped = new Promise((_,reject)=>{rejectStopped=reject;});
      stopped.catch(()=>{}); wake=rejectStopped;
      record('start',{origin,productDeadline:origin+PRODUCT_MS,engineeringDeadline:origin+GUARD_MS});
      arm();
      try {
        owner=start(Object.freeze({deadline:origin+GUARD_MS,checkpoint,
          fail:error=>stop(error),observe:detail=>record('observation',detail)}));
        assert.ok(owner && owner.completion && owner.closed && typeof owner.terminate==='function');
        const result=await Promise.race([owner.completion,stopped]);
        await Promise.race([owner.closed,stopped]);
        checkpoint(); assert.equal(owner.quiescence(),true);
        completedAt=now(); checkpoint(); owner.cleanupConfirmed=true;
        record('quiescent',{completedAt}); return result;
      } catch(error) {
        stop(error);
        if(owner?.closed) {
          let cleanupTimer;
          try {
            try {owner.terminate();} catch {/* proof still required */}
            const closed=await Promise.race([
              Promise.resolve(owner.closed).then(()=>true,()=>false),
              new Promise(resolve=>{cleanupTimer=setTimeout(()=>resolve(false),Math.max(0,terminalAt+CLEANUP_MS-now()));})]);
            owner.cleanupConfirmed=closed && now()<=terminalAt+CLEANUP_MS && owner.quiescence();
            if(!owner.cleanupConfirmed)owner.abandon?.();
            record('cleanup',{confirmed:owner.cleanupConfirmed});
          } finally {clearTimeout(cleanupTimer);}
        }
        throw terminal;
      } finally {clearTimeout(timer);wake=null;}
    },
    snapshot:()=>({mode:'ENGINEERING_OBSERVATION_ONLY',origin,completedAt,launches,
      terminalCode:terminal?.code??null,terminalAt,cleanupDeadline:terminalAt===null?null:terminalAt+CLEANUP_MS,
      transportCleanupConfirmed:owner?.cleanupConfirmed===true,events:events.map(e=>({...e}))})
  });
}

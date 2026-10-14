// MO-1308 Phase 3A Windows harness: the fault-injection preload (node --import fault-preload.mjs bin/memoryos.js ...).
// Harness only: the product never loads it and never knows it. DISARMED unless the environment names a plan file (P3A_PLAN): with
// no plan this module reads one environment variable and returns, patching nothing and importing nothing (3A-K1 proves it a
// no-op by comparing function identities and bytes of output with and without the preload). Armed, it wraps node:fs,
// child_process, net, dns and worker_threads calls; every wrapper calls straight on to the real function with the caller's
// arguments and rethrows what it throws.
//
// Plan file (JSON): { id, dir, mode: {errors, events, children, exitCensus, exitPause}, points: [point] }
//   point: { id, op, match: { "0": regex-source, "1": regex-source }, nth, when: "before"|"after", action: "pause"|"fail", code }
// `pause` writes <dir>/<id>.reached and blocks the thread until <dir>/<id>.go exists (or the point's timeout, then exit 97): the
// harness kills, swaps or signals the stopped process, then releases it or never does. `fail` throws the named errno instead of
// running the call (before) or after running it (after).
const planFile = process.env.P3A_PLAN;
if (planFile !== undefined && planFile !== '') await (await import('./fault-arm.mjs')).arm(planFile);

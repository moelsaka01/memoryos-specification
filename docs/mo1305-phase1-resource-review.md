# MO-1305 Phase 1 resource review

The existing 128 MiB ceiling is achievable for the reviewed maximum witnesses.
No Contract Freeze correction is justified. The 1.5 multiplier and committed
memory metric remain unchanged. Full Phase 1 measurement and binding remain
separate gates; this diagnostic review does not claim their completion.

## Preservation and reproduction

The review began on main at c2e3835b852fd966046ac9e984538fdcaf8b26bf, parent
ce1780e2dac0afe31aeb947f0a7f78b953e17f6b. All 72 dirty Phase 1 files were
hash-recorded and copied before modification, with six original cache artifacts.
There were no tracked modifications or unrelated changes. The preservation
manifest is .cache/mo1305-resource-review/initial-files.json. All predecessor
tags were unchanged and memoryos-1.3-mo1305 was absent.

The original archive SHA-256 is
6e3c55fa19c898b0c7b4c0f47694c4bf2196401724e0743a67eaeacfc3036a22.
It was independently materialized in a new private directory outside the
checkout. The pinned Node 24.21.0/npm 11.19.0 ran on detected Windows 11 Home
25H2, version 10.0.26200, full build 26200.9457, x64. No Linux or VM was used.
The original [failed diagnostic](../repositories/cca-conformance/evidence/mo1305-phase1-early-measurement-blocker.json)
remains byte-identical and failed. New [review records](../repositories/cca-conformance/evidence/mo1305-resource-review/review.json)
retain every diagnostic sample, including larger reproduced failures.

## Metric and source trace

worker.mjs samples process.memoryUsage and getHeapSpaceStatistics within the
worker isolate. It adds physical_space_size only for new_space and
new_large_object_space. Other spaces form a conservative old-generation
aggregate. semantic.mjs validates the worker message and records maxima;
server.mjs carries those maxima to the engineering observer; the client records
them in the operation sample. Parent heap/external and process-wide RSS are
separate fields. ArrayBuffers are recorded separately, not added to external.

The pinned [V8 statistics implementation](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/v8/src/api/api.cc)
assigns space_size from CommittedMemory and physical_space_size from
CommittedPhysicalMemory. These are distinct from SizeOfObjects (live data)
and MaxReserved (address-space allowance). Read-only space reports zero because
V8 accounts for its shared memory elsewhere. On these Windows executions,
physical and committed space sizes agree. The [Windows backend](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/v8/src/base/platform/platform-win32.cc)
reports no lazy commits; its allocation paths distinguish MEM_RESERVE from
MEM_COMMIT. V8 commitment is not synonymous with resident working set.

An independent Python process used GetProcessMemoryInfo with
PROCESS_MEMORY_COUNTERS_EX, GetProcessHandleCount and Toolhelp32 thread
snapshots every 20 ms. It recorded working set, peak working set, pagefile
commit, peak commit, PrivateUsage, handles and OS threads. Heap traces retain
size, used, available and physical for every named space, heapTotal/heapUsed,
external/ArrayBuffers, heap statistics, actual worker resourceLimits, thread ID,
empty worker environment and empty execArgv. Records cover before, delegation
boundaries, after execution, and worker reaping. No JavaScript sampler can run
inside the synchronous SDK call; OS sampling continues externally. These are
observed peaks, with the frozen headroom, not a claim of exhaustive native peak
capture or instantaneous OS containment.

Review wrappers intercept the original worker's existing sampler and add an
independent message port. They do not change installed archive bytes. This
instrumented run is distinguished from the initial untouched execution and the
subsequent production-change probe. Wrapper allocations are included in their
measurements. Detailed OS/heap traces are split into canonical chunks below
2 MiB; original diagnostic files remain in the preserved local cache. Worker
creation counts are null where that counter was not instrumented.

## Node/V8 sizing and cause

[Node's worker implementation](https://raw.githubusercontent.com/nodejs/node/v24.21.0/src/node_worker.cc)
converts the supplied MiB value to bytes and passes it to V8 resource constraints.
The original correctly supplied old=512, young=128 and stack=8, with no swapped
fields or unit conversion bug. However, its young allocation control was
incorrectly equated with the release's committed-memory budget.

In the pinned [V8 heap configuration](https://raw.githubusercontent.com/nodejs/node/v24.21.0/deps/v8/src/heap/heap.cc),
the scavenger divides the requested young size among two semispaces and the
new-large-object allowance, then rounds semispace size upward to a power of two.
Thus a 128 MiB request permits 64 MiB semispaces and a 192 MiB young reservation
allowance; it is not an exact 128 MiB aggregate commitment cap. A reproduced
139472896-byte sample is 134217728 bytes of new_space plus 5255168 bytes of
new_large_object_space. Another sample reached 186458112 bytes when the latter
space held more temporary objects. Allocation and collection timing explain the
variation; the earlier failed measurement was not a fictitious live-byte count.

The [Worker documentation](https://raw.githubusercontent.com/nodejs/node/v24.21.0/doc/api/worker_threads.md)
also distinguishes heap constraints from external buffers/RSS and documents
command-line overrides. No override, inspector, source-map flag, NODE_OPTIONS,
or inherited worker environment was present. resourceLimits reports the
requested constraint, not V8's rounded aggregate allowance; heap_size_limit
provided a separate runtime cross-check.

## Implementation audit and controlled trials

Each instrumented execution had at most one worker, and all 195 workers in the
three-pass semantic trial exited and were reaped. OS thread count rose from 13
to at most 14 and returned after reaping. There was one verified SDK URL/closure,
not a second MCP copy. Fixtures and oracle outputs lived in the client process.
The semantic worker creates no TLS server/socket and receives no credentials.
Its denial bootstrap imports built-in networking modules to replace their entry
points; that small bootstrap cost is included. The API schema is used for
worker output validation. OpenAPI is hashed as a distribution member but is not
parsed/compiled in the worker. No SDK, Core, MIP or normative artifact changed.

The maximum MIP contains a large valid inert extension. The authoritative
parser/canonicalizer and immutable SDK products allocate temporary data during
import/evaluation. Attribution to those call paths is an inference from source
and boundary samples, not a captured allocation-stack profile. The large original allocation allowance let those temporary
allocations grow young commitment substantially above live retained data.
Changing collection pressure removed the ceiling failure without changing
normative results; this does not prove that every possible implementation or
unmeasured workload fits.

| Trial | Samples | Committed young peak bytes | ceilMiB(1.5 peak) | Maximum operation microseconds |
|---|---:|---:|---:|---:|
| Original archive, no diagnostic worker wrapper | 5 | 186458112 | 267 | 2802730 |
| Original archive, instrumented young=128 | 5 | 186458112 | 267 | 2923494 |
| Original archive, instrumented young=32 | 5 | 38809600 | 56 | 3003857 |
| Original archive, instrumented young=24 | 5 | 22032384 | 32 | 3160264 |
| Instrumented young=24, all 65 SDK vectors three times | 195 | 22032384 | 32 | 3603773 |

The 195-vector run also observed old commitment 42885120, worker external
17183084, parent heap 30277632, parent external 10390750, process sampled RSS
268709888, and OS peak working set 268713984 bytes. These are diagnostic values,
not final release budgets. PASS, FAIL, COULD_NOT_EVALUATE, both Policy kinds,
preparation maxima, maximum MIP, identity/outcome verification and a valid
4060-byte normative outcome all matched independently prepared SDK expectations.

The production correction requests 24 MiB (three exactly 8 MiB allowances),
separate from the release commitment budget. It additionally checks observed
old/young commitment against their budgets, alongside external memory, poisoning
admission on breach. The production probe without the diagnostic worker wrapper
again observed 22032384 young bytes and exact SDK parity. No measurement was
clamped, no live-memory substitution was made, and no headroom was reduced.
The archive and distribution identities for that probe are bound in its record;
subsequent implementation changes require their own full campaign.

## Remaining gates

There is no resource-correction commit or change to the frozen 128 MiB ceiling.
I1 must remain parented by c2e3835b852fd966046ac9e984538fdcaf8b26bf. Final budgets
must still derive from the complete 30-cold/100-warm catalog and all three
60-second adverse repetitions, including any larger observation. The original
BLOCKED record is historical evidence, not rewritten PASS. Phase 2 must repeat
measurement when its implementation changes costs; Phase 3 confirms the frozen
installed I2 archive under the existing Windows-only policy.

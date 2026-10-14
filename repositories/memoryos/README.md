# MemoryOS repository boundary

This directory remains reserved for a possible future standalone MemoryOS
repository. It does not contain a second implementation and does not authorize
new dependencies.

The released MemoryOS 1.0 implementation currently resides in
[`cca-core`](../cca-core/) for CP-001 through CP-010 and in
[`cca-studio`](../cca-studio/) for the CP-011 Contract. The additive MemoryOS
1.1 investigation presentation and MemoryOS 1.2 MIP, adapter, and Investigation
Core modules also reside in `cca-studio`. The MO-1204 public facade and native
bindings reside in [`cca-sdk`](../cca-sdk/), and the MO-1205 SDK-backed command
line client resides in [`memoryos-cli`](../memoryos-cli/). MO-1206 adds
Cognitive Regression and MO-1207 adds deterministic regression-evidence
navigation to the existing Investigation Core, SDK, CLI, and Studio layers
without creating behavior in this reserved directory. MO-1208 publishes the
implementation-independent CCA-MEMORYOS-1.0 Standard and assesses MemoryOS
1.2.0 through the official [`cca-conformance`](../cca-conformance/) suite;
neither moves product behavior into this directory. Begin with the
[root product overview](../../README.md). The reserved directory remains empty
of product behavior and is not a second execution authority.

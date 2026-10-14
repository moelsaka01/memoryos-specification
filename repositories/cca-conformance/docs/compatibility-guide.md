# MemoryOS Compatibility Guide

## Purpose

This informative guide explains the compatibility model defined normatively by
CCA-MEMORYOS-1.0. It does not create an additional compatibility promise.

## Compatibility dimensions

MemoryOS treats compatibility as several independent questions:

| Dimension | Question |
| --- | --- |
| Standard | Does an implementation satisfy one published behavioral contract? |
| Behavioral | Do equivalent accepted inputs retain the same observable outcomes? |
| MIP | Can a Producer and Consumer exchange canonical cognition without loss? |
| SDK | Can source consumers continue to use the documented public facade? |
| CLI | Do commands, exit codes, and machine output retain their contract? |
| Conformance | Can evidence be evaluated by the identified suite version? |

A claim about one dimension does not imply the others. In particular, MIP wire
compatibility does not imply SDK source compatibility, and an SDK version does
not identify a Standard version.

## Assessed compatibility matrix

| Surface | Assessed version | Compatible Standard/profile |
| --- | --- | --- |
| MemoryOS Reference Implementation | 1.2.0 | CCA-MEMORYOS-1.0 full platform |
| Runtime Foundation | CCA-RF-1.0 | Incorporated Runtime profile |
| MIP | 1.0.0 | CCA-MIP-1.0 Producer, Consumer, and Verifier |
| Investigation Core | 1.0.0 | CCA-MEMORYOS-1.0 Core and lifecycle profiles |
| AI Runtime Adapter contract | 1.0.0 | CCA-MEMORYOS-1.0 Adapter profile |
| SDK | 1.0.0 | CCA-MEMORYOS-1.0 SDK profile |
| CLI | 1.0.0 | CCA-MEMORYOS-1.0 CLI profile |
| Regression report | 1.0.0 | CCA-MEMORYOS-1.0 Regression profile |
| Explorer result | 1.0.0 | CCA-MEMORYOS-1.0 Explorer profile |
| Conformance Suite | 1.0.0 | CCA-MEMORYOS-1.0 evidence protocol |

## Backward compatibility

The Standard is stable by publication version. A later implementation can
continue to claim CCA-MEMORYOS-1.0 conformance when it still passes every
applicable 1.0 requirement. A newer implementation version alone does not
invalidate an older Standard claim.

MIP compatibility follows the incorporated CCA-MIP-1.0 rules: same-major
stable formats are accepted and preserved only where the frozen format permits
that behavior; unknown noncritical extensions survive exact round trips;
unsupported critical extensions and unknown major versions fail atomically.

SDK and CLI compatibility follow their independently versioned public
contracts. Patch releases preserve documented behavior. A minor release may
add backward-compatible surface area while retaining existing inputs and
outcomes. An incompatible public change requires a major version.

## Forward compatibility

Closed contracts reject unknown members rather than guessing their meaning.
Forward compatibility exists only at an explicit extension or version boundary,
such as MIP noncritical extensions and its same-major rules. There is no general
promise that an older SDK, CLI, or Core understands future operations or
closed-result fields.

This fail-closed model prevents an older implementation from silently
misinterpreting newer cognition.

## Behavioral compatibility

Behavior remains compatible when equivalent explicit inputs and initial state
produce the same documented acceptance or rejection, stable identity and
ordering, lifecycle transition, diagnostic code, package bytes, report facts,
and evidence pointers. Private algorithms, allocation strategies, process
boundaries, or renderers may change without affecting that assessment.

Layout, animation, elapsed time, test duration, log prose, and other
presentation-only values are outside behavioral comparison unless a separate
public contract explicitly includes them.

## Checking compatibility

Use the exact Standard, suite, and target versions shown in a report. Run the
suite twice for equivalent inputs and compare its canonical reports. A report
with a failed requirement, an unapproved exception, a missing result, or an
unexplained `NOT APPLICABLE` result does not establish compatibility.

See [the versioning guide](versioning-guide.md) for change classification and
[the certification guide](certification-guide.md) for claim rules.


# MemoryOS Versioning Guide

## Purpose

This informative guide explains the independent version identities assessed by
the MemoryOS Conformance Suite. The normative rules remain in
CCA-MEMORYOS-1.0 `versioning.md` and `compatibility.md`.

## Baseline identities

| Concern | MO-1208 baseline |
| --- | --- |
| MemoryOS Standard | CCA-MEMORYOS-1.0 / Standard 1.0 |
| Reference Implementation | MemoryOS 1.2.1 |
| Conformance specification | 1.0.0 |
| Conformance Suite | 1.0.0 |
| Investigation Core | 1.0.0 |
| AI Runtime Adapter contract | 1.0.0 |
| SDK | 1.0.0 |
| CLI | 1.0.0 |
| Native investigation artifacts | 1.1 |
| Cognitive Regression report | 1.0.0 |
| Explorer result | 1.0.0 |
| MIP specification / wire format | CCA-MIP-1.0 / 1.0.0 |

These identifiers describe different contracts. They are not aliases and do
not advance together. A conformance report records the complete assessed
combination.

MemoryOS v1.2.0 remains the immutable initial historical assessment. v1.2.1
is a corrective implementation release against the same frozen Standard,
component contracts, and wire-format identities.

## Change classification

A MemoryOS Standard major release changes or removes normative behavior,
accepted input, required output, ownership, identity, ordering, lifecycle,
compatibility, or conformance meaning. A Standard minor release may add only
backward-compatible normative behavior. An erratum may correct publication
wording or metadata only when no valid input, outcome, requirement meaning, or
evidence result changes.

Implementation and component versions evolve independently under their public
contracts. A new implementation release does not amend the Standard, and a new
suite release does not make an implementation conformant without a fresh
assessment.

## Compatibility interpretation

- A Standard version identifies the behavior being claimed.
- An implementation version identifies the assessed semantic release.
- An optional implementation revision separately identifies the immutable
  source revision used for that assessment.
- SDK and CLI versions identify their respective public surfaces.
- MIP compatibility is governed only by the incorporated CCA-MIP-1.0 rules.
- A conformance specification and suite version identify how evidence was
  collected and reported.

No matching or differing version number proves compatibility. Compatibility is
established by the applicable contract and attributed evidence.

## Publication records

Never overwrite a prior report to represent a newer implementation, suite, or
Standard. Publish a new immutable report that identifies its exact requirement
manifest digest, incorporated publications, evidence root, assessor, and date.

See [the compatibility guide](compatibility-guide.md) for boundary-specific
guarantees and [the certification guide](certification-guide.md) for claim
levels.

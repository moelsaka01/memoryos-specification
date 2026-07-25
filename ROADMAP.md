# CCA reference workspace roadmap

This roadmap separates committed milestone boundaries from proposed future
work. It does not authorize implementation beyond the architecture in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Milestone 0: engineering foundation

Status: current milestone.

Scope:

- establish the workspace and reserved repository map;
- establish cross-platform CMake and vcpkg integration;
- configure formatting, static analysis, tests, CI, and coverage seams;
- establish shared logging, configuration, utilities, testing, and versioning;
- create public and private skeletons for all named compiler modules;
- create placeholder CLI commands;
- document architecture, repository boundaries, setup, build workflows, coding
  standards, public interfaces, examples, risks, and ambiguities.

Exit evidence should include reviewable source and documentation, platform
configuration, discoverable tests, and honest placeholder behavior. Merely
configuring a tool is not the same as demonstrating a successful run, so build,
test, analysis, coverage, and platform results must be reported separately when
they are actually executed.

Explicit exclusions:

- MemoryOS;
- AI, reasoning, and LLM integration;
- databases;
- plugins;
- networking;
- compiler language or generation semantics.

## Recommended next milestone: specification and contracts

The next milestone should freeze the minimum specification and compatibility
contracts needed before compiler logic begins. It should not begin MemoryOS.

Recommended outcomes:

1. identify the authority and versioning process for the CCA specification;
2. decide source syntax boundaries and a testable grammar strategy;
3. define diagnostic identity, severity, source-location, and compatibility
   rules;
4. define the data contracts between compiler stages without implementing the
   full stages;
5. select artifact, documentation, conformance, and package output contracts;
6. define configuration schema and precedence;
7. decide deterministic-build inputs, path handling, locale, and ordering;
8. decide API/ABI and repository release policies;
9. resolve licensing, copyright, and contribution governance;
10. convert approved decisions into architecture records and conformance
    fixtures.

The milestone should end with reviewed contracts, golden fixtures, and a
traceability map from specification statements to planned tests. Only then
should a narrow vertical compiler slice be proposed.

## Possible later milestones

These are directional proposals, not approved scope:

- implement a minimal parser slice against an approved grammar and fixtures;
- implement validation and analysis slices against approved semantic contracts;
- implement one deterministic artifact path with conformance evidence;
- harden packaging, release, and compatibility workflows;
- establish SDK and conformance repository work after their boundaries are
  approved;
- evaluate studio, atlas, and MemoryOS work only under separately approved
  architectures.

AI, reasoning, LLM, database, plugin, and networking work requires explicit
future architecture. It must not be smuggled into a compiler milestone.

## Principal risks

| Risk | Consequence | Current mitigation |
|---|---|---|
| Skeletons are mistaken for semantics | Consumers depend on accidental behavior | Explicit placeholder statuses, scope labels, and module docs |
| Code becomes the de facto architecture | Unreviewed dependencies and contracts harden | `ARCHITECTURE.md` is authoritative; ambiguities block assumptions |
| Compiler stages imply an unapproved pipeline | Data and sequencing choices become costly to reverse | Modules are independent seams; ordering remains unresolved |
| Reserved repositories attract premature work | Milestone expands into MemoryOS or other systems | Reserved directories are documented as non-implementation boundaries |
| Cross-platform configuration drifts | Builds differ across Windows, Linux, and macOS | Preset-based workflows and CI matrix foundations |
| Dependency supply chain is underspecified | Reproducibility, security, or license exposure | vcpkg foundation; approval and pinning policy remains a recorded blocker |
| Licensing is unresolved | External use and contribution rights are unclear | Pending-decision notice; no license grant is claimed |
| Quality tooling creates false confidence | Configured checks are described as passing | Documentation separates configuration from observed execution results |
| Public placeholders become compatibility commitments | Future specification work is constrained by incidental APIs | Compatibility policy remains unresolved; version interfaces deliberately |
| Diagnostics and logs are conflated | Embedders cannot handle failures deterministically | Structured diagnostics are separate from operational logging |

## Roadmap change rule

Moving an item between milestones requires an architecture and scope review.
The review must identify affected decisions in
[docs/ambiguity-register.md](docs/ambiguity-register.md), update this roadmap,
and update `ARCHITECTURE.md` before implementation starts.

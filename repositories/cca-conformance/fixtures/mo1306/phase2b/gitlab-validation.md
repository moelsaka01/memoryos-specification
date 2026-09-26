# GitLab Phase 2B offline validator

The authority is `docs/mo1306-contract-freeze-1.md`, sections 15–17. This
validator is an engineering conformance dependency, never a production
dependency and never a GitLab service or runner certification.

The preserved upstream file is
`../gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json`.
It is exactly 128034 bytes with SHA-256
`a4dc2b155aa574575fbfd51dcca99388db5ba1b563ab5e05ce8df005e7eb9ced`,
schema identity `https://gitlab.com/.gitlab-ci.yml`, Draft-07.

Source: [GitLab official mirror at the frozen commit](https://github.com/gitlabhq/gitlabhq/blob/a725331f22234d3078d7300944b9454da103e73c/app/assets/javascripts/editor/schema/ci.json).
Origin attribution: [GitLab source repository](https://gitlab.com/gitlab-org/gitlab).
The exact file is retained from the already verified Phase 2B input; validation
does not reacquire it. The upstream MIT Expat notice is retained in
[gitlab-LICENSE](gitlab-LICENSE), from that same frozen commit, SHA-256
`62dfe4bdd76e08992c09cf335b2374b3e6acd4f2b959b4971760727d9b785ab4`.

## Layers and independence

1. A 32768-byte bound, strict UTF-8, printable ASCII/LF, exactly one final LF,
   no tabs/controls/BOM, two-space indentation and no comments or blank lines.
   The fixed grammar admits only ASCII labels, keys, digest pins and script.
2. PyYAML 6.0.3 scans tokens and composes an AST using `BaseLoader`. It never
   constructs Python objects. Anchors, aliases, explicit tags, directives,
   flow collections, document delimiters, merges, duplicates and multiline
   ordinary scalars are rejected. Scalar types and quoting are checked
   independently of PyYAML YAML-1.1 implicit coercion.
3. jsonschema 4.26.0 validates the parsed JSON-compatible mapping with its full
   Draft7Validator. The schema bytes and Draft are verified first. The
   reference registry starts empty and its retrieval callback always raises;
   all 141 references (58 unique targets) are audited as resolvable local
   JSON pointers. No remote resolution or optional dependency download occurs.
4. The MO-1306 subset checks exact top-level/job key order, the one test stage,
   one Windows runner tag, manual execution, false allow_failure, five-minute
   timeout, zero retry and exactly one literal block script. The expected
   configuration/distribution pins are external trusted arguments.
5. A separately reviewed fixed PowerShell launch contract checks the decoded
   block and returns a normalized descriptor including bootstrap variables,
   metadata mapping, timeout, pins, local publication and captured common
   exit. Parent integration separately applies PowerShell parse-only AST
   validation and native Windows execution to the extracted script.

The module imports no product generator or adapter. The independent
[golden file](gitlab-golden.yml) is hand-authored against the frozen contract,
using runner label `windows_2022`, configuration pin `sha256:` plus 64 ones,
and distribution pin `sha256:` plus 64 twos. These are parser test constants,
not a claim that a package with either identity exists. Parent integration
validates actual generated artifacts against their real trusted input pins.

Official schema acceptance and restricted-subset acceptance are separate
gates. A positive control shows that the official schema permits
`before_script`, while the closed MO-1306 subset rejects it. Official-schema
negatives independently exercise invalid stage, script and retry types.

## Schema vocabulary

[gitlab-schema-audit.json](gitlab-schema-audit.json) records every schema
keyword and its count, the exact local reference targets, core keywords,
assertions and annotations. Any unknown assertion fails the audit.
`then` is implemented by jsonschema's `if` assertion evaluator.
`definitions`, `$id` and `$schema` are schema/core vocabulary, not behavioral
assertions. `markdownDescription` is an editor annotation; `description`,
`default` and `examples` are nonasserting annotations.

Draft-07 permits `format` to remain an optional annotation. Its 18 occurrences
use `uri`, `uri-reference`, `date-time` and `regex`; all corresponding instance
fields are excluded by this provider subset. No format assertion coverage is
claimed, no unpinned optional format packages are installed, and the validator
never silently accepts an unknown required assertion.

## Retained security corpus and tests

[gitlab-negatives.json](gitlab-negatives.json) contains 79 individually named
mutations with categories and exact byte/string transformations. Every string
mutation must have exactly one target in the independent golden fixture.
The corpus covers unsupported keys/jobs/steps, malformed/injected YAML,
duplicates, anchors/aliases/tags/merge/flow syntax, controls/malformed Unicode,
multiline values, expressions, unsafe variables, paths, metadata, secret
placeholders, executable additions, argv/pin/runner/config substitution,
scalar styles, ordering, logging commands, literal block indicators and bounds.

The unittest module exposes every corpus entry as its own test, plus 12
positive/structural controls: 91 tests total. These include pinned-schema
tampering, unknown schema assertion, remote reference rejection, a forbidden
retrieval callback, valid label boundaries, and a successful validation with
Python object constructors and socket creation disabled. Runtime and actual
metadata equivalence are recorded by the enclosing Phase 2B integration suite.

Dependencies and licenses are pinned by the immutable Phase 1
`../engineering-validator-lock.json` and `../validator-notices/`: PyYAML 6.0.3,
jsonschema 4.26.0 and the existing exact transitive wheels. No additional
production or engineering library is introduced.

Run after preparing that locked local Python environment:

```text
python -m unittest discover -s repositories/cca-conformance/tools/mo1306-phase2b -p test_gitlab.py -v
```

The caller supplies the retained validator directory and this tools directory
on `PYTHONPATH`; no network, GitLab account, runner, Linux, WSL or VM is needed.

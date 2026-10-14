# GitHub Phase 2C independent workflow validation

The retained golden and trusted bindings are independently authored from Contract
Freeze 1 sections 15, 16.1, 16.5 and 17. The validator does not import the product
generator. Pinned PyYAML 6.0.3 performs token/node parsing; the closed ordered
grammar checks types, keys, fixed values, expressions, pins, all six steps and
the six explicit upload paths. PowerShell 5.1 parses actual and independently
authored expected scripts, comparing AST node kinds and token/argument values
without executing submitted scripts. The decoder records the trusted launcher,
config/distribution identities, workspace, timeout, completion and publication.

`test_github.py` compares production bytes with the retained golden, tests config
path spaces, recursive input-key order permutations, defaults and 12 repeated
generations. It rejects every retained negative witness and three additional
PowerShell AST mutations. Five provider metadata attacks are rejected by the
bridge. Root Phase 2C native tests separately exercise completion, six/four file
cardinality, runtime identities, result revalidation, and semantic invariance.

The test regenerates the original workflow from immutable commit
`e1c990bf65d0c7925a68eea8222cd304f8ce6db6`, retains its bytes as diagnostic evidence,
confirms the missing Node bootstrap, hard-coded false completion, absent core
run-id output and directory upload, and requires independent validator rejection.
The original tiny substring suite checked none of these four obligations.

Run with Python 3.12.14 and `PYTHONPATH` pointing to the verified engineering
wheels extracted in `.cache/mo1306-phase2c/validators`; use the local frozen Node
24.21.0 executable. `test_github.py --output <Phase-2C-evidence-path>` retains the
mechanical report. `github_validator.py <workflow> --bindings <trusted-json>` is
the standalone validator. No provider API, SDK, hosted run, schema network
resolution or production dependency is involved. GitHub has no selected official
machine schema in this freeze; this validates the documented restricted subset.

The action inventory preserves the two frozen immutable revisions. A fresh
supply-chain/advisory review remains Phase 3B; hosted execution certification
remains Phase 3A. Status: IMPLEMENTED / HOSTED_EXECUTION_CERTIFICATION_PENDING.

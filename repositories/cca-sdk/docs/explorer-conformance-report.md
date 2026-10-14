# MO-1207 SDK Explorer Conformance

## Assessment

The JavaScript, Python, and C++ SDK surfaces delegate Cognitive Investigation
navigation to `InvestigationCore.investigate()`. No SDK implementation filters,
ranks, replays, recomputes, or explains regression evidence.

## Evidence

| Requirement | SDK evidence | Status |
| --- | --- | --- |
| One navigation authority | All language facades invoke the same private Core operation | Conformant |
| Existing report input | SDK report projections are transported intact; JavaScript and Python also accept parsed raw reports | Conformant |
| CLI report compatibility | Successful deterministic Regression JSON envelopes are unwrapped as transport only and then validated by Core | Conformant |
| Closed query | Only category, Reflection identity, and transition selectors cross the binding | Conformant |
| Deterministic output | All surfaces preserve the Core result and exact match ordering | Conformant |
| Evidence termination | Results expose the Core's exact report pointers and digests | Conformant |
| No investigation execution | The Explorer path performs no Trace, Replay, Evolution, or Comparison command | Conformant |
| Immutable values | JavaScript freezes results, Python uses frozen recursive values, and C++ exposes immutable value handles | Conformant |

## Automated coverage

- JavaScript verifies exact Core parity, immutability, raw-report input, CLI
  envelope input, empty matches, and invalid selectors.
- Python verifies typed queries, raw and envelope compatibility, immutable
  results, deterministic identity, and Core diagnostics.
- C++ verifies warnings-as-errors compilation, deterministic canonical JSON,
  matched and empty queries, and deterministic error propagation.
- Python and C++ executable examples are part of their automated suites.

## Conclusion

MO-1207 adds programmability for deterministic evidence navigation without
adding a second Explorer or changing any existing SDK behavior.

# MemoryOS Reference Implementation Guide

## Purpose

This informative guide identifies the MemoryOS 1.2 implementation assessed by
the MO-1208 conformance suite. It does not add requirements to MemoryOS
Standard 1.0. The normative publication is
`cca-specifications/specifications/CCA-MEMORYOS-1.0/`.

## Reference Implementation identity

| Item | Identity |
| --- | --- |
| Product | MemoryOS Reference Implementation |
| Product version | 1.2.1 |
| Standard target | CCA-MEMORYOS-1.0 |
| Conformance Suite | 1.0.0 |
| Runtime Foundation | CCA-RF-1.0 |
| MIP format | CCA-MIP-1.0 / 1.0.0 |
| Investigation Core | 1.0.0 |
| AI Runtime Adapter contract | 1.0.0 |
| SDK | 1.0.0 |
| CLI | 1.0.0 |
| Cognitive Regression | 1.0.0 |
| Cognitive Investigation Explorer | 1.0.0 |

The product, Standard, package, SDK, CLI, and suite versions are independent.
The matrix above is the assessed combination; matching version numbers do not
imply shared release cadence.

MemoryOS v1.2.0 remains the immutable initial historical assessment. v1.2.1
is the corrected Reference Implementation baseline and changes only source,
publication, and conformance provenance closure.

## Implementation map

| Standard boundary | Reference surface |
| --- | --- |
| Runtime Foundation | `repositories/cca-core/include/cca/runtime/`, `src/runtime/`, and Runtime tests |
| Memory capabilities | `repositories/cca-core/include/cca/memory/`, `src/memory/`, and capability tests |
| MIP Producer, Consumer, and Verifier | `repositories/cca-studio/web/js/mip-canonical.js` and `memory-investigation-package.js` |
| AI Runtime Adapters | `repositories/cca-studio/web/js/ai-runtime-adapter.js` and `web/js/adapters/` |
| Investigation Core | `repositories/cca-studio/web/js/investigation-core.js` and the released deterministic investigation modules |
| JavaScript SDK | `repositories/cca-studio/web/js/memoryos-sdk.js` |
| Python and C++ SDK | `repositories/cca-sdk/` |
| CLI | `repositories/memoryos-cli/` |
| Regression and Explorer | `repositories/cca-studio/web/js/cognitive-regression.js` and `cognitive-investigation-explorer.js` |
| Conformance evidence | `repositories/cca-conformance/` plus the component test suites it invokes |

The implementation remains split across these established repositories. The
conformance repository contains no cognitive or investigation behavior.

The bundled `requirements-manifest.json` is the current concrete manifest for
this Reference Implementation assessment. It is not the normative registry and
does not prescribe another implementation's paths, commands, execution IDs, or
test selectors. Immutable copies are retained by canonical digest under
`manifests/`.

## Authority flow

```text
Runtime truth
    -> Investigation Core
        -> public MemoryOS SDK
            -> Memory Studio
            -> MemoryOS CLI

MIP Producer / Consumer / Verifier
    -> Investigation Core package boundary

Investigation Core
    -> Cognitive Regression
        -> Cognitive Investigation Explorer
```

The renderer, SDK, CLI, and conformance harness consume established behavior.
They do not become alternate execution authorities.

## Build and verification

From the workspace root, run the JavaScript product suites through Node.js:

```console
npm --prefix repositories/cca-studio test
npm --prefix repositories/memoryos-cli test
npm --prefix repositories/cca-conformance test
```

The conformance package runner is not dependency-free: its SDK boundary suite
also requires Python 3.12 or newer. Set `MEMORYOS_CONFORMANCE_PYTHON` to the
interpreter when it is not discoverable as `python3` or `python`. Retained C2
evidence additionally requires the explicit native toolchain inputs documented
in the repository [README](../README.md).

The complete native assessment uses the configured workspace build:

```console
cmake --preset ci
cmake --build --preset ci
ctest --preset ci -L memoryos-standard
```

The workspace structure check remains:

```console
python tools/verify_workspace.py --root .
```

Exact results and requirement-level evidence are recorded in
[the conformance report](conformance-report.md).

## Implementation freedom

Another implementation may use different languages, processes, storage,
private data structures, or build tools. Conformance depends on the observable
requirements in CCA-MEMORYOS-1.0, not on reproducing this repository layout or
its internal mechanisms.

# CCA Memory Studio

`cca-studio` implements CP-011 as two deliberately separated surfaces:

- `cca::studio`, the frozen CCA-STUDIO-1.0 headless C++ Contract in
  `include/cca/memory/memory_studio.hpp`; and
- a dependency-free, responsive web presentation in `web/` that projects a
  detached Studio observation without becoming part of the public C++ API.

The C++ target depends only on `cca::memory`. It deep-copies caller-supplied
released values, preserves exact Workspace identity and deterministic order,
and implements `observe`, `inspect`, `trace`, `summarize`, `exportView`, and
`forgetSession`. It does not poll, persist, retrieve, mutate, or acquire
MemoryOS state.

MemoryOS 1.1 Sprint 1 extends only the downstream presentation. Accepted
detached observations become immutable frames in a stable semantic world;
layout is deterministic, Follow is ephemeral view state, and finite motion is
driven only by an actual observation delta. The frozen C++ Contract remains
unchanged.

Sprint 2 adds immutable Cognitive Traces over those frames. Selecting an
observed Reflection reconstructs each branch from the Reflection's own
detached candidate, typed knowledge value, and ordered evidence snapshots
before the renderer receives the result. The renderer never computes or
infers a trace, and current aggregates cannot rewrite historical provenance.

Sprint 3 adds the Living Connectome investigation identity without changing
either foundation. Fixed structural regions make cognitive geography
recognizable, Trace mode establishes an explicit origin-to-outcome hierarchy,
and manual Follow moves through validated membership only. No activity is
simulated and no semantic state is written by the presentation.

Sprint 4 adds deterministic Cognitive Replay. Replay reconstructs one
immutable Cognitive Trace as actual node and relationship references, one
semantic step at a time. The application owns the explicit Play/Pause
scheduler; the renderer receives completed replay state and never computes
events or ordering. Replay does not change the runtime or public C++ Contract.

## Build and verify

From the workspace root:

```text
cmake --preset ci
cmake --build --preset ci
ctest --preset ci -L studio
```

The Studio test inventory includes public behavior, lifecycle, ordering,
failure precedence, moved-from state, ownership and lifetime, exhaustive
allocation-failure campaigns, architecture-boundary checks, the executable
example, and the dependency-free presentation model.

## Run the presentation

With Node.js 20 or newer:

```text
node repositories/cca-studio/scripts/serve.mjs
```

Open `http://127.0.0.1:4173/`. The built-in reference observation is
deterministic and makes every MemoryOS scope reviewable without a backend. A
host can supply a real detached projection before loading `app.js`:

```js
globalThis.__CCA_STUDIO_SNAPSHOT__ = detachedStudioProjection;
globalThis.__CCA_STUDIO_COMMANDS__ = {
  observe: (view) => adapter.observe(view),
  inspect: (query) => adapter.inspect(query),
  trace: (query) => adapter.trace(query),
  summarize: (query) => adapter.summarize(query),
  exportView: () => adapter.exportView(),
  forgetSession: () => adapter.forgetSession(),
};
```

An injected adapter is accepted only when all six operations are present. The
adapter remains downstream of the frozen C++ Contract. It must preserve
exact identifiers, stored order, Workspace isolation, result codes,
observation paths, and explanation-chain boundaries.

## Documentation

- [Public API and behavior](docs/memory-studio.md)
- [Requirement and test evidence](docs/memory-studio-conformance-evidence.md)
- [MemoryOS 1.1 observable cognition foundation](docs/memoryos-1.1-sprint-1.md)
- [MemoryOS 1.1 Cognitive Trace architecture](docs/memoryos-1.1-sprint-2.md)
- [MemoryOS 1.1 Living Connectome identity](docs/memoryos-1.1-sprint-3.md)
- [MemoryOS 1.1 Cognitive Replay](docs/memoryos-1.1-sprint-4.md)
- [MemoryOS 1.0 launch demo production package](docs/memoryos-1.0-launch-demo-production-package.md)
- [GitHub screenshot specification](docs/github-screenshot-specification.md)
- [C++ example](examples/memory_studio_usage.cpp)

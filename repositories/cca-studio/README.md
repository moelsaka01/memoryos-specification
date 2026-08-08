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
- [C++ example](examples/memory_studio_usage.cpp)

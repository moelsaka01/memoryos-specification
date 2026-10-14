# AI runtime adapter reference vectors

The `*.events.json` files are provider-shaped private transport vectors used to
validate documented event lifecycles. `openai-agents.output.json` and
`langgraph.output.json` are their settled source-authored projections;
Anthropic settled content is reconstructed from its complete Messages stream.
`reference-sources.mjs` combines those offline values into the same source
surfaces accepted by the adapters.

No fixture requires an SDK, credential, network access, or live model. Matching
canonical packages live under `examples/ai-runtime-adapters/reference-packages`
and are verified byte-for-byte by `ai_runtime_adapter_test.mjs`.

The vectors intentionally contain only source-authored, package-permitted
content. Transport vectors are validation inputs, not MIP records. The fixtures
are examples of the adapter boundary, not recordings of private model activity
and not claims about a particular hosted model.

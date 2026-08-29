import { readFile } from "node:fs/promises";

export async function fixture(name, suffix = "events") {
  return JSON.parse(await readFile(new URL(`./${name}.${suffix}.json`, import.meta.url), "utf8"));
}

function asyncEventSource(events, properties) {
  return {
    ...properties,
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event;
    },
  };
}

export function openAIStream(events, output, overrides = {}) {
  return asyncEventSource(events, {
    cancelled: false,
    completed: Promise.resolve(),
    error: null,
    interruptions: [],
    output,
    ...overrides,
  });
}

export function langGraphStream(events, output, overrides = {}) {
  return asyncEventSource(events, {
    output: Promise.resolve(output),
    ...overrides,
  });
}

export async function referenceSource(name) {
  const events = await fixture(name);
  if (name === "openai-agents") return openAIStream(events, await fixture(name, "output"));
  if (name === "langgraph") return langGraphStream(events, await fixture(name, "output"));
  return events;
}

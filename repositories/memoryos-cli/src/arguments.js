import { argumentError } from "./errors.js";

const definitions = Object.freeze({
  version: { positionals: [0, 0], options: { json: "flag" } },
  help: { positionals: [0, 1], options: { json: "flag" } },
  observe: {
    positionals: [0, 0],
    required: ["workspace", "snapshot"],
    options: {
      workspace: "value",
      snapshot: "value",
      id: "value",
      operation: "value",
      query: "value",
      "result-code": "value",
      json: "flag",
    },
  },
  trace: {
    positionals: [1, 1],
    required: ["reflection"],
    options: { reflection: "value", id: "value", json: "flag" },
  },
  replay: {
    positionals: [1, 1],
    required: ["trace"],
    options: { trace: "value", action: "repeat", id: "value", json: "flag" },
  },
  compare: {
    positionals: [1, 1],
    required: ["trace", "evolution"],
    options: { trace: "value", evolution: "value", id: "value", json: "flag" },
  },
  regression: { positionals: [2, 2], options: { json: "flag" } },
  investigate: {
    positionals: [1, 1],
    options: {
      category: "value",
      reflection: "value",
      transition: "value",
      json: "flag",
    },
  },
  verify: { positionals: [1, 1], options: { json: "flag" } },
  import: { positionals: [1, 1], options: { id: "value", json: "flag" } },
  export: {
    positionals: [1, 1],
    required: ["output"],
    options: { output: "value", id: "value", json: "flag" },
  },
  inspect: { positionals: [1, 1], options: { id: "value", json: "flag" } },
  session: { positionals: [0, 1], options: { json: "flag" } },
});

function consumeOption(tokens, index, definition, options) {
  const token = tokens[index];
  const separator = token.indexOf("=");
  const name = token.slice(2, separator === -1 ? undefined : separator);
  const kind = definition.options[name];
  if (!kind) throw argumentError(`Unknown option --${name}.`);

  if (kind === "flag") {
    if (separator !== -1) throw argumentError(`Option --${name} does not accept a value.`);
    if (options[name] === true) throw argumentError(`Option --${name} was provided more than once.`);
    options[name] = true;
    return index;
  }

  const value = separator === -1 ? tokens[index + 1] : token.slice(separator + 1);
  if (separator === -1 && (value === undefined || value.startsWith("--"))) {
    throw argumentError(`Option --${name} requires a value.`);
  }
  if (value.length === 0) throw argumentError(`Option --${name} requires a non-empty value.`);
  if (kind !== "repeat" && options[name] !== undefined) {
    throw argumentError(`Option --${name} was provided more than once.`);
  }
  if (kind === "repeat") options[name] = [...(options[name] ?? []), value];
  else options[name] = value;
  return separator === -1 ? index + 1 : index;
}

export function parseArguments(argv) {
  const tokens = [...argv];
  if (tokens.length === 0 || tokens[0] === "--help" || tokens[0] === "-h") {
    return { command: "help", options: {}, positionals: [] };
  }
  if (tokens[0] === "--version" || tokens[0] === "-V") {
    return { command: "version", options: {}, positionals: [] };
  }

  const command = tokens.shift();
  const definition = definitions[command];
  if (!definition) throw argumentError(`Unknown command ${command}. Run 'memoryos help'.`);

  const options = {};
  const positionals = [];
  let positionalOnly = false;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!positionalOnly && token === "--") {
      positionalOnly = true;
    } else if (!positionalOnly && token.startsWith("--")) {
      index = consumeOption(tokens, index, definition, options);
    } else {
      positionals.push(token);
    }
  }

  const [minimum, maximum] = definition.positionals;
  if (positionals.length < minimum || positionals.length > maximum) {
    const expected = minimum === maximum ? String(minimum) : `${minimum}-${maximum}`;
    throw argumentError(`${command} expects ${expected} positional argument(s).`);
  }
  for (const name of definition.required ?? []) {
    if (options[name] === undefined) throw argumentError(`${command} requires --${name}.`);
  }
  return { command, options, positionals };
}

export const commandNames = Object.freeze(Object.keys(definitions));

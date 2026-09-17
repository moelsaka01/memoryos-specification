import { resolve } from "node:path";

import { argumentError } from "./errors.js";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const definitions = Object.freeze({
  validate: {
    positionals: 0,
    options: { policy: "value", "policy-set": "value", json: "flag" },
  },
  digest: {
    positionals: 0,
    options: {
      policy: "value",
      "policy-set": "value",
      "canonical-output": "value",
      json: "flag",
    },
  },
  inspect: {
    positionals: 0,
    options: {
      context: "value",
      "regression-source": "value",
      "regression-report": "value",
      "evaluation-identity": "value",
      outcome: "value",
      json: "flag",
    },
  },
  evaluate: {
    positionals: 0,
    options: {
      policy: "value",
      "policy-set": "value",
      package: "value",
      "regression-baseline": "value",
      outcome: "value",
      "identity-output": "value",
      "evaluation-identity-digest-output": "value",
      "outcome-digest-output": "value",
      json: "flag",
    },
  },
  "verify-identity": {
    positionals: 1,
    options: {
      mode: "value",
      "expected-evaluation-identity-digest": "value",
      policy: "value",
      "policy-set": "value",
      package: "value",
      "regression-baseline": "value",
      json: "flag",
    },
  },
  "verify-outcome": {
    positionals: 1,
    options: {
      mode: "value",
      "expected-identity": "value",
      "expected-evaluation-identity-digest": "value",
      "expected-outcome-digest": "value",
      policy: "value",
      "policy-set": "value",
      package: "value",
      "regression-baseline": "value",
      json: "flag",
    },
  },
  identities: { positionals: 0, options: { json: "flag" } },
});

function consumeOption(tokens, index, definition, options) {
  const token = tokens[index];
  const separator = token.indexOf("=");
  const name = token.slice(2, separator === -1 ? undefined : separator);
  const kind = definition.options[name];
  if (!kind) throw argumentError(`Unknown policy option --${name}.`);

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
  if (options[name] !== undefined) throw argumentError(`Option --${name} was provided more than once.`);
  options[name] = value;
  return separator === -1 ? index + 1 : index;
}

function exactlyOne(options, names, label) {
  const present = names.filter((name) => options[name] !== undefined);
  if (present.length !== 1) {
    throw argumentError(`${label} requires exactly one of ${names.map((name) => `--${name}`).join(" or ")}.`);
  }
}

function requireOption(options, name, label) {
  if (options[name] === undefined) throw argumentError(`${label} requires --${name}.`);
}

function forbid(options, names, label) {
  const present = names.find((name) => options[name] !== undefined);
  if (present !== undefined) throw argumentError(`${label} does not accept --${present}.`);
}

function requireDigest(options, name) {
  if (options[name] !== undefined && !DIGEST_PATTERN.test(options[name])) {
    throw argumentError(`Option --${name} must be 'sha256:' followed by 64 lowercase hexadecimal characters.`);
  }
}

function normalizedPath(path) {
  const value = resolve(path);
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function validateTransport(subcommand, options, positionals) {
  const inputOptions = [
    "policy", "policy-set", "context", "regression-source", "regression-report",
    "evaluation-identity", "package", "regression-baseline", "expected-identity",
  ];
  const inputs = [
    ...positionals,
    ...inputOptions.filter((name) => options[name] !== undefined).map((name) => options[name]),
  ];
  if (inputs.filter((value) => value === "-").length > 1) {
    throw argumentError(`policy ${subcommand} accepts at most one input from standard input.`);
  }

  const outputNames = subcommand === "digest"
    ? ["canonical-output"]
    : subcommand === "evaluate"
      ? [
        "outcome", "identity-output", "evaluation-identity-digest-output",
        "outcome-digest-output",
      ]
      : [];
  const outputs = outputNames
    .filter((name) => options[name] !== undefined)
    .map((name) => ({ name, path: options[name] }));

  for (const output of outputs) {
    if (output.path === "-" && output.name !== "outcome") {
      throw argumentError(`--${output.name} requires a filesystem path, not '-'.`);
    }
  }
  if (options.outcome === "-" && options.json === true) {
    throw argumentError("--json cannot be combined with --outcome -.");
  }

  const pathOutputs = outputs.filter(({ path }) => path !== "-");
  const outputKeys = pathOutputs.map(({ path }) => normalizedPath(path));
  if (new Set(outputKeys).size !== outputKeys.length) {
    throw argumentError("Policy output paths must be distinct.");
  }
  const inputKeys = new Set(inputs.filter((path) => path !== "-").map(normalizedPath));
  const collision = pathOutputs.find(({ path }) => inputKeys.has(normalizedPath(path)));
  if (collision !== undefined) {
    throw argumentError(`Output --${collision.name} must not overwrite an input path.`);
  }
}

function validateSemantics(subcommand, options) {
  const artifactOptions = ["policy", "policy-set"];
  if (subcommand === "validate" || subcommand === "digest" || subcommand === "evaluate") {
    exactlyOne(options, artifactOptions, `policy ${subcommand}`);
  }
  if (subcommand === "inspect") {
    exactlyOne(
      options,
      ["context", "regression-source", "regression-report", "evaluation-identity", "outcome"],
      "policy inspect",
    );
  }
  if (subcommand === "evaluate") {
    requireOption(options, "package", "policy evaluate");
    requireOption(options, "outcome", "policy evaluate");
  }

  if (subcommand === "verify-identity" || subcommand === "verify-outcome") {
    requireOption(options, "mode", `policy ${subcommand}`);
    if (!new Set(["artifact", "evaluation"]).has(options.mode)) {
      throw argumentError("--mode must be exactly 'artifact' or 'evaluation'.");
    }
  }

  if (subcommand === "verify-identity") {
    if (options.mode === "artifact") {
      requireOption(options, "expected-evaluation-identity-digest", "policy verify-identity --mode artifact");
      forbid(options, ["policy", "policy-set", "package", "regression-baseline"], "policy verify-identity --mode artifact");
    } else {
      exactlyOne(options, artifactOptions, "policy verify-identity --mode evaluation");
      requireOption(options, "package", "policy verify-identity --mode evaluation");
      forbid(options, ["expected-evaluation-identity-digest"], "policy verify-identity --mode evaluation");
    }
  }

  if (subcommand === "verify-outcome") {
    if (options.mode === "artifact") {
      exactlyOne(
        options,
        ["expected-identity", "expected-evaluation-identity-digest"],
        "policy verify-outcome --mode artifact",
      );
      forbid(options, ["policy", "policy-set", "package", "regression-baseline"], "policy verify-outcome --mode artifact");
    } else {
      exactlyOne(options, artifactOptions, "policy verify-outcome --mode evaluation");
      requireOption(options, "package", "policy verify-outcome --mode evaluation");
      forbid(options, ["expected-identity", "expected-evaluation-identity-digest"], "policy verify-outcome --mode evaluation");
    }
  }

  requireDigest(options, "expected-evaluation-identity-digest");
  requireDigest(options, "expected-outcome-digest");
}

export function parsePolicyArguments(argv) {
  const tokens = [...argv];
  const subcommand = tokens.shift();
  const definition = definitions[subcommand];
  if (!definition) {
    throw argumentError(
      subcommand === undefined
        ? "policy requires a subcommand."
        : `Unknown policy subcommand '${subcommand}'.`,
    );
  }

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
  if (positionals.length !== definition.positionals) {
    throw argumentError(`policy ${subcommand} expects ${definition.positionals} positional argument(s).`);
  }
  if (positionals.some((value) => value.length === 0)) {
    throw argumentError(`policy ${subcommand} requires non-empty artifact paths.`);
  }

  validateSemantics(subcommand, options);
  validateTransport(subcommand, options, positionals);
  return { command: "policy", subcommand, options, positionals };
}

export const policyCommandNames = Object.freeze(Object.keys(definitions));

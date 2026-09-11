import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import {
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import {
  decodeUtf8,
  parseStrictJson,
  sha256Hex,
} from "../web/js/mip-canonical.js";

const fixtureNames = [
  "minimal-observation.mip.b64",
  "complete-investigation.mip.b64",
  "noncritical-extension.mip.b64",
];

async function fixture(name) {
  const encoded = await readFile(new URL(`./fixtures/mip/${name}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

const schemaBytes = await fixture("memory-investigation-package-1.0.schema.json.b64");
const schema = parseStrictJson(decodeUtf8(schemaBytes));

function encodePointerToken(token) {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1");
}

function resolveReference(reference) {
  assert.match(reference, /^#(?:\/|$)/, `Only local schema references are supported: ${reference}`);
  return reference.slice(2).split("/").filter(Boolean).reduce(
    (value, token) => value[token.replaceAll("~1", "/").replaceAll("~0", "~")],
    schema,
  );
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateTime(value) {
  if (typeof value !== "string") return false;
  const pattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  return pattern.test(value) && Number.isFinite(Date.parse(value));
}

// Test-only, independent evaluator for every assertion keyword used by the
// frozen MIP-001 Draft 2020-12 schema. Semantic MIP rules remain covered by
// the package conformance tests rather than being duplicated here.
function schemaErrors(schemaNode, value, path = "") {
  if (schemaNode === true) return [];
  if (schemaNode === false) return [`${path || "/"}: false schema`];

  const errors = [];
  const report = (message) => errors.push(`${path || "/"}: ${message}`);

  if (schemaNode.$ref !== undefined) {
    errors.push(...schemaErrors(resolveReference(schemaNode.$ref), value, path));
  }

  if (schemaNode.allOf !== undefined) {
    for (const child of schemaNode.allOf) errors.push(...schemaErrors(child, value, path));
  }

  if (schemaNode.oneOf !== undefined) {
    const matches = schemaNode.oneOf.filter((child) => schemaErrors(child, value, path).length === 0);
    if (matches.length !== 1) report(`oneOf matched ${matches.length} branches`);
  }

  if (schemaNode.if !== undefined) {
    const conditionMatches = schemaErrors(schemaNode.if, value, path).length === 0;
    if (conditionMatches && schemaNode.then !== undefined) {
      errors.push(...schemaErrors(schemaNode.then, value, path));
    }
    if (!conditionMatches && schemaNode.else !== undefined) {
      errors.push(...schemaErrors(schemaNode.else, value, path));
    }
  }

  if (schemaNode.not !== undefined && schemaErrors(schemaNode.not, value, path).length === 0) {
    report("not schema matched");
  }

  if (schemaNode.type !== undefined) {
    const allowed = Array.isArray(schemaNode.type) ? schemaNode.type : [schemaNode.type];
    const actual = valueType(value);
    const matches = allowed.includes(actual) || (actual === "integer" && allowed.includes("number"));
    if (!matches) {
      report(`expected ${allowed.join("|")}, received ${actual}`);
      return errors;
    }
  }

  if (schemaNode.const !== undefined && !isDeepStrictEqual(value, schemaNode.const)) {
    report("const mismatch");
  }
  if (schemaNode.enum !== undefined && !schemaNode.enum.some((entry) => isDeepStrictEqual(entry, value))) {
    report("enum mismatch");
  }

  if (typeof value === "string") {
    const length = Array.from(value).length;
    if (schemaNode.minLength !== undefined && length < schemaNode.minLength) report("minLength");
    if (schemaNode.maxLength !== undefined && length > schemaNode.maxLength) report("maxLength");
    if (schemaNode.pattern !== undefined && !new RegExp(schemaNode.pattern, "u").test(value)) report("pattern");
    if (schemaNode.format === "date-time" && !isDateTime(value)) report("date-time format");
  }

  if (typeof value === "number") {
    if (schemaNode.minimum !== undefined && value < schemaNode.minimum) report("minimum");
    if (schemaNode.maximum !== undefined && value > schemaNode.maximum) report("maximum");
  }

  if (Array.isArray(value)) {
    if (schemaNode.minItems !== undefined && value.length < schemaNode.minItems) report("minItems");
    if (schemaNode.maxItems !== undefined && value.length > schemaNode.maxItems) report("maxItems");
    if (schemaNode.uniqueItems === true) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(0, index).some((entry) => isDeepStrictEqual(entry, value[index]))) {
          report(`uniqueItems at ${index}`);
        }
      }
    }
    const prefixLength = schemaNode.prefixItems?.length ?? 0;
    for (let index = 0; index < prefixLength && index < value.length; index += 1) {
      errors.push(...schemaErrors(schemaNode.prefixItems[index], value[index], `${path}/${index}`));
    }
    if (schemaNode.items !== undefined) {
      const start = schemaNode.prefixItems === undefined ? 0 : prefixLength;
      for (let index = start; index < value.length; index += 1) {
        errors.push(...schemaErrors(schemaNode.items, value[index], `${path}/${index}`));
      }
    }
  }

  if (isObject(value)) {
    for (const required of schemaNode.required ?? []) {
      if (!Object.hasOwn(value, required)) report(`missing required property ${required}`);
    }
    if (schemaNode.propertyNames !== undefined) {
      for (const name of Object.keys(value)) {
        errors.push(...schemaErrors(schemaNode.propertyNames, name, `${path}/${encodePointerToken(name)}`));
      }
    }
    const properties = schemaNode.properties ?? {};
    for (const [name, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, name)) {
        errors.push(...schemaErrors(propertySchema, value[name], `${path}/${encodePointerToken(name)}`));
      }
    }
    if (schemaNode.additionalProperties !== undefined) {
      for (const [name, child] of Object.entries(value)) {
        if (!Object.hasOwn(properties, name)) {
          errors.push(...schemaErrors(schemaNode.additionalProperties, child, `${path}/${encodePointerToken(name)}`));
        }
      }
    }
  }

  return errors;
}

function assertSchemaValid(value) {
  assert.deepEqual(schemaErrors(schema, value), []);
}

test("vendored MIP-001 schema is the exact frozen publication", () => {
  assert.equal(
    sha256Hex(schemaBytes),
    "beea4722bf0071f0c0cf3291cea1f99797f67dba81662cf0bc51f737f4016df6",
  );
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "urn:memoryos:mip:schema:1.0.0");
});

for (const name of fixtureNames) {
  test(`independent JSON Schema validation accepts published vector ${name}`, async () => {
    const bytes = await fixture(name);
    const value = parseStrictJson(decodeUtf8(bytes));
    assertSchemaValid(value);

    const imported = importMemoryInvestigationPackage(bytes);
    const exported = exportMemoryInvestigationPackage(imported);
    assertSchemaValid(parseStrictJson(decodeUtf8(exported)));
  });
}

test("independent JSON Schema validation rejects closed-core and profile violations", async () => {
  const original = parseStrictJson(decodeUtf8(await fixture(fixtureNames[0])));
  const cases = [
    (value) => { value.unknownRootMember = true; },
    (value) => { delete value.observations; },
    (value) => { value.formatVersion = "01.0.0"; },
    (value) => { value.verification.checks[0].code = "CANONICAL_BYTES"; },
    (value) => { value.verification.checks.push(value.verification.checks[0]); },
    (value) => { value.extensions.invalid = { critical: false, payload: {}, version: "1.0.0" }; },
    (value) => { value.metadata.createdAt = "2026-99-99T99:99:99Z"; },
  ];

  for (const mutate of cases) {
    const value = structuredClone(original);
    mutate(value);
    assert.ok(schemaErrors(schema, value).length > 0);
  }
});

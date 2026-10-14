import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function pointer(root, fragment) {
  if (fragment === "" || fragment === "#") return root;
  assert.match(fragment, /^#\//u, `unsupported JSON Schema reference fragment: ${fragment}`);
  return fragment.slice(2).split("/").reduce((value, token) => {
    const key = decodeURIComponent(token).replaceAll("~1", "/").replaceAll("~0", "~");
    assert.ok(value !== null && typeof value === "object" && Object.hasOwn(value, key), `unresolved JSON Schema pointer ${fragment}`);
    return value[key];
  }, root);
}

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

async function matches(value, schema, context, location) {
  try {
    await validate(value, schema, context, location);
    return true;
  } catch {
    return false;
  }
}

async function validate(value, schema, context, location) {
  assert.equal(schema !== null && typeof schema === "object" && !Array.isArray(schema), true, `${location}: schema must be an object`);
  if (schema.$ref) {
    const [relativePath, rawFragment = ""] = schema.$ref.split("#", 2);
    const absoluteIdentifier = /^[a-z][a-z0-9+.-]*:/iu.test(relativePath);
    const registered = absoluteIdentifier ? context.identifiers.get(relativePath) : null;
    assert.equal(
      absoluteIdentifier && !registered,
      false,
      `unresolved JSON Schema identifier ${relativePath}`,
    );
    const documentPath = registered
      ?? (relativePath ? resolve(dirname(context.documentPath), relativePath) : context.documentPath);
    let document = context.documents.get(documentPath);
    if (!document) {
      document = JSON.parse(await readFile(documentPath, "utf8"));
      context.documents.set(documentPath, document);
    }
    await validate(value, pointer(document, `#${rawFragment}`), { ...context, documentPath }, location);
    return;
  }
  if (schema.const !== undefined) assert.equal(canonical(value), canonical(schema.const), `${location}: const differs`);
  if (schema.enum) assert.ok(schema.enum.some((item) => canonical(item) === canonical(value)), `${location}: value is outside enum`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert.ok(types.some((type) => typeMatches(value, type)), `${location}: type differs`);
  }
  if (schema.anyOf) {
    const outcomes = await Promise.all(schema.anyOf.map((branch) => matches(value, branch, context, location)));
    assert.ok(outcomes.some(Boolean), `${location}: no anyOf branch matched`);
  }
  if (schema.allOf) {
    for (const branch of schema.allOf) await validate(value, branch, context, location);
  }
  if (schema.not) assert.equal(await matches(value, schema.not, context, location), false, `${location}: forbidden schema matched`);
  if (schema.if) {
    const selected = await matches(value, schema.if, context, location) ? schema.then : schema.else;
    if (selected) await validate(value, selected, context, location);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined) assert.ok([...value].length >= schema.minLength, `${location}: string is too short`);
    if (schema.maxLength !== undefined) assert.ok([...value].length <= schema.maxLength, `${location}: string is too long`);
    if (schema.pattern !== undefined) assert.match(value, new RegExp(schema.pattern, "u"), `${location}: pattern differs`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${location}: below minimum`);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${location}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${location}: too few items`);
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, `${location}: too many items`);
    if (schema.uniqueItems) assert.equal(new Set(value.map(canonical)).size, value.length, `${location}: duplicate items`);
    if (schema.prefixItems) {
      for (let index = 0; index < Math.min(value.length, schema.prefixItems.length); index += 1) {
        await validate(value[index], schema.prefixItems[index], context, `${location}/${index}`);
      }
    }
    if (schema.items && typeof schema.items === "object") {
      for (let index = 0; index < value.length; index += 1) {
        await validate(value[index], schema.items, context, `${location}/${index}`);
      }
    }
    if (schema.contains) {
      const outcomes = await Promise.all(value.map((item, index) => matches(item, schema.contains, context, `${location}/${index}`)));
      assert.ok(outcomes.some(Boolean), `${location}: contains did not match`);
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (schema.minProperties !== undefined) assert.ok(keys.length >= schema.minProperties, `${location}: too few properties`);
    if (schema.maxProperties !== undefined) assert.ok(keys.length <= schema.maxProperties, `${location}: too many properties`);
    for (const required of schema.required ?? []) assert.ok(Object.hasOwn(value, required), `${location}: missing ${required}`);
    if (schema.propertyNames) {
      for (const key of keys) await validate(key, schema.propertyNames, context, `${location}/<property-name>`);
    }
    for (const [key, propertySchema] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) await validate(value[key], propertySchema, context, `${location}/${key}`);
    }
    const declared = new Set(Object.keys(schema.properties ?? {}));
    const extra = keys.filter((key) => !declared.has(key));
    if (schema.additionalProperties === false) assert.deepEqual(extra, [], `${location}: additional properties are forbidden`);
    else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      for (const key of extra) await validate(value[key], schema.additionalProperties, context, `${location}/${key}`);
    }
  }
}

export async function validateJsonSchema(value, schemaPath) {
  const documentPath = resolve(schemaPath instanceof URL ? fileURLToPath(schemaPath) : schemaPath);
  const documents = new Map();
  const identifiers = new Map();
  for (const name of await readdir(dirname(documentPath))) {
    if (!name.endsWith(".json")) continue;
    const candidatePath = resolve(dirname(documentPath), name);
    const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
    documents.set(candidatePath, candidate);
    if (typeof candidate.$id === "string") identifiers.set(candidate.$id, candidatePath);
  }
  const schema = documents.get(documentPath) ?? JSON.parse(await readFile(documentPath, "utf8"));
  documents.set(documentPath, schema);
  if (typeof schema.$id === "string") identifiers.set(schema.$id, documentPath);
  const context = { documentPath, documents, identifiers };
  await validate(value, schema, context, "$");
  return value;
}

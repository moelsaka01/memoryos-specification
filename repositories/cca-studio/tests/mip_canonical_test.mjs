import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MipCanonicalError,
  canonicalize,
  cloneCanonical,
  decodeUtf8,
  deepFreeze,
  mipDigest,
  parseStrictJson,
  sha256Hex,
  utf8Encode,
} from "../web/js/mip-canonical.js";

async function fixture(name) {
  const encoded = await readFile(new URL(`./fixtures/mip/${name}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

function expectCode(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof MipCanonicalError);
    assert.equal(error.code, code);
    assert.equal(typeof error.path, "string");
    return true;
  });
}

test("strict UTF-8 round-trips Unicode and rejects BOM, malformed bytes, and lone surrogates", () => {
  const text = "Evidence → Reflection 😀";
  assert.equal(decodeUtf8(utf8Encode(text)), text);
  expectCode(() => decodeUtf8(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), "INVALID_UTF8_BOM");
  expectCode(() => decodeUtf8(new Uint8Array([0xc3, 0x28])), "INVALID_UTF8");
  expectCode(() => utf8Encode("\ud800"), "INVALID_UNICODE");
});

test("strict JSON parsing preserves exact members and reports duplicate names with paths", () => {
  const parsed = parseStrictJson('{"safe":1,"__proto__":{"owned":true},"nested":{"value":"ok"}}');
  assert.equal(parsed.safe, 1);
  assert.equal(Object.hasOwn(parsed, "__proto__"), true);
  assert.equal(parsed.__proto__.owned, true);
  assert.equal(Object.getPrototypeOf(parsed), Object.prototype);

  assert.throws(() => parseStrictJson('{"nested":{"same":1,"same":2}}'), (error) => {
    assert.equal(error.code, "DUPLICATE_MEMBER");
    assert.equal(error.path, '$["nested"]["same"]');
    assert.equal(error.line, 1);
    assert.ok(error.column > 1);
    return true;
  });
});

test("strict JSON rejects syntax extensions, invalid Unicode, and invalid MIP numbers", () => {
  expectCode(() => parseStrictJson('{"a":1,}'), "INVALID_JSON");
  expectCode(() => parseStrictJson('[1/* comment */]'), "INVALID_JSON");
  expectCode(() => parseStrictJson('"\\ud800"'), "INVALID_UNICODE");
  expectCode(() => parseStrictJson("-0"), "INVALID_NUMBER");
  expectCode(() => parseStrictJson("1e400"), "INVALID_NUMBER");
  expectCode(() => parseStrictJson("9007199254740992"), "INVALID_NUMBER");
  assert.equal(parseStrictJson("9007199254740991"), Number.MAX_SAFE_INTEGER);
});

test("canonical serialization follows RFC 8785 ordering and the MIP numeric subset", () => {
  const value = {
    "€": "Euro Sign",
    "\r": "Carriage Return",
    1: "One",
    "😀": "Emoji",
    ö: "Latin Small Letter O With Diaeresis",
    numbers: [333333333.33333329, 4.50, 2e-3, 1e-7, 1e-27],
  };
  assert.equal(
    canonicalize(value),
    '{"\\r":"Carriage Return","1":"One","numbers":[333333333.3333333,4.5,0.002,1e-7,1e-27],"ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji"}',
  );
});

test("canonical serialization rejects non-JSON and non-interoperable values", () => {
  expectCode(() => canonicalize(-0), "INVALID_NUMBER");
  expectCode(() => canonicalize(Number.NaN), "INVALID_NUMBER");
  expectCode(() => canonicalize(Number.POSITIVE_INFINITY), "INVALID_NUMBER");
  expectCode(() => canonicalize(9007199254740992), "INVALID_NUMBER");
  expectCode(() => canonicalize("\udfff"), "INVALID_UNICODE");
  expectCode(() => canonicalize({ missing: undefined }), "INVALID_JSON_VALUE");
  const sparse = [];
  sparse.length = 1;
  expectCode(() => canonicalize(sparse), "INVALID_JSON_VALUE");
  const cyclic = {};
  cyclic.self = cyclic;
  expectCode(() => canonicalize(cyclic), "CYCLIC_VALUE");
});

test("pure JavaScript SHA-256 and MIP domain separation match known vectors", () => {
  assert.equal(
    sha256Hex(""),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(
    mipDigest("record", '{"id":"evidence-001"}'),
    "sha256:b3b1fa4bfc1dfd68187171eeb7e1ec9eb68f1715a56137a774fc324df9672d7f",
  );
  assert.notEqual(mipDigest("record", "{}"), mipDigest("relationship", "{}"));
});

test("canonical clone and deep freeze produce detached immutable JSON values", () => {
  const original = { z: [3, 2, 1], a: { value: true } };
  const clone = cloneCanonical(original);
  assert.deepEqual(clone, original);
  assert.notEqual(clone, original);
  assert.notEqual(clone.a, original.a);
  deepFreeze(clone);
  assert.equal(Object.isFrozen(clone), true);
  assert.equal(Object.isFrozen(clone.z), true);
  assert.throws(() => clone.z.push(0), TypeError);
});

const goldenVectors = [
  {
    path: "minimal-observation.mip.b64",
    fileHash: "36cdf11919c58727cc3b5ec0293ffbb1716b57c35899cf06e1a92b130b6b9483",
    packageDigest: "sha256:0333b3e8dd64e14cc1b114546e49f221e95662e695d45e507b7d87ba8b2178ae",
    cognitionDigest: "sha256:80d486e661f8eea7cdd6c257fc706ffa729647879f891be13604e6bc177836e3",
  },
  {
    path: "complete-investigation.mip.b64",
    fileHash: "176b81ef6caecdd6db19caf5ae4e0cdd89fe1f30b43f79d485eb72c6e3b96f32",
    packageDigest: "sha256:0b786c02d37435efe1729d002428ca044175cedb83a9e262c24e18b2f73f1b15",
    cognitionDigest: "sha256:b434df4e88219aeefe722ddb6e658b7e156ec319e8f1b15b73c40a7820305dab",
  },
  {
    path: "noncritical-extension.mip.b64",
    fileHash: "824fbab80067a0f915cdceb8bc8cfc24e01978301603e1e22b490369e2934712",
    packageDigest: "sha256:eded105fd02ca5c66eb03a5aecc995f1560449846d673f0c8a6e7aaf7887a655",
    cognitionDigest: "sha256:80d486e661f8eea7cdd6c257fc706ffa729647879f891be13604e6bc177836e3",
  },
];

const sectionNames = [
  "manifest",
  "metadata",
  "observations",
  "traces",
  "replays",
  "evolutions",
  "comparativeReconstructions",
  "extensions",
  "verification",
];
const cognitionNames = new Set([
  "observations",
  "traces",
  "replays",
  "evolutions",
  "comparativeReconstructions",
]);

for (const vector of goldenVectors) {
  test(`published MIP vector ${vector.path} has canonical bytes and exact commitments`, async () => {
    const bytes = await fixture(vector.path);
    const text = decodeUtf8(bytes);
    const packageValue = parseStrictJson(text);
    assert.equal(canonicalize(packageValue), text);
    assert.equal(sha256Hex(bytes), vector.fileHash);
    assert.deepEqual(
      packageValue.integrity.sectionDigests.map(({ name }) => name),
      sectionNames,
    );

    for (const section of packageValue.integrity.sectionDigests) {
      assert.equal(
        section.digest,
        mipDigest("section", section.name, canonicalize(packageValue[section.name])),
      );
    }
    const cognitionSections = packageValue.integrity.sectionDigests
      .filter(({ name }) => cognitionNames.has(name));
    assert.equal(
      mipDigest("cognition", canonicalize(cognitionSections)),
      vector.cognitionDigest,
    );
    const packageCommitment = {
      $schema: packageValue.$schema,
      kind: packageValue.kind,
      formatVersion: packageValue.formatVersion,
      sectionDigests: packageValue.integrity.sectionDigests,
    };
    assert.equal(
      mipDigest("package", canonicalize(packageCommitment)),
      vector.packageDigest,
    );
    assert.equal(packageValue.integrity.packageDigest, vector.packageDigest);
    assert.equal(packageValue.integrity.cognitionDigest, vector.cognitionDigest);
  });
}

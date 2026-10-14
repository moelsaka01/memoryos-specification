// WORKSPACE_CHECK_CORRECTION (docs/mo1302-vendored-runtime-check-correction.md, MO-1308 Amendment A9).
// The vendored runtime of the released memoryos-vscode package is pinned to its release, not to the moving
// current source. Every vendored file must equal its bytes at the releasing tag, and the closure manifest must
// equal the released manifest. No git access is needed here: the pins are constants, and the MO-1308 A9
// correction test proves each constant equals the blob at the tag.
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const RELEASED_RUNTIME = Object.freeze({
  tag: "memoryos-1.3-mo1303",
  tagObject: "f3891cbac8a6ab804887a3d95a595c7bd1523af9",
  commit: "49aa80fa76bffc03e36335be8ab805bb5dc38f9c",
});

export const RELEASED_MANIFEST = Object.freeze({
  path: "runtime-closure-manifest.json",
  byteLength: 6512,
  sha256: "sha256:9b78149d2091056c80dce0f10e9d0a4eefbc180f3a17e62e96b6bfe7b1b1eeb8",
});

// [path under runtime/, byteLength, sha256] for each of the 37 vendored files at the tag.
export const RELEASED_VENDOR_PINS = Object.freeze([
  ["vendor/repositories/cca-studio/package.json", 1922, "sha256:d2f3cb58f4b854c658b63512aa7ef11a0cbc82fd0b889b0d152fdeba707258f4"],
  ["vendor/repositories/cca-studio/web/data/studio-snapshot.js", 10180, "sha256:0c1e3219e6ea16e0ba913ba089e9fff21813977e9f20d7f15396a7259c01a6b4"],
  ["vendor/repositories/cca-studio/web/js/cognitive-comparative-reconstruction.js", 11681, "sha256:9f41c7161673b1536c6748e95c062e8be650ada3a3d0c7cc2eb930e41e53a1c7"],
  ["vendor/repositories/cca-studio/web/js/cognitive-comparative-replay.js", 8004, "sha256:d50e3952a70ee3849b69929531313a7540e5c3b34f56c3d8ee3a712ac1fbf596"],
  ["vendor/repositories/cca-studio/web/js/cognitive-evolution-controller.js", 2730, "sha256:880df2ac0dab286655052b7e8057682b8d57db1c47c3be2e77ca01c245a8752d"],
  ["vendor/repositories/cca-studio/web/js/cognitive-evolution.js", 14080, "sha256:a417d84122642814efbb4862ac872a4ea58b1aebd8c73faed7c003a90b78b539"],
  ["vendor/repositories/cca-studio/web/js/cognitive-investigation-explorer.js", 11511, "sha256:cdb0dac0fe6d4e9c29f270ff8d97021713ee28b9a245bc6a12978f85da63995a"],
  ["vendor/repositories/cca-studio/web/js/cognitive-regression.js", 23419, "sha256:730c0740f54d75a1e007fee21bb5fe4ffb0f30de9b34e5c25a3651eb9500c3c4"],
  ["vendor/repositories/cca-studio/web/js/cognitive-replay.js", 6194, "sha256:2b02b5d7a5ad854c25e3f9bc676c8efd8de07a86e58242cdf1b95f79795d656a"],
  ["vendor/repositories/cca-studio/web/js/cognitive-trace.js", 25155, "sha256:c427986595c7a507cbc8863abc5eac3357baa905536f1fc22193ccbca13a2c9c"],
  ["vendor/repositories/cca-studio/web/js/deterministic-sequence-alignment.js", 5239, "sha256:b1b6fa20bb56612deebded48ebf30104d6b083d61ed33fa26651648a9effdcfc"],
  ["vendor/repositories/cca-studio/web/js/investigation-core.js", 57631, "sha256:f6d960591daf0411d44ebc18ad5a3afad7fc87b1598421ae32011a902dfa8806"],
  ["vendor/repositories/cca-studio/web/js/investigation-policy-contracts.js", 25861, "sha256:2448146319d18c2c7bc8113ece048cba25d5a793d450540767ff70d379522b10"],
  ["vendor/repositories/cca-studio/web/js/investigation-policy-engine.js", 62321, "sha256:97a62eaa58797f1d2d278ed450a9142c12b9e38d33c0a41acd36e926ac8094e3"],
  ["vendor/repositories/cca-studio/web/js/investigation-policy-integration.js", 28320, "sha256:65c6f6f1c32a6556a1993faecfd2e2735dc625e4e89bc293ad94615d842308dc"],
  ["vendor/repositories/cca-studio/web/js/investigation-policy.js", 25396, "sha256:951e7d481888eeebd3ce66ed1ef3c16bd592d975952100a22852d13080a2a3b0"],
  ["vendor/repositories/cca-studio/web/js/memory-investigation-package.js", 80144, "sha256:532830e1ec67cb8b069753f4d53e6a70cfc8786fca5a03b7146e4fcaee780f0c"],
  ["vendor/repositories/cca-studio/web/js/memoryos-sdk.js", 25111, "sha256:3d476156394045abc0eca5bf57309a743b1d8a7f332cf0788c22ed57e41c9d94"],
  ["vendor/repositories/cca-studio/web/js/mip-canonical.js", 25607, "sha256:0dd9dbaed8c3fdf92600dec4d998fe290dd9b2b83344198711ec88f0ec95fa68"],
  ["vendor/repositories/cca-studio/web/js/observation-timeline.js", 4350, "sha256:ba3c99d78c8170794cca6d53ebeaa5802922ae145759f262d8843fac6440b060"],
  ["vendor/repositories/cca-studio/web/js/policy-canonical.js", 27453, "sha256:be5a633d421f4d3885df7d438ad633a515675e1d49cfae889fe8452bd40f02f0"],
  ["vendor/repositories/cca-studio/web/js/policy-fact-context.js", 57247, "sha256:1d1110d8ceb0c5bf9d90369c8cf6f8cc114effa58325f6471ea41e93f64000a8"],
  ["vendor/repositories/cca-studio/web/js/regression-policy-fact-source.js", 34954, "sha256:05dd75bf4aeabd2da617add1c8e42922ca8f819d20c0032b0f03bf0db5aa30af"],
  ["vendor/repositories/cca-studio/web/js/semantic-world.js", 11244, "sha256:1d49a1efc103f1b987a8efc239720736d7c6c2db08ceb8e0f9ee94f539665031"],
  ["vendor/repositories/cca-studio/web/js/studio-model.js", 41908, "sha256:c04f82c15a2eb8727e3c00c7365ab3403f569ea08eced7f5b75ee3b8a488a84a"],
  ["vendor/repositories/memoryos-cli/package.json", 413, "sha256:d25a0e21883e916659f04ef1074c3ca069f6cc994641241eb350574a62406a02"],
  ["vendor/repositories/memoryos-cli/src/arguments.js", 4388, "sha256:de3d46d463d8ccff325aaa1e6163162917d48b950dcdaea6f736db39be2ba66b"],
  ["vendor/repositories/memoryos-cli/src/commands.js", 8439, "sha256:71d5ebe024d36a8f3fd16f973ddf01d4f217d6fc8b2635427b1a57e78e8cfa92"],
  ["vendor/repositories/memoryos-cli/src/errors.js", 6005, "sha256:1af18cd3d261805b01d6600df013de895f257cfa88075e03c9faf9e7632e3359"],
  ["vendor/repositories/memoryos-cli/src/help.js", 3310, "sha256:2420f2318060b3789f34da13e60d1dd2b9021a6dff298a7004a1d4039444de1a"],
  ["vendor/repositories/memoryos-cli/src/main.js", 2937, "sha256:cddef37e262da839fcd0ebf5b7efece7ed17b93533a433af08e788e7935091b9"],
  ["vendor/repositories/memoryos-cli/src/output.js", 4190, "sha256:7427907d2d7fcfcb0dfadc7b1e58150f3d4fe9009b272d62d718af61958bba86"],
  ["vendor/repositories/memoryos-cli/src/policy-arguments.js", 9285, "sha256:1fa54a028ccc549b262a09ab4ed7165806b83b114d256e93794498102e745d99"],
  ["vendor/repositories/memoryos-cli/src/policy-commands.js", 10582, "sha256:2d6f1cfa4b676613064f5f80681f9f6c1828018808c78881d7a74e5387f97670"],
  ["vendor/repositories/memoryos-cli/src/policy-publication.js", 3063, "sha256:b0172e84283a5c84e35ce3c6fd017bda8b9164a1b9c1f3300982c4eca3a3ac23"],
  ["vendor/repositories/memoryos-cli/src/session.js", 7086, "sha256:a3d92b5c963b86eac9b70fe360d86409565743a1cd580a1b9541316ce0ac6b1b"],
  ["vendor/repositories/memoryos-cli/src/version.js", 45, "sha256:11c277d8fdf8d63733afe9c90cfa0f40e42a94f6a3062e297b6366bc5adc48c6"],
].map((row) => Object.freeze(row)));

const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function listFiles(root, prefix = "") {
  const names = [];
  for (const name of readdirSync(join(root, prefix)).sort()) {
    const path = prefix === "" ? name : `${prefix}/${name}`;
    const metadata = lstatSync(join(root, path));
    if (metadata.isDirectory()) names.push(...listFiles(root, path));
    else names.push(path);
  }
  return names;
}

// Returns the list of violations (empty when `runtimeRoot` is exactly the released closure).
export function verifyReleasedRuntime(runtimeRoot) {
  const errors = [];
  const expected = [RELEASED_MANIFEST.path, ...RELEASED_VENDOR_PINS.map(([path]) => path)].sort();
  const actual = listFiles(runtimeRoot);
  for (const path of expected) if (!actual.includes(path)) errors.push(`removed: ${path}`);
  for (const path of actual) if (!expected.includes(path)) errors.push(`added: ${path}`);
  const check = (path, byteLength, sha256) => {
    let bytes;
    try {
      if (lstatSync(join(runtimeRoot, path)).isSymbolicLink()) { errors.push(`link: ${path}`); return; }
      bytes = readFileSync(join(runtimeRoot, path));
    } catch {
      return;
    }
    if (bytes.length !== byteLength || digest(bytes) !== sha256) errors.push(`differs from release: ${path}`);
  };
  check(RELEASED_MANIFEST.path, RELEASED_MANIFEST.byteLength, RELEASED_MANIFEST.sha256);
  for (const [path, byteLength, sha256] of RELEASED_VENDOR_PINS) check(path, byteLength, sha256);
  return errors;
}

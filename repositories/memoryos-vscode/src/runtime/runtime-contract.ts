export const RUNTIME_CLOSURE_MANIFEST_KIND = "MemoryOSVSCodeRuntimeClosureManifest";
export const RUNTIME_CLOSURE_MANIFEST_VERSION = "1.0.0";
export const RUNTIME_CLOSURE_MANIFEST_FILE = "runtime-closure-manifest.json";
export const RUNTIME_CLOSURE_DIGEST_DOMAIN = "MemoryOSVSCodeRuntimeClosureIdentity\u0000";
export const RUNTIME_CLI_MAIN = "vendor/repositories/memoryos-cli/src/main.js";

export const RUNTIME_CLOSURE_ENTRY_COUNT = 37;
export const RUNTIME_CLOSURE_INVENTORY_DIGEST =
  "sha256:2aed4a65a3697345c3da71a4716565e2eb5275021db7628a09b2103c78203542";
export const RUNTIME_CLOSURE_MANIFEST_RAW_SHA256 =
  "sha256:9b78149d2091056c80dce0f10e9d0a4eefbc180f3a17e62e96b6bfe7b1b1eeb8";
export const RUNTIME_CLOSURE_DIGEST =
  "sha256:41b01d85836e98e40577bdb63ae419b405f90ced84ee720c87a23ac7cf69fae3";

export const POLICY_CONTRACT_IDENTITIES_FILE = "policy-contract-identities-1.0.0.json";
export const POLICY_CONTRACT_IDENTITIES_BYTE_LENGTH = 932;
export const POLICY_CONTRACT_IDENTITIES_RAW_SHA256 =
  "sha256:2876d692d77b6ab369ca2933a4fb37fe25a1008818680a91396f66411f4580d7";

export const STDOUT_MAX_BYTES = 1_048_576;
export const STDERR_MAX_BYTES = 1_048_576;
export const WORKER_REQUEST_MAX_BYTES = 65_536;
export const WORKER_ARGV_MAX_COUNT = 32;
export const WORKER_ARG_MAX_BYTES = 8_192;

export const TRANSPORT_LIMITS = Object.freeze({
  mip: 524_288,
  policy: 2_048,
  policySet: 4_096,
});

export type TransportInputKind = keyof typeof TRANSPORT_LIMITS;

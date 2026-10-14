import { Buffer } from "node:buffer";

import * as vscode from "vscode";

export type MemoryOSVirtualDocumentKind =
  | "contractIdentities"
  | "evaluationIdentity"
  | "evaluationOutcome";

export interface VerifiedVirtualDocument {
  readonly kind: MemoryOSVirtualDocumentKind;
  readonly digest: string;
  readonly canonicalBytes: Uint8Array;
}

export interface MemoryOSEvaluationVirtualDocuments {
  readonly evaluationIdentity: vscode.Uri;
  readonly evaluationOutcome: vscode.Uri;
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const DOCUMENT_LIMITS: Readonly<Record<MemoryOSVirtualDocumentKind, number>> = Object.freeze({
  contractIdentities: 65_536,
  evaluationIdentity: 65_536,
  // Existing frozen MO-1301 normative outcome limit, not an extension input limit.
  evaluationOutcome: 4_060,
});
const KIND_PATH: Readonly<Record<MemoryOSVirtualDocumentKind, string>> = Object.freeze({
  contractIdentities: "contract-identities",
  evaluationIdentity: "evaluation-identity",
  evaluationOutcome: "evaluation-outcome",
});

interface StoredDocument {
  readonly kind: MemoryOSVirtualDocumentKind;
  readonly bytes: Uint8Array;
  readonly content: string;
  readonly uri: vscode.Uri;
}

function prepareDocument(document: VerifiedVirtualDocument): StoredDocument {
  if (!DIGEST_PATTERN.test(document.digest)) {
    throw new Error("A verified virtual document requires a lowercase sha256 digest.");
  }
  const bytes = Uint8Array.from(document.canonicalBytes);
  if (bytes.byteLength > DOCUMENT_LIMITS[document.kind]) {
    throw new Error(`The verified ${document.kind} document exceeds its frozen bound.`);
  }
  const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const uri = vscode.Uri.from({
    scheme: "memoryos",
    authority: "verified",
    path: `/${KIND_PATH[document.kind]}/${document.digest.slice(7)}.json`,
  });
  return Object.freeze({ bytes, content, kind: document.kind, uri });
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.from(left).equals(Buffer.from(right));
}

/** Read-only exact-byte provider. It never pretty-prints or rewrites content. */
export class MemoryOSVirtualDocumentProvider
implements vscode.TextDocumentContentProvider, vscode.Disposable {
  readonly #changeEmitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.#changeEmitter.event;
  #documents = new Map<string, StoredDocument>();
  #disposed = false;

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    return this.#documents.get(uri.toString(true))?.content;
  }

  publishContractIdentities(document: VerifiedVirtualDocument): vscode.Uri {
    if (document.kind !== "contractIdentities") {
      throw new Error("Contract publication requires contractIdentities bytes.");
    }
    const [published] = this.#publishTransaction([document], new Set(["contractIdentities"]));
    if (published === undefined) throw new Error("Contract virtual-document publication failed.");
    return published;
  }

  replaceEvaluationGeneration(
    identity: VerifiedVirtualDocument,
    outcome: VerifiedVirtualDocument,
  ): MemoryOSEvaluationVirtualDocuments {
    if (identity.kind !== "evaluationIdentity" || outcome.kind !== "evaluationOutcome") {
      throw new Error("An evaluation generation requires identity and outcome documents.");
    }
    const [identityUri, outcomeUri] = this.#publishTransaction(
      [identity, outcome],
      new Set(["evaluationIdentity", "evaluationOutcome"]),
    );
    if (identityUri === undefined || outcomeUri === undefined) {
      throw new Error("Evaluation virtual-document publication failed.");
    }
    return Object.freeze({ evaluationIdentity: identityUri, evaluationOutcome: outcomeUri });
  }

  replaceVerifiedEvaluationArtifact(document: VerifiedVirtualDocument): vscode.Uri {
    if (document.kind !== "evaluationIdentity" && document.kind !== "evaluationOutcome") {
      throw new Error("Verified evaluation-artifact publication requires identity or outcome bytes.");
    }
    const [published] = this.#publishTransaction(
      [document],
      new Set(["evaluationIdentity", "evaluationOutcome"]),
    );
    if (published === undefined) throw new Error("Verified virtual-document publication failed.");
    return published;
  }

  #publishTransaction(
    documents: readonly VerifiedVirtualDocument[],
    replacedKinds: ReadonlySet<MemoryOSVirtualDocumentKind>,
  ): readonly vscode.Uri[] {
    if (this.#disposed) throw new Error("The MemoryOS virtual-document provider is disposed.");
    const prepared = documents.map(prepareDocument);
    const transactionUris = new Set<string>();
    for (const item of prepared) {
      const key = item.uri.toString(true);
      if (transactionUris.has(key)) throw new Error("Duplicate virtual document in publication.");
      transactionUris.add(key);
      const existing = this.#documents.get(key);
      if (existing !== undefined && !sameBytes(existing.bytes, item.bytes)) {
        throw new Error("A normative digest cannot identify different virtual-document bytes.");
      }
    }

    const next = new Map<string, StoredDocument>();
    const changedUris: vscode.Uri[] = [];
    for (const [key, existing] of this.#documents) {
      if (replacedKinds.has(existing.kind)) changedUris.push(existing.uri);
      else next.set(key, existing);
    }
    for (const item of prepared) {
      next.set(item.uri.toString(true), item);
      changedUris.push(item.uri);
    }

    // One reference swap makes the complete generation visible atomically.
    this.#documents = next;
    for (const uri of changedUris) this.#changeEmitter.fire(uri);
    return Object.freeze(prepared.map(({ uri }) => uri));
  }

  clear(): void {
    if (this.#disposed || this.#documents.size === 0) return;
    const uris = [...this.#documents.values()].map(({ uri }) => uri);
    this.#documents = new Map();
    for (const uri of uris) this.#changeEmitter.fire(uri);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
    this.#changeEmitter.dispose();
  }
}

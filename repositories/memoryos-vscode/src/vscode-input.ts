import { basename } from "node:path";

import * as vscode from "vscode";

import {
  MEMORYOS_VSCODE_ADAPTER_ERROR_CODES,
  MemoryOSAdapterError,
} from "./errors.js";
import { sanitizePresentationText } from "./presentation/sanitize.js";
import type { LocalFileInput } from "./runtime/input-snapshot.js";

export type ExplicitArtifactRole =
  | "policy"
  | "policySet"
  | "candidateMip"
  | "baselineMip"
  | "evaluationIdentity"
  | "expectedEvaluationIdentity"
  | "policyOutcome";

export interface SelectedLocalArtifact {
  readonly input: LocalFileInput;
  readonly sourceUri: vscode.Uri;
}

const STATIC_ROLE_LABELS: Readonly<Record<ExplicitArtifactRole, string>> = Object.freeze({
  baselineMip: "Regression baseline MIP",
  candidateMip: "Candidate MIP",
  evaluationIdentity: "Evaluation Identity",
  expectedEvaluationIdentity: "Expected Evaluation Identity",
  policy: "Policy",
  policyOutcome: "Policy Outcome",
  policySet: "Policy Set",
});

function unsupported(message: string): MemoryOSAdapterError {
  return new MemoryOSAdapterError(
    MEMORYOS_VSCODE_ADAPTER_ERROR_CODES.INPUT_UNSUPPORTED,
    message,
  );
}

export function assertSupportedVSCodeHost(): void {
  if (vscode.env.uiKind !== vscode.UIKind.Desktop || vscode.env.remoteName !== undefined) {
    throw unsupported("MemoryOS v1 requires a local VS Code Desktop Extension Host.");
  }
  if (vscode.workspace.workspaceFolders?.some(({ uri }) => uri.scheme !== "file") === true) {
    throw unsupported("MemoryOS v1 does not support virtual workspace folders.");
  }
}

function sameUri(left: vscode.Uri, right: vscode.Uri): boolean {
  return left.toString(true) === right.toString(true);
}

function selectedInput(uri: vscode.Uri): SelectedLocalArtifact {
  const document = vscode.workspace.textDocuments.find((candidate) => sameUri(candidate.uri, uri));
  const untitled = uri.scheme === "untitled" || document?.isUntitled === true;
  const dirty = document?.isDirty === true;
  if (untitled) {
    throw unsupported("Untitled documents cannot be authoritative MemoryOS input.");
  }
  if (dirty) {
    throw unsupported("Save the selected document before using it as authoritative MemoryOS input.");
  }
  if (uri.scheme !== "file") {
    throw unsupported("Only explicitly selected local file: artifacts are supported.");
  }
  return Object.freeze({
    input: Object.freeze({
      dirty,
      fsPath: uri.fsPath,
      scheme: uri.scheme,
      untitled,
    }),
    sourceUri: uri,
  });
}

/** Recheck editor authority immediately before a semantic dispatch. */
export function revalidateSelectedLocalArtifact(
  artifact: SelectedLocalArtifact,
): SelectedLocalArtifact {
  return selectedInput(artifact.sourceUri);
}

function safeFileDetail(uri: vscode.Uri): string {
  return sanitizePresentationText(basename(uri.fsPath), 160);
}

function dialogFilters(role: ExplicitArtifactRole): Record<string, string[]> {
  if (role === "candidateMip" || role === "baselineMip") {
    return { "Memory Investigation Package (hint)": ["mip"], "All local files": ["*"] };
  }
  return { "JSON artifact (hint)": ["json"], "All local files": ["*"] };
}

/**
 * Select exactly one local artifact without inferring its semantic kind from
 * the file name or a workspace relationship. A command-supplied Explorer URI
 * is already an explicit selection. Otherwise the active editor is offered as
 * a choice, never silently adopted.
 */
export async function selectLocalArtifact(
  role: ExplicitArtifactRole,
  suppliedUri?: vscode.Uri,
): Promise<SelectedLocalArtifact | undefined> {
  assertSupportedVSCodeHost();
  if (suppliedUri !== undefined) return selectedInput(suppliedUri);

  const activeDocument = vscode.window.activeTextEditor?.document;
  const choices: Array<vscode.QuickPickItem & { readonly source: "active" | "dialog" }> = [];
  if (activeDocument !== undefined) {
    choices.push({
      description: safeFileDetail(activeDocument.uri),
      label: "Use saved active editor",
      source: "active",
    });
  }
  choices.push({ label: "Choose a local file…", source: "dialog" });
  const choice = await vscode.window.showQuickPick(choices, {
    ignoreFocusOut: true,
    placeHolder: `Select the ${STATIC_ROLE_LABELS[role]} source`,
    title: `MemoryOS: Select ${STATIC_ROLE_LABELS[role]}`,
  });
  if (choice === undefined) return undefined;
  if (choice.source === "active" && activeDocument !== undefined) {
    return selectedInput(activeDocument.uri);
  }
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: dialogFilters(role),
    openLabel: `Select ${STATIC_ROLE_LABELS[role]}`,
    title: `MemoryOS: Select ${STATIC_ROLE_LABELS[role]}`,
  });
  const uri = selected?.[0];
  return uri === undefined ? undefined : selectedInput(uri);
}

export async function selectPolicyKind(): Promise<"policy" | "policySet" | undefined> {
  assertSupportedVSCodeHost();
  const selected = await vscode.window.showQuickPick([
    { artifactKind: "policy" as const, label: "Policy" },
    { artifactKind: "policySet" as const, label: "Policy Set" },
  ], {
    ignoreFocusOut: true,
    placeHolder: "Choose the artifact kind explicitly",
    title: "MemoryOS: Artifact Kind",
  });
  return selected?.artifactKind;
}

export async function selectVerificationMode(): Promise<"artifact" | "evaluation" | undefined> {
  assertSupportedVSCodeHost();
  const selected = await vscode.window.showQuickPick([
    {
      description: "Verify the serialized artifact against explicit expected identity data",
      label: "Artifact",
      mode: "artifact" as const,
    },
    {
      description: "Reacquire Policy and MIP authority and verify by reconstruction",
      label: "Evaluation",
      mode: "evaluation" as const,
    },
  ], {
    ignoreFocusOut: true,
    placeHolder: "Choose the verification mode explicitly",
    title: "MemoryOS: Verification Mode",
  });
  return selected?.mode;
}

export async function selectOptionalBaseline(): Promise<boolean | undefined> {
  const selected = await vscode.window.showQuickPick([
    { label: "No baseline", selected: false },
    { label: "Select baseline MIP", selected: true },
  ], {
    ignoreFocusOut: true,
    placeHolder: "Choose whether trusted Regression facts are required",
    title: "MemoryOS: Optional Regression Baseline",
  });
  return selected?.selected;
}

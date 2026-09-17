import * as vscode from "vscode";

import type { MemoryOSNavigationRegistry, PossessedArtifactNavigation } from "./navigation.js";
import {
  boundedPresentationJson,
  sanitizePresentationLabel,
  sanitizePresentationText,
} from "./sanitize.js";
import type {
  MemoryOSDecision,
  MemoryOSEvaluationPresentation,
  MemoryOSPolicyEvidence,
  MemoryOSPolicyPresentation,
  MemoryOSPresentationField,
  MemoryOSPresentationSnapshot,
  MemoryOSRulePresentation,
} from "./types.js";

export interface MemoryOSTreeNode {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
  readonly icon?: string;
  readonly children: readonly MemoryOSTreeNode[];
  readonly navigation?: PossessedArtifactNavigation;
}

function node(
  id: string,
  label: string,
  options: {
    readonly description?: string;
    readonly tooltip?: string;
    readonly icon?: string;
    readonly children?: readonly MemoryOSTreeNode[];
    readonly navigation?: PossessedArtifactNavigation;
  } = {},
): MemoryOSTreeNode {
  const value: MemoryOSTreeNode = {
    id,
    label: sanitizePresentationLabel(label),
    ...(options.description === undefined
      ? {} : { description: sanitizePresentationText(options.description) }),
    ...(options.tooltip === undefined
      ? {} : { tooltip: sanitizePresentationText(options.tooltip, 1_024) }),
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    children: Object.freeze([...(options.children ?? [])]),
    ...(options.navigation === undefined ? {} : { navigation: options.navigation }),
  };
  return Object.freeze(value);
}

function fields(id: string, values: readonly MemoryOSPresentationField[]): readonly MemoryOSTreeNode[] {
  return Object.freeze(values.map((field, index) => node(
    `${id}/field/${index}`,
    field.name,
    { description: field.value, tooltip: `${field.name}: ${field.value}` },
  )));
}

function navigationNode(
  id: string,
  navigation: PossessedArtifactNavigation,
): MemoryOSTreeNode {
  return node(id, navigation.label, {
    description: "Open whole artifact",
    tooltip: "Open the possessed artifact. This does not claim a source byte range.",
    icon: "go-to-file",
    navigation,
  });
}

function decisionIcon(decision: MemoryOSDecision): string {
  switch (decision) {
    case "PASS": return "check";
    case "FAIL": return "error";
    case "COULD_NOT_EVALUATE": return "question";
  }
}

function evidenceSourceNodes(
  id: string,
  evidence: Exclude<MemoryOSPolicyEvidence, { readonly kind: "MemoryOSDeterministicFactSourceAbsence" }>,
): readonly MemoryOSTreeNode[] {
  const source = evidence.source;
  if (source.kind === "policyFactContext") {
    return Object.freeze([
      node(`${id}/source-kind`, "Source kind", { description: source.kind }),
      node(`${id}/context-digest`, "Context digest", { description: source.contextDigest }),
    ]);
  }
  return Object.freeze([
    node(`${id}/source-kind`, "Source kind", { description: source.kind }),
    node(`${id}/external-source-digest`, "External source digest", {
      description: source.externalSourceDigest,
    }),
  ]);
}

function evidenceNode(
  id: string,
  presented: MemoryOSRulePresentation["evidence"][number],
  index: number,
): MemoryOSTreeNode {
  const evidence = presented.evidence;
  const children: MemoryOSTreeNode[] = [
    node(`${id}/kind`, "Kind", { description: evidence.kind }),
    node(`${id}/domain`, "Domain", { description: evidence.domain }),
  ];

  switch (evidence.kind) {
    case "MemoryOSPolicyFactReference":
      children.push(...evidenceSourceNodes(id, evidence));
      if (evidence.source.kind === "deterministicFactSource") {
        children.push(node(`${id}/fact-domain`, "Fact domain", {
          description: evidence.factDomain,
        }));
      }
      children.push(node(`${id}/fact-identifier`, "Fact identifier", {
        description: evidence.factIdentifier,
      }));
      break;
    case "MemoryOSPolicyFactSelection": {
      children.push(...evidenceSourceNodes(id, evidence));
      if (evidence.source.kind === "deterministicFactSource") {
        children.push(node(`${id}/fact-domain`, "Fact domain", {
          description: evidence.factDomain,
        }));
      }
      children.push(node(`${id}/selector`, "Selector", {
        children: [
          node(`${id}/selector/identifier`, "Identifier", {
            description: evidence.selector.identifier,
          }),
          node(`${id}/selector/version`, "Version", { description: evidence.selector.version }),
          node(`${id}/selector/parameters`, "Parameters", {
            description: boundedPresentationJson(evidence.selector.parameters),
          }),
        ],
      }));
      children.push(node(`${id}/match-count`, "Match count", {
        description: String(evidence.matchCount),
      }));
      children.push(node(`${id}/matched-identifiers`, "Matched fact identifiers", {
        // The verified source order is intentionally not sorted.
        children: evidence.matchedFactIdentifiers.map((identifier, matchedIndex) => node(
          `${id}/matched-identifiers/${matchedIndex}`,
          String(matchedIndex + 1),
          { description: identifier },
        )),
      }));
      break;
    }
    case "MemoryOSPolicyFactDomainState":
      children.push(...evidenceSourceNodes(id, evidence));
      children.push(node(`${id}/availability`, "Availability", {
        description: evidence.availability,
      }));
      break;
    case "MemoryOSDeterministicFactSourceAbsence":
      children.push(node(`${id}/absence`, "Source state", {
        description: "not supplied",
      }));
      break;
  }

  return node(id, `Evidence ${index + 1}: ${evidence.kind}`, {
    children,
    navigation: presented.navigation,
  });
}

function ruleNode(id: string, rule: MemoryOSRulePresentation, index: number): MemoryOSTreeNode {
  const details: MemoryOSTreeNode[] = [
    node(`${id}/identifier`, "Rule identity", { description: rule.ruleIdentifier }),
    node(`${id}/type`, "Rule type", { description: rule.ruleType }),
    node(`${id}/version`, "Rule version", { description: rule.ruleVersion }),
    node(`${id}/decision`, "Decision", {
      description: rule.decision,
      icon: decisionIcon(rule.decision),
    }),
  ];
  if (rule.decisionCode !== undefined) {
    details.push(node(`${id}/decision-code`, "Decision code", {
      description: rule.decisionCode,
    }));
  }
  details.push(node(`${id}/evidence`, "Evidence", {
    children: rule.evidence.map((item, evidenceIndex) => evidenceNode(
      `${id}/evidence/${evidenceIndex}`,
      item,
      evidenceIndex,
    )),
  }));
  return node(id, `${index + 1}. ${rule.ruleIdentifier}`, {
    description: rule.decision,
    icon: decisionIcon(rule.decision),
    children: details,
  });
}

function policyNode(id: string, policy: MemoryOSPolicyPresentation, index: number): MemoryOSTreeNode {
  return node(id, `${index + 1}. ${policy.policyIdentifier}`, {
    description: policy.decision,
    icon: decisionIcon(policy.decision),
    children: [
      node(`${id}/semantic-digest`, "Semantic digest", {
        description: policy.policySemanticDigest,
      }),
      node(`${id}/rules`, "Rules", {
        // The evaluated order is intentionally not sorted.
        children: policy.rules.map((rule, ruleIndex) => ruleNode(
          `${id}/rules/${ruleIndex}`,
          rule,
          ruleIndex,
        )),
      }),
    ],
  });
}

function evaluationNodes(evaluation: MemoryOSEvaluationPresentation): readonly MemoryOSTreeNode[] {
  const summaryChildren: MemoryOSTreeNode[] = [
    node("evaluation/decision", "Decision", {
      description: evaluation.decision,
      icon: decisionIcon(evaluation.decision),
    }),
    node("evaluation/artifact-kind", "Artifact kind", { description: evaluation.artifactKind }),
    node("evaluation/artifact-identifier", "Artifact identifier", {
      description: evaluation.artifactIdentifier,
    }),
    node("evaluation/semantic-digest", "Semantic digest", {
      description: evaluation.semanticDigest,
    }),
    node("evaluation/identity-digest", "Evaluation Identity digest", {
      description: evaluation.evaluationIdentityDigest,
    }),
    node("evaluation/outcome-digest", "Outcome digest", {
      description: evaluation.outcomeDigest,
    }),
    ...(evaluation.resultFields === undefined
      ? []
      : fields("evaluation/result", evaluation.resultFields)),
    node("evaluation/artifacts", "Artifacts", {
      children: [
        ...evaluation.selectedArtifacts.map((item, index) => navigationNode(
          `evaluation/artifacts/selected/${index}`,
          item,
        )),
        navigationNode("evaluation/artifacts/identity", evaluation.identityDocument),
        navigationNode("evaluation/artifacts/outcome", evaluation.outcomeDocument),
      ],
    }),
  ];
  const result: MemoryOSTreeNode[] = [node("evaluation", "Evaluation Summary", {
    description: evaluation.decision,
    icon: decisionIcon(evaluation.decision),
    children: summaryChildren,
  })];

  if (evaluation.artifactKind === "Policy Set") {
    result.push(node("evaluation/policies", "Policies", {
      // Authored/evaluated child order is intentionally not sorted.
      children: evaluation.policies.map((policy, index) => policyNode(
        `evaluation/policies/${index}`,
        policy,
        index,
      )),
    }));
  } else {
    const rules = evaluation.policies[0]?.rules ?? [];
    result.push(node("evaluation/rules", "Rules", {
      children: rules.map((rule, index) => ruleNode(
        `evaluation/rules/${index}`,
        rule,
        index,
      )),
    }));
  }
  return Object.freeze(result);
}

function materialize(snapshot: MemoryOSPresentationSnapshot): readonly MemoryOSTreeNode[] {
  const roots: MemoryOSTreeNode[] = [];
  if (snapshot.contracts !== undefined) {
    roots.push(node("contracts", "Contracts", {
      children: [
        ...fields("contracts", snapshot.contracts.fields),
        ...(snapshot.contracts.document === undefined
          ? [] : [navigationNode("contracts/document", snapshot.contracts.document)]),
      ],
    }));
  }
  if (snapshot.preparedArtifact !== undefined) {
    const prepared = snapshot.preparedArtifact;
    roots.push(node("prepared", "Prepared Artifact", {
      description: prepared.state,
      icon: "check",
      children: [
        node("prepared/kind", "Kind", { description: prepared.artifactKind }),
        node("prepared/document-digest", "Document digest", {
          description: prepared.documentDigest,
        }),
        node("prepared/semantic-digest", "Semantic digest", {
          description: prepared.semanticDigest,
        }),
        navigationNode("prepared/source", prepared.sourceArtifact),
      ],
    }));
  }
  if (snapshot.evaluation !== undefined) roots.push(...evaluationNodes(snapshot.evaluation));
  if (snapshot.verification !== undefined) {
    const verification = snapshot.verification;
    roots.push(node("verification", "Verification", {
      description: verification.state,
      icon: "verified",
      children: [
        node("verification/target", "Target", { description: verification.target }),
        node("verification/mode", "Mode", { description: verification.mode }),
        ...fields("verification", verification.fields),
        ...(verification.document === undefined
          ? [] : [navigationNode("verification/document", verification.document)]),
      ],
    }));
  }
  return Object.freeze(roots);
}

/** Native, ordered, atomically replaced MemoryOS Results tree model. */
export class MemoryOSResultsTreeProvider
implements vscode.TreeDataProvider<MemoryOSTreeNode>, vscode.Disposable {
  readonly #changeEmitter = new vscode.EventEmitter<MemoryOSTreeNode | undefined>();
  readonly onDidChangeTreeData = this.#changeEmitter.event;
  #roots: readonly MemoryOSTreeNode[] = Object.freeze([]);
  #disposed = false;

  constructor(readonly navigation: MemoryOSNavigationRegistry) {}

  getTreeItem(element: MemoryOSTreeNode): vscode.TreeItem {
    const collapsibleState = element.children.length === 0
      ? vscode.TreeItemCollapsibleState.None
      : vscode.TreeItemCollapsibleState.Collapsed;
    const item = new vscode.TreeItem(element.label, collapsibleState);
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip;
    if (element.icon !== undefined) item.iconPath = new vscode.ThemeIcon(element.icon);
    if (element.navigation !== undefined) item.command = this.navigation.openCommand(element.navigation);
    return item;
  }

  getChildren(element?: MemoryOSTreeNode): MemoryOSTreeNode[] {
    return [...(element?.children ?? this.#roots)];
  }

  replace(snapshot: MemoryOSPresentationSnapshot): void {
    if (this.#disposed) throw new Error("The MemoryOS results provider is disposed.");
    const candidate = materialize(snapshot);
    this.#roots = candidate;
    this.#changeEmitter.fire(undefined);
  }

  clear(): void {
    if (this.#disposed || this.#roots.length === 0) return;
    this.#roots = Object.freeze([]);
    this.#changeEmitter.fire(undefined);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
    this.#changeEmitter.dispose();
  }
}

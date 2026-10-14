"""Offline Jenkins parser positives and retained adversarial mutation corpus."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys
import unittest

from jenkins_validator import (
    Agent, Checkout, JenkinsValidationError, Lexer, Options, PARSER_ID,
    PARSER_VERSION, PipelineParser, PowerShell, validate_jenkins,
)

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "mo1306" / "phase2b"
GOLDEN_PATH = FIXTURES / "jenkins-golden.Jenkinsfile"
CORPUS_PATH = FIXTURES / "jenkins-negative-corpus.json"
GOLDEN = GOLDEN_PATH.read_bytes()
LABEL = "windows-agent"
CONFIG_DIGEST = "sha256:" + "a" * 64
DISTRIBUTION_DIGEST = "sha256:" + "b" * 64
CORPUS = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))["cases"]


def mutated_bytes(case):
    operation = case["operation"]
    if operation == "replace":
        before, after = case["find"].encode("utf-8"), case["replace"].encode("utf-8")
        if not before or GOLDEN.count(before) != 1:
            raise AssertionError(f"negative {case['id']} does not target one unique source span")
        result = GOLDEN.replace(before, after, 1)
    elif operation == "suffix":
        result = GOLDEN + case["value"].encode("utf-8")
    elif operation == "prefixHex":
        result = bytes.fromhex(case["value"]) + GOLDEN
    elif operation == "removeFinalLF":
        result = GOLDEN[:-1]
    elif operation == "prefixSpaces":
        result = b" " * case["value"] + GOLDEN
    else:
        raise AssertionError(f"unknown mutation operation {operation}")
    if result == GOLDEN:
        raise AssertionError(f"negative {case['id']} did not mutate golden")
    return result


def run_negative_corpus():
    """Return auditable per-case rejection receipts; fail if any mutation passes."""
    ids, rows = set(), []
    for case in CORPUS:
        if case["id"] in ids:
            raise AssertionError("duplicate negative case id")
        ids.add(case["id"])
        data = mutated_bytes(case)
        try:
            validate_jenkins(data, LABEL, CONFIG_DIGEST, DISTRIBUTION_DIGEST)
        except JenkinsValidationError as error:
            rows.append({"id": case["id"], "category": case["category"], "status": "PASS",
                         "rejected": True, "diagnostic": str(error),
                         "byteLength": len(data), "sha256": "sha256:" + hashlib.sha256(data).hexdigest()})
        else:
            raise AssertionError(f"negative accepted: {case['id']}")
    return rows


def report():
    rows = run_negative_corpus()
    return {"kind": "MemoryOSCICDJenkinsParserValidation", "version": "1.0.0",
            "parser": {"id": PARSER_ID, "version": PARSER_VERSION},
            "negativeCount": len(rows), "negativeResult": "PASS",
            "categories": dict(sorted(Counter(row["category"] for row in rows).items())),
            "cases": rows,
            "identities": [{"path": str(path.name), "byteLength": path.stat().st_size,
                            "sha256": "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()}
                           for path in (Path(__file__).with_name("jenkins_validator.py"),
                                        Path(__file__), GOLDEN_PATH, CORPUS_PATH,
                                        FIXTURES / "jenkins-grammar.ebnf")]}


class JenkinsParserTests(unittest.TestCase):
    def test_independent_golden_to_launch(self):
        launch = validate_jenkins(GOLDEN, LABEL, CONFIG_DIGEST, DISTRIBUTION_DIGEST)
        self.assertEqual(launch["provider"], "jenkins")
        self.assertEqual(launch["runner"], "scripts/Invoke-MemoryOSCI.ps1")
        self.assertEqual(launch["runnerCapability"], "MEMORYOS_CI_HOME")
        self.assertEqual(launch["workspaceCapability"], "WORKSPACE")
        self.assertEqual(launch["configurationCapability"], "MEMORYOS_CI_CONFIG")
        self.assertEqual(launch["nodeCapability"], "MEMORYOS_CI_NODE")
        self.assertEqual(launch["configurationDigest"], CONFIG_DIGEST)
        self.assertEqual(launch["distributionDigest"], DISTRIBUTION_DIGEST)
        self.assertEqual(launch["timeoutMinutes"], 5)
        self.assertEqual(launch["metadataMapping"], {
            "repository": "JOB_NAME", "revision": "GIT_COMMIT", "runId": "BUILD_NUMBER",
            "jobId": "BUILD_TAG", "attempt": None, "event": None, "changeRequest": "CHANGE_ID"})

    def test_actual_closed_ast(self):
        tokens = Lexer(GOLDEN.decode("utf-8")).tokens()
        self.assertIn("SCRIPT", {token.kind for token in tokens})
        tree = PipelineParser(tokens).parse()
        self.assertEqual(tree.agent, Agent(LABEL))
        self.assertEqual(tree.options, Options(True, 5, "MINUTES"))
        self.assertEqual(len(tree.stages), 1)
        self.assertEqual(tree.stages[0].name, "MemoryOS Policy")
        self.assertEqual(tree.stages[0].steps[0], Checkout("scm"))
        self.assertIsInstance(tree.stages[0].steps[1], PowerShell)
        self.assertEqual(tree.stages[0].steps[1].encoding, "UTF-8")

    def test_minimum_and_maximum_labels(self):
        for label in ("a", "9_-", "a" * 64):
            data = GOLDEN.replace(LABEL.encode(), label.encode())
            self.assertEqual(validate_jenkins(data, label, CONFIG_DIGEST, DISTRIBUTION_DIGEST)["agentLabel"], label)

    def test_literal_pins_bind_independent_expected_input(self):
        config, distribution = "sha256:" + "1" * 64, "sha256:" + "2" * 64
        data = GOLDEN.replace(CONFIG_DIGEST.encode(), config.encode()).replace(DISTRIBUTION_DIGEST.encode(), distribution.encode())
        launch = validate_jenkins(data, LABEL, config, distribution)
        self.assertEqual((launch["configurationDigest"], launch["distributionDigest"]), (config, distribution))
        with self.assertRaises(JenkinsValidationError):
            validate_jenkins(data, LABEL, CONFIG_DIGEST, DISTRIBUTION_DIGEST)

    def test_expected_context_rejected_before_parse(self):
        for label, config, distribution in (("../agent", CONFIG_DIGEST, DISTRIBUTION_DIGEST),
                                           (LABEL, "${CONFIG_PIN}", DISTRIBUTION_DIGEST),
                                           (LABEL, CONFIG_DIGEST, "sha256:abc")):
            with self.assertRaises(JenkinsValidationError):
                validate_jenkins(GOLDEN, label, config, distribution)

    def test_truncated_prefixes_fail_closed(self):
        # Every truncation, including a previously complete string/token boundary,
        # must be rejected with the public validation error, not an index error.
        for length in range(len(GOLDEN)):
            with self.assertRaises(JenkinsValidationError):
                validate_jenkins(GOLDEN[:length], LABEL, CONFIG_DIGEST, DISTRIBUTION_DIGEST)


def _case_test(case):
    def test(self):
        data = mutated_bytes(case)
        with self.assertRaises(JenkinsValidationError):
            validate_jenkins(data, LABEL, CONFIG_DIGEST, DISTRIBUTION_DIGEST)
    return test


for _case in CORPUS:
    setattr(JenkinsParserTests, "test_negative_" + _case["id"].replace("-", "_"), _case_test(_case))


if __name__ == "__main__":
    if sys.argv[1:] == ["--report"]:
        print(json.dumps(report(), sort_keys=True, separators=(",", ":")))
    else:
        unittest.main()

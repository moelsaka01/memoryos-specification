"""Independent golden and retained adversarial GitLab corpus tests."""
import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from referencing.exceptions import NoSuchResource

from gitlab_validator import (
    FIXTURES, GitLabValidationError, audit_schema, deny_retrieval,
    official_validator, parse_yaml, validate_gitlab, validate_official,
)

GOLDEN = FIXTURES / 'phase2b' / 'gitlab-golden.yml'
CORPUS = FIXTURES / 'phase2b' / 'gitlab-negatives.json'
CONFIG = 'sha256:' + '1' * 64
DISTRIBUTION = 'sha256:' + '2' * 64
LABEL = 'windows_2022'


def mutate(base, case):
    if 'replace' in case:
        before, after = case['replace'].encode(), case['with'].encode()
        if base.count(before) != 1:
            raise AssertionError('negative mutation target must occur exactly once: ' + case['id'])
        return base.replace(before, after, 1)
    if 'prefixHex' in case:
        return bytes.fromhex(case['prefixHex']) + base
    if 'suffixHex' in case:
        return base + bytes.fromhex(case['suffixHex'])
    if case.get('trimFinalLf'):
        return base[:-1]
    if 'prefixRepeat' in case:
        return case['prefixRepeat'].encode() * case['count'] + base
    raise AssertionError('unknown retained mutation')


class GitLabTests(unittest.TestCase):
    def test_independent_golden_descriptor(self):
        result = validate_gitlab(GOLDEN.read_bytes(), LABEL, CONFIG, DISTRIBUTION)
        self.assertEqual(result['provider'], 'gitlab')
        self.assertEqual(result['runner'], 'scripts/Invoke-MemoryOSCI.ps1')
        self.assertEqual(result['workspaceCapability'], 'CI_PROJECT_DIR')
        self.assertEqual(result['configurationDigest'], CONFIG)
        self.assertEqual(result['distributionDigest'], DISTRIBUTION)
        self.assertEqual(result['timeoutMinutes'], 5)
        self.assertEqual(result['metadataMapping']['event'], 'CI_PIPELINE_SOURCE')

    def test_official_schema_positive(self):
        _, mapping = parse_yaml(GOLDEN.read_bytes())
        validate_official(mapping)

    def test_official_schema_rejects_invalid_types(self):
        _, mapping = parse_yaml(GOLDEN.read_bytes())
        for field, value in [('stage', 0), ('script', [0]), ('retry', 'forever')]:
            with self.subTest(field=field):
                changed = copy.deepcopy(mapping)
                changed['memoryos_policy'][field] = value
                with self.assertRaises(GitLabValidationError):
                    validate_official(changed)

    def test_schema_vocabulary_and_local_references(self):
        _, audit = official_validator()
        self.assertEqual(audit['referenceCount'], 141)
        self.assertEqual(audit['remoteReferenceCount'], 0)
        self.assertIn('oneOf', audit['assertions'])
        self.assertIn('patternProperties', audit['assertions'])
        self.assertIn('markdownDescription', audit['annotations'])
        self.assertEqual(audit['formats'], ['date-time', 'regex', 'uri', 'uri-reference'])
        self.assertEqual(audit, json.loads((FIXTURES / 'phase2b' / 'gitlab-schema-audit.json').read_text(encoding='utf-8')))

    def test_unsupported_schema_assertion_rejected(self):
        with self.assertRaisesRegex(GitLabValidationError, 'unsupported schema assertion'):
            audit_schema({'futureAssertion': True})

    def test_remote_reference_rejected_without_retrieval(self):
        with self.assertRaisesRegex(GitLabValidationError, 'nonlocal schema reference'):
            audit_schema({'$ref': 'https://example.invalid/schema.json'})

    def test_empty_registry_retrieval_fails_closed(self):
        with self.assertRaises(NoSuchResource):
            deny_retrieval('https://example.invalid/schema.json')

    def test_schema_tampering_fails_identity(self):
        official_validator.cache_clear()
        try:
            with patch('gitlab_validator.SCHEMA_PATH') as schema_path:
                schema_path.read_bytes.return_value = b'{}\n'
                with self.assertRaisesRegex(GitLabValidationError, 'pinned schema identity mismatch'):
                    official_validator()
        finally:
            official_validator.cache_clear()

    def test_valid_label_boundaries(self):
        for label in ['A', '_', '-', 'x' * 64]:
            with self.subTest(label=label):
                artifact = GOLDEN.read_bytes().replace(LABEL.encode(), label.encode())
                self.assertEqual(validate_gitlab(artifact, label, CONFIG, DISTRIBUTION)['runnerTag'], label)

    def test_offline_and_no_constructor(self):
        # Parsing must succeed even if construction and network are made unusable.
        with patch('yaml.constructor.BaseConstructor.construct_document', side_effect=AssertionError('constructor called')), patch('socket.socket', side_effect=AssertionError('network called')):
            validate_gitlab(GOLDEN.read_bytes(), LABEL, CONFIG, DISTRIBUTION)

    def test_supported_subset_stricter_than_official(self):
        _, mapping = parse_yaml(GOLDEN.read_bytes())
        mapping['memoryos_policy']['before_script'] = ['whoami']
        validate_official(mapping)
        injected = GOLDEN.read_bytes().replace(b'  retry: 0', b"  retry: 0\\n  before_script:\\n    - 'whoami'")
        with self.assertRaises(GitLabValidationError):
            validate_gitlab(injected, LABEL, CONFIG, DISTRIBUTION)

    def test_trusted_arguments_fail_closed(self):
        for label, config, distribution in [('a\\nb', CONFIG, DISTRIBUTION), (LABEL, 'sha256:' + 'A' * 64, DISTRIBUTION), (LABEL, CONFIG, '$TOKEN')]:
            with self.subTest(label=label, config=config, distribution=distribution):
                with self.assertRaises(GitLabValidationError):
                    validate_gitlab(GOLDEN.read_bytes(), label, config, distribution)


def add_negative_tests():
    corpus = json.loads(CORPUS.read_text(encoding='utf-8'))
    ids = [case['id'] for case in corpus['cases']]
    if len(ids) != len(set(ids)):
        raise AssertionError('duplicate corpus case IDs')
    for case in corpus['cases']:
        def run(self, case=case):
            with self.assertRaises(GitLabValidationError):
                validate_gitlab(mutate(GOLDEN.read_bytes(), case), LABEL, CONFIG, DISTRIBUTION)
        setattr(GitLabTests, 'test_negative_' + case['id'].replace('-', '_'), run)


add_negative_tests()

if __name__ == '__main__':
    unittest.main()

"""Independent offline GitLab token/AST and complete Draft-07 validation.

Engineering only. PyYAML scanner/composer nodes never invoke constructors.
No imports from production generator, schema retrieval, or script execution.
"""
from collections import Counter
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import re

from jsonschema import Draft7Validator
from referencing import Registry
from referencing.exceptions import NoSuchResource
import yaml
from yaml.nodes import MappingNode, ScalarNode, SequenceNode

FIXTURES = Path(__file__).resolve().parents[2] / 'fixtures' / 'mo1306'
SCHEMA_PATH = FIXTURES / 'gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json'
SCHEMA_SHA256 = 'a4dc2b155aa574575fbfd51dcca99388db5ba1b563ab5e05ce8df005e7eb9ced'
SCHEMA_LENGTH = 128034
ANNOTATIONS = frozenset({'description', 'markdownDescription', 'default', 'examples', 'format'})
CORE_KEYWORDS = frozenset({'$schema', '$id', 'definitions'})
SCHEMA_MAPS = frozenset({'definitions', 'properties', 'patternProperties', 'dependencies'})
SCHEMA_ARRAYS = frozenset({'allOf', 'anyOf', 'oneOf'})
SCHEMA_CHILDREN = frozenset({'items', 'additionalItems', 'additionalProperties', 'not', 'if', 'then', 'else', 'contains', 'propertyNames'})


class GitLabValidationError(ValueError):
    """Untrusted artifact, schema, or unsupported assertion rejected."""


def require(condition, message):
    if not condition:
        raise GitLabValidationError(message)


def deny_retrieval(uri):
    raise NoSuchResource(ref=uri)


def audit_schema(schema):
    """Audit schema positions, distinguishing keyword and property names."""
    vocabulary, formats, references = Counter(), set(), []

    def visit(node):
        if isinstance(node, bool):
            return
        require(isinstance(node, dict), 'schema node must be object or boolean')
        for key, value in node.items():
            vocabulary[key] += 1
            require(key in Draft7Validator.VALIDATORS or key in ANNOTATIONS or key in CORE_KEYWORDS or key in {'then', 'else'}, 'unsupported schema assertion: ' + key)
            if key == '$ref':
                require(isinstance(value, str) and value.startswith('#/'), 'nonlocal schema reference')
                target = schema
                try:
                    for segment in value[2:].split('/'):
                        target = target[segment.replace('~1', '/').replace('~0', '~')]
                except (KeyError, TypeError) as exc:
                    raise GitLabValidationError('unresolved local schema reference') from exc
                require(isinstance(target, (dict, bool)), 'reference target is not a schema')
                references.append(value)
            if key == 'format':
                formats.add(value)
            if key == '$id':
                require(node is schema and value == 'https://gitlab.com/.gitlab-ci.yml', 'unexpected schema identity or nested base')
            if key in SCHEMA_MAPS:
                for child in value.values():
                    if key != 'dependencies' or not isinstance(child, list):
                        visit(child)
            elif key in SCHEMA_ARRAYS:
                for child in value:
                    visit(child)
            elif key in SCHEMA_CHILDREN:
                for child in value if isinstance(value, list) else [value]:
                    visit(child)

    visit(schema)
    return {
        'assertions': sorted(set(vocabulary) - ANNOTATIONS - CORE_KEYWORDS),
        'annotations': sorted(set(vocabulary) & ANNOTATIONS),
        'coreKeywords': sorted(set(vocabulary) & CORE_KEYWORDS),
        'vocabularyCounts': dict(sorted(vocabulary.items())),
        'referenceCount': len(references), 'uniqueReferences': sorted(set(references)),
        'remoteReferenceCount': 0, 'formats': sorted(formats),
        'formatPolicy': 'Draft-07 optional annotation; formatted instance fields excluded by closed MO-1306 subset; no format downloads',
    }


@lru_cache(maxsize=1)
def official_validator():
    data = SCHEMA_PATH.read_bytes()
    require(len(data) == SCHEMA_LENGTH and hashlib.sha256(data).hexdigest() == SCHEMA_SHA256, 'pinned schema identity mismatch')
    schema = json.loads(data.decode('utf-8'))
    require(schema.get('$schema') == 'http://json-schema.org/draft-07/schema#', 'schema draft mismatch')
    audit = audit_schema(schema)
    Draft7Validator.check_schema(schema)
    return Draft7Validator(schema, registry=Registry(retrieve=deny_retrieval)), audit


def validate_official(mapping):
    validator, _ = official_validator()
    errors = list(validator.iter_errors(mapping))
    require(not errors, 'official GitLab Draft-07 validation failed' + (': ' + errors[0].message if errors else ''))


def parse_yaml(data):
    require(isinstance(data, bytes) and 0 < len(data) <= 32768, 'artifact byte bound/type')
    try:
        text = data.decode('utf-8', errors='strict')
    except UnicodeDecodeError as exc:
        raise GitLabValidationError('invalid UTF-8') from exc
    require(text.endswith('\n') and not text.endswith('\n\n'), 'exactly one final LF required')
    require(all(c == '\n' or 32 <= ord(c) <= 126 for c in text), 'forbidden control/non-ASCII artifact character')
    require('#' not in text, 'comments/directives are outside fixed artifact')
    for line in text.splitlines():
        require(bool(line), 'blank lines are outside fixed artifact')
        require(not line.endswith(' '), 'trailing whitespace')
        require((len(line) - len(line.lstrip(' '))) % 2 == 0, 'two-space indentation required')
    banned = (yaml.tokens.AliasToken, yaml.tokens.AnchorToken, yaml.tokens.TagToken,
              yaml.tokens.DirectiveToken, yaml.tokens.FlowSequenceStartToken,
              yaml.tokens.FlowMappingStartToken, yaml.tokens.DocumentStartToken,
              yaml.tokens.DocumentEndToken)
    try:
        tokens = list(yaml.scan(text, Loader=yaml.BaseLoader))
        require(len(tokens) <= 256, 'token bound')
        require(not any(isinstance(token, banned) for token in tokens), 'forbidden YAML token')
        for token in tokens:
            if isinstance(token, yaml.tokens.ScalarToken):
                if token.style == '|':
                    require(text[token.start_mark.index:].split('\n', 1)[0] == '|', 'fixed literal block indicator required')
                else:
                    require(token.start_mark.line == token.end_mark.line, 'multiline ordinary scalar forbidden')
        documents = list(yaml.compose_all(text, Loader=yaml.BaseLoader))
        require(len(documents) == 1, 'single document required')
    except yaml.YAMLError as exc:
        raise GitLabValidationError('malformed YAML') from exc

    def convert(node, depth=0):
        require(depth <= 8, 'AST depth bound')
        if isinstance(node, MappingNode):
            require(not node.flow_style, 'flow mapping')
            result = {}
            for key, value in node.value:
                require(isinstance(key, ScalarNode) and key.style is None, 'plain scalar mapping key required')
                require(key.value not in result and key.value != '<<', 'duplicate/merge key')
                result[key.value] = convert(value, depth + 1)
            return result
        if isinstance(node, SequenceNode):
            require(not node.flow_style, 'flow sequence')
            return [convert(value, depth + 1) for value in node.value]
        require(isinstance(node, ScalarNode), 'unsupported AST node')
        if node.style is None:
            if node.value == 'false':
                return False
            if node.value == '0':
                return 0
            raise GitLabValidationError('ordinary string must be explicitly single-quoted')
        require(node.style in ("'", '|'), 'unsupported scalar style')
        return node.value

    return documents[0], convert(documents[0])


def validate_gitlab(data: bytes, label: str, config_digest: str, distribution_digest: str):
    """Return independent normalized launch descriptor or reject."""
    require(isinstance(label, str) and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', label), 'invalid trusted runner label')
    for pin in (config_digest, distribution_digest):
        require(isinstance(pin, str) and re.fullmatch(r'sha256:[0-9a-f]{64}', pin), 'invalid trusted digest')
    root, value = parse_yaml(data)
    validate_official(value)
    require(isinstance(value, dict) and list(value) == ['stages', 'memoryos_policy'], 'top-level key order/subset')
    require(value['stages'] == ['test'], 'exactly one test stage')
    job = value['memoryos_policy']
    require(isinstance(job, dict) and list(job) == ['stage', 'tags', 'when', 'allow_failure', 'timeout', 'retry', 'script'], 'job key order/subset')
    require(job['stage'] == 'test' and job['tags'] == [label], 'stage/runner substitution')
    require(job['when'] == 'manual' and job['allow_failure'] is False, 'manual fail-closed job required')
    require(job['timeout'] == '5m' and type(job['retry']) is int and job['retry'] == 0, 'deadline/retry substitution')
    require(isinstance(job['script'], list) and len(job['script']) == 1, 'single script required')
    # Independent literal reviewed against section 16.1; never imported from adapter.
    expected_lines = [
        '$status = 16', 'try {',
        "  & (Join-Path $env:MEMORYOS_CI_HOME 'scripts/Invoke-MemoryOSCI.ps1') -Provider 'gitlab' -Workspace $env:CI_PROJECT_DIR -ConfigurationDigest '" + config_digest + "' -DistributionDigest '" + distribution_digest + "'",
        '  $status = $LASTEXITCODE', '} finally {', '  exit $status', '}',
    ]
    script = job['script'][0]
    require(script == '\n'.join(expected_lines) + '\n', 'fixed launcher/script/pin mismatch')
    top = dict((key.value, node) for key, node in root.value)
    job_nodes = dict((key.value, node) for key, node in top['memoryos_policy'].value)
    require(all(key.start_mark.column == 0 for key, _ in root.value), 'top-level indentation')
    require(all(key.start_mark.column == 2 for key, _ in top['memoryos_policy'].value), 'job indentation')
    require(top['stages'].value[0].style == "'" and top['stages'].value[0].start_mark.column == 4, 'stage sequence format')
    require(job_nodes['tags'].value[0].style == "'" and job_nodes['tags'].value[0].start_mark.column == 6, 'tag sequence format')
    require(job_nodes['script'].value[0].style == '|' and job_nodes['script'].value[0].start_mark.column == 6, 'literal script block required')
    require(all(job_nodes[key].style == "'" for key in ('stage', 'when', 'timeout')), 'quoted ordinary strings required')
    require(all(job_nodes[key].style is None for key in ('allow_failure', 'retry')), 'literal boolean/integer required')
    return {
        'provider': 'gitlab', 'runner': 'scripts/Invoke-MemoryOSCI.ps1',
        'runnerCapability': 'MEMORYOS_CI_HOME', 'workspaceCapability': 'CI_PROJECT_DIR',
        'configurationCapability': 'MEMORYOS_CI_CONFIG', 'nodeCapability': 'MEMORYOS_CI_NODE',
        'configurationDigest': config_digest, 'distributionDigest': distribution_digest,
        'runnerTag': label, 'timeoutMinutes': 5,
        'metadataMapping': {'repository': 'CI_PROJECT_PATH', 'revision': 'CI_COMMIT_SHA', 'runId': 'CI_PIPELINE_ID', 'jobId': 'CI_JOB_ID', 'attempt': None, 'event': 'CI_PIPELINE_SOURCE', 'changeRequest': 'CI_MERGE_REQUEST_IID'},
        'publication': 'local verified common bundle; no provider upload',
        'exitPropagation': '$LASTEXITCODE -> $status -> finally exit $status', 'script': script,
    }

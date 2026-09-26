"""Full pinned Draft-07 and independent MO-1306 Azure subset validation."""
import hashlib
import json
from pathlib import Path
import re
import sys
import jsonschema
import yaml
from jsonschema import Draft7Validator, validators, ValidationError
from referencing import Registry, Resource
from safe_yaml import parse_yaml, require, validate_powershell

ROOT = Path(__file__).resolve().parents[4]
FIXTURE = ROOT / 'repositories/cca-conformance/fixtures/mo1306-phase2c/azure'
SCHEMA_LENGTH = 1640523
SCHEMA_SHA256 = 'f00a9630f6550204148634d9a13f634b5750a225559886effe09a751482f0459'
ANNOTATIONS = {'aliases', 'deprecationMessage', 'doNotSuggest'}
BEHAVIOR = {'firstProperty', 'ignoreCase'}
STANDARD = {'$comment', '$id', '$ref', '$schema', 'additionalProperties', 'anyOf', 'definitions',
            'description', 'enum', 'examples', 'items', 'minProperties', 'oneOf', 'pattern',
            'patternProperties', 'properties', 'required', 'title', 'type'}


def _schema_nodes(node):
    if not isinstance(node, dict):
        return
    yield node
    for key, value in node.items():
        if key in ('properties', 'patternProperties', 'definitions'):
            for child in value.values():
                yield from _schema_nodes(child)
        elif key in ('anyOf', 'oneOf', 'allOf'):
            for child in value:
                yield from _schema_nodes(child)
        elif key in ('items', 'additionalProperties', 'not', 'if', 'then', 'else'):
            yield from _schema_nodes(value)


def first_property(validator, allowed, instance, schema):
    if isinstance(instance, dict) and instance and next(iter(instance)) not in allowed:
        yield ValidationError('Azure firstProperty order mismatch')


def pattern(validator, expression, instance, schema):
    if isinstance(instance, str) and schema.get('ignoreCase') in ('value', 'all'):
        if re.search(expression, instance, re.IGNORECASE) is None:
            yield ValidationError('Azure case-insensitive pattern mismatch')
    else:
        yield from Draft7Validator.VALIDATORS['pattern'](validator, expression, instance, schema)


def enum(validator, values, instance, schema):
    if isinstance(instance, str) and schema.get('ignoreCase') in ('value', 'all'):
        if instance.casefold() not in [item.casefold() if isinstance(item, str) else item for item in values]:
            yield ValidationError('Azure case-insensitive enum mismatch')
    else:
        yield from Draft7Validator.VALIDATORS['enum'](validator, values, instance, schema)


def normalize_schema_keys(instance, schema):
    if not isinstance(instance, dict):
        return instance
    properties = schema.get('properties', {})
    insensitive = {key.casefold(): key for key, child in properties.items() if child.get('ignoreCase') in ('key', 'all')}
    result = {}
    for key, value in instance.items():
        normalized = insensitive.get(key.casefold(), key)
        if normalized in result:
            raise ValidationError('Azure case-insensitive key collision')
        result[normalized] = value
    return result


def properties(validator, values, instance, schema):
    try:
        normalized = normalize_schema_keys(instance, schema)
    except ValidationError as error:
        yield error
        return
    yield from Draft7Validator.VALIDATORS['properties'](validator, values, normalized, schema)


def required(validator, values, instance, schema):
    try:
        normalized = normalize_schema_keys(instance, schema)
    except ValidationError as error:
        yield error
        return
    yield from Draft7Validator.VALIDATORS['required'](validator, values, normalized, schema)


def additional_properties(validator, values, instance, schema):
    try:
        normalized = normalize_schema_keys(instance, schema)
    except ValidationError as error:
        yield error
        return
    yield from Draft7Validator.VALIDATORS['additionalProperties'](validator, values, normalized, schema)


AzureSchemaValidator = validators.extend(Draft7Validator, {'firstProperty': first_property, 'pattern': pattern, 'enum': enum,
                                                         'properties': properties, 'required': required, 'additionalProperties': additional_properties})


def load_schema():
    raw = (FIXTURE / 'upstream/service-schema.json').read_bytes()
    require(len(raw) == SCHEMA_LENGTH and hashlib.sha256(raw).hexdigest() == SCHEMA_SHA256, 'pinned schema identity')
    schema = json.loads(raw)
    require(schema['$schema'] == 'http://json-schema.org/draft-07/schema#' and schema['$comment'] == 'v1.261.1', 'schema dialect/version')
    keywords, refs = set(), []
    for node in _schema_nodes(schema):
        keywords.update(node)
        require(set(node) <= STANDARD | ANNOTATIONS | BEHAVIOR, 'unsupported schema assertion')
        if '$ref' in node:
            refs.append(node['$ref'])
            require(node['$ref'].startswith('#/definitions/'), 'nonlocal schema reference')
        if 'ignoreCase' in node:
            require(node['ignoreCase'] in ('key', 'value', 'all'), 'unsupported ignoreCase behavior')
    Draft7Validator.check_schema(schema)

    def deny_remote(uri):
        raise RuntimeError('Remote schema resolution is forbidden: ' + uri)

    registry = Registry(retrieve=deny_remote).with_resource(schema['$id'], Resource.from_contents(schema))
    validator = AzureSchemaValidator(schema, registry=registry)
    return validator, {'byteLength': len(raw), 'sha256': SCHEMA_SHA256, 'schemaId': schema['$id'],
                       'schemaVersion': schema['$comment'], 'draft': 'Draft-07', 'localReferenceCount': len(refs),
                       'keywords': sorted(keywords), 'annotations': sorted(ANNOTATIONS),
                       'behavioralExtensionsEnforced': sorted(BEHAVIOR), 'remoteResolution': 'FORBIDDEN'}


def ordered(mapping, names):
    require(isinstance(mapping, dict) and list(mapping) == names, 'Azure closed keys/order')


def schema_representation(data):
    """Microsoft service-schema models YAML scalar lexemes as strings.

    In the retained bytes, definitions.boolean is string patterns (true/false,
    etc.), and timeout fields reference definitions.string. Keep those exact
    lexical values for Draft-07, independently of our stricter scalar-kind pass.
    The safe parser always rejects duplicates, aliases, tags and unsafe styles
    before BaseLoader can construct this string-only JSON-compatible mapping.
    """
    parse_yaml(data)
    return yaml.load(data.decode('utf-8'), Loader=yaml.BaseLoader)


def validate(data, config_digest, distribution_digest, pool, *, parse_script=True):
    require(re.fullmatch(r'sha256:[0-9a-f]{64}', config_digest) and re.fullmatch(r'sha256:[0-9a-f]{64}', distribution_digest), 'expected digest pins')
    require(re.fullmatch(r'[A-Za-z0-9_-]{1,64}', pool), 'expected pool')
    mapping = parse_yaml(data)
    ordered(mapping, ['trigger', 'pr', 'pool', 'jobs'])
    require(mapping['trigger'] == mapping['pr'] == 'none', 'Azure manual triggers')
    ordered(mapping['pool'], ['name', 'demands'])
    require(mapping['pool']['name'] == pool and mapping['pool']['demands'] == ['Agent.OS -equals Windows_NT'], 'Azure Windows pool')
    require(isinstance(mapping['jobs'], list) and len(mapping['jobs']) == 1, 'Azure job cardinality')
    job = mapping['jobs'][0]
    ordered(job, ['job', 'timeoutInMinutes', 'cancelTimeoutInMinutes', 'steps'])
    require(job['job'] == 'memoryos_policy', 'Azure job identity')
    require(type(job['timeoutInMinutes']) is int and job['timeoutInMinutes'] == 5, 'Azure timeout')
    require(type(job['cancelTimeoutInMinutes']) is int and job['cancelTimeoutInMinutes'] == 1, 'Azure cancellation timeout')
    require(isinstance(job['steps'], list) and len(job['steps']) == 2, 'Azure step cardinality')
    checkout, step = job['steps']
    ordered(checkout, ['checkout', 'persistCredentials', 'submodules', 'lfs'])
    require(checkout['checkout'] == 'self' and all(checkout[key] is False for key in ('persistCredentials', 'submodules', 'lfs')), 'Azure checkout')
    ordered(step, ['powershell', 'displayName', 'failOnStderr', 'ignoreLASTEXITCODE'])
    require(step['displayName'] == 'MemoryOS Policy' and step['failOnStderr'] is False and step['ignoreLASTEXITCODE'] is False, 'Azure result propagation')
    script = step['powershell']
    expected = ("$ErrorActionPreference = 'Stop'\n"
                "& (Join-Path $env:MEMORYOS_CI_HOME 'scripts\\Invoke-MemoryOSCI.ps1') -Provider 'azure' "
                "-Workspace $env:BUILD_SOURCESDIRECTORY -ConfigurationDigest '" + config_digest + "' "
                "-DistributionDigest '" + distribution_digest + "'\n"
                "$gateExit = $LASTEXITCODE\nexit $gateExit\n")
    require(script == expected, 'Azure immutable launcher script')
    expected_yaml = '\n'.join([
        "trigger: 'none'", "pr: 'none'", 'pool:', "  name: '" + pool + "'", '  demands:',
        "    - 'Agent.OS -equals Windows_NT'", 'jobs:', "  - job: 'memoryos_policy'",
        '    timeoutInMinutes: 5', '    cancelTimeoutInMinutes: 1', '    steps:',
        "      - checkout: 'self'", '        persistCredentials: false', '        submodules: false',
        '        lfs: false', '      - powershell: |',
        *['          ' + line for line in expected.splitlines()],
        "        displayName: 'MemoryOS Policy'", '        failOnStderr: false',
        '        ignoreLASTEXITCODE: false', '',
    ])
    require(data.decode('utf-8') == expected_yaml, 'Azure canonical grammar layout')
    # Independent source-layout checks supplement the parsed scalar kinds.
    for line in data.decode('utf-8').splitlines():
        require(len(line) - len(line.lstrip(' ')) in (0, 2, 4, 6, 8, 10), 'Azure indentation')
        if line.lstrip().startswith(('$', '&', 'exit ')):
            continue
        value = line.partition(': ')[2] if ': ' in line else line.strip()[2:] if line.strip().startswith('- ') else ''
        if value and value not in ('true', 'false', '|') and not value.isdecimal() and ': ' not in value:
            require(value.startswith("'") and value.endswith("'"), 'Azure ordinary scalar quoting')
    validator, schema_identity = load_schema()
    errors = list(validator.iter_errors(schema_representation(data)))
    require(not errors, 'Microsoft Draft-07 schema: ' + (str(errors[0])[:512] if errors else ''))
    nodes = validate_powershell(script, expected) if parse_script else []
    if nodes:
        commands = [node['text'] for node in nodes if node['kind'] == 'CommandAst']
        require(len(commands) == 2 and commands[0].startswith('& (Join-Path ') and commands[1] == "Join-Path $env:MEMORYOS_CI_HOME 'scripts\\Invoke-MemoryOSCI.ps1'", 'Azure PowerShell command allowlist')
        require(not any(node['kind'] in ('InvokeMemberExpressionAst', 'ScriptBlockExpressionAst', 'FunctionDefinitionAst', 'SubExpressionAst') for node in nodes), 'Azure PowerShell forbidden AST')
    return {'schema': schema_identity, 'schemaValidation': 'PASS', 'schemaRepresentation': 'SAFE_YAML_AST_SCALAR_LEXEMES',
            'scalarKinds': 'SEPARATE_STRICT_SUBSET', 'subsetValidation': 'PASS', 'scriptAst': 'PASS' if nodes else 'DEFERRED',
            'invocation': {'provider': 'azure', 'workspaceCapability': 'BUILD_SOURCESDIRECTORY',
                           'launcherCapability': 'MEMORYOS_CI_HOME', 'launcherRelativePath': 'scripts/Invoke-MemoryOSCI.ps1',
                           'configurationDigest': config_digest, 'distributionDigest': distribution_digest,
                           'timeoutMinutes': 5, 'cancelTimeoutMinutes': 1, 'publication': 'LOCAL_ONLY',
                           'resultProjection': 'UNCHANGED_COMMON_EXIT', 'metadataAuthority': 'OPERATIONAL_ONLY'}}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('pipeline', type=Path)
    parser.add_argument('--config-digest', required=True)
    parser.add_argument('--distribution-digest', required=True)
    parser.add_argument('--pool', required=True)
    args = parser.parse_args()
    print(json.dumps(validate(args.pipeline.read_bytes(), args.config_digest, args.distribution_digest, args.pool), sort_keys=True))

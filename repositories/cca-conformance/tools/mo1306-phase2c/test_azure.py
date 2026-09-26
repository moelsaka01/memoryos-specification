"""Retained Azure positive/negative corpus; no provider or schema network access."""
import hashlib
import json
import socket
from pathlib import Path
import sys
from azure_validator import FIXTURE, ROOT, load_schema, validate, AzureSchemaValidator, schema_representation
from safe_yaml import ContractError, parse_yaml, require, powershell_ast
import yaml


def forbidden_network(*args, **kwargs):
    raise AssertionError('Network forbidden during ordinary Azure validation')


socket.create_connection = forbidden_network
socket.socket.connect = forbidden_network
generation = json.loads((FIXTURE / 'generation.json').read_text(encoding='utf-8'))
pipeline = (FIXTURE / 'azure-pipelines.yml').read_bytes()
arguments = (generation['configurationDigest'], generation['distributionDigest'], generation['pool'])
positive = validate(pipeline, *arguments)
require(positive['scriptAst'] == 'PASS', 'PowerShell AST required')
validator, schema = load_schema()
require(not list(validator.iter_errors(schema_representation(pipeline))), 'official schema positive')
bad_schema = schema_representation(pipeline)
bad_schema['jobs'][0]['timeoutInMinutes'] = []
require(bool(list(validator.iter_errors(bad_schema))), 'official schema rejects invalid timeout')
require(bool(list(AzureSchemaValidator({'firstProperty': ['job']}).iter_errors({'timeout': 1, 'job': 'x'}))), 'firstProperty custom assertion')
require(not list(AzureSchemaValidator({'type': 'string', 'pattern': '^ACR$', 'ignoreCase': 'value'}).iter_errors('acr')), 'ignoreCase custom assertion')
case_schema = {'type': 'object', 'properties': {'targetType': {'ignoreCase': 'all', 'enum': ['inline']}}, 'required': ['targetType'], 'additionalProperties': False}
require(not list(AzureSchemaValidator(case_schema).iter_errors({'TARGETTYPE': 'INLINE'})), 'ignoreCase key/all custom assertion')
require(bool(list(AzureSchemaValidator(case_schema).iter_errors({'TARGETTYPE': 'INLINE', 'targetType': 'inline'}))), 'ignoreCase collision rejection')
corpus = json.loads((FIXTURE / 'negative-corpus.json').read_text(encoding='utf-8'))
results = []
for row in corpus:
    source = row['from'].replace('{{configurationDigest}}', arguments[0]).replace('{{distributionDigest}}', arguments[1])
    require(source in pipeline.decode('utf-8'), 'negative corpus source missing: ' + row['id'])
    candidate = pipeline.decode('utf-8').replace(source, row['to'], 1).encode('utf-8')
    try:
        validate(candidate, *arguments, parse_script=False)
    except (ValueError, yaml.YAMLError, UnicodeError) as error:
        results.append({'id': row['id'], 'result': 'REJECTED', 'sha256': hashlib.sha256(candidate).hexdigest(), 'reason': str(error).splitlines()[0][:160]})
    else:
        raise AssertionError('Accepted negative: ' + row['id'])
for name, candidate in [('invalid-utf8', b'\xff' + pipeline), ('utf8-bom', b'\xef\xbb\xbf' + pipeline), ('extra-final-lf', pipeline + b'\n')]:
    try:
        validate(candidate, *arguments, parse_script=False)
    except (ValueError, yaml.YAMLError, UnicodeError) as error:
        results.append({'id': name, 'result': 'REJECTED', 'sha256': hashlib.sha256(candidate).hexdigest(), 'reason': str(error).splitlines()[0][:160]})
    else:
        raise AssertionError('Accepted encoding negative: ' + name)
script = parse_yaml(pipeline)['jobs'][0]['steps'][1]['powershell']
try:
    powershell_ast(script + "'unterminated\n")
except ContractError:
    results.append({'id': 'powershell-ast-invalid-syntax', 'result': 'REJECTED', 'sha256': hashlib.sha256((script + "'unterminated\n").encode()).hexdigest(), 'reason': 'PowerShell AST parsing'})
else:
    raise AssertionError('PowerShell malformed syntax accepted')
provenance = json.loads((FIXTURE / 'schema-provenance.json').read_text(encoding='utf-8'))
license_bytes = (FIXTURE / provenance['licensePath']).read_bytes()
require(len(license_bytes) == provenance['licenseByteLength'] and 'sha256:' + hashlib.sha256(license_bytes).hexdigest() == provenance['licenseSha256'], 'schema license provenance')
require(provenance['sha256'] == 'sha256:' + schema['sha256'] and provenance['byteLength'] == schema['byteLength'], 'schema provenance binding')
receipt = {'kind': 'MemoryOSCICDAzureContractValidation', 'version': '1.0.0', 'result': 'PASS',
           'baseline': 'dbafc0061aa493da2517ee5564f9ea6adb90f52d', 'originalPhase2C': 'e1c990bf65d0c7925a68eea8222cd304f8ce6db6',
           'schema': schema, 'positive': positive, 'negativeCount': len(results), 'negatives': results,
           'generation': generation, 'ordinaryValidationNetwork': 'DISABLED',
           'projectionScope': '11 independent fixed common projections; native semantic/launcher execution separately retained',
           'providerStatus': 'IMPLEMENTED_CONTRACT_VALIDATED', 'liveProviderCertification': 'NOT_LIVE_PROVIDER_CERTIFIED'}
if len(sys.argv) == 3 and sys.argv[1] == '--record':
    target = Path(sys.argv[2]).resolve()
    require(target.is_relative_to(ROOT), 'receipt must remain in Phase 2C')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(receipt, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps(receipt, sort_keys=True))

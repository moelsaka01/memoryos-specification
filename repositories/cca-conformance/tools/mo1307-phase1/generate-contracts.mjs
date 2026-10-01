// Engineering-only generation of the closed MO-1307 Contract Freeze 1 tables.
// No dependencies, network, input discovery, runtime schema loading or product execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const product = path.join(workspace, 'repositories/memoryos-readiness');
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const write = (relative, value) => {
  const target = path.join(product, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${canonical(value)}\n`, { encoding: 'utf8' });
};
const sort = values => [...values].sort();
const coverage = {
  SEMANTIC_CONFORMANCE: sort(['CONTRACT_IDENTITIES','EXPECTED_VECTORS','NORMATIVE_BYTES','SEMANTIC_PARITY']),
  EXECUTION_CERTIFICATION: sort(['NATIVE_WINDOWS','INSTALLED_EXECUTION','EXPECTED_EXITS']),
  ARTIFACT_CERTIFICATION: sort(['ARCHIVE_MEMBERS','DISTRIBUTION','OFFLINE_INSTALL','REPRODUCIBILITY','DOCUMENTATION','RELEASE_METADATA']),
  SECURITY_AUDIT: sort(['FILESYSTEM','NETWORK','PROCESS','SECRETS','LOGGING','NEGATIVE_CORPUS']),
  SUPPLY_CHAIN_REVIEW: sort(['RUNTIME','INSTALL_TOOLING','PRODUCTION_DEPENDENCIES','ENGINEERING_VALIDATORS','SCHEMAS','LICENSES_NOTICES','ADVISORY_DISPOSITION']),
  SBOM_VALIDATION: sort(['SCHEMA','FILE_CHECKSUMS','PACKAGE_RELATIONSHIPS']),
  PROVENANCE: sort(['SOURCE','BUILD_TOOLCHAIN','ARCHIVE_BINDING','SBOM_BINDING']),
  RESOURCE_VALIDATION: sort(['INPUT_BOUNDS','OUTPUT_BOUNDS','DEADLINES','MEMORY_CHARACTERIZATION','BOUNDARY_ENFORCEMENT']),
  PROVIDER_CERTIFICATION: sort(['IMPLEMENTATION','OFFLINE_CONTRACT','EXECUTION_SCOPE']),
  HISTORICAL_DISPOSITION: sort(['HISTORY_COMPLETE','DISPOSITION_AUTHORITY','RECURRENCE_ACCOUNTED']),
  SCOPE_AUTHORITY: sort(['PROFILE_MATCH','QUALIFICATIONS_COMPLETE','ASSUMPTIONS_CURRENT']),
  FINAL_BINDING: sort(['CANDIDATE_CLOSURE','RECEIPT_CLOSURE','ACYCLIC_BINDING']),
  REST_CONTRACT: sort(['OPENAPI','SIX_SEMANTIC_OPERATIONS','THREE_OPERATIONAL_ENDPOINTS','TLS_AUTH','SAME_HOST_REMOTE']),
  TAG_OBSERVATION: ['OBSERVATION_COMPLETE'],
};
const dependencyRoles = Object.fromEntries(Object.entries({
  SEMANTIC_CONFORMANCE: ['SOURCE_MEMBER','RUNTIME_CLOSURE','RUNTIME','SCHEMA','CONFIGURATION'],
  EXECUTION_CERTIFICATION: ['SOURCE_MEMBER','ARCHIVE','RUNTIME_CLOSURE','RUNTIME','CONFIGURATION'],
  ARTIFACT_CERTIFICATION: ['ARCHIVE','DISTRIBUTION','TOOLCHAIN','DOCUMENTATION'],
  SECURITY_AUDIT: ['SOURCE_MEMBER','SECURITY_CONTROL','CONFIGURATION','RUNTIME'],
  SUPPLY_CHAIN_REVIEW: ['RUNTIME','TOOLCHAIN','RUNTIME_CLOSURE','SCHEMA','DISTRIBUTION'],
  SBOM_VALIDATION: ['SBOM','ARCHIVE','DISTRIBUTION','SCHEMA'],
  PROVENANCE: ['PROVENANCE','ARCHIVE','SBOM','SOURCE_MEMBER','TOOLCHAIN'],
  RESOURCE_VALIDATION: ['SOURCE_MEMBER','RUNTIME','CONFIGURATION','SECURITY_CONTROL'],
  PROVIDER_CERTIFICATION: ['ADAPTER','CONFIGURATION','RUNTIME','SECURITY_CONTROL'],
  HISTORICAL_DISPOSITION: [], SCOPE_AUTHORITY: [], FINAL_BINDING: [],
  REST_CONTRACT: ['SOURCE_MEMBER','SCHEMA','CONFIGURATION','SECURITY_CONTROL'], TAG_OBSERVATION: [],
}).map(([key, value]) => [key, sort(value)]));
const gateRows = [
  ['artifact','ARTIFACT_CERTIFICATION',true,'ALWAYS',null,'RETAIN'],
  ['binding','FINAL_BINDING',true,'ALWAYS',null,'RETAIN'],
  ['history','HISTORICAL_DISPOSITION',true,'ALWAYS',null,'HISTORY'],
  ['provenance','PROVENANCE',true,'ALWAYS',null,'RETAIN'],
  ['provider.azure','PROVIDER_CERTIFICATION',true,'CICD_ONLY','azure','PROVIDER'],
  ['provider.azure.live','PROVIDER_CERTIFICATION',false,'CICD_ONLY','azure','OBSERVE'],
  ['provider.generic','PROVIDER_CERTIFICATION',true,'CICD_ONLY','generic','PROVIDER'],
  ['provider.github','PROVIDER_CERTIFICATION',true,'CICD_ONLY','github','PROVIDER'],
  ['provider.github.hosted','PROVIDER_CERTIFICATION',false,'CICD_ONLY','github','OBSERVE'],
  ['provider.gitlab','PROVIDER_CERTIFICATION',true,'CICD_ONLY','gitlab','PROVIDER'],
  ['provider.gitlab.live','PROVIDER_CERTIFICATION',false,'CICD_ONLY','gitlab','OBSERVE'],
  ['provider.jenkins','PROVIDER_CERTIFICATION',true,'CICD_ONLY','jenkins','PROVIDER'],
  ['provider.jenkins.live','PROVIDER_CERTIFICATION',false,'CICD_ONLY','jenkins','OBSERVE'],
  ['resources','RESOURCE_VALIDATION',true,'ALWAYS',null,'RETAIN'],
  ['rest.contract','REST_CONTRACT',true,'REST_ONLY',null,'SAME_HOST'],
  ['sbom','SBOM_VALIDATION',true,'ALWAYS',null,'RETAIN'],
  ['scope','SCOPE_AUTHORITY',true,'ALWAYS',null,'COMPLETE'],
  ['security','SECURITY_AUDIT',true,'ALWAYS',null,'RETAIN'],
  ['semantic','SEMANTIC_CONFORMANCE',true,'ALWAYS',null,'RETAIN'],
  ['supply','SUPPLY_CHAIN_REVIEW',true,'ALWAYS',null,'ADVISORY'],
  ['tag','TAG_OBSERVATION',true,'ALWAYS',null,'RETAIN'],
  ['windows','EXECUTION_CERTIFICATION',true,'ALWAYS',null,'RETAIN'],
];
const gateDefinitions = gateRows.map(([id,evidenceType,mandatory,applicability,provider,qualificationRule]) => ({
  id,version:'1.0.0',mandatory,applicability,evidenceType,provider,
  minimumRoles:dependencyRoles[evidenceType],acceptedVerdict:'PASS',qualificationRule,failureRule:'ALL_FAILED_CHECKS',
}));
const qualificationRules = [
  {code:'HOSTED_NOT_CERTIFIED',impact:'RELEASE_IMPACTING',providers:['github'],gateIds:['provider.github','provider.github.hosted'],condition:'EMPTY'},
  {code:'PROVIDER_NOT_LIVE_CERTIFIED',impact:'RELEASE_IMPACTING',providers:['azure','gitlab','jenkins'],gateIds:null,condition:'EMPTY'},
  {code:'SAME_HOST_REMOTE_ONLY',impact:'RELEASE_IMPACTING',providers:[null],gateIds:['rest.contract'],condition:'EMPTY'},
  {code:'BOUNDED_ADVISORY_REVIEW',impact:'RELEASE_IMPACTING',providers:[null],gateIds:['supply'],condition:'EMPTY'},
  {code:'HISTORICAL_UNRESOLVED_PRESERVED',impact:'RELEASE_IMPACTING',providers:[null],gateIds:null,condition:'ONE_HISTORY_CONDITION'},
  {code:'PLATFORM_NOT_REQUIRED',impact:'INFORMATIONAL',providers:[null],gateIds:null,condition:'EMPTY'},
  {code:'ENVIRONMENT_LIMITATION',impact:'INFORMATIONAL',providers:[null],gateIds:null,condition:'EMPTY'},
].sort((a,b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
const errors = ['USAGE','CONFIGURATION','INPUT','INTEGRITY','CANDIDATE_MISMATCH','EVIDENCE_VERSION','EVIDENCE_AUTHORITY','GRAPH_CYCLE','GRAPH_LIMIT','STALE_EVIDENCE','FILESYSTEM_BOUNDARY','OUTPUT','INTERNAL','QUALIFICATION_MISMATCH','HISTORY_MISMATCH','PROFILE_MISMATCH','RESULT_MISMATCH','DECISION_MISMATCH','RESOURCE_LIMIT','TIMEOUT','CANCELLED']
  .map((suffix,index) => ({suffix,code:`MO1307_${suffix}`,exit:10+index}));
const limits = {
  configurationBytes:16384,candidateBytes:524288,manifestBytes:262144,authorityBytes:1048576,
  rawSourceBytes:2097152,envelopeBytes:262144,aggregateEvidenceBytes:8388608,manifestFiles:128,
  candidateComponents:1024,claims:64,grants:64,authoritySources:32,dependenciesPerClaim:1024,
  assumptions:32,graphNodes:2048,graphEdges:8192,gates:128,qualifications:128,blockers:128,historyRecords:128,
  jsonDepth:16,jsonValues:131072,objectMembers:64,keyCodeUnits:64,stringCodeUnits:4096,
  relativePathChars:180,fullPathCodeUnits:240,resultBytes:4194304,textStdoutBytes:131072,
  jsonSummaryBytes:1024,errorRecordBytes:1024,stderrBytes:4096,decisionBytes:8192,temporaryOutputBytes:4194304,
  workerOldHeapMiB:128,workerYoungHeapMiB:16,engineeringAggregateRssBytes:536870912,
  cliDeadlineMs:30000,apiDeadlineMs:10000,helperRequestPaths:128,helperDeadlineMs:8000,
  cleanupAllowanceMs:2000,helperRequestBytes:65536,helperResponseBytes:16777216,helperRequests:9,
  helperVerifyRequests:4,helperAggregateDeadlineMs:20000,helperChainComponents:120,
  metadataCodeUnits:256,decisionReasonCodeUnits:1024,decisionActorCodeUnits:128,
  sourceKindChars:128,sourceVersionChars:64,historyDispositionChars:256,tagNameChars:128,
};
const roles = sort(['SOURCE_MEMBER','ARCHIVE','DISTRIBUTION','CONFIGURATION','SBOM','PROVENANCE','RUNTIME_CLOSURE','RUNTIME','TOOLCHAIN','SCHEMA','ADAPTER','SECURITY_CONTROL','DOCUMENTATION']);
const authorityClasses = ['CURRENT_CONFORMANCE_BINDING','FREEZE_SCOPE_AUTHORITY','RELEASED_BINDING'];
const states = ['SATISFIED','SATISFIED_WITH_QUALIFICATION','BLOCKED','NOT_REQUIRED','NOT_APPLICABLE','COULD_NOT_EVALUATE'];
const readiness = ['READY','READY_WITH_QUALIFICATIONS','NOT_READY','COULD_NOT_EVALUATE'];
const providers = ['azure','generic','github','gitlab','jenkins'];
const phases = ['LAUNCH','CONFIGURATION','ACQUISITION','INTEGRITY','AUTHORITY','GRAPH','EVALUATION','VERIFICATION','PUBLICATION'];
const stages = ['PRE_TAG_READINESS','POST_TAG_VERIFICATION'];
const cneReasons = ['MISSING','AUTHORITY_UNAVAILABLE','STALE','UNEVALUABLE'];
const definitions = {
  identity:{id:'memoryos.readiness',version:'1.0.0',packageName:'memoryos-readiness',packageVersion:'0.1.0',private:true},
  versions:{record:'1.0.0',profile:'1.0.0',gate:'1.0.0',evidence:'1.0.0',schemaDraft:'2020-12'},
  enums:{evidenceTypes:sort(Object.keys(coverage)),componentRoles:roles,providers,authorityClasses,gateStates:states,readiness,stages,validationPhases:phases,cneReasons,
    qualificationCodes:qualificationRules.map(row => row.code),bindingModes:['DEPENDENCY_SET','WHOLE_CANDIDATE'],verdicts:['PASS','FAIL','UNEVALUABLE'],
    applicability:['ALWAYS','REST_ONLY','CICD_ONLY','PRE_TAG','POST_TAG'],qualificationRules:['RETAIN','HISTORY','PROVIDER','OBSERVE','SAME_HOST','COMPLETE','ADVISORY'],
    graphNodeTypes:['ASSESSMENT','CANDIDATE','GRANT','CLAIM','DEPENDENCY','AUTHORITY'],graphEdgeTypes:['ASSESSES','ACCEPTS','AUTHORIZES','ROOTED_IN','DEPENDS_ON'],
    originalOutcomes:['FAIL','BLOCKED','NOT_EXECUTED','UNEVALUABLE'],historyDispositions:['CURRENT_APPLICABLE','SUPERSEDED','PRESERVED_NOT_APPLICABLE','PRESERVED_WITH_QUALIFICATION'],
    recurrence:['NOT_APPLICABLE','NOT_OBSERVED','OBSERVED'],decisions:['APPROVE','REJECT','DEFER'],blockerReasons:['CHECK_FAILED','PROVIDER_MINIMUM_UNMET','TAG_CONDITION_UNMET','CONDITION_UNSATISFIED']},
  coverage,dependencyRoles,gateDefinitions,qualificationRules,errors,
  evaluationExits:{READY:0,READY_WITH_QUALIFICATIONS:2,NOT_READY:3,COULD_NOT_EVALUATE:4},
  profiles:[{id:'rest',version:'1.0.0',product:'memoryos-rest',remoteScope:'SAME_HOST_RFC1918',providers:[]},{id:'cicd',version:'1.0.0',product:'memoryos-ci',remoteScope:'NOT_APPLICABLE',providers}],
  canonicalization:{name:'J',encoding:'UTF-8',bom:false,trailingLf:true,objectKeyOrder:'ASCII',integersOnly:true,negativeZero:false,maximumInteger:9007199254740991,hash:'SHA-256',digestPrefix:'sha256:'},
  limits,topology:{supervisors:1,evaluationWorkers:1,concurrentHelpers:1,possibleConsoleHosts:1,totalProcesses:3,helperOperations:['READ_SET','CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'],helperRequests:9,helperVerifyRequests:4,
    publicationOperations:['CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'],
    acquisitionStages:[['config','authority'],['candidate','manifest'],['manifest.entries']],finalHelperOperation:{evaluate:'CHECK_OUTPUT',verify:'READ_SET'},helperEnvironment:['SystemRoot','WINDIR'],network:false},
  filenames:{configuration:'memoryos-readiness.json',result:'memoryos-readiness-result.json',pendingResult:'memoryos-readiness-result.json.pending',contract:'contracts/contract.json',distribution:'distribution-manifest.json',bin:'bin/memoryos-readiness.mjs',rootExport:'src/index.mjs'},
  runtime:{nodeVersion:'24.21.0',nodePlatform:'win-x64',nodeByteLength:93580104,nodeSha256:'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32',npmVersion:'11.19.0',powershellVersion:'5.1',externalProductionDependencies:0},
  requiredHumanActions:['REVIEW_READINESS_AND_LIMITATIONS','DECIDE_RELEASE'],
};
write('contracts/definitions.json', definitions);

// A shared closed definition library; all $refs are local JSON Pointers or files.
const ref = name => ({$ref:`#/$defs/${name}`});
const literal = value => ({const:value});
const enumeration = values => ({enum:values});
const nullable = schema => ({oneOf:[schema,{type:'null'}]});
const string = (max=limits.stringCodeUnits,min=0,pattern='^[^\\u0000-\\u001f\\u007f]*$') => ({type:'string',minLength:min,maxLength:max,pattern});
const ascii = (max,min=1) => string(max,min,'^[\\x20-\\x7e]*$');
const array = (items,max=limits.jsonValues,min=0) => ({type:'array',items,minItems:min,maxItems:max});
const set = (items,max=limits.jsonValues,min=0) => ({...array(items,max,min),uniqueItems:true});
const obj = properties => ({type:'object',properties,required:Object.keys(properties).sort(),additionalProperties:false});
const record = (kind,properties) => obj({kind:literal(kind),version:literal('1.0.0'),...properties});
const props = properties => ({properties});
const boolean = {type:'boolean'};
const defs = {};
defs.Id = string(64,1,'^[a-z][a-z0-9._-]*$');
defs.Code = string(64,1,'^[A-Z][A-Z0-9_]*$');
defs.Digest = string(71,71,'^sha256:[0-9a-f]{64}$');
defs.Revision = string(40,40,'^[0-9a-f]{40}$');
defs.Integer = {type:'integer',minimum:0,maximum:9007199254740991};
defs.String = string();
defs.ProductVersion = string(64,1,'^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-[A-Za-z0-9.-]+)?$');
defs.RelativeFile = {...string(180,1,'^[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$'),allOf:[
  {not:{pattern:'(?:^|/)(?:\\.|\\.\\.)(?:/|$)'}},
  {not:{pattern:'\\.(?:/|$)'}},
  {not:{pattern:'(?:^|/)(?:[Cc][Oo][Nn]|[Pp][Rr][Nn]|[Aa][Uu][Xx]|[Nn][Uu][Ll]|[Cc][Oo][Mm][1-9]|[Ll][Pp][Tt][1-9])(?:\\.[^/]*|)(?:/|$)'}},
]};
defs.TagName = {...string(128,1,'^[a-z0-9][a-z0-9._-]*$'),allOf:[{not:{pattern:'\\.\\.'}},{not:{pattern:'\\.$'}},{not:{pattern:'\\.lock$'}}]};
defs.Provider = enumeration(providers);
defs.ComponentRole = enumeration(roles);
defs.GateId = enumeration(gateDefinitions.map(row => row.id));
defs.BlockerId = string(72,72,'^blocker\\.[0-9a-f]{64}$');
defs.Stage = enumeration(stages);
defs.Readiness = enumeration(readiness);
defs.GateState = enumeration(states);
defs.AuthorityClass = enumeration(authorityClasses);
defs.Profile = obj({id:enumeration(['rest','cicd']),version:literal('1.0.0')});
defs.Assumption = obj({id:ref('Id'),sha256:ref('Digest')});
defs.Component = obj({id:ref('Id'),role:ref('ComponentRole'),byteLength:ref('Integer'),sha256:ref('Digest')});
defs.SemanticContract = obj({id:ref('Id'),version:ref('ProductVersion'),sha256:ref('Digest')});
defs.CandidateProvider = obj({id:ref('Provider'),adapterVersion:ref('ProductVersion'),componentId:ref('Id')});
defs.Candidate = record('MemoryOSReadinessCandidate',{
  product:obj({name:enumeration(['memoryos-rest','memoryos-ci']),version:ref('ProductVersion')}),profile:ref('Profile'),source:obj({commit:ref('Revision'),tree:ref('Revision')}),
  components:set(ref('Component'),limits.candidateComponents,1),semanticContracts:set(ref('SemanticContract'),limits.jsonValues,1),providers:set(ref('CandidateProvider'),5),
  expectedTag:obj({name:ref('TagName'),target:ref('Revision')}),remoteScope:enumeration(['NOT_APPLICABLE','SAME_HOST_RFC1918']),
});
defs.Candidate.allOf = [
  ...['ARCHIVE','DISTRIBUTION','CONFIGURATION','SBOM','PROVENANCE','RUNTIME_CLOSURE','RUNTIME','TOOLCHAIN'].map(role => props({components:{contains:props({role:literal(role)}),minContains:1,maxContains:1}})),
  ...['SOURCE_MEMBER','SCHEMA','SECURITY_CONTROL','DOCUMENTATION'].map(role => props({components:{contains:props({role:literal(role)}),minContains:1}})),
  {oneOf:[
    props({product:props({name:literal('memoryos-rest')}),profile:props({id:literal('rest')}),providers:literal([]),remoteScope:literal('SAME_HOST_RFC1918'),components:{not:{contains:props({role:literal('ADAPTER')})}}}),
    {...props({product:props({name:literal('memoryos-ci')}),profile:props({id:literal('cicd')}),providers:{minItems:5,maxItems:5},remoteScope:literal('NOT_APPLICABLE')}),allOf:providers.map(id => props({providers:{contains:props({id:literal(id)}),minContains:1,maxContains:1}}))},
  ]},
];
defs.Dependency = obj({componentId:ref('Id'),role:ref('ComponentRole'),byteLength:ref('Integer'),sha256:ref('Digest')});
const qualificationProperties = {
  id:ref('Id'),type:literal('MemoryOSReadinessQualification'),version:literal('1.0.0'),gateIds:set(ref('GateId'),22,1),provider:nullable(ref('Provider')),scopeId:ref('Id'),
  reasonCode:enumeration(qualificationRules.map(row => row.code)),impact:enumeration(['RELEASE_IMPACTING','INFORMATIONAL']),disclosureCode:enumeration(qualificationRules.map(row => row.code)),conditionIds:set(ref('Id'),limits.historyRecords),
};
const qualificationVariants = qualificationRules.flatMap(rule => rule.providers.map(provider => {
  const exactGates = rule.code === 'PROVIDER_NOT_LIVE_CERTIFIED' ? [`provider.${provider}`,`provider.${provider}.live`] : rule.gateIds;
  return props({reasonCode:literal(rule.code),disclosureCode:literal(rule.code),impact:literal(rule.impact),provider:literal(provider),
    ...(exactGates === null ? {} : {gateIds:literal(exactGates)}),conditionIds:rule.condition === 'EMPTY' ? literal([]) : {minItems:1,maxItems:1}});
}));
defs.Qualification = {...obj(qualificationProperties),allOf:[{oneOf:qualificationVariants}]};
defs.DerivedQualification = {...obj({...qualificationProperties,candidateDigest:ref('Digest'),evidenceClaimDigests:set(ref('Digest'),limits.claims,1),grantDigests:set(ref('Digest'),limits.grants,1)}),allOf:[{oneOf:qualificationVariants}]};
defs.History = obj({id:ref('Id'),originalOutcome:enumeration(definitions.enums.originalOutcomes),originalDisposition:ascii(256),sourceIds:set(ref('Id'),limits.manifestFiles,1),conditionId:ref('Id'),disposition:enumeration(definitions.enums.historyDispositions),affectedGateIds:set(ref('GateId'),22),authoritySourceIds:set(ref('Id'),limits.authoritySources,1),recurrence:enumeration(definitions.enums.recurrence)});
defs.History.allOf = [{oneOf:[props({disposition:enumeration(['SUPERSEDED','PRESERVED_NOT_APPLICABLE'])}),props({disposition:enumeration(['CURRENT_APPLICABLE','PRESERVED_WITH_QUALIFICATION']),affectedGateIds:{minItems:1}})]}];
defs.ProviderDetail = obj({provider:ref('Provider'),implementation:enumeration(['IMPLEMENTED','NOT_IMPLEMENTED']),validation:enumeration(['OFFLINE_VALIDATED','CONTRACT_VALIDATED','REAL_EXECUTION_CERTIFIED','NOT_VALIDATED']),execution:enumeration(['REAL_EXECUTION_CERTIFIED','HOSTED_EXECUTION_CERTIFIED','HOSTED_EXECUTION_NOT_CERTIFIED','LIVE_PROVIDER_CERTIFIED','NOT_LIVE_PROVIDER_CERTIFIED','NOT_CERTIFIED']),sourceExecutionLabel:ref('Code'),support:enumeration(['SUPPORTED','SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION','SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY','UNSUPPORTED']),hostedCases:nullable(obj({pass:boolean,fail:boolean,cne:boolean,parity:boolean}))});
defs.ProviderDetail.allOf = [{oneOf:[props({provider:literal('github')}),props({provider:enumeration(['azure','generic','gitlab','jenkins']),hostedCases:literal(null)})]}];
defs.TagObservation = obj({name:ref('TagName'),presence:enumeration(['ABSENT','PRESENT']),object:nullable(ref('Revision')),annotated:nullable(boolean),peeledTarget:nullable(ref('Revision'))});
defs.TagObservation.allOf = [{oneOf:[props({presence:literal('ABSENT'),object:literal(null),annotated:literal(null),peeledTarget:literal(null)}),props({presence:literal('PRESENT'),object:ref('Revision'),annotated:boolean,peeledTarget:ref('Revision')})]}];
const details = {
  SEMANTIC_CONFORMANCE:obj({contractIds:set(ref('Id'),limits.jsonValues,1)}),
  EXECUTION_CERTIFICATION:obj({platform:literal('windows11-x64'),runtimeComponent:ref('Id')}),
  ARTIFACT_CERTIFICATION:obj({}), SECURITY_AUDIT:obj({}),
  SUPPLY_CHAIN_REVIEW:obj({reviewScope:enumeration(['DECLARED_INVENTORY_COMPLETE','BOUNDED_SNAPSHOT'])}),
  SBOM_VALIDATION:obj({}),PROVENANCE:obj({}),RESOURCE_VALIDATION:obj({}),
  PROVIDER_CERTIFICATION:ref('ProviderDetail'),HISTORICAL_DISPOSITION:obj({records:set(ref('History'),limits.historyRecords)}),
  SCOPE_AUTHORITY:obj({qualificationIds:set(ref('Id'),limits.qualifications),conditionIds:set(ref('Id'),limits.historyRecords)}),
  FINAL_BINDING:obj({target:ref('Revision')}),REST_CONTRACT:obj({remoteScope:literal('SAME_HOST_RFC1918')}),TAG_OBSERVATION:ref('TagObservation'),
};
const claimNames = [];
for (const type of Object.keys(coverage).sort()) {
  const whole = ['FINAL_BINDING','TAG_OBSERVATION'].includes(type);
  const name = `Claim_${type}`; claimNames.push(name);
  const checks = coverage[type];
  defs[`Detail_${type}`] = details[type];
  defs[name] = obj({type:literal(type),version:literal('1.0.0'),originCandidate:ref('Digest'),binding:literal(whole?'WHOLE_CANDIDATE':'DEPENDENCY_SET'),
    dependencies:whole?literal([]):set(ref('Dependency'),limits.dependenciesPerClaim,1),scopeId:ref('Id'),assumptions:set(ref('Assumption'),limits.assumptions),
    passed:set(enumeration(checks),checks.length),failed:set(enumeration(checks),checks.length),unevaluable:set(enumeration(checks),checks.length),
    verdict:enumeration(['PASS','FAIL','UNEVALUABLE']),detail:ref(`Detail_${type}`),qualifications:set(ref('Qualification'),limits.qualifications)});
  defs[name].allOf = [
    ...checks.map(check => ({oneOf:['passed','failed','unevaluable'].map(field => props({[field]:{contains:literal(check),minContains:1}}))})),
    {oneOf:[props({verdict:literal('FAIL'),failed:{minItems:1}}),props({verdict:literal('UNEVALUABLE'),failed:literal([]),unevaluable:{minItems:1}}),props({verdict:literal('PASS'),failed:literal([]),unevaluable:literal([])})]},
  ];
}
defs.Claim = {oneOf:claimNames.map(ref)};
defs.Evidence = record('MemoryOSReadinessEvidence',{claim:ref('Claim'),sources:set(ref('Id'),limits.manifestFiles,1),metadata:obj({observedAt:nullable(string(256)),runId:nullable(string(256)),locator:nullable(string(256))})});
defs.Git = obj({revision:ref('Revision'),tree:ref('Revision'),blob:ref('Revision'),path:ref('RelativeFile')});
defs.ManifestEntry = obj({id:ref('Id'),type:enumeration(['ENVELOPE','SOURCE','AUTHORITY_SOURCE']),sourceKind:ascii(128),sourceVersion:ascii(64),path:ref('RelativeFile'),byteLength:{type:'integer',minimum:0,maximum:limits.rawSourceBytes},sha256:ref('Digest'),candidateBinding:nullable(ref('Digest')),dependencyIds:set(ref('Id'),limits.dependenciesPerClaim),authorityClass:enumeration(['UNTRUSTED_SOURCE','GRANTED_CLAIM',...authorityClasses]),git:nullable(ref('Git'))});
defs.ManifestEntry.allOf = [{oneOf:[
  props({type:literal('ENVELOPE'),sourceKind:literal('memoryos-readiness-evidence'),sourceVersion:literal('1.0.0'),byteLength:{maximum:limits.envelopeBytes},candidateBinding:ref('Digest'),authorityClass:literal('GRANTED_CLAIM')}),
  props({type:literal('SOURCE'),candidateBinding:literal(null),dependencyIds:literal([]),authorityClass:literal('UNTRUSTED_SOURCE')}),
  props({type:literal('AUTHORITY_SOURCE'),candidateBinding:literal(null),dependencyIds:literal([]),authorityClass:ref('AuthorityClass'),git:ref('Git')}),
]}];
defs.Manifest = record('MemoryOSReadinessManifest',{candidateDigest:ref('Digest'),entries:set(ref('ManifestEntry'),limits.manifestFiles)});
defs.AuthoritySource = obj({id:ref('Id'),classification:ref('AuthorityClass'),revision:ref('Revision'),tree:ref('Revision'),path:ref('RelativeFile'),blob:ref('Revision'),byteLength:{type:'integer',minimum:0,maximum:limits.rawSourceBytes},sha256:ref('Digest'),releaseTag:nullable(obj({name:ref('TagName'),object:ref('Revision'),target:ref('Revision')}))});
defs.AuthoritySource.allOf = [{oneOf:[props({classification:literal('RELEASED_BINDING'),releaseTag:{type:'object'}}),props({classification:enumeration(['CURRENT_CONFORMANCE_BINDING','FREEZE_SCOPE_AUTHORITY']),releaseTag:literal(null)})]}];
defs.Grant = obj({id:ref('Id'),claimDigest:ref('Digest'),envelopeId:ref('Id'),envelopeSha256:ref('Digest'),sourceIds:set(ref('Id'),limits.manifestFiles,1),authoritySourceIds:set(ref('Id'),limits.authoritySources,1),dependencyIds:set(ref('Id'),limits.dependenciesPerClaim),scopeId:ref('Id'),assumptions:set(ref('Assumption'),limits.assumptions),applicability:enumeration(['CURRENT','REUSED'])});
const slotProps = {gateId:ref('GateId'),grantIds:set(ref('Id'),1),availability:enumeration(['AVAILABLE','UNAVAILABLE']),reason:nullable(enumeration(cneReasons))};
defs.Slot = {...obj(slotProps),allOf:[{oneOf:[props({availability:literal('AVAILABLE'),reason:literal(null)}),props({availability:literal('UNAVAILABLE'),grantIds:literal([]),reason:enumeration(cneReasons)})]}]};
defs.AuthorityAssessment = obj({candidateDigest:ref('Digest'),profile:ref('Profile'),stage:ref('Stage'),scopeId:ref('Id'),assumptions:set(ref('Assumption'),limits.assumptions),requiredComponents:set(ref('Component'),limits.candidateComponents,1),semanticContracts:set(ref('SemanticContract'),limits.jsonValues,1),grants:set(ref('Grant'),limits.grants),slots:set(ref('Slot'),22,22)});
defs.Authority = record('MemoryOSReadinessAuthority',{assessment:ref('AuthorityAssessment'),provenance:set(ref('AuthoritySource'),limits.authoritySources),manifestSha256:ref('Digest')});
defs.NormalizedAuthoritySource = obj({classification:ref('AuthorityClass'),scopeId:ref('Id'),assumptions:set(ref('Assumption'),limits.assumptions)});
defs.NormalizedGrant = obj({claimDigest:ref('Digest'),dependencyIds:set(ref('Id'),limits.dependenciesPerClaim),scopeId:ref('Id'),assumptions:set(ref('Assumption'),limits.assumptions),applicability:enumeration(['CURRENT','REUSED']),authorityClasses:set(ref('AuthorityClass'),3,1)});
defs.NormalizedSlot = {...obj({gateId:ref('GateId'),grantDigests:set(ref('Digest'),1),availability:enumeration(['AVAILABLE','UNAVAILABLE']),reason:nullable(enumeration(cneReasons))}),allOf:[{oneOf:[props({availability:literal('AVAILABLE'),reason:literal(null)}),props({availability:literal('UNAVAILABLE'),grantDigests:literal([]),reason:enumeration(cneReasons)})]}]};
defs.NormalizedAuthority = obj({candidateDigest:ref('Digest'),profile:ref('Profile'),stage:ref('Stage'),scopeId:ref('Id'),assumptions:set(ref('Assumption'),limits.assumptions),requiredComponents:set(ref('Component'),limits.candidateComponents,1),semanticContracts:set(ref('SemanticContract'),limits.jsonValues,1),normalizedGrants:set(ref('Digest'),limits.grants),slots:set(ref('NormalizedSlot'),22,22)});
defs.GraphNode = {oneOf:definitions.enums.graphNodeTypes.map(type => obj({id:type==='ASSESSMENT'?literal('assessment'):string(90,1,`^${type}:sha256:[0-9a-f]{64}$`),type:literal(type),digest:type==='ASSESSMENT'?literal(null):ref('Digest')}))};
const endpoint = type => type==='ASSESSMENT'?literal('assessment'):string(90,1,`^${type}:sha256:[0-9a-f]{64}$`);
defs.GraphEdge = {oneOf:[['ASSESSES','ASSESSMENT','CANDIDATE'],['ACCEPTS','ASSESSMENT','GRANT'],['AUTHORIZES','GRANT','CLAIM'],['ROOTED_IN','GRANT','AUTHORITY'],['DEPENDS_ON','CLAIM','DEPENDENCY'],['DEPENDS_ON','CLAIM','CANDIDATE']].map(([type,from,to]) => obj({from:endpoint(from),type:literal(type),to:endpoint(to)}))};
defs.Graph = record('MemoryOSReadinessGraph',{nodes:set(ref('GraphNode'),limits.graphNodes,1),edges:set(ref('GraphEdge'),limits.graphEdges)});
defs.BlockerKey = obj({gateId:ref('GateId'),reasonCode:enumeration(definitions.enums.blockerReasons),checkCode:ref('Code'),conditionId:nullable(ref('Id'))});
defs.Blocker = obj({id:ref('BlockerId'),gateId:ref('GateId'),reasonCode:enumeration(definitions.enums.blockerReasons),checkCode:ref('Code'),claimDigest:nullable(ref('Digest')),grantDigest:nullable(ref('Digest')),candidateDigest:ref('Digest'),conditionId:nullable(ref('Id'))});
defs.Blocker.allOf = [{oneOf:[props({reasonCode:literal('CONDITION_UNSATISFIED'),checkCode:literal('HISTORICAL_CONDITION'),conditionId:ref('Id')}),props({reasonCode:enumeration(['CHECK_FAILED','PROVIDER_MINIMUM_UNMET','TAG_CONDITION_UNMET']),conditionId:literal(null)})]}];
defs.CneReason = obj({gateId:ref('GateId'),reason:enumeration(cneReasons),checkCode:nullable(ref('Code'))});
defs.GateDefinition = obj({id:ref('GateId'),version:literal('1.0.0'),mandatory:boolean,applicability:enumeration(definitions.enums.applicability),evidenceType:enumeration(definitions.enums.evidenceTypes),provider:nullable(ref('Provider')),minimumRoles:set(ref('ComponentRole'),roles.length),acceptedVerdict:literal('PASS'),qualificationRule:enumeration(definitions.enums.qualificationRules),failureRule:literal('ALL_FAILED_CHECKS')});
defs.GateDefinition.allOf = [{enum:gateDefinitions}];
defs.GateResult = obj({id:ref('GateId'),version:literal('1.0.0'),mandatory:boolean,applicable:boolean,state:ref('GateState'),claimDigest:nullable(ref('Digest')),grantDigest:nullable(ref('Digest')),blockerIds:set(ref('BlockerId'),limits.blockers),qualificationIds:set(ref('Id'),limits.qualifications),cneReasons:set(ref('CneReason'),limits.jsonValues)});
defs.HistoryProjection = obj({id:ref('Id'),originalOutcome:enumeration(definitions.enums.originalOutcomes),originalDisposition:ascii(256),conditionId:ref('Id'),disposition:enumeration(definitions.enums.historyDispositions),affectedGateIds:set(ref('GateId'),22),recurrence:enumeration(definitions.enums.recurrence),claimDigest:ref('Digest'),grantDigest:ref('Digest')});
defs.DecisionProjection = obj({decision:enumeration(definitions.enums.decisions),consistency:enumeration(['CONSISTENT','CONTRARY_TO_READINESS']),authenticity:literal('NOT_VERIFIED_BY_MEMORYOS')});
// Internal implementation synonym for the same frozen API decision projection.
defs.DecisionVerification = ref('DecisionProjection');
defs.Timestamp = {...string(20,20,'^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$'),format:'date-time'};
defs.HumanDecision = record('MemoryOSReadinessHumanDecision',{candidateDigest:ref('Digest'),readinessDigest:ref('Digest'),proofBindingDigest:ref('Digest'),decision:enumeration(definitions.enums.decisions),reason:string(1024,1),actor:nullable(string(128)),timestamp:nullable(ref('Timestamp')),authenticity:literal('NOT_VERIFIED_BY_MEMORYOS'),attestation:nullable(ref('Digest'))});
defs.Configuration = record('MemoryOSReadinessConfiguration',{profile:ref('Profile'),stage:ref('Stage'),candidate:ref('RelativeFile'),manifest:ref('RelativeFile')});
defs.AuditBinding = obj({grantId:ref('Id'),grantDigest:ref('Digest'),claimDigest:ref('Digest'),envelopeId:ref('Id'),envelopeSha256:ref('Digest'),sourceIds:set(ref('Id'),limits.manifestFiles,1),authoritySourceIds:set(ref('Id'),limits.authoritySources,1)});
defs.Audit = obj({trustedAuthorityDigest:ref('Digest'),manifestSha256:ref('Digest'),candidateFileSha256:ref('Digest'),configurationSha256:ref('Digest'),inputs:set(ref('ManifestEntry'),limits.manifestFiles),authoritySources:set(ref('AuthoritySource'),limits.authoritySources),bindings:set(ref('AuditBinding'),limits.grants)});
defs.Assessment = obj({contract:obj({id:literal('memoryos.readiness'),version:literal('1.0.0')}),candidate:ref('Candidate'),candidateDigest:ref('Digest'),profile:ref('Profile'),stage:ref('Stage'),authorityIdentityDigest:ref('Digest'),readiness:ref('Readiness'),gates:set(ref('GateResult'),22,22),blockers:set(ref('Blocker'),limits.blockers),qualifications:set(ref('DerivedQualification'),limits.qualifications),cneReasons:set(ref('CneReason'),limits.jsonValues),history:set(ref('HistoryProjection'),limits.historyRecords),providers:set(ref('ProviderDetail'),5),graph:ref('Graph'),graphDigest:ref('Digest'),requiredHumanActions:literal(definitions.requiredHumanActions)});
defs.Result = record('MemoryOSReadinessResult',{assessment:ref('Assessment'),readinessDigest:ref('Digest'),audit:ref('Audit'),proofBindingDigest:ref('Digest')});
defs.Identity = record('MemoryOSReadinessIdentity',{assessment:ref('Assessment')});
defs.ProofBinding = record('MemoryOSReadinessProofBinding',{readinessDigest:ref('Digest'),audit:ref('Audit')});
defs.Summary = record('MemoryOSReadinessSummary',{operation:enumeration(['evaluate','verify']),readiness:ref('Readiness'),readinessDigest:ref('Digest'),proofBindingDigest:ref('Digest'),blockerCount:ref('Integer'),qualificationCount:ref('Integer'),cneCount:ref('Integer'),decision:nullable(ref('DecisionProjection'))});
defs.Error = record('MemoryOSReadinessError',{code:enumeration(errors.map(row => row.code)),stage:enumeration(phases),reference:nullable(ref('Id'))});
defs.FileMember = obj({path:ref('RelativeFile'),byteLength:ref('Integer'),sha256:ref('Digest')});
defs.ContractManifest = record('MemoryOSReadinessContract',{id:literal('memoryos.readiness'),files:set(ref('FileMember'),limits.jsonValues)});
defs.DistributionManifest = record('MemoryOSReadinessDistributionManifest',{package:obj({name:literal('memoryos-readiness'),version:literal('0.1.0')}),files:set(ref('FileMember'),limits.jsonValues)});
const schemaVersion = 'https://json-schema.org/draft/2020-12/schema';
write('schemas/shared-1.0.0.schema.json',{$schema:schemaVersion,$defs:defs});
const wrappers = {
  configuration:'Configuration',candidate:'Candidate',manifest:'Manifest',authority:'Authority',evidence:'Evidence',qualification:'Qualification','human-decision':'HumanDecision',result:'Result',summary:'Summary',error:'Error',
  graph:'Graph','gate-result':'GateResult','gate-definition':'GateDefinition',blocker:'Blocker',history:'History',component:'Component',claim:'Claim','provider-detail':'ProviderDetail','tag-observation':'TagObservation',
  'derived-qualification':'DerivedQualification','history-projection':'HistoryProjection','contract-manifest':'ContractManifest','distribution-manifest':'DistributionManifest',identity:'Identity','proof-binding':'ProofBinding',
  grant:'Grant',slot:'Slot','authority-source':'AuthoritySource','manifest-entry':'ManifestEntry','normalized-grant':'NormalizedGrant','normalized-authority':'NormalizedAuthority','normalized-slot':'NormalizedSlot','normalized-authority-source':'NormalizedAuthoritySource',
  'cne-reason':'CneReason','decision-projection':'DecisionProjection',assessment:'Assessment',audit:'Audit',dependency:'Dependency','semantic-contract':'SemanticContract',assumption:'Assumption','file-member':'FileMember',
  id:'Id',code:'Code',digest:'Digest',revision:'Revision',integer:'Integer',string:'String','product-version':'ProductVersion','relative-file':'RelativeFile','tag-name':'TagName',timestamp:'Timestamp',
};
for (const [name,definition] of Object.entries(wrappers)) write(`schemas/${name}-1.0.0.schema.json`,{$schema:schemaVersion,$ref:`shared-1.0.0.schema.json#/$defs/${definition}`});
const members = ['contracts/definitions.json',...fs.readdirSync(path.join(product,'schemas')).filter(name => name.endsWith('.schema.json')).map(name => `schemas/${name}`)].sort();
write('contracts/contract.json',{kind:'MemoryOSReadinessContract',version:'1.0.0',id:'memoryos.readiness',files:members.map(relative => {
  const bytes=fs.readFileSync(path.join(product,relative));
  return {path:relative,byteLength:bytes.length,sha256:`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`};
})});
process.stdout.write(`${JSON.stringify({definitions:definitions.enums.evidenceTypes.length,gates:gateDefinitions.length,errors:errors.length,qualificationCodes:qualificationRules.length,sharedDefinitions:Object.keys(defs).length,schemaFiles:Object.keys(wrappers).length+1})}\n`);

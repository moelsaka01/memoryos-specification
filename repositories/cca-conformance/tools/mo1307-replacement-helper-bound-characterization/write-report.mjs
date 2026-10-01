import fs from 'node:fs';
import path from 'node:path';
import {root,evidence,json,record,writeJson} from './common.mjs';
const campaign=json(evidence+'/campaign.json'),decision=json(evidence+'/decision.json'),ind=json(evidence+'/independent-recomputation.json');
const out=path.join(root,'docs','mo1307-replacement-helper-bound-characterization.md');if(fs.existsSync(out))throw new Error('report exists');
const lines=['# MemoryOS 1.3 — MO-1307 replacement whole-helper bound characterization','',`Result: **${decision.result}**`,'',
  'This is an evidence-only numeric characterization. It is not Phase 3A certification, contract adoption, or human release authorization.','',
  'Production tree: `6a0bf13aaf40e20b68e469989b5a34ef74cf2903`','',
  'Helper SHA-256: `97ef5ae9ce7ab390548b04a2aefba9f922c3e1c6b9b80581c6c274f0b21f0127`',''];
if(decision.result==='H_ESTABLISHED')lines.push(`Mechanically established prospective bound: **${decision.Hms} ms**.`,'',
  `- U: ${ind.derived.U_ns} ns`,`- L: ${ind.derived.L_ns} ns`,`- V: ${ind.derived.V_ns} ns`,`- Q: ${ind.derived.Q_ns} ns`,`- R: ${ind.derived.R_ns} ns`,`- H: ${ind.derived.H_ms} ms`,'');
else {const summary={reason:decision.stop?.reason??null,current:decision.stop?.current??null,executedPrefix:decision.stop?.executedPrefix??null,evidence:decision.stop?.evidence??null};lines.push('`H` is **NOT_ESTABLISHED**.','',`First stop summary: \`${JSON.stringify(summary)}\`. The exact remaining \`NOT_EXECUTED\` inventory is in the bound stop evidence.`, '');}
lines.push('## Execution','',`- Derivation: ${campaign.counts.derivation} / 1080.`,`- Holdout: ${campaign.counts.holdout} / 360.`,
  `- Complete sequence controls passed: ${campaign.counts.sequenceControlsPassed} / 16.`,`- Sequence helper launches: ${campaign.counts.sequenceHelperLaunches} / 104.`,
  `- Real worker threads: ${campaign.counts.workerThreads} / 16.`,`- Fresh native helper launches: ${campaign.counts.actualHelperLaunches} / 1544.`,
  '- Retries, replacements, warmups, cache flushes, discarded outliers, and adaptive expansion: zero.','',
  '## Complete-sequence controls','',
  'Four production-shaped evaluate, four maximum-admitted evaluate, four production-shaped verify, and four maximum-admitted verify controls use sealed valid bundles. Each evaluate runs helpers 1–4, one real production semantic worker, and publication helpers 5–9. Each verify runs helpers 1–4 and one real production semantic worker. The prospective helper bound is the only changed owner parameter; the 20,000 ms helper aggregate, 30,000 ms CLI, 10,000 ms worker/API, and 2,000 ms cleanup limits remain fixed.','',
  '## Preservation','',
  'Production, the frozen contract, Phase 3A evidence, accepted Phase 3B, and accepted Phase 3C were not modified or rerun. No push or tag was performed. Any later adoption of H remains a separate governance operation, followed by a new production candidate and fresh certification.','',
  '## Evidence','',`The sealed plan, exact request and fixture identities, raw per-launch receipts, sequence-control receipts, decision, security summary, dependency map, and independent recomputation are under \`${evidence}/\`.`, '');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,lines.join('\n')+'\n',{flag:'wx'});
writeJson(evidence+'/report-binding.json',{kind:'MO1307ReplacementBoundReportBinding',report:record('docs/mo1307-replacement-helper-bound-characterization.md'),decision:record(evidence+'/decision.json'),campaign:record(evidence+'/campaign.json'),independent:record(evidence+'/independent-recomputation.json'),statistics:record(evidence+'/statistics.json')});
console.log(JSON.stringify({result:decision.result,report:record('docs/mo1307-replacement-helper-bound-characterization.md')}));

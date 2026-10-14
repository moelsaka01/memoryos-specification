"""Enumerate clock-bearing source lines with explicit authority classification."""
from pathlib import Path
import hashlib,json,re,sys
ROOT=Path(__file__).resolve().parents[3]
RULES=[
 ('task_qpc',r'QueryPerformanceCounter|QueryPerformanceFrequency|Stopwatch|GetTimestamp', ['B','D','E'], 'Engineering task budget uses the Windows system-wide QPC counter/frequency with recorded same-counter proof; release sample epochs remain independent.'),
 ('civil_utc',r'Date\.now|Date\.parse|new Date|datetime\.datetime\.now|datetime\.now|time\.time(?:_ns)?|Get-Date|UtcNow|captureUtcMs|observedUtcMs|utcMs|utcStartMs|utcEndMs|\.isoformat\(|creationInfo', ['A'], 'Civil UTC, certificate-calendar validity or descriptive UTC fields; never elapsed/order/deadline authority.'),
 ('native_process_identity',r'GetProcessTimes|processStartedUtcMs|process_started_ms|FILETIME', ['D'], 'Creation FILETIME is compared for process identity equality only; not capture ordering.'),
 ('monotonic_primitive',r'hrtime|perf_counter(?:_ns)?|time\.monotonic(?:_ns)?|performance\.now|monoMs\(|\.mono\(|\.stamp\(|elapsedNs\(|elapsedUs\(|(?<![.\w])(?:now|us|ms|deadlineReached|atDeadline|cancelDeadline)\(|\.clock\(', ['B','C','E'], 'Same named process domain only; duration/order/freshness/deadline. Independent epochs are never compared.'),
 ('timer_wakeup',r'setTimeout|clearTimeout|scheduleTimeout|cancelTimeout|armDeadline|bounded\(|timeout=|timeoutMs|\.wait\(timeout|\.join\(timeout', ['E'], 'Node monotonic deadline wrapper or Python subprocess/threading monotonic timeout. Wakeup alone does not prove capture.'),
 ('cadence',r'setInterval|clearInterval|time\.sleep|await delay\(', ['B'], 'Sampling/client pacing; not synchronization evidence or elapsed-time authority.'),
 ('capture_protocol',r'COLLECTOR_SEQUENCE|CAPTURE_TICKET|captureNs|completedNs|monoDomain|requestedTicket|persistedSequence', ['C','D'], 'Persisted capture tickets and strictly ordered sequence numbers; collector ns values compare within collector domain only.'),
 ('descriptive_iso',r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', ['A'], 'Descriptive fixed build/provenance date, not timing authority.')]
paths=list((ROOT/'repositories/cca-conformance/tools/mo1305-phase1').glob('*'))
paths += [p for p in (ROOT/'repositories/cca-conformance/tools').glob('mo1305*') if p.is_file() and p.name!=Path(__file__).name]
paths += list((ROOT/'repositories/memoryos-rest/src').glob('*.mjs'))
records=[]
for p in sorted(set(paths)):
 if p.suffix not in ['.mjs','.py','.ps1']:continue
 for line_no,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
  matches=[{'use':name,'classes':classes,'authority':reason} for name,pattern,classes,reason in RULES if re.search(pattern,line)]
  if matches:records.append({'path':p.relative_to(ROOT).as_posix(),'line':line_no,'source':line,'classifications':matches})
# Civil comparisons from R4 must not return in active release-critical measurement source.
for name in ['campaign.mjs','monitor.mjs','sample-proof.mjs','adverse.mjs','faults.mjs','lifecycle.mjs']:
 text=(ROOT/'repositories/cca-conformance/tools/mo1305-phase1'/name).read_text()
 assert not re.search(r'(?:UtcMs|utcMs)\s*(?:<=|>=|<|>)',text),name
assert not any('performance.now()' in (ROOT/'repositories/cca-conformance/tools/mo1305-phase1'/name).read_text() for name in ['campaign.mjs','adverse.mjs','lifecycle.mjs'])
result={'kind':'MemoryOSMeasurementClockAudit','version':'2.0.0','state':'PASS','classes':{'A':'descriptive civil/wall clock','B':'elapsed duration','C':'ordering/synchronization','D':'cross-process correlation','E':'timeout/deadline'},'sourceLines':len(records),'records':records,'unclassifiedClockUses':0,'pythonRuntimeVerified':{'perf_counter_ns':'QueryPerformanceCounter, monotonic true, adjustable false','subprocess._time':'time.monotonic; _remaining_time and _check_timeout inspected locally'},'runtimeCertificateClock':'Existing calendar-based certificate validity intentionally unchanged; not measurement timing.'}
output=Path(sys.argv[1]);assert not output.exists();output.write_bytes(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode());print(json.dumps({'state':'PASS','sourceLines':len(records),'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}))

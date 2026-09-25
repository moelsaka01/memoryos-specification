from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/correction-a'
p=ROOT/'docs/mo1306-contract-freeze-1.md'
s=p.read_text(encoding='utf-8')
s=s.replace('Status: **CONTRACT FREEZE 1 ESTABLISHED / PHASE 1 NEXT**.','Status: **CONTRACT FREEZE 1 WITH CORRECTION A / PHASE 1 RESUME AUTHORIZED**.\n\nCorrection A preserves the original freeze at 3537b037e4ea70a726a249d7397f1df15daa2167.\nOnly Windows attributable process accounting is corrected. See the\n[process correction record](mo1306-contract-freeze-1-process-correction.md) for\nthe original two-process assumption, fresh diagnostics and resume gates.')
s=s.replace('never concurrent with the semantic child. The whole product process tree has\nat most the supervisor plus **one** direct child. Child descendants are denied,\nnot later discovered by a broad '+chr(96)+'taskkill'+chr(96)+' against unrelated processes.',"""never concurrent with the semantic child. **Correction A:** the whole attributable
Windows tree has at most three role-bound processes: the pinned Node supervisor,
one direct active workload child (the fixed PowerShell filesystem helper OR the
pinned Node semantic worker), and at most one Windows System32/conhost.exe
owned by that active child. The required third role in the helper phase is the
Windows console host, not a simultaneous semantic worker. No arbitrary three-process topology
is accepted; a fourth attributable process fails validation. Extra helpers,
semantic workers, substituted executables and all other descendants are denied.

The validated headless supervisor launch uses Windows DETACHED_PROCESS with
redirected private pipes and no supervisor-owned console host. The PowerShell
helper itself remains non-detached with its frozen direct argv and private
protocol. A console-owning supervisor that adds another attributable console
host is outside this profile and must fail; never hide it from accounting.
An existing-console launch is admissible only if the same role/ownership
witness passes. Runtime flags and public CLI argv remain unchanged.
The independent Windows observer validates executable identities, PID/parent
and creation identity, command line and phase exclusivity. It fails unexpected
topology; this is not a new kernel process sandbox or arbitrary shell service.
Production denies executable selection and child descendants through the
trusted closure and permission boundary. No broad taskkill targets unrelated
processes. At normal completion, helper/child failure, timeout and handled
cancellation all observed authorized roles must exit within the existing cleanup
allowance. Test parent termination where safe and report externally observed
cleanup; never infer clean cancellation from a killed supervisor alone.""")
s=s.replace('| Processes / concurrency | supervisor + one child, one semantic evaluation, no queue/retry |','| Processes / concurrency | Correction A: at most 3 attributable role-bound processes, one direct helper OR semantic child plus its required Windows console host; one semantic evaluation, no queue/retry |')
s=s.replace('Preliminary acceptance <=768 MiB for supervisor plus child','Preliminary acceptance <=768 MiB for the entire attributable tree (supervisor, active helper OR semantic child, and console host)')
s=s.replace('processCount:2','processCount:3')
s=s.replace('Direct argv supervisor/one child, fixed PS boundary (§13) | No shell service, no child descendants','Direct argv supervisor/one active child plus owned Windows console host, fixed PS boundary (§13) | No shell service, no other descendants')
s=s.replace('Use monotonic elapsed clocks, external Windows RSS/process observation and','Correction A counts every attributable role, including trusted PowerShell and\nits Windows console host, in aggregate RSS. Wall-clock time includes helper\nstartup, protocol, semantic execution, publication and cleanup; no memory or\ntime ceiling is increased. Preserve failure evidence from the original ceiling.\n\nUse monotonic elapsed clocks, external Windows RSS/process observation and')
p.write_text(s,encoding='utf-8')
summary=json.loads((OUT/'diagnostic-summary.json').read_bytes())
model={'kind':'MemoryOSCICDWindowsProcessCorrection','version':'1.0.0','correction':'A','previousMaximum':2,'maximumAttributableProcesses':3,'roles':['pinned-node-supervisor','one-fixed-powershell-helper-OR-pinned-node-semantic-worker','at-most-one-owned-system32-conhost'],'fourthProcess':'FAIL','helperDetached':False,'headlessSupervisorCreationFlags':['DETACHED_PROCESS','CREATE_NEW_PROCESS_GROUP'],'helperSha256':hashlib.sha256(Path(__file__).with_name('check-paths.ps1.txt').read_bytes()).hexdigest(),'nodeSha256':summary['identities']['node']['sha256'],'aggregateRssMiB':768,'helperMs':2000,'terminationMs':2000,'overallAllowanceMs':15000,'normalSemanticMaxMs':60000,'platform':'native Windows x64','arbitraryShell':False,'linuxOrVmRequired':False}
(OUT/'process-model.json').write_text(json.dumps(model,indent=2)+'\n',encoding='utf-8')

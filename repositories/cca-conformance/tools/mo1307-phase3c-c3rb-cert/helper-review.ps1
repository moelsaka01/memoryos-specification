param([string] $RepoRoot = 'C:\m7c', [switch] $Verify)
# Static source analysis only. No native helper, runtime or package campaign runs.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
if ([IO.Path]::GetFullPath($RepoRoot).TrimEnd('\') -cne 'C:\m7c') { throw 'Unexpected review workspace' }
$originalRoot = 'C:\Users\melsa\Documents\Codex\cca-mo1307-3c'
$baseline = '976d4a04d75dadc02e30215dd5a8ddeaa2352df8'
$candidateCommit = 'defe93989efc6501b1a730b82e79e705884b269b'
$ev = 'repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert'
$tool = 'repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert/helper-review.ps1'
$helper = 'repositories/memoryos-readiness/helpers/windows-inspect.ps1'
$old = 'repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/oracle/b2-windows-inspect.ps1'
function Assert-Review([bool] $Condition, [string] $Message) { if (-not $Condition) { throw ('SOURCE_REVIEW_FAILED: ' + $Message) } }
function Bind([string] $Relative, [string] $Root = $RepoRoot) {
    $p = Join-Path $Root $Relative
    $bytes = [IO.File]::ReadAllBytes($p)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
    return [ordered] @{ path = $Relative; byteLength = $bytes.Length; sha256 = 'sha256:' + $digest }
}
function Git-Text([string[]] $Arguments) {
    $v = & git -C $RepoRoot @Arguments
    Assert-Review ($LASTEXITCODE -eq 0) ('git failed: ' + ($Arguments -join ' '))
    return ($v -join "`n").Trim()
}
function Save-Review([string] $Name, $Value) {
    $destination = Join-Path $RepoRoot ($ev + '/' + $Name)
    $text = ($Value | ConvertTo-Json -Depth 30) + "`n"
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($text)
    if ($Verify) {
        Assert-Review ([IO.File]::ReadAllText($destination) -ceq $text) ('review receipt differs: ' + $Name)
    } else {
        $stream = [IO.FileStream]::new($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
        try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    }
}
$oldBinding = Bind $old
$newBinding = Bind $helper
$originalBinding = Bind $helper $originalRoot
Assert-Review ($oldBinding.sha256 -ceq 'sha256:ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b') 'old helper SHA256'
Assert-Review ($oldBinding.byteLength -eq 29771) 'old helper byte length'
Assert-Review ($newBinding.sha256 -ceq 'sha256:35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8') 'candidate helper SHA256'
Assert-Review ($newBinding.byteLength -eq 30210) 'candidate helper byte length'
Assert-Review ($originalBinding.sha256 -ceq $oldBinding.sha256) 'original 3C helper must equal old helper'
Assert-Review ((Git-Text @('hash-object', $helper)) -ceq (Git-Text @('rev-parse', ($candidateCommit + ':' + $helper)))) 'candidate commit helper binding'
$oldText = [IO.File]::ReadAllText((Join-Path $RepoRoot $old))
$newText = [IO.File]::ReadAllText((Join-Path $RepoRoot $helper))
$removed = '        Assert-Root $observed' + "`n"
Assert-Review (($oldText.Split(@($removed), [StringSplitOptions]::None)).Count -eq 2) 'removed command must occur once'
$oldTokens = $null; $newTokens = $null; $oldErrors = $null; $newErrors = $null
$oldAst = [System.Management.Automation.Language.Parser]::ParseInput($oldText.Replace($removed, ''), [ref] $oldTokens, [ref] $oldErrors)
$newAst = [System.Management.Automation.Language.Parser]::ParseInput($newText, [ref] $newTokens, [ref] $newErrors)
Assert-Review ($oldErrors.Count -eq 0 -and $newErrors.Count -eq 0) 'PowerShell parsing'
$ot = @($oldTokens | Where-Object { $_.Kind -notin @('Comment', 'NewLine', 'EndOfInput') } | ForEach-Object { $_.Kind.ToString() + ':' + $_.Text })
$nt = @($newTokens | Where-Object { $_.Kind -notin @('Comment', 'NewLine', 'EndOfInput') } | ForEach-Object { $_.Kind.ToString() + ':' + $_.Text })
Assert-Review ($ot.Count -eq 5256 -and $nt.Count -eq 5256) 'executable token counts'
Assert-Review ([string]::Join("`n", $ot) -ceq [string]::Join("`n", $nt)) 'all remaining executable tokens identical'
$commands = @($newAst.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true))
$dynamic = @($commands | Where-Object { $null -eq $_.GetCommandName() })
Assert-Review ($dynamic.Count -eq 0) 'no dynamically selected PowerShell command'
function Call-Sites([string] $Name) {
    return @($commands | Where-Object { $_.GetCommandName() -ceq $Name } | ForEach-Object {
        $owner = $_.Parent
        while ($null -ne $owner -and $owner -isnot [System.Management.Automation.Language.FunctionDefinitionAst]) { $owner = $owner.Parent }
        [ordered] @{ command = $Name; owner = $(if ($null -eq $owner) { 'script' } else { $owner.Name }); line = $_.Extent.StartLineNumber; text = $_.Extent.Text }
    })
}
$readCalls = @(Call-Sites 'Read-Identity'); $openCalls = @(Call-Sites 'Open-Chain'); $stableCalls = @(Call-Sites 'Assert-ChainStable')
Assert-Review (($readCalls.line -join ',') -ceq '248,259,262') 'complete Read-Identity call inventory'
Assert-Review (($openCalls.line -join ',') -ceq '283,289,337') 'complete Open-Chain call inventory'
Assert-Review (($stableCalls.line -join ',') -ceq '313,322,344') 'complete Assert-ChainStable call inventory'
$nativeCalls = @($newAst.FindAll({ param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Expression.Extent.Text -eq '$script:native' }, $true) | ForEach-Object { [ordered] @{ method = $_.Member.Value; line = $_.Extent.StartLineNumber; text = $_.Extent.Text } })
Assert-Review ($nativeCalls.Count -eq 19) 'native invocation inventory'
$pathWrites = @($newAst.FindAll({ param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -match '\.(path|identity|handle|directory)(\s|$)' }, $true))
Assert-Review ($pathWrites.Count -eq 0) 'no chain entry path or identity reassignment'
$sharedPaths = @('contracts/definitions.json', 'src/helper-protocol.mjs', 'src/helper-transport.mjs', 'src/runtime.mjs', 'src/acquisition.mjs', 'src/publication.mjs', 'src/windows-paths.mjs', 'src/cli.mjs')
$unchanged = @($sharedPaths | ForEach-Object {
    $p = 'repositories/memoryos-readiness/' + $_
    $currentObject = Git-Text @('hash-object', $p)
    $baselineObject = Git-Text @('rev-parse', ($baseline + ':' + $p))
    Assert-Review ($currentObject -ceq $baselineObject) ('shared source changed: ' + $p)
    [ordered] @{ binding = (Bind $p); baselineGitBlob = $baselineObject; currentGitBlob = $currentObject; unchanged = $true }
})
$definitions = Get-Content -LiteralPath (Join-Path $RepoRoot 'repositories/memoryos-readiness/contracts/definitions.json') -Raw | ConvertFrom-Json
$expectedLimits = [ordered] @{ helperDeadlineMs = 5000; helperAggregateDeadlineMs = 20000; cliDeadlineMs = 30000; apiDeadlineMs = 10000; cleanupAllowanceMs = 2000; helperRequests = 9; helperVerifyRequests = 4 }
foreach ($key in $expectedLimits.Keys) { Assert-Review ($definitions.limits.$key -eq $expectedLimits[$key]) ('resource limit ' + $key) }
$provenance = [ordered] @{ executionKind = 'STATIC_SOURCE_PARSE_ONLY'; parserVersion = $PSVersionTable.PSVersion.ToString(); script = (Bind $tool); sourceBasisCommit = $candidateCommit; preOptimizationCommit = $baseline; original3CWorkspace = $originalRoot; nativeHelperRuns = 0; runtimeCertification = $false; packageCertification = $false; historicalEvidenceReusedAsCurrentExecution = $false }
$delta = [ordered] @{ kind = 'MO1307Phase3CRefreshHelperDeltaReview'; version = '1.0.0'; result = 'PASS'; scope = 'Fresh static helper delta and dependency boundary review; dynamic tests are separate evidence.'; provenance = $provenance; oldHelper = $oldBinding; original3CHelper = $originalBinding; candidateHelper = $newBinding
    mechanicalProof = [ordered] @{ deletedExecutableStatement = 'Assert-Root $observed'; removedStatementOccurrences = 1; addedCommentLines = 6; deletedLines = 1; executableTokensAfterDeletion = 5256; candidateExecutableTokens = 5256; remainingTokenSequenceIdentical = $true; oldParseErrors = 0; newParseErrors = 0; nativeInvocationSites = 19; changedNativeCalls = 0; freshNativeObservationsRemoved = 0; additionalProductionCachesOrMetadata = 0; dynamicCommandSites = 0 }; unchangedSharedSources = $unchanged; nativeCallSites = $nativeCalls; limits = $expectedLimits
    preserved = @('GetFileInformationByHandle, GetFileType and GetFinalPathNameByHandleW execute on every successful Read-Identity invocation; unchanged earlier fail-fast rejections can exit before later observations.', 'Same native prefix, count, ordinary-disk, type, reparse, hardlink and volume checks remain in their original order.', 'The observed native finalPath remains returned unchanged, then all seven identity fields are compared case-sensitively after reading.', 'Parent lifetime, fixed helper launch, sanitized environment, request framing, serializer and error codes are unchanged.')
    errorEquivalence = 'The removed observed-path parser and the retained full-path mismatch check both fail MO1307_FILESYSTEM_BOUNDARY; no side effect occurs between them. A matching observed path has the validated expected path grammar under OrdinalIgnoreCase.'
    limitations = @('Token equality and call-site data are mechanically checked; control/data-flow argument is explicit source review below.', 'Static source review does not claim native race coverage, measured deadlines, runtime certification or package certification.') }
Save-Review 'helper-delta-review.json' $delta
$dominance = [ordered] @{ kind = 'MO1307Phase3CRefreshCallSiteDominance'; version = '1.0.0'; result = 'PASS'; provenance = $provenance; helper = $newBinding; readIdentityCallCount = 3; readIdentityCalls = $readCalls; openChainCallCount = 3; openChainCalls = $openCalls; stableChainCallCount = 3; stableChainCalls = $stableCalls; chainMemberReassignmentCount = 0
    pathValidation = @([ordered] @{ lines = @(33,34,37,38,39,414,415,422); proof = 'Each request root passes Assert-Root, converts slash to backslash, then enters a request-local Dictionary[string,string]. No observation-derived value enters that dictionary.' }, [ordered] @{ lines = @(41,42,43,46,434,435,436); proof = 'File relative segments pass Assert-Relative, are converted to backslashes and appended to a validated root. Full length and case-insensitive duplicate checks precede acquisition.' }, [ordered] @{ lines = @(233,234,235,236,237,238,239,242,247,248,250); proof = 'Every Open-Chain call validates its complete path before building drive-root and complete-segment prefixes. Each prefix is no longer than the validated full path. Expected strings are retained in local entries independently of identity.finalPath.' })
    readIdentityDominance = @([ordered] @{ callLine = 248; owner = 'Open-Chain'; dominatingValidationLine = 234; value = '$paths[$index]'; proof = 'The only initial Read-Identity call follows full-path validation and prefix construction within the same function.' }, [ordered] @{ callLine = 259; owner = 'Assert-ChainStable'; dominatingProducers = @(283,289,337); value = '$entry.path'; proof = 'All callers supply chains returned by Open-Chain; there are no assignments to entry path, identity, handle or directory members.' }, [ordered] @{ callLine = 262; owner = 'Assert-ChainStable'; dominatingProducers = @(283,289,337); value = '$entry.path'; proof = 'The freshly reopened handle is opened with the same retained validated expected path at line 261, then independently observed and disposed.' })
    freshness = @([ordered] @{ phase = 'initial'; lines = @(188,200,210,212,223,247,248,251); proof = 'Each component gets an actual native open, identity, disk type and final path. Full equality and common-volume enforcement remain.' }, [ordered] @{ phase = 'post-read-held-and-fresh'; lines = @(300,301,305,309,310,311,313,259,261,262,263); proof = 'A borrowed wrapper reads the checked leaf handle without closing the owner. Every component then has both held-handle reobservation and fresh-path open/reobservation, compared against the complete original identity.' }, [ordered] @{ phase = 'final-root'; lines = @(322,259,261,262); proof = 'Every initial root chain receives fresh held and reopened observations after all requested files finish.' }, [ordered] @{ phase = 'publication'; lines = @(337,344,259,261,262); proof = 'Each publication chain is freshly opened and fully checked, including held and reopened observations; no acquisition observation cache substitutes for them.' })
    publicationFlows = @([ordered] @{ operation = 'CHECK_OUTPUT'; producer = 'src/acquisition.mjs:81 and src/publication.mjs:165'; helperLines = @(327,332,333,334,335,337,339,344); path = 'Validated output root parent via GetDirectoryName; non-drive-root output enforced; target absence checked natively.' }, [ordered] @{ operation = 'INSPECT_OUTPUT_ROOT'; producer = 'src/publication.mjs:170'; helperLines = @(327,329,337,344); path = 'The request-local validated output root.' }, [ordered] @{ operation = 'CHECK_STAGE_ROOT'; producer = 'src/publication.mjs:193'; helperLines = @(327,329,337,344); path = 'The request-local validated output root.' }, [ordered] @{ operation = 'INSPECT_PENDING'; producer = 'src/publication.mjs:219'; helperLines = @(327,328,336,337,344,445); path = 'Validated output root plus fixed memoryos-readiness-result.json.pending segment; full length checked before native invocation.' }, [ordered] @{ operation = 'CHECK_FINALIZATION'; producer = 'src/publication.mjs:257'; helperLines = @(327,328,336,337,340,341,344,445); path = 'Same fixed pending path and a separate native absence check of fixed final filename.' })
    requestScope = [ordered] @{ rootsDictionary = 408; chains = @(276,283,289,337); entries = 242; paths = 235; processRequests = 1; loopsAcrossRequests = 0; nativeObservationCache = $false; crossRequestCache = $false; durableCache = $false; cleanupLines = @(254,263,320,324,347) }
    equalityBoundary = 'OrdinalIgnoreCase equality to ordinary drive path prefixes preserves delimiters, control/ADS exclusions, dot/trailing-character exclusions and reserved device-name exclusions. Unicode letter case variation cannot introduce those lexical delimiters. Original observed spelling is kept in identity.finalPath and later compared case-sensitively.' }
Save-Review 'call-site-dominance.json' $dominance
$scanPatterns = [ordered] @{ debugInstrumentation = 'Oracle-|instrument|telemetry|DEBUG|Trace-|Write-Host|Write-Debug|Write-Verbose|Write-Output|Start-Transcript'; ambientEnvironmentReads = '\$env:|GetEnvironmentVariable|EnvironmentVariables'; network = 'Invoke-WebRequest|Invoke-RestMethod|WebClient|HttpClient|TcpClient|UdpClient|System\.Net|https?://'; secretKeywords = 'TOKEN|PASSWORD|SECRET|AUTHORIZATION|BEARER|PRIVATE KEY'; cacheAndUnexpectedIO = 'cache|memoiz|Get-Content|ReadAll|WriteAll|Out-File|Set-Content|Add-Type|Invoke-Expression|Start-Process' }
$scans = @($scanPatterns.Keys | ForEach-Object { $category = $_; $matches = @([regex]::Matches($newText, $scanPatterns[$category], [Text.RegularExpressions.RegexOptions]::IgnoreCase)); Assert-Review ($matches.Count -eq 0) ('unexpected helper residue: ' + $category); [ordered] @{ category = $category; pattern = $scanPatterns[$category]; matches = $matches.Count } })
$security = [ordered] @{ kind = 'MO1307Phase3CRefreshNetworkSecretsSourceReview'; version = '1.0.0'; result = 'PASS'; provenance = $provenance; helper = $newBinding; scans = $scans; scanClasses = 5; totalMatches = 0
    fixedLaunch = [ordered] @{ source = (Bind 'repositories/memoryos-readiness/src/helper-transport.mjs'); lines = @(9,10,11,12,15,16,17,18,19,20,23,25,32,35,39,40); executable = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'; fixedArguments = @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','<package>/helpers/windows-inspect.ps1'); fixedCwd = '<package>'; environment = [ordered] @{ SystemRoot = 'C:\Windows'; WINDIR = 'C:\Windows' }; windowsHide = $true; detached = $false; shell = $false; stdio = @('pipe','pipe','pipe'); observation = 'Module-relative source, fixed executable and argument array; public package exports only src/index.mjs, with no public launch override. Internal spawn test seam is unchanged.' }
    deadlineBinding = [ordered] @{ source = (Bind 'repositories/memoryos-readiness/src/runtime.mjs'); constants = $expectedLimits; lines = @(33,51,52,58,72,79,80,89,90,93,99,105,108,113,114,116,129,134,136,137,138,140,145); additionalSequenceEnforcement = 'src/helper-protocol.mjs:192-194,200,208,217,228,232'; lateReplyRechecks = 'src/helper-transport.mjs:52-71'; observation = 'All deadlines use the same unchanged supervisor and sequence checks. Completion and separately closed pipes/process are observed before success; lease checkpoints prevent late success; cleanup still requires quiescence.' }
    diagnostics = [ordered] @{ lines = @(354,360,472,473,474,475,476,479,480,485,488,493,495,496); observation = 'Startup emits no diagnostics; exception text is mapped to four fixed code values. Only bounded canonical framed protocol output is written to saved stdout. No debug files or diagnostic stderr writer exists.' }
    nativeBoundary = [ordered] @{ signatures = 14; invocationSites = 19; dll = 'kernel32.dll'; newSignatures = 0; generatedDiskSource = $false; externalCompiler = $false; consolePolicy = 'Exclusive helper-owned conhost identity, detach, bounded termination and exit check at lines 129-180; unchanged.' }
    controlSources = @('repositories/cca-conformance/tests/mo1307_phase1_native_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_runtime_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_launch_policy_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_surfaces_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_api_bootstrap_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_publication_test.mjs', 'repositories/cca-conformance/tests/mo1307_phase2c_finalization_test.mjs', 'repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/equivalence.mjs', 'repositories/cca-conformance/tools/mo1307-phase2c-final-native/helper-filesystem.mjs', 'repositories/cca-conformance/tools/mo1307-phase2c-final-native/environment.mjs')
    limitations = @('Five zero-match scans supplement source inspection and exact delta proof; they do not establish absence of every possible secret or dynamic behavior.', 'Dynamic negative, deadline, environment, process and freshness controls are recorded separately; no prior PASS is treated as current execution.') }
Save-Review 'network-secrets-source.json' $security
[ordered] @{ result = 'PASS'; mode = $(if ($Verify) { 'VERIFY' } else { 'CREATE' }); executableTokens = 5256; readIdentityCalls = 3; openChainCalls = 3; stableChainCalls = 3; nativeCallSites = 19; helperResidueMatches = 0; nativeHelperRuns = 0 } | ConvertTo-Json -Compress

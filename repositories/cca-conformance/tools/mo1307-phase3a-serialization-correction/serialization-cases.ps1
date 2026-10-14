# Engineering-only pure serializer process. No native helper initialization,
# filesystem acquisition, console ownership code or production deadline runs.
param([Parameter(Mandatory=$true)][string]$OracleEngine,
      [Parameter(Mandatory=$true)][string]$CandidateEngine,
      [Parameter(Mandatory=$true)][string]$FrameDirectory)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or -not [Environment]::Is64BitProcess) { exit 22 }
$oracle = [ScriptBlock]::Create([IO.File]::ReadAllText($OracleEngine))
$candidate = [ScriptBlock]::Create([IO.File]::ReadAllText($CandidateEngine))
$utf8 = [Text.UTF8Encoding]::new($false, $true)

function Send-Record($Value) { [Console]::Out.WriteLine((ConvertTo-Json -InputObject $Value -Depth 12 -Compress)); [Console]::Out.Flush() }
function New-Identity([long]$Length, [bool]$Directory, [string]$Path, [long]$Number = 1) {
    return [pscustomobject]@{ attributes = [long]$(if ($Directory) { 16 } else { 32 }); byteLength = $Length;
        fileId = $Number.ToString('x16'); finalPath = $Path; isDirectory = $Directory; linkCount = 1L; volumeSerial = '00000001' }
}
function Payload-Chunks([int]$Length) {
    $bytes = [byte[]]::new($Length)
    $first = [Math]::Min(256, $Length)
    for ($i = 0; $i -lt $first; $i++) { $bytes[$i] = [byte]$i }
    $used = $first
    while ($used -lt $Length) { $take = [Math]::Min($used, $Length - $used); [Buffer]::BlockCopy($bytes, 0, $bytes, $used, $take); $used += $take }
    $encoded = [Convert]::ToBase64String($bytes)
    $chunks = [Collections.Generic.List[string]]::new()
    for ($i = 0; $i -lt $encoded.Length; $i += 4096) { $chunks.Add($encoded.Substring($i, [Math]::Min(4096, $encoded.Length - $i))) }
    return ,$chunks.ToArray()
}
function Mutation-Value($Mutation) {
    switch -CaseSensitive ($Mutation.kind) {
        'string' {
            switch -CaseSensitive ($Mutation.value) {
                'ascii' { return 'ordinary ASCII value' }
                'quotes' { return 'C:\quoted"segment\leaf' }
                'backslashes' { return '\\server\share\a\b' }
                'empty' { return '' }
                'unicode' { return ('C:\' + [char]0x00e9 + [char]0x03a9 + [char]0x4e2d + [char]0x2028 + [char]0x2029) }
                'paired-surrogate' { return ('C:\' + [char]0xd83d + [char]0xde00) }
                'lone-high' { return ('C:\' + [char]0xd83d) }
                'lone-low' { return ('C:\' + [char]0xde00) }
                'nul' { return ('C:\' + [char]0) }
                'control' { return ('C:\' + [char]0x1f) }
                'newline' { return "C:\`nleaf" }
                'del' { return ('C:\' + [char]0x7f) }
                'length-4096' { return ('x' * 4096) }
                'length-4097' { return ('x' * 4097) }
                default { throw 'UNKNOWN_STRING_CASE' }
            }
        }
        'integer' { return [long]::Parse([string]$Mutation.value, [Globalization.CultureInfo]::InvariantCulture) }
        'double' { return [double]::Parse([string]$Mutation.value, [Globalization.CultureInfo]::InvariantCulture) }
        'boolean' { return [bool]$Mutation.value }
        'null' { return $null }
        default { throw 'UNKNOWN_MUTATION_KIND' }
    }
}
function New-CaseState($Spec) {
    $files = [Collections.Generic.List[object]]::new()
    $roots = [Collections.Generic.List[object]]::new()
    if ($Spec.operation -ceq 'READ_SET') {
        foreach ($id in $Spec.rootIds) {
            $rootPath = if ($id -ceq 'input') { 'C:\root' } else { 'D:\result' }
            $roots.Add([pscustomobject]@{ id = [string]$id; identity = (New-Identity 0 $true $rootPath) })
        }
        $index = 0
        foreach ($size in $Spec.fileLengths) {
            $fileRoot = if ($Spec.rootIds.Length -gt 1 -and $index % 2 -eq 1) { 'D:\result' } else { 'C:\root' }
            $files.Add([pscustomobject]@{ id = ('file' + $index.ToString('d3')); identity = (New-Identity ([long]$size) $false ($fileRoot + '\f' + $index + '.bin') ($index + 16)); bytes = (Payload-Chunks ([int]$size)) })
            $index++
        }
    } else {
        $pending = $Spec.operation -cin @('INSPECT_PENDING', 'CHECK_FINALIZATION')
        $id = if ($Spec.operation -ceq 'CHECK_OUTPUT') { 'output-parent' } elseif ($pending) { 'pending' } else { 'output' }
        $chain = [Collections.Generic.List[object]]::new()
        $current = 'C:\'
        for ($i = 0; $i -lt $Spec.chainLength; $i++) {
            $isDirectory = -not ($pending -and $i -eq $Spec.chainLength - 1)
            if ($i -gt 0) { $current = $current.TrimEnd('\') + $(if ($isDirectory) { '\a' } else { '\memoryos-readiness-result.json.pending' }) }
            $chain.Add((New-Identity $(if ($isDirectory) { 0 } else { 17 }) $isDirectory $current ($i + 1)))
        }
        $roots.Add([pscustomobject]@{ id = $id; chain = $chain.ToArray() })
    }
    if ($null -ne $Spec.frameFill) {
        $chunks = [Collections.Generic.List[string]]::new()
        $full = [Convert]::ToBase64String([byte[]]::new(3072))
        for ($i = 0; $i -lt $Spec.frameFill.fullChunks; $i++) { $chunks.Add($full) }
        if ($Spec.frameFill.tailChars -gt 0) { $chunks.Add([Convert]::ToBase64String([byte[]]::new([int]($Spec.frameFill.tailChars / 4 * 3)))) }
        $files[0].bytes = $chunks.ToArray()
        $files[0].identity.finalPath += ('x' * $Spec.frameFill.pathPadding)
    }
    $status = if ($Spec.operation -ceq 'CHECK_OUTPUT') { 'ABSENT' } elseif ($Spec.operation -ceq 'CHECK_FINALIZATION') { 'FINAL_ABSENT' } else { 'OK' }
    $state = [pscustomobject]@{ code = $Spec.code; operation = $Spec.operation; sequence = [int]$Spec.sequence; session = ('b' * 64);
        nativeResult = [pscustomobject]@{ files = $files.ToArray(); roots = $roots.ToArray(); status = $status } }
    if ($Spec.earlyDefaults) { $state.session = '0' * 64 }
    if ($null -ne $Spec.mutation) {
        $value = Mutation-Value $Spec.mutation
        switch -CaseSensitive ($Spec.mutation.target) {
            'fileIdentity' { $state.nativeResult.files[0].identity.($Spec.mutation.field) = $value }
            'file' { $state.nativeResult.files[0].($Spec.mutation.field) = $value }
            'root' { $state.nativeResult.roots[0].($Spec.mutation.field) = $value }
            'outer' { $state.($Spec.mutation.field) = $value }
            'nativeResult' { $state.nativeResult.($Spec.mutation.field) = $value }
            'chunk' { $state.nativeResult.files[0].bytes = @($value) }
            default { throw 'UNKNOWN_MUTATION_TARGET' }
        }
    }
    return $state
}
function Save-Frame([string]$Name, [byte[]]$Bytes) {
    $target = [IO.Path]::Combine($FrameDirectory, $Name + '.bin')
    $file = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $file.Write($Bytes, 0, $Bytes.Length) } finally { $file.Dispose() }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
    return [pscustomobject]@{ path = $target; byteLength = $Bytes.Length; sha256 = ('sha256:' + $digest) }
}
Send-Record ([pscustomobject]@{ event = 'ready'; powerShellVersion = $PSVersionTable.PSVersion.ToString(); is64Bit = [Environment]::Is64BitProcess; nativeInitialization = $false })
while ($null -ne ($line = [Console]::In.ReadLine())) {
    try {
        $command = ConvertFrom-Json -InputObject $line
        if ($command.command -ceq 'stop') { Send-Record ([pscustomobject]@{ event = 'stopped' }); exit 0 }
        if ($command.command -cne 'case' -or $command.spec.id -cnotmatch '^[a-z0-9-]+$') { throw 'INVALID_ENGINEERING_COMMAND' }
        # Fresh independent state for both encoders prevents mutation by one
        # implementation from influencing the other implementation's input.
        $oldState = New-CaseState $command.spec
        $newState = New-CaseState $command.spec
        [byte[]]$oldBytes = & $oracle $oldState
        [byte[]]$newBytes = & $candidate $newState
        $same = [Collections.StructuralComparisons]::StructuralEqualityComparer.Equals($oldBytes, $newBytes)
        $oldPin = Save-Frame ($command.spec.id + '.oracle') $oldBytes
        $newPin = Save-Frame ($command.spec.id + '.candidate') $newBytes
        Send-Record ([pscustomobject]@{ event = 'case'; id = $command.spec.id; exactEquality = $same; oracle = $oldPin; candidate = $newPin })
        if (-not $same) { exit 23 }
        # Parent independently validates complete bytes before sending another
        # case. No future case executes merely because prior hashes matched.
    } catch {
        Send-Record ([pscustomobject]@{ event = 'engine-error'; message = $_.Exception.Message; detail = $_.ScriptStackTrace })
        exit 24
    }
}
exit 0

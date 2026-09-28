# MemoryOS readiness Phase 1 private protocol foundation; Windows PowerShell 5.1.
# This fixed script has no acquisition implementation, filesystem writes, module
# imports, executable selection, interpolation, command evaluation or network.
# A valid request deliberately returns MO1307_INTERNAL until Phase 2C supplies
# checked-handle acquisition. Protocol validation must never fabricate snapshots.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$requestCeiling = 65536
$responseCeiling = 16777216
$sequence = 1
$operation = 'READ_SET'
$session = '0000000000000000000000000000000000000000000000000000000000000000'
$code = 'MO1307_INPUT'

function Reject-Protocol([string] $ErrorCode = 'MO1307_INPUT') {
    throw [System.InvalidOperationException]::new($ErrorCode)
}
function Assert-Keys($Value, [string[]] $Expected) {
    if ($null -eq $Value -or $Value -isnot [System.Management.Automation.PSCustomObject]) { Reject-Protocol }
    $actual = @($Value.PSObject.Properties.Name)
    [Array]::Sort($actual, [StringComparer]::Ordinal)
    if (($actual -join ',') -cne ($Expected -join ',')) { Reject-Protocol }
}
function Assert-Id([string] $Value) {
    if ($Value -cnotmatch '^[a-z][a-z0-9._-]{0,63}$') { Reject-Protocol }
}
function Assert-Segment([string] $Value) {
    if ($Value.Length -eq 0 -or $Value -eq '.' -or $Value -eq '..' -or $Value -match '[. ]$' -or
        $Value -match '[\x00-\x1f\x7f<>:"/\\|?*]' -or
        $Value -match '^(?i:CON|PRN|AUX|NUL|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])(?:\.|$)') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
}
function Assert-Root($Value) {
    if ($Value -isnot [string] -or $Value.Length -gt 240 -or $Value -cnotmatch '^[A-Za-z]:[\\/]') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    $ordinary = $Value.Replace('/', '\')
    if ($ordinary.Length -gt 3 -and $ordinary.EndsWith('\')) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
    if ($ordinary.Length -gt 3) { foreach ($part in $ordinary.Substring(3).Split('\')) { Assert-Segment $part } }
}
function Assert-Relative($Value) {
    if ($Value -isnot [string] -or $Value.Length -lt 1 -or $Value.Length -gt 180 -or
        $Value -cnotmatch '^[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    foreach ($part in $Value.Split('/')) { Assert-Segment $part }
}
function Encode-String([string] $Value) {
    if ($Value.Length -gt 4096) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    $builder = [System.Text.StringBuilder]::new()
    [void] $builder.Append('"')
    for ($i = 0; $i -lt $Value.Length; $i++) {
        $c = $Value[$i]
        if ([int] $c -lt 32 -or [int] $c -eq 127) { Reject-Protocol }
        if ([char]::IsHighSurrogate($c)) {
            if ($i + 1 -ge $Value.Length -or -not [char]::IsLowSurrogate($Value[$i + 1])) { Reject-Protocol }
            [void] $builder.Append($c)
            $i++
            [void] $builder.Append($Value[$i])
        } elseif ([char]::IsLowSurrogate($c)) { Reject-Protocol }
        elseif ($c -eq '"') { [void] $builder.Append('\"') }
        elseif ($c -eq '\') { [void] $builder.Append('\\') }
        else { [void] $builder.Append($c) }
    }
    [void] $builder.Append('"')
    return $builder.ToString()
}
function Encode-Value($Value, [int] $Depth = 1) {
    if ($Depth -gt 16) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [string]) { return Encode-String $Value }
    if ($Value -is [bool]) { if ($Value) { return 'true' } else { return 'false' } }
    if ($Value -is [int] -or $Value -is [long]) {
        if ($Value -lt 0 -or $Value -gt 9007199254740991) { Reject-Protocol }
        return $Value.ToString([Globalization.CultureInfo]::InvariantCulture)
    }
    if ($Value -is [array]) {
        $parts = [System.Collections.Generic.List[string]]::new()
        foreach ($item in $Value) { $parts.Add((Encode-Value $item ($Depth + 1))) }
        return '[' + ($parts -join ',') + ']'
    }
    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        $keys = @($Value.PSObject.Properties.Name)
        if ($keys.Length -gt 64) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
        [Array]::Sort($keys, [StringComparer]::Ordinal)
        $parts = [System.Collections.Generic.List[string]]::new()
        foreach ($key in $keys) {
            if ($key.Length -gt 64 -or $key -match '[^\x20-\x7e]') { Reject-Protocol }
            $parts.Add((Encode-String $key) + ':' + (Encode-Value $Value.$key ($Depth + 1)))
        }
        return '{' + ($parts -join ',') + '}'
    }
    Reject-Protocol
}

try {
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
        -not [Environment]::Is64BitProcess) { Reject-Protocol }
    $stdin = [Console]::OpenStandardInput()
    $header = [byte[]]::new(4)
    $used = 0
    while ($used -lt 4) {
        $count = $stdin.Read($header, $used, 4 - $used)
        if ($count -eq 0) { Reject-Protocol }
        $used += $count
    }
    $size = [long] $header[0] * 16777216 + [long] $header[1] * 65536 + [long] $header[2] * 256 + $header[3]
    if ($size + 4 -gt $requestCeiling) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    $body = [byte[]]::new([int] $size)
    $used = 0
    while ($used -lt $body.Length) {
        $count = $stdin.Read($body, $used, $body.Length - $used)
        if ($count -eq 0) { Reject-Protocol }
        $used += $count
    }
    if ($stdin.ReadByte() -ne -1) { Reject-Protocol }
    $utf8 = [System.Text.UTF8Encoding]::new($false, $true)
    $text = $utf8.GetString($body)
    # Bound nesting before the system JSON parser. Quoted/escaped punctuation
    # cannot affect the depth counter. Canonical equality rejects duplicate keys,
    # alternate escapes, whitespace, exponent/fraction syntax and BOM afterward.
    $depth = 0; $quoted = $false; $escaped = $false
    foreach ($c in $text.ToCharArray()) {
        if ($quoted) {
            if ($escaped) { $escaped = $false }
            elseif ($c -eq '\') { $escaped = $true }
            elseif ($c -eq '"') { $quoted = $false }
        } elseif ($c -eq '"') { $quoted = $true }
        elseif ($c -eq '{' -or $c -eq '[') { $depth++; if ($depth -gt 16) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' } }
        elseif ($c -eq '}' -or $c -eq ']') { $depth-- }
    }
    $request = ConvertFrom-Json -InputObject $text
    if (((Encode-Value $request) + "`n") -cne $text) { Reject-Protocol }
    Assert-Keys $request @('files', 'kind', 'operation', 'roots', 'sequence', 'session', 'version')
    if ($request.kind -isnot [string] -or $request.version -isnot [string] -or $request.operation -isnot [string] -or
        $request.kind -cne 'MemoryOSReadinessHelperRequest' -or $request.version -cne '2.0.0' -or
        $request.session -isnot [string] -or $request.session -cnotmatch '^[a-f0-9]{64}$' -or
        $request.operation -cnotin @('READ_SET', 'CHECK_OUTPUT', 'INSPECT_OUTPUT_ROOT', 'CHECK_STAGE_ROOT', 'INSPECT_PENDING', 'CHECK_FINALIZATION') -or
        $request.sequence -isnot [int] -or $request.sequence -lt 1 -or $request.sequence -gt 9 -or
        $request.roots -isnot [array] -or $request.files -isnot [array]) { Reject-Protocol }
    $sequence = $request.sequence; $operation = $request.operation; $session = $request.session
    if ($request.roots.Length -gt 3 -or $request.files.Length -gt 128) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    $roots = [System.Collections.Generic.Dictionary[string,string]]::new([StringComparer]::Ordinal)
    $prior = $null
    foreach ($root in $request.roots) {
        Assert-Keys $root @('id', 'path')
        if ($root.id -isnot [string] -or $root.id -cnotin @('input', 'result', 'output') -or
            ($null -ne $prior -and [StringComparer]::Ordinal.Compare($prior, $root.id) -ge 0)) { Reject-Protocol }
        Assert-Root $root.path
        $rootPath = $root.path.Replace('/', '\')
        foreach ($existing in $roots.Values) {
            $a = $existing.TrimEnd('\') + '\'; $b = $rootPath.TrimEnd('\') + '\'
            if ($a.StartsWith($b, [StringComparison]::OrdinalIgnoreCase) -or $b.StartsWith($a, [StringComparison]::OrdinalIgnoreCase)) {
                Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
            }
        }
        $roots.Add($root.id, $rootPath); $prior = $root.id
    }
    $prior = $null
    $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($file in $request.files) {
        Assert-Keys $file @('id', 'maxBytes', 'path', 'root')
        if ($file.id -isnot [string] -or $file.root -isnot [string]) { Reject-Protocol }
        Assert-Id $file.id
        if (($null -ne $prior -and [StringComparer]::Ordinal.Compare($prior, $file.id) -ge 0) -or
            -not $roots.ContainsKey($file.root) -or $file.root -ceq 'output' -or
            $file.maxBytes -isnot [int] -or $file.maxBytes -lt 0) { Reject-Protocol }
        if ($file.maxBytes -gt 4194304 -or ($sequence -eq 3 -and $file.maxBytes -gt 2097152)) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
        Assert-Relative $file.path
        $full = $roots[$file.root].TrimEnd('\') + '\' + $file.path.Replace('/', '\')
        if ($full.Length -gt 240 -or -not $seen.Add($full)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $prior = $file.id
    }
    $ids = @($request.files | ForEach-Object { $_.id }) -join ','
    if ($operation -cne 'READ_SET') {
        $publicationOperations = @('CHECK_OUTPUT', 'INSPECT_OUTPUT_ROOT', 'CHECK_STAGE_ROOT', 'INSPECT_PENDING', 'CHECK_FINALIZATION')
        if ($request.files.Length -ne 0 -or $roots.Count -ne 1 -or -not $roots.ContainsKey('output') -or
            ($sequence -eq 4 -and $operation -cne 'CHECK_OUTPUT') -or $sequence -lt 4 -or
            ($sequence -ge 5 -and $operation -cne $publicationOperations[$sequence - 5])) { Reject-Protocol }
        if (($roots['output'].TrimEnd('\') + '\memoryos-readiness-result.json.pending').Length -gt 240) {
            Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
        }
    } else {
        if ($sequence -gt 4 -or $roots.Count -eq 0 -or $roots.ContainsKey('output') -or
            ($sequence -lt 4 -and ($roots.Count -ne 1 -or -not $roots.ContainsKey('input'))) -or
            ($sequence -eq 1 -and $ids -cne 'authority,config') -or
            ($sequence -eq 2 -and $ids -cne 'candidate,manifest') -or
            ($sequence -eq 4 -and $ids -cnotin @('result', 'decision,result'))) { Reject-Protocol }
        $caps = @{}
        if ($sequence -eq 1) { $caps = @{ authority = 1048576; config = 16384 } }
        elseif ($sequence -eq 2) { $caps = @{ candidate = 524288; manifest = 262144 } }
        elseif ($sequence -eq 4) { $caps = @{ decision = 8192; result = 4194304 } }
        foreach ($file in $request.files) {
            if ($caps.Count -gt 0 -and $file.maxBytes -ne $caps[$file.id]) { Reject-Protocol }
            $expectedRoot = 'input'
            if ($sequence -eq 4 -and $file.id -ceq 'result') { $expectedRoot = 'result' }
            if ($file.root -cne $expectedRoot) { Reject-Protocol }
        }
        foreach ($root in $request.roots) {
            if ($request.files.Length -gt 0 -and @($request.files | Where-Object { $_.root -ceq $root.id }).Length -eq 0) { Reject-Protocol }
        }
    }
    $code = 'MO1307_INTERNAL'
} catch {
    # Never emit exception text, path, stack, raw request, environment or secrets.
    if ($_.Exception.Message -cin @('MO1307_INPUT', 'MO1307_FILESYSTEM_BOUNDARY', 'MO1307_RESOURCE_LIMIT')) {
        $code = $_.Exception.Message
    } else { $code = 'MO1307_INPUT' }
}

$reply = '{"code":"' + $code + '","files":[],"kind":"MemoryOSReadinessHelperResponse","operation":"' + $operation +
    '","roots":[],"sequence":' + $sequence + ',"session":"' + $session + '","status":"ERROR","version":"2.0.0"}' + "`n"
$replyBytes = [System.Text.UTF8Encoding]::new($false, $true).GetBytes($reply)
if ($replyBytes.Length + 4 -gt $responseCeiling) { exit 22 }
$length = [uint32] $replyBytes.Length
$replyHeader = [byte[]] @([byte] (($length -shr 24) -band 255), [byte] (($length -shr 16) -band 255), [byte] (($length -shr 8) -band 255), [byte] ($length -band 255))
$stdout = [Console]::OpenStandardOutput()
$stdout.Write($replyHeader, 0, 4)
$stdout.Write($replyBytes, 0, $replyBytes.Length)
$stdout.Flush()
exit 0

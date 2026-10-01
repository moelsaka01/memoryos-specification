# Fixed MemoryOS readiness wire 2.0 checked native acquisition; PowerShell 5.1.
$script:diagEntryTick = [Diagnostics.Stopwatch]::GetTimestamp()
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$requestCeiling = 65536
$responseCeiling = 16777216
$sequence = 1
$operation = 'READ_SET'
$session = '0000000000000000000000000000000000000000000000000000000000000000'
$code = 'MO1307_INPUT'
$nativeMode = $false
$nativeResult = $null
$script:diagStream = $null
$script:diagFrequency = [Diagnostics.Stopwatch]::Frequency
$script:diagTicks = [long[]]::new(13)
$script:diagSnapshots = [string[]]::new(13)
$script:diagRootValidations = 0L
$script:diagRelativeValidations = 0L
$script:diagSegmentValidations = 0L
$script:diagOpenChains = 0L
$script:diagChainComponents = 0L
$script:diagCreateFileW = 0L
$script:diagLastErrorReads = 0L
$script:diagGetFileInformationByHandle = 0L
$script:diagGetFinalPathNameByHandleW = 0L
$script:diagGetFileType = 0L
$script:diagGetStdHandle = 0L
$script:diagGetConsoleProcessList = 0L
$script:diagFreeConsole = 0L
$script:diagStablePasses = 0L
$script:diagHeldChecks = 0L
$script:diagFreshReopens = 0L
$script:diagHandleDisposals = 0L
$script:diagSuccessfulHandles = 0L
$script:diagRequestBytes = 0L
$script:diagPendingBytes = 0L
$script:diagPathDepth = 0L
$script:diagResponseBytes = 0L
function Write-DiagnosticMark([string] $Stage, [long] $Tick = -1) {
    if ($Tick -lt 0) { $Tick = [Diagnostics.Stopwatch]::GetTimestamp() }
    $index = [int] $Stage.Substring(1)
    $script:diagTicks[$index] = $Tick
}
function Get-DiagnosticCountsText {
    $counts = @(
        'rootValidations=' + $script:diagRootValidations, 'relativeValidations=' + $script:diagRelativeValidations,
        'segmentValidations=' + $script:diagSegmentValidations, 'openChains=' + $script:diagOpenChains,
        'chainComponents=' + $script:diagChainComponents, 'createFileW=' + $script:diagCreateFileW,
        'lastErrorReads=' + $script:diagLastErrorReads, 'getFileInformationByHandle=' + $script:diagGetFileInformationByHandle,
        'getFinalPathNameByHandleW=' + $script:diagGetFinalPathNameByHandleW, 'getFileType=' + $script:diagGetFileType,
        'getStdHandle=' + $script:diagGetStdHandle, 'getConsoleProcessList=' + $script:diagGetConsoleProcessList,
        'freeConsole=' + $script:diagFreeConsole, 'stablePasses=' + $script:diagStablePasses,
        'heldChecks=' + $script:diagHeldChecks, 'freshReopens=' + $script:diagFreshReopens,
        'handleDisposals=' + $script:diagHandleDisposals, 'successfulHandles=' + $script:diagSuccessfulHandles,
        'requestBytes=' + $script:diagRequestBytes, 'pendingBytes=' + $script:diagPendingBytes,
        'pathDepth=' + $script:diagPathDepth, 'responseBytes=' + $script:diagResponseBytes
    )
    return [string]::Join(',', $counts)
}
function Write-DiagnosticSnapshot([string] $Stage) {
    $index = [int] $Stage.Substring(1)
    $script:diagSnapshots[$index] = Get-DiagnosticCountsText
}
function Write-DiagnosticReport {
    if ($null -eq $script:diagStream) { return }
    try {
        $lines = [Collections.Generic.List[string]]::new()
        for ($index = 1; $index -le 12; $index++) {
            $lines.Add('MO1307D|T' + $index + '|' + $script:diagTicks[$index].ToString([Globalization.CultureInfo]::InvariantCulture) + '|' + $script:diagFrequency.ToString([Globalization.CultureInfo]::InvariantCulture))
        }
        foreach ($index in @(2, 6, 7, 12)) {
            $lines.Add('MO1307D|SNAPSHOT|T' + $index + '|' + $script:diagSnapshots[$index])
        }
        $bytes = [Text.Encoding]::ASCII.GetBytes(([string]::Join([char]10, $lines)) + [char]10)
        $script:diagStream.Write($bytes, 0, $bytes.Length)
        $script:diagStream.Flush()
    } catch { }
}

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
    $script:diagSegmentValidations++
    if ($Value.Length -eq 0 -or $Value -eq '.' -or $Value -eq '..' -or $Value -match '[. ]$' -or
        $Value -match '[\x00-\x1f\x7f<>:"/\\|?*]' -or
        $Value -match '^(?i:CON|PRN|AUX|NUL|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])(?:\.|$)') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
}
function Assert-Root($Value) {
    $script:diagRootValidations++
    if ($Value -isnot [string] -or $Value.Length -gt 240 -or $Value -cnotmatch '^[A-Za-z]:[\\/]') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    $ordinary = $Value.Replace('/', '\')
    if ($ordinary.Length -gt 3 -and $ordinary.EndsWith('\')) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
    if ($ordinary.Length -gt 3) { foreach ($part in $ordinary.Substring(3).Split('\')) { Assert-Segment $part } }
}
function Assert-Relative($Value) {
    $script:diagRelativeValidations++
    if ($Value -isnot [string] -or $Value.Length -lt 1 -or $Value.Length -gt 180 -or
        $Value -cnotmatch '^[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    foreach ($part in $Value.Split('/')) { Assert-Segment $part }
}
function Encode-String([string] $Value) {
    if ($Value.Length -gt 4096) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    if ($Value -match '[\x00-\x1f\x7f]') { Reject-Protocol }
    if ($Value -match '[\uD800-\uDFFF]') {
        for ($i = 0; $i -lt $Value.Length; $i++) {
            if ([char]::IsHighSurrogate($Value[$i])) {
                if ($i + 1 -ge $Value.Length -or -not [char]::IsLowSurrogate($Value[$i + 1])) { Reject-Protocol }
                $i++
            } elseif ([char]::IsLowSurrogate($Value[$i])) { Reject-Protocol }
        }
    }
    return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
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

# Fixed Win32 signatures are emitted in memory. No C# compiler, temporary source,
# external assembly, module, executable or caller-selected native symbol exists.
function Initialize-Native {
    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')
    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)
    $module = $assembly.DefineDynamicModule('Native')
    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')
    $definitions = @(
        @('CreateFileW', [Microsoft.Win32.SafeHandles.SafeFileHandle], [Type[]] @([string], [uint32], [uint32], [IntPtr], [uint32], [uint32], [IntPtr])),
        @('GetFileInformationByHandle', [bool], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [IntPtr])),
        @('GetFinalPathNameByHandleW', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [Text.StringBuilder], [uint32], [uint32])),
        @('GetFileType', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle])),
        @('GetStdHandle', [IntPtr], [Type[]] @([int32])),
        @('GetFileType', [uint32], [Type[]] @([IntPtr])),
        @('GetConsoleProcessList', [uint32], [Type[]] @([IntPtr], [uint32])),
        @('FreeConsole', [bool], [Type[]] @())
    )
    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))
    $fields = [Reflection.FieldInfo[]] @(
        [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
        [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
    foreach ($definition in $definitions) {
        $library = if ($definition.Count -eq 4) { $definition[3] } else { 'kernel32.dll' }
        if ($definition[0] -ceq 'CreateFileW') {
            # DefineMethod lets the complete DllImport attribute establish the
            # mapping once, including marshaler last-error capture.
            $method = $builder.DefineMethod($definition[0],
                [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
                $definition[1], $definition[2])
        } else {
            $method = $builder.DefinePInvokeMethod($definition[0], $library, $definition[0],
                [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
                $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,
                [Runtime.InteropServices.CharSet]::Unicode)
        }
        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
        if ($definition[0] -ceq 'CreateFileW') {
            $createFileFields = [Reflection.FieldInfo[]] @(
                [Runtime.InteropServices.DllImportAttribute].GetField('EntryPoint'),
                [Runtime.InteropServices.DllImportAttribute].GetField('PreserveSig'),
                [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
                [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
                [Runtime.InteropServices.DllImportAttribute].GetField('CallingConvention'),
                [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
            $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),
                $createFileFields, [object[]] @($definition[0], $true, $true, $true,
                    [Runtime.InteropServices.CallingConvention]::Winapi, [Runtime.InteropServices.CharSet]::Unicode))
        } else {
            $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),
                $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))
        }
        $method.SetCustomAttribute($attribute)
    }
    $script:native = $builder.CreateType()
    Confirm-ConsoleQuiescence
}
function Confirm-ConsoleQuiescence {
    # Standard handles are borrowed from this process, not newly owned handles.
    # Only the fixed redirected product pipes admit the headless lifecycle path.
    foreach ($selector in @(-10, -11, -12)) {
        $script:diagGetStdHandle++
        $standardHandle = $script:native::GetStdHandle($selector)
        if ($standardHandle -eq [IntPtr]::Zero -or $standardHandle -eq [IntPtr]::new(-1)) { Reject-Protocol 'MO1307_INTERNAL' }
        $script:diagGetFileType++
        if ($script:native::GetFileType($standardHandle) -ne 3) { Reject-Protocol 'MO1307_INTERNAL' }
    }
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
    try {
        $script:diagGetConsoleProcessList++
        $count = $script:native::GetConsoleProcessList($buffer, 1)
        # Every failed initial observation, including zero/error 6, fails closed.
        if ($count -ne 1 -or [Runtime.InteropServices.Marshal]::ReadInt32($buffer) -ne $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        # Membership is topology evidence only. Detach this helper without
        # discovering, opening, terminating or claiming exit of any host process.
        $script:diagFreeConsole++
        if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }
        # Successful self-detachment is the transition; do not query membership again.
    } finally {
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    }
}

function Open-Native([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {
    $access = [uint32] 128
    $sharing = [uint32] 7
    if (-not $Directory) { $access = [uint32] 2147483648; $sharing = [uint32] 1 }
    $script:diagCreateFileW++
    $handle = $script:native::CreateFileW($Path, $access, $sharing, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)
    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $script:diagLastErrorReads++
    if ($handle.IsInvalid) {
        $handle.Dispose()
        if ($InputLeaf -and $nativeError -eq 2) { Reject-Protocol 'MO1307_INPUT' }
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    $script:diagSuccessfulHandles++
    return $handle
}
function Read-Identity($Handle, [string] $Path, [bool] $Directory) {
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(52)
    try {
        $script:diagGetFileInformationByHandle++
        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $raw = [byte[]]::new(52)
        [Runtime.InteropServices.Marshal]::Copy($buffer, $raw, 0, 52)
        $attributes = [long] [BitConverter]::ToUInt32($raw, 0)
        $volume = [BitConverter]::ToUInt32($raw, 28)
        $length = [long] [BitConverter]::ToUInt32($raw, 32) * 4294967296 + [BitConverter]::ToUInt32($raw, 36)
        $links = [long] [BitConverter]::ToUInt32($raw, 40)
        $fileId = [BitConverter]::ToUInt32($raw, 44).ToString('x8') + [BitConverter]::ToUInt32($raw, 48).ToString('x8')
        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or
            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $script:diagGetFileType++
        if ($script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $final = [Text.StringBuilder]::new(512)
        $script:diagGetFinalPathNameByHandleW++
        $count = $script:native::GetFinalPathNameByHandleW($Handle, $final, 512, 0)
        if ($count -eq 0 -or $count -ge 512) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $observed = $final.ToString()
        if (-not $observed.StartsWith('\\?\', [StringComparison]::Ordinal)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $observed = $observed.Substring(4)
        # Request decoding and the caller validate the full expected path before
        # Open-Chain constructs its component paths. Those immutable strings
        # remain in the request-local chain entries through both held-handle and
        # fresh-handle checks.
        # Equality to that validated path also proves the newly retrieved final
        # path's lexical boundary; do not repeat pure segment parsing here.
        # Native final-path retrieval and this comparison remain fresh each time.
        if (-not [string]::Equals($observed, $Path, [StringComparison]::OrdinalIgnoreCase)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        return [pscustomobject] @{ attributes = $attributes; byteLength = $length; fileId = $fileId;
            finalPath = $observed; isDirectory = $Directory; linkCount = $links; volumeSerial = $volume.ToString('x8') }
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer) }
}
function Assert-SameIdentity($Before, $After) {
    foreach ($key in @('attributes', 'byteLength', 'fileId', 'finalPath', 'isDirectory', 'linkCount', 'volumeSerial')) {
        if ($Before.$key -cne $After.$key) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
    }
}
function Open-Chain([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {
    $script:diagOpenChains++
    $paths = [Collections.Generic.List[string]]::new()
    $paths.Add($Path.Substring(0, 3))
    if ($Path.Length -gt 3) {
        foreach ($part in $Path.Substring(3).Split('\')) {
            $paths.Add($paths[$paths.Count - 1].TrimEnd('\') + '\' + $part)
        }
    }
    if ($paths.Count -gt 120) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    $entries = [Collections.Generic.List[object]]::new()
    try {
        for ($index = 0; $index -lt $paths.Count; $index++) {
            $script:diagChainComponents++
            $isDirectory = $index -lt $paths.Count - 1 -or $Directory
            $handle = Open-Native $paths[$index] $isDirectory ($InputLeaf -and -not $isDirectory)
            try { $identity = Read-Identity $handle $paths[$index] $isDirectory }
            catch { $handle.Dispose(); $script:diagHandleDisposals++; throw }
            $entries.Add([pscustomobject] @{ path = $paths[$index]; directory = $isDirectory; handle = $handle; identity = $identity })
            if ($index -gt 0 -and $identity.volumeSerial -cne $entries[0].identity.volumeSerial) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        }
        return ,$entries
    } catch { foreach ($entry in $entries) { $entry.handle.Dispose(); $script:diagHandleDisposals++ }; throw }
}
function Close-Chain($Entries) { foreach ($entry in $Entries) { $entry.handle.Dispose(); $script:diagHandleDisposals++ } }
function Assert-ChainStable($Entries) {
    $script:diagStablePasses++
    foreach ($entry in $Entries) {
        $script:diagHeldChecks++
        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)
        # A fresh handle proves the path still names the original identity.
        $script:diagFreshReopens++
        $fresh = Open-Native $entry.path $entry.directory
        try { Assert-SameIdentity $entry.identity (Read-Identity $fresh $entry.path $entry.directory) }
        finally { $fresh.Dispose(); $script:diagHandleDisposals++ }
    }
}
function Assert-NativeAbsent([string] $Path) {
    $handle = $script:native::CreateFileW($Path, 128, 7, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)
    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    try {
        # Only ERROR_FILE_NOT_FOUND means this leaf is absent. Missing paths,
        # access denial, sharing errors and all ambiguous failures are boundary.
        if (-not $handle.IsInvalid -or $nativeError -ne 2) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
    } finally { $handle.Dispose() }
}
function Invoke-ReadSet($Request, $Roots) {
    $rootChains = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
    $responseRoots = [Collections.Generic.List[object]]::new()
    $responseFiles = [Collections.Generic.List[object]]::new()
    $nativeFiles = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $total = 0L
    try {
        foreach ($root in $Request.roots) {
            $chain = Open-Chain $Roots[$root.id] $true
            $rootChains.Add($root.id, $chain)
            $responseRoots.Add([pscustomobject] @{ id = $root.id; identity = $chain[$chain.Count - 1].identity })
        }
        foreach ($file in $Request.files) {
            $full = $Roots[$file.root].TrimEnd('\') + '\' + $file.path.Replace('/', '\')
            $chain = Open-Chain $full $false $true
            try {
                $rootChain = $rootChains[$file.root]
                for ($index = 0; $index -lt $rootChain.Count; $index++) { Assert-SameIdentity $rootChain[$index].identity $chain[$index].identity }
                $leaf = $chain[$chain.Count - 1]
                if (-not $nativeFiles.Add($leaf.identity.volumeSerial + ':' + $leaf.identity.fileId)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
                if ($leaf.identity.byteLength -gt $file.maxBytes) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
                if ($Request.sequence -eq 3 -and $total + $leaf.identity.byteLength -gt 8388608) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
                $data = [byte[]]::new($file.maxBytes + 1)
                # This non-owning wrapper leaves the checked native handle open
                # through after-read identity checks and complete chain checks.
                $borrowed = [Microsoft.Win32.SafeHandles.SafeFileHandle]::new($leaf.handle.DangerousGetHandle(), $false)
                $stream = [IO.FileStream]::new($borrowed, [IO.FileAccess]::Read, 65536, $false)
                try {
                    $used = 0
                    while ($used -lt $data.Length) {
                        $count = $stream.Read($data, $used, $data.Length - $used)
                        if ($count -eq 0) { break }
                        $used += $count
                    }
                } finally { $stream.Dispose(); $borrowed.Dispose() }
                if ($used -gt $file.maxBytes) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
                if ($used -ne $leaf.identity.byteLength) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
                $total += $used
                Assert-ChainStable $chain
                $encoded = [Convert]::ToBase64String($data, 0, $used)
                $chunks = [Collections.Generic.List[string]]::new()
                for ($offset = 0; $offset -lt $encoded.Length; $offset += 4096) {
                    $chunks.Add($encoded.Substring($offset, [Math]::Min(4096, $encoded.Length - $offset)))
                }
                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })
            } finally { Close-Chain $chain }
        }
        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }
        return [pscustomobject] @{ roots = $responseRoots.ToArray(); files = $responseFiles.ToArray(); status = 'OK' }
    } finally { foreach ($chain in $rootChains.Values) { Close-Chain $chain } }
}
function Invoke-Inspection($Request, $Roots) {
    $root = $Roots['output']
    $pending = $Request.operation -cin @('INSPECT_PENDING', 'CHECK_FINALIZATION')
    $path = $root
    $id = 'output'
    $status = 'OK'
    if ($Request.operation -ceq 'CHECK_OUTPUT') {
        if ($root.Length -le 3) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $path = [IO.Path]::GetDirectoryName($root)
        $id = 'output-parent'; $status = 'ABSENT'
    } elseif ($pending) { $path = $root.TrimEnd('\') + '\memoryos-readiness-result.json.pending'; $id = 'pending' }
    Write-DiagnosticMark 'T6'
    Write-DiagnosticSnapshot 'T6'
    $chain = Open-Chain $path (-not $pending)
    try {
        if ($Request.operation -ceq 'CHECK_OUTPUT') { Assert-NativeAbsent $root }
        elseif ($Request.operation -ceq 'CHECK_FINALIZATION') {
            Assert-NativeAbsent ($root.TrimEnd('\') + '\memoryos-readiness-result.json')
            $status = 'FINAL_ABSENT'
        }
        Assert-ChainStable $chain
        $identities = @($chain | ForEach-Object { $_.identity })
        $script:diagPathDepth = $chain.Count
        $script:diagPendingBytes = $chain[$chain.Count - 1].identity.byteLength
        Write-DiagnosticMark 'T7'
        Write-DiagnosticSnapshot 'T7'
        return [pscustomobject] @{ roots = @([pscustomobject] @{ id = $id; chain = $identities }); files = @(); status = $status }
    } finally { Close-Chain $chain }
}


# Save all redirected transports before self-detachment. A valid response proves
# this helper's startup pipe/membership/console-absence checks, not host exit.
# The supervisor separately requires process termination and complete pipe EOF.
# Actual startup-security failure remains silent exit 22 without a frame.
try {
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
        -not [Environment]::Is64BitProcess) { exit 22 }
    $stdin = [Console]::OpenStandardInput()
    $savedStdout = [Console]::OpenStandardOutput()
    $savedStderr = [Console]::OpenStandardError()
    $script:diagStream = $savedStderr
    Write-DiagnosticMark 'T1' $script:diagEntryTick
    if ([object]::ReferenceEquals($stdin, [IO.Stream]::Null) -or
        [object]::ReferenceEquals($savedStdout, [IO.Stream]::Null) -or
        [object]::ReferenceEquals($savedStderr, [IO.Stream]::Null) -or
        -not $stdin.CanRead -or -not $savedStdout.CanWrite -or -not $savedStderr.CanWrite) { exit 22 }
    Initialize-Native
    Write-DiagnosticMark 'T2'
    Write-DiagnosticSnapshot 'T2'
} catch { exit 22 }

try {
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
        -not [Environment]::Is64BitProcess) { Reject-Protocol }
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
    $script:diagRequestBytes = [long] $size + 4
    Write-DiagnosticMark 'T3'
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
    Write-DiagnosticMark 'T4'
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
    Write-DiagnosticMark 'T5'
    $nativeMode = $true
    if ($operation -ceq 'READ_SET') { $nativeResult = Invoke-ReadSet $request $roots }
    else { $nativeResult = Invoke-Inspection $request $roots }
    $code = $null
} catch {
    # Never disclose internal diagnostics on the product transport.
    if ($_.Exception.Message -cin @('MO1307_INPUT', 'MO1307_FILESYSTEM_BOUNDARY', 'MO1307_RESOURCE_LIMIT', 'MO1307_INTERNAL')) {
        $code = $_.Exception.Message
    } elseif ($nativeMode) { $code = 'MO1307_INTERNAL' } else { $code = 'MO1307_INPUT' }
}

try {
    $response = [pscustomobject] @{ code = $code; files = @(); kind = 'MemoryOSReadinessHelperResponse';
        operation = $operation; roots = @(); sequence = $sequence; session = $session; status = 'ERROR'; version = '2.0.0' }
    if ($null -eq $code -and $null -ne $nativeResult) {
        $response.files = $nativeResult.files; $response.roots = $nativeResult.roots; $response.status = $nativeResult.status
    }
    Write-DiagnosticMark 'T8'
    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes((Encode-Value $response) + "`n")
    if ($replyBytes.Length + 4 -gt $responseCeiling) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
} catch {
    $reply = '{"code":"MO1307_RESOURCE_LIMIT","files":[],"kind":"MemoryOSReadinessHelperResponse","operation":"' + $operation +
        '","roots":[],"sequence":' + $sequence + ',"session":"' + $session + '","status":"ERROR","version":"2.0.0"}' + "`n"
    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($reply)
}
$length = [uint32] $replyBytes.Length
$replyHeader = [byte[]] @([byte] (($length -shr 24) -band 255), [byte] (($length -shr 16) -band 255), [byte] (($length -shr 8) -band 255), [byte] ($length -band 255))
$script:diagResponseBytes = [long] $replyBytes.Length + 4
Write-DiagnosticMark 'T9'
$stdout = $savedStdout
$stdout.Write($replyHeader, 0, 4)
Write-DiagnosticMark 'T10'
$stdout.Write($replyBytes, 0, $replyBytes.Length)
$stdout.Flush()
Write-DiagnosticMark 'T11'
Write-DiagnosticSnapshot 'T12'
Write-DiagnosticMark 'T12'
Write-DiagnosticReport
exit 0

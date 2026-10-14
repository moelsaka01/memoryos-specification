# Fixed MemoryOS readiness wire 2.0 checked native acquisition; PowerShell 5.1.
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
    D-Start 'S05.01' 'AssemblyName'
    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')
    D-Ok 'S05.01'
    D-Start 'S05.02' 'DefineDynamicAssembly'
    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)
    D-Ok 'S05.02'
    D-Start 'S05.03' 'DefineDynamicModule'
    $module = $assembly.DefineDynamicModule('Native')
    D-Ok 'S05.03'
    D-Start 'S05.04' 'DefineType'
    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')
    D-Ok 'S05.04'
    D-Start 'S05.05' 'Native signature definitions'
    $definitions = @(
        @('CreateFileW', [Microsoft.Win32.SafeHandles.SafeFileHandle], [Type[]] @([string], [uint32], [uint32], [IntPtr], [uint32], [uint32], [IntPtr])),
        @('GetFileInformationByHandle', [bool], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [IntPtr])),
        @('GetFinalPathNameByHandleW', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [Text.StringBuilder], [uint32], [uint32])),
        @('GetFileType', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle])),
        @('GetConsoleProcessList', [uint32], [Type[]] @([IntPtr], [uint32])),
        @('GetConsoleWindow', [IntPtr], [Type[]] @()),
        @('GetWindowThreadProcessId', [uint32], [Type[]] @([IntPtr], [uint32].MakeByRefType()), 'user32.dll'),
        @('GetProcessId', [uint32], [Type[]] @([IntPtr])),
        @('OpenProcess', [IntPtr], [Type[]] @([uint32], [bool], [uint32])),
        @('QueryFullProcessImageNameW', [bool], [Type[]] @([IntPtr], [uint32], [Text.StringBuilder], [uint32].MakeByRefType())),
        @('FreeConsole', [bool], [Type[]] @()),
        @('WaitForSingleObject', [uint32], [Type[]] @([IntPtr], [uint32])),
        @('CloseHandle', [bool], [Type[]] @([IntPtr]))
    )
    D-Ok 'S05.05'
    D-Start 'S05.06' 'DllImport constructor lookup'
    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))
    D-Ok 'S05.06'
    D-Start 'S05.07' 'DllImport fields'
    $fields = [Reflection.FieldInfo[]] @(
        [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
        [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
    D-Ok 'S05.07'
    foreach ($definition in $definitions) {
        D-Start 'S05.08' ('Select fixed native library '+$definition[0])
        $library = if ($definition.Count -eq 4) { $definition[3] } else { 'kernel32.dll' }
        D-Ok 'S05.08'
        D-Start 'S05.09' ('DefinePInvokeMethod '+$definition[0])
        $method = $builder.DefinePInvokeMethod($definition[0], $library, $definition[0],
            [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
            $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,
            [Runtime.InteropServices.CharSet]::Unicode)
        D-Ok 'S05.09'
        D-Start 'S05.10' ('SetImplementationFlags '+$definition[0])
        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
        D-Ok 'S05.10'
        D-Start 'S05.11' ('DllImport attribute construction '+$definition[0])
        $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),
            $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))
        D-Ok 'S05.11'
        D-Start 'S05.12' ('SetCustomAttribute '+$definition[0])
        $method.SetCustomAttribute($attribute)
        D-Ok 'S05.12'
    }
    D-Start 'S06' 'Native type creation'
    $script:native = $builder.CreateType()
    D-Ok 'S06'
    Confirm-ConsoleQuiescence
}
function Confirm-ConsoleQuiescence {
    D-Start 'S07' 'AllocHGlobal'
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
    D-Ok 'S07'
    $consoleHandle = [IntPtr]::Zero
    try {
        $count = $(D-Start 'S08' 'Initial console membership'; $__mo1307Return = $script:native::GetConsoleProcessList($buffer, 1); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) $null; $__mo1307Return)
        $nativeError = $script:__mo1307LastError
        if ($count -eq 0 -and $nativeError -eq 6) { return }
        if ($count -ne 1 -or $(D-Start 'S08.01' 'Initial sole-client PID read'; $__mo1307Value = [Runtime.InteropServices.Marshal]::ReadInt32($buffer); D-Value $__mo1307Value $null $false; $__mo1307Value) -ne $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        # Bind the current console window's owner, never historical numeric PPID.
        # Missing/headless windows are ambiguous and fail before request parsing.
        $window = $(D-Start 'S12.01' 'Current console HWND/nonzero guard'; $__mo1307Return = $script:native::GetConsoleWindow(); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error $false $null; $__mo1307Return)
        if ($window -eq [IntPtr]::Zero) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        $owner = [uint32] 0
        if ($(D-Start 'S12.02' 'Current HWND owner/nonzero distinct-self guard'; $__mo1307Return = $script:native::GetWindowThreadProcessId($window, [ref] $owner); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{owner=$owner}; $__mo1307Return) -eq 0 -or $owner -eq 0 -or $owner -eq $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        # Query and synchronize only: no process-termination capability is acquired.
        $consoleHandle = $(D-Start 'S13.01' 'OpenProcess query-synchronize/nonzero guard'; $__mo1307Return = $script:native::OpenProcess(0x101000, $false, $owner); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{owner=$owner}; $__mo1307Return)
        if ($consoleHandle -eq [IntPtr]::Zero -or $(D-Start 'S13.02' 'Opened handle PID equality'; $__mo1307Return = $script:native::GetProcessId($consoleHandle); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{heldHandle=$consoleHandle.ToInt64()}; $__mo1307Return) -ne $owner) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        D-Start 'S14.00' 'Image buffer allocation'
        $image = [Text.StringBuilder]::new(512); $imageLength = [uint32] 512
        D-Ok 'S14.00'
        if (-not $(D-Start 'S14' 'QueryFullProcessImageNameW/success guard'; $__mo1307Return = $script:native::QueryFullProcessImageNameW($consoleHandle, 0, $image, [ref] $imageLength); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{imageLength=$imageLength}; $__mo1307Return)) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        D-Start 'S15.01' 'System directory lookup'
        $systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
        D-Ok 'S15.01'
        if (-not $(D-Start 'S15.02' 'Exact system conhost image equality'; $__mo1307Value = [string]::Equals($image.ToString(), $systemDirectory + '\conhost.exe', [StringComparison]::OrdinalIgnoreCase); D-Value $__mo1307Value $null $false; $__mo1307Value)) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        # A second current association, followed by a live-object check, closes
        # discovery/open PID replacement without asserting historical ancestry.
        $currentOwner = [uint32] 0
        if ($(D-Start 'S12.03a' 'Recheck same console HWND'; $__mo1307Return = $script:native::GetConsoleWindow(); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error $false $null; $__mo1307Return) -ne $window -or
            $(D-Start 'S12.03b' 'Recheck same HWND owner'; $__mo1307Return = $script:native::GetWindowThreadProcessId($window, [ref] $currentOwner); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{owner=$currentOwner}; $__mo1307Return) -eq 0 -or $currentOwner -ne $owner) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        $count = $(D-Start 'S12.04' 'Recheck sole console membership'; $__mo1307Return = $script:native::GetConsoleProcessList($buffer, 1); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) $null; $__mo1307Return)
        if ($count -ne 1 -or $(D-Start 'S12.04a' 'Rechecked sole-client PID read'; $__mo1307Value = [Runtime.InteropServices.Marshal]::ReadInt32($buffer); D-Value $__mo1307Value $null $false; $__mo1307Value) -ne $PID -or
            $(D-Start 'S12.05' 'Recheck held handle PID equality'; $__mo1307Return = $script:native::GetProcessId($consoleHandle); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{heldHandle=$consoleHandle.ToInt64()}; $__mo1307Return) -ne $owner -or
            $(D-Start 'S17' 'Held host live-object wait/258 guard'; $__mo1307Return = $script:native::WaitForSingleObject($consoleHandle, 0); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 4294967295) @{heldHandle=$consoleHandle.ToInt64()}; $__mo1307Return) -ne 258) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        if (-not $(D-Start 'S16' 'FreeConsole/success guard'; $__mo1307Return = $script:native::FreeConsole(); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) $null; $__mo1307Return)) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        # Detach only self and observe natural exit of the SAME held host object.
        # A late joining client can make this fail closed, never authorize killing
        # its console. No TerminateProcess or PID-based process kill is available.
        if ($(D-Start 'S19' 'Natural host exit wait/zero guard'; $__mo1307Return = $script:native::WaitForSingleObject($consoleHandle, 1000); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 4294967295) @{heldHandle=$consoleHandle.ToInt64()}; $__mo1307Return) -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
        $remaining = $(D-Start 'S20' 'Final console absence'; $__mo1307Return = $script:native::GetConsoleProcessList($buffer, 1); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) $null; $__mo1307Return)
        $nativeError = $script:__mo1307LastError
        if ($remaining -ne 0 -or $nativeError -ne 6) { Reject-Protocol 'MO1307_INTERNAL' }
        D-Ok $script:__mo1307D.activeId
    } catch { D-Failure $_; throw } finally {
        if ($consoleHandle -ne [IntPtr]::Zero) { [void] $(D-Start 'S21' 'CloseHandle original return discarded'; $__mo1307Return = $script:native::CloseHandle($consoleHandle); $__mo1307Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__mo1307LastError = $__mo1307Error; D-Value $__mo1307Return $__mo1307Error ($__mo1307Return -eq 0) @{heldHandle=$consoleHandle.ToInt64()}; $__mo1307Return) }
        D-Start 'S22' 'FreeHGlobal'
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
        D-Ok 'S22'
    }
}

function Open-Native([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {
    $access = [uint32] 128
    $sharing = [uint32] 7
    if (-not $Directory) { $access = [uint32] 2147483648; $sharing = [uint32] 1 }
    $handle = $script:native::CreateFileW($Path, $access, $sharing, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)
    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($handle.IsInvalid) {
        $handle.Dispose()
        if ($InputLeaf -and $nativeError -eq 2) { Reject-Protocol 'MO1307_INPUT' }
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    return $handle
}
function Read-Identity($Handle, [string] $Path, [bool] $Directory) {
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(52)
    try {
        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $raw = [byte[]]::new(52)
        [Runtime.InteropServices.Marshal]::Copy($buffer, $raw, 0, 52)
        $attributes = [long] [BitConverter]::ToUInt32($raw, 0)
        $volume = [BitConverter]::ToUInt32($raw, 28)
        $length = [long] [BitConverter]::ToUInt32($raw, 32) * 4294967296 + [BitConverter]::ToUInt32($raw, 36)
        $links = [long] [BitConverter]::ToUInt32($raw, 40)
        $fileId = [BitConverter]::ToUInt32($raw, 44).ToString('x8') + [BitConverter]::ToUInt32($raw, 48).ToString('x8')
        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or
            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991 -or
            $script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $final = [Text.StringBuilder]::new(512)
        $count = $script:native::GetFinalPathNameByHandleW($Handle, $final, 512, 0)
        if ($count -eq 0 -or $count -ge 512) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $observed = $final.ToString()
        if (-not $observed.StartsWith('\\?\', [StringComparison]::Ordinal)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $observed = $observed.Substring(4)
        # Open-Chain validates the full expected path before constructing its
        # component paths. Those immutable strings remain in the request-local
        # chain entries through both held-handle and fresh-handle checks.
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
    Assert-Root $Path
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
            $isDirectory = $index -lt $paths.Count - 1 -or $Directory
            $handle = Open-Native $paths[$index] $isDirectory ($InputLeaf -and -not $isDirectory)
            try { $identity = Read-Identity $handle $paths[$index] $isDirectory }
            catch { $handle.Dispose(); throw }
            $entries.Add([pscustomobject] @{ path = $paths[$index]; directory = $isDirectory; handle = $handle; identity = $identity })
            if ($index -gt 0 -and $identity.volumeSerial -cne $entries[0].identity.volumeSerial) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        }
        return ,$entries
    } catch { foreach ($entry in $entries) { $entry.handle.Dispose() }; throw }
}
function Close-Chain($Entries) { foreach ($entry in $Entries) { $entry.handle.Dispose() } }
function Assert-ChainStable($Entries) {
    foreach ($entry in $Entries) {
        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)
        # A fresh handle proves the path still names the original identity.
        $fresh = Open-Native $entry.path $entry.directory
        try { Assert-SameIdentity $entry.identity (Read-Identity $fresh $entry.path $entry.directory) }
        finally { $fresh.Dispose() }
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
    $chain = Open-Chain $path (-not $pending)
    try {
        if ($Request.operation -ceq 'CHECK_OUTPUT') { Assert-NativeAbsent $root }
        elseif ($Request.operation -ceq 'CHECK_FINALIZATION') {
            Assert-NativeAbsent ($root.TrimEnd('\') + '\memoryos-readiness-result.json')
            $status = 'FINAL_ABSENT'
        }
        Assert-ChainStable $chain
        $identities = @($chain | ForEach-Object { $_.identity })
        return [pscustomobject] @{ roots = @([pscustomobject] @{ id = $id; chain = $identities }); files = @(); status = $status }
    } finally { Close-Chain $chain }
}


# Save redirected byte transports before detaching the private console. Every
# valid response (including ERROR) proves owned-console quiescence. Startup
# failure emits no frame and no diagnostic; parent treats exit as unconfirmed.
try {
    $script:__mo1307Clock = [Diagnostics.Stopwatch]::StartNew()
    $script:__mo1307D = @{ activeId='ENTRY'; operation='Startup entry'; lastSuccessfulId=$null; nativeReturn=$null; win32Error=$null; win32ErrorMeaningful=$false; details=$null; firstFailure=$null }
    $script:__mo1307Recent = [Collections.Generic.List[object]]::new()
    $script:__mo1307LastError = 0
    function D-Start([string]$Id,[string]$Operation) {
        $script:__mo1307D.activeId=$Id; $script:__mo1307D.operation=$Operation
        $script:__mo1307D.nativeReturn=$null; $script:__mo1307D.win32Error=$null; $script:__mo1307D.win32ErrorMeaningful=$false; $script:__mo1307D.details=$null
    }
    function D-Value($Value,$NativeError,[bool]$Meaningful,$Details=$null) {
        if($Value -is [IntPtr]) { $Value=$Value.ToInt64() }
        $script:__mo1307D.nativeReturn=$Value; $script:__mo1307D.win32Error=$NativeError; $script:__mo1307D.win32ErrorMeaningful=$Meaningful; $script:__mo1307D.details=$Details
        $script:__mo1307Recent.Add([ordered]@{id=$script:__mo1307D.activeId;operation=$script:__mo1307D.operation;nativeReturn=$Value;win32Error=$NativeError;win32ErrorMeaningful=$Meaningful;details=$Details;elapsedMs=$script:__mo1307Clock.Elapsed.TotalMilliseconds})
        if($script:__mo1307Recent.Count -gt 6) { $script:__mo1307Recent.RemoveAt(0) }
    }
    function D-Ok([string]$Id) { $script:__mo1307D.lastSuccessfulId=$Id }
    function D-Exception($Caught) {
        if($null -eq $Caught) { return $null }
        $exception=$Caught.Exception
        $message=[string]$exception.Message
        $message=[regex]::Replace($message,'[A-Za-z]:[\\/][^\r\n]*','<path>')
        $message=[regex]::Replace($message,'[\r\n\t]',' ')
        if($message.Length -gt 160) { $message=$message.Substring(0,160) }
        return [ordered]@{exceptionType=$exception.GetType().FullName;hresult=$exception.HResult;message=$message}
    }
    function D-Failure($Caught) {
        if($null -eq $script:__mo1307D.firstFailure) {
            $exception=D-Exception $Caught
            $script:__mo1307D.firstFailure=[ordered]@{id=$script:__mo1307D.activeId;operation=$script:__mo1307D.operation;lastSuccessfulId=$script:__mo1307D.lastSuccessfulId;nativeReturn=$script:__mo1307D.nativeReturn;win32Error=$script:__mo1307D.win32Error;win32ErrorMeaningful=$script:__mo1307D.win32ErrorMeaningful;details=$script:__mo1307D.details;selfPid=$PID;exceptionType=$(if($exception){$exception.exceptionType}else{$null});hresult=$(if($exception){$exception.hresult}else{$null});message=$(if($exception){$exception.message}else{'RUNTIME_CHECK_FALSE'});elapsedMs=$script:__mo1307Clock.Elapsed.TotalMilliseconds}
        }
    }
    function D-EmitFailure($Caught) {
        $ProgressPreference='SilentlyContinue'
        try {
            D-Failure $Caught
            $record=[ordered]@{kind='MO1307StartupDiagnostic';event='FAILURE';outerId='S23';activeId=$script:__mo1307D.activeId;lastSuccessfulId=$script:__mo1307D.firstFailure.lastSuccessfulId;cleanupLastSuccessfulId=$script:__mo1307D.lastSuccessfulId;firstFailure=$script:__mo1307D.firstFailure;outerException=(D-Exception $Caught);recent=@($script:__mo1307Recent.ToArray());elapsedMs=$script:__mo1307Clock.Elapsed.TotalMilliseconds}
            $encoded=ConvertTo-Json -InputObject $record -Depth 8 -Compress
            while([Text.Encoding]::UTF8.GetByteCount($encoded) -gt 3900 -and $record.recent.Count -gt 0) {
                $record.recent=@($record.recent | Select-Object -Skip 1)
                $encoded=ConvertTo-Json -InputObject $record -Depth 8 -Compress
            }
            if([Text.Encoding]::UTF8.GetByteCount($encoded) -gt 3900) { $record.outerException=$null; $record.firstFailure.message='<bounded>'; $encoded=ConvertTo-Json -InputObject $record -Depth 8 -Compress }
            if([Text.Encoding]::UTF8.GetByteCount($encoded) -le 3900) { [Console]::Error.WriteLine($encoded) }
        } catch { }
    }
    [Console]::Error.WriteLine('{"kind":"MO1307StartupDiagnostic","event":"ENTRY"}')
    if ($(D-Start 'S01.01' 'PowerShell major version'; $__mo1307Value = $PSVersionTable.PSVersion.Major; D-Value $__mo1307Value $null $false; if ($__mo1307Value -eq 5) { D-Ok 'S01.01' }; $__mo1307Value) -ne 5 -or $(D-Start 'S01.02' 'PowerShell minor version'; $__mo1307Value = $PSVersionTable.PSVersion.Minor; D-Value $__mo1307Value $null $false; if ($__mo1307Value -eq 1) { D-Ok 'S01.02' }; $__mo1307Value) -ne 1 -or
        -not $(D-Start 'S02' '64-bit architecture'; $__mo1307Value = [Environment]::Is64BitProcess; D-Value $__mo1307Value $null $false; if ($__mo1307Value -eq $true) { D-Ok 'S02' }; $__mo1307Value)) { try { D-EmitFailure $null } catch { }; exit 22 }
    D-Start 'S03' 'OpenStandardInput'
    $stdin = [Console]::OpenStandardInput()
    D-Ok 'S03'
    D-Start 'S04' 'OpenStandardOutput'
    $savedStdout = [Console]::OpenStandardOutput()
    D-Ok 'S04'
    Initialize-Native
} catch { try { D-EmitFailure $_ } catch { }; exit 22 }

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
    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes((Encode-Value $response) + "`n")
    if ($replyBytes.Length + 4 -gt $responseCeiling) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
} catch {
    $reply = '{"code":"MO1307_RESOURCE_LIMIT","files":[],"kind":"MemoryOSReadinessHelperResponse","operation":"' + $operation +
        '","roots":[],"sequence":' + $sequence + ',"session":"' + $session + '","status":"ERROR","version":"2.0.0"}' + "`n"
    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($reply)
}
$length = [uint32] $replyBytes.Length
$replyHeader = [byte[]] @([byte] (($length -shr 24) -band 255), [byte] (($length -shr 16) -band 255), [byte] (($length -shr 8) -band 255), [byte] ($length -band 255))
$stdout = $savedStdout
$stdout.Write($replyHeader, 0, 4)
$stdout.Write($replyBytes, 0, $replyBytes.Length)
$stdout.Flush()
exit 0

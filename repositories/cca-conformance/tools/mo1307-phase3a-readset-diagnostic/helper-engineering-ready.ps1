# ENGINEERING-ONLY BEGIN 104
# This copied helper is ENGINEERING ONLY and cannot certify any gate.
$script:engZero = [Diagnostics.Stopwatch]::GetTimestamp()
$script:engTicks = [long[]]::new(50)
$script:engCalls = [long[]]::new(50)
$script:engOrdinal = 0; $script:engFilesCompleted = 0; $script:engBytesCompleted = 0L
$script:engValidationOrdinal = 0
$script:engLogWriteTicks = 0L; $script:engLogPreparationTicks = 0L
$script:engWriter = [IO.StreamWriter]::new('C:\Users\melsa\Documents\Codex\cca-mo1307-3a\repositories\cca-conformance\evidence\mo1307\phase3a-readset-diagnostic\ready-telemetry.jsonl', $false, [Text.UTF8Encoding]::new($false))
function Write-Engineering([string] $Label, [string] $Fields) {
    $engWriteStart = [Diagnostics.Stopwatch]::GetTimestamp()
    $engRow = '{"kind":"' + $Label + '","tick":' + $engWriteStart
    if ($Fields.Length -gt 0) { $engRow += ',' + $Fields }
    $engRow += '}'
    $script:engWriter.WriteLine($engRow)
    $script:engWriter.Flush()
    $script:engLogWriteTicks += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engWriteStart
}
Write-Engineering 'meta' ('"engineeringOnly":true,"pid":' + $PID + ',"frequency":' + [Diagnostics.Stopwatch]::Frequency + ',"firstScriptTick":' + $script:engZero + ',"utc":"' + [DateTime]::UtcNow.ToString('o') + '","sourceSha256":"ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b","stageNames":["initialize_native_inclusive","console_quiescence_inclusive","assert_root_inclusive","assert_relative_inclusive","open_native_inclusive","read_identity_inclusive","open_chain_inclusive","assert_chain_stable_inclusive","readset_inclusive","create_file_and_error_capture","get_file_information_native_and_branch","identity_buffer_and_field_decode","identity_attributes_and_get_file_type","get_final_path_native_buffer_and_count_check","identity_final_path_validation_inclusive","identity_result_construction","open_chain_root_lexical_validation","open_chain_ancestor_preparation","stable_chain_held_identity_inclusive","stable_chain_fresh_open_inclusive","stable_chain_fresh_identity_and_dispose_inclusive","console_final_native_wait","readset_collection_initialization","readset_root_acquisition","file_path_preparation","file_open_chain_inclusive","file_pre_read_identity_and_limits","file_buffer_and_stream_preparation","file_stream_read_and_dispose","file_post_read_size_checks","file_post_read_chain_verification_inclusive","file_base64_encoding","file_base64_chunking","file_result_construction","file_chain_close","readset_final_root_verification_inclusive","readset_aggregate_result_construction","request_framing_and_read","request_utf8_decode","request_depth_scan","request_json_decode","request_canonical_reencode_and_equality","request_roots_validation","request_paths_validation","request_semantic_validation_inclusive","response_envelope_construction","response_canonical_serialization","response_utf8_encoding","response_frame_header_encoding","stdout_write_and_flush"]')
# ENGINEERING-ONLY END 104
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
# ENGINEERING-ONLY BEGIN 005
$engT_assert_root_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 005
    if ($Value -isnot [string] -or $Value.Length -gt 240 -or $Value -cnotmatch '^[A-Za-z]:[\\/]') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    $ordinary = $Value.Replace('/', '\')
    if ($ordinary.Length -gt 3 -and $ordinary.EndsWith('\')) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
    if ($ordinary.Length -gt 3) { foreach ($part in $ordinary.Substring(3).Split('\')) { Assert-Segment $part } }
# ENGINEERING-ONLY BEGIN 006
} finally { $script:engTicks[2] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_assert_root_inclusive; $script:engCalls[2]++ }
# ENGINEERING-ONLY END 006
}
function Assert-Relative($Value) {
# ENGINEERING-ONLY BEGIN 007
$engT_assert_relative_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 007
    if ($Value -isnot [string] -or $Value.Length -lt 1 -or $Value.Length -gt 180 -or
        $Value -cnotmatch '^[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$') {
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    foreach ($part in $Value.Split('/')) { Assert-Segment $part }
# ENGINEERING-ONLY BEGIN 008
} finally { $script:engTicks[3] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_assert_relative_inclusive; $script:engCalls[3]++ }
# ENGINEERING-ONLY END 008
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
# ENGINEERING-ONLY BEGIN 001
$engT_initialize_native_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 001
    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')
    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)
    $module = $assembly.DefineDynamicModule('Native')
    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')
    $definitions = @(
        @('CreateFileW', [Microsoft.Win32.SafeHandles.SafeFileHandle], [Type[]] @([string], [uint32], [uint32], [IntPtr], [uint32], [uint32], [IntPtr])),
        @('GetFileInformationByHandle', [bool], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [IntPtr])),
        @('GetFinalPathNameByHandleW', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle], [Text.StringBuilder], [uint32], [uint32])),
        @('GetFileType', [uint32], [Type[]] @([Microsoft.Win32.SafeHandles.SafeFileHandle])),
        @('GetConsoleProcessList', [uint32], [Type[]] @([IntPtr], [uint32])),
        @('CreateToolhelp32Snapshot', [IntPtr], [Type[]] @([uint32], [uint32])),
        @('Process32FirstW', [bool], [Type[]] @([IntPtr], [IntPtr])),
        @('Process32NextW', [bool], [Type[]] @([IntPtr], [IntPtr])),
        @('OpenProcess', [IntPtr], [Type[]] @([uint32], [bool], [uint32])),
        @('QueryFullProcessImageNameW', [bool], [Type[]] @([IntPtr], [uint32], [Text.StringBuilder], [uint32].MakeByRefType())),
        @('FreeConsole', [bool], [Type[]] @()),
        @('WaitForSingleObject', [uint32], [Type[]] @([IntPtr], [uint32])),
        @('CloseHandle', [bool], [Type[]] @([IntPtr])),
        @('TerminateProcess', [bool], [Type[]] @([IntPtr], [uint32]))
    )
    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))
    $fields = [Reflection.FieldInfo[]] @(
        [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),
        [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'),
        [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'))
    foreach ($definition in $definitions) {
        $method = $builder.DefinePInvokeMethod($definition[0], 'kernel32.dll', $definition[0],
            [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
            $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,
            [Runtime.InteropServices.CharSet]::Unicode)
        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
        $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @('kernel32.dll'),
            $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))
        $method.SetCustomAttribute($attribute)
    }
    $script:native = $builder.CreateType()
    Confirm-ConsoleQuiescence
# ENGINEERING-ONLY BEGIN 002
} finally { $script:engTicks[0] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_initialize_native_inclusive; $script:engCalls[0]++ }
# ENGINEERING-ONLY END 002
}
function Confirm-ConsoleQuiescence {
# ENGINEERING-ONLY BEGIN 003
$engT_console_quiescence_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 003
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(568)
    $snapshot = [IntPtr]::Zero
    $consoleHandle = [IntPtr]::Zero
    try {
        $count = $script:native::GetConsoleProcessList($buffer, 1)
        $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($count -eq 0 -and $nativeError -eq 6) { return }
        if ($count -ne 1 -or [Runtime.InteropServices.Marshal]::ReadInt32($buffer) -ne $PID) { Reject-Protocol 'MO1307_INTERNAL' }
        # x64 PROCESSENTRY32W is 568 bytes. Inspect only process identity, never
        # command lines or environment. An owned console may have no HWND.
        $snapshot = $script:native::CreateToolhelp32Snapshot(2, 0)
        if ($snapshot -eq [IntPtr]::new(-1)) { Reject-Protocol 'MO1307_INTERNAL' }
        [Runtime.InteropServices.Marshal]::WriteInt32($buffer, 568)
        $next = $script:native::Process32FirstW($snapshot, $buffer)
        $observed = 0; $owner = 0; $children = 0
        while ($next) {
            $observed++
            if ($observed -gt 16384) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
            $parent = [Runtime.InteropServices.Marshal]::ReadInt32($buffer, 32)
            if ($parent -eq $PID) {
                $children++
                $imageName = [Runtime.InteropServices.Marshal]::PtrToStringUni([IntPtr]::Add($buffer, 44))
                if ($imageName -cne 'conhost.exe') { Reject-Protocol 'MO1307_INTERNAL' }
                $owner = [Runtime.InteropServices.Marshal]::ReadInt32($buffer, 8)
            }
            $next = $script:native::Process32NextW($snapshot, $buffer)
        }
        if ([Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 18 -or $children -ne 1 -or $owner -le 0) { Reject-Protocol 'MO1307_INTERNAL' }
        $consoleHandle = $script:native::OpenProcess(0x101001, $false, $owner)
        if ($consoleHandle -eq [IntPtr]::Zero) { Reject-Protocol 'MO1307_INTERNAL' }
        $image = [Text.StringBuilder]::new(512); $imageLength = [uint32] 512
        if (-not $script:native::QueryFullProcessImageNameW($consoleHandle, 0, $image, [ref] $imageLength)) { Reject-Protocol 'MO1307_INTERNAL' }
        $systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
        if (-not [string]::Equals($image.ToString(), $systemDirectory + '\conhost.exe', [StringComparison]::OrdinalIgnoreCase)) { Reject-Protocol 'MO1307_INTERNAL' }
        if (-not $script:native::FreeConsole()) { Reject-Protocol 'MO1307_INTERNAL' }
        # Bounded cleanup of the explicitly authorized exclusively owned host.
        # FreeConsole has already detached this sole-member private console.
        # Only the held, positively identified owned conhost object is targeted.
        $wait = $script:native::WaitForSingleObject($consoleHandle, 0)
        if ($wait -eq 258) {
            if (-not $script:native::TerminateProcess($consoleHandle, 0) -and
                $script:native::WaitForSingleObject($consoleHandle, 0) -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }
        } elseif ($wait -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }
# ENGINEERING-ONLY BEGIN 043
$engT_console_final_native_wait = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 043
        if ($script:native::WaitForSingleObject($consoleHandle, 1000) -ne 0) { Reject-Protocol 'MO1307_INTERNAL' }
# ENGINEERING-ONLY BEGIN 044
$script:engTicks[21] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_console_final_native_wait; $script:engCalls[21]++
# ENGINEERING-ONLY END 044
        $remaining = $script:native::GetConsoleProcessList($buffer, 1)
        $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($remaining -ne 0 -or $nativeError -ne 6) { Reject-Protocol 'MO1307_INTERNAL' }
# ENGINEERING-ONLY BEGIN 045
Write-Engineering 'console_quiescence_proved' ('"consolePid":' + $owner + ',"heldHandleWaitConfirmed":true,"remainingConsoleProcesses":0')
# ENGINEERING-ONLY END 045
    } finally {
        if ($consoleHandle -ne [IntPtr]::Zero) { [void] $script:native::CloseHandle($consoleHandle) }
        if ($snapshot -ne [IntPtr]::Zero -and $snapshot -ne [IntPtr]::new(-1)) { [void] $script:native::CloseHandle($snapshot) }
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
    }
# ENGINEERING-ONLY BEGIN 004
} finally { $script:engTicks[1] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_console_quiescence_inclusive; $script:engCalls[1]++ }
# ENGINEERING-ONLY END 004
}

function Open-Native([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {
# ENGINEERING-ONLY BEGIN 009
$engT_open_native_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 009
    $access = [uint32] 128
    $sharing = [uint32] 7
    if (-not $Directory) { $access = [uint32] 2147483648; $sharing = [uint32] 1 }
# ENGINEERING-ONLY BEGIN 019
$engT_create_file_and_error_capture = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 019
    $handle = $script:native::CreateFileW($Path, $access, $sharing, [IntPtr]::Zero, 3, 0x02200000, [IntPtr]::Zero)
    $nativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
# ENGINEERING-ONLY BEGIN 020
$script:engTicks[9] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_create_file_and_error_capture; $script:engCalls[9]++
# ENGINEERING-ONLY END 020
    if ($handle.IsInvalid) {
        $handle.Dispose()
        if ($InputLeaf -and $nativeError -eq 2) { Reject-Protocol 'MO1307_INPUT' }
        Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY'
    }
    return $handle
# ENGINEERING-ONLY BEGIN 010
} finally { $script:engTicks[4] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_open_native_inclusive; $script:engCalls[4]++ }
# ENGINEERING-ONLY END 010
}
function Read-Identity($Handle, [string] $Path, [bool] $Directory) {
# ENGINEERING-ONLY BEGIN 011
$engT_read_identity_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 011
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(52)
    try {
# ENGINEERING-ONLY BEGIN 021
$engT_get_file_information_native_and_branch = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 021
        if (-not $script:native::GetFileInformationByHandle($Handle, $buffer)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
# ENGINEERING-ONLY BEGIN 022
$script:engTicks[10] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_get_file_information_native_and_branch; $script:engCalls[10]++
# ENGINEERING-ONLY END 022
# ENGINEERING-ONLY BEGIN 023
$engT_identity_buffer_and_field_decode = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 023
        $raw = [byte[]]::new(52)
        [Runtime.InteropServices.Marshal]::Copy($buffer, $raw, 0, 52)
        $attributes = [long] [BitConverter]::ToUInt32($raw, 0)
        $volume = [BitConverter]::ToUInt32($raw, 28)
        $length = [long] [BitConverter]::ToUInt32($raw, 32) * 4294967296 + [BitConverter]::ToUInt32($raw, 36)
        $links = [long] [BitConverter]::ToUInt32($raw, 40)
        $fileId = [BitConverter]::ToUInt32($raw, 44).ToString('x8') + [BitConverter]::ToUInt32($raw, 48).ToString('x8')
# ENGINEERING-ONLY BEGIN 024
$script:engTicks[11] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_identity_buffer_and_field_decode; $script:engCalls[11]++
# ENGINEERING-ONLY END 024
# ENGINEERING-ONLY BEGIN 025
$engT_identity_attributes_and_get_file_type = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 025
        if (($attributes -band 0x400) -ne 0 -or (($attributes -band 0x10) -ne 0) -ne $Directory -or
            $links -lt 1 -or (-not $Directory -and $links -ne 1) -or $length -gt 9007199254740991 -or
            $script:native::GetFileType($Handle) -ne 1) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
# ENGINEERING-ONLY BEGIN 026
$script:engTicks[12] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_identity_attributes_and_get_file_type; $script:engCalls[12]++
# ENGINEERING-ONLY END 026
# ENGINEERING-ONLY BEGIN 027
$engT_get_final_path_native_buffer_and_count_check = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 027
        $final = [Text.StringBuilder]::new(512)
        $count = $script:native::GetFinalPathNameByHandleW($Handle, $final, 512, 0)
        if ($count -eq 0 -or $count -ge 512) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
# ENGINEERING-ONLY BEGIN 028
$script:engTicks[13] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_get_final_path_native_buffer_and_count_check; $script:engCalls[13]++
# ENGINEERING-ONLY END 028
# ENGINEERING-ONLY BEGIN 029
$engT_identity_final_path_validation_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 029
        $observed = $final.ToString()
        if (-not $observed.StartsWith('\\?\', [StringComparison]::Ordinal)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
        $observed = $observed.Substring(4)
        Assert-Root $observed
        if (-not [string]::Equals($observed, $Path, [StringComparison]::OrdinalIgnoreCase)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
# ENGINEERING-ONLY BEGIN 030
$script:engTicks[14] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_identity_final_path_validation_inclusive; $script:engCalls[14]++
# ENGINEERING-ONLY END 030
# ENGINEERING-ONLY BEGIN 031
$engT_identity_result_construction = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 031
        return [pscustomobject] @{ attributes = $attributes; byteLength = $length; fileId = $fileId;
            finalPath = $observed; isDirectory = $Directory; linkCount = $links; volumeSerial = $volume.ToString('x8') }
# ENGINEERING-ONLY BEGIN 032
} finally { $script:engTicks[15] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_identity_result_construction; $script:engCalls[15]++ }
# ENGINEERING-ONLY END 032
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer) }
# ENGINEERING-ONLY BEGIN 012
} finally { $script:engTicks[5] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_read_identity_inclusive; $script:engCalls[5]++ }
# ENGINEERING-ONLY END 012
}
function Assert-SameIdentity($Before, $After) {
    foreach ($key in @('attributes', 'byteLength', 'fileId', 'finalPath', 'isDirectory', 'linkCount', 'volumeSerial')) {
        if ($Before.$key -cne $After.$key) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
    }
}
function Open-Chain([string] $Path, [bool] $Directory, [bool] $InputLeaf = $false) {
# ENGINEERING-ONLY BEGIN 013
$engT_open_chain_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 013
# ENGINEERING-ONLY BEGIN 033
$engT_open_chain_root_lexical_validation = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 033
    Assert-Root $Path
# ENGINEERING-ONLY BEGIN 034
$script:engTicks[16] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_open_chain_root_lexical_validation; $script:engCalls[16]++
# ENGINEERING-ONLY END 034
# ENGINEERING-ONLY BEGIN 035
$engT_open_chain_ancestor_preparation = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 035
    $paths = [Collections.Generic.List[string]]::new()
    $paths.Add($Path.Substring(0, 3))
    if ($Path.Length -gt 3) {
        foreach ($part in $Path.Substring(3).Split('\')) {
            $paths.Add($paths[$paths.Count - 1].TrimEnd('\') + '\' + $part)
        }
    }
    if ($paths.Count -gt 120) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
    $entries = [Collections.Generic.List[object]]::new()
# ENGINEERING-ONLY BEGIN 036
$script:engTicks[17] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_open_chain_ancestor_preparation; $script:engCalls[17]++
# ENGINEERING-ONLY END 036
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
# ENGINEERING-ONLY BEGIN 014
} finally { $script:engTicks[6] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_open_chain_inclusive; $script:engCalls[6]++ }
# ENGINEERING-ONLY END 014
}
function Close-Chain($Entries) { foreach ($entry in $Entries) { $entry.handle.Dispose() } }
function Assert-ChainStable($Entries) {
# ENGINEERING-ONLY BEGIN 015
$engT_assert_chain_stable_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 015
    foreach ($entry in $Entries) {
# ENGINEERING-ONLY BEGIN 037
$engT_stable_chain_held_identity_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 037
        Assert-SameIdentity $entry.identity (Read-Identity $entry.handle $entry.path $entry.directory)
# ENGINEERING-ONLY BEGIN 038
$script:engTicks[18] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_stable_chain_held_identity_inclusive; $script:engCalls[18]++
# ENGINEERING-ONLY END 038
        # A fresh handle proves the path still names the original identity.
# ENGINEERING-ONLY BEGIN 039
$engT_stable_chain_fresh_open_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 039
        $fresh = Open-Native $entry.path $entry.directory
# ENGINEERING-ONLY BEGIN 040
$script:engTicks[19] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_stable_chain_fresh_open_inclusive; $script:engCalls[19]++
# ENGINEERING-ONLY END 040
# ENGINEERING-ONLY BEGIN 041
$engT_stable_chain_fresh_identity_and_dispose_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 041
        try { Assert-SameIdentity $entry.identity (Read-Identity $fresh $entry.path $entry.directory) }
        finally { $fresh.Dispose() }
# ENGINEERING-ONLY BEGIN 042
$script:engTicks[20] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_stable_chain_fresh_identity_and_dispose_inclusive; $script:engCalls[20]++
# ENGINEERING-ONLY END 042
    }
# ENGINEERING-ONLY BEGIN 016
} finally { $script:engTicks[7] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_assert_chain_stable_inclusive; $script:engCalls[7]++ }
# ENGINEERING-ONLY END 016
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
# ENGINEERING-ONLY BEGIN 017
$engT_readset_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 017
# ENGINEERING-ONLY BEGIN 046
$engT_readset_collection_initialization = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 046
    $rootChains = [Collections.Generic.Dictionary[string,object]]::new([StringComparer]::Ordinal)
    $responseRoots = [Collections.Generic.List[object]]::new()
    $responseFiles = [Collections.Generic.List[object]]::new()
    $nativeFiles = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    $total = 0L
# ENGINEERING-ONLY BEGIN 047
$script:engTicks[22] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_readset_collection_initialization; $script:engCalls[22]++
# ENGINEERING-ONLY END 047
    try {
# ENGINEERING-ONLY BEGIN 048
$engT_readset_root_acquisition = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 048
        foreach ($root in $Request.roots) {
            $chain = Open-Chain $Roots[$root.id] $true
            $rootChains.Add($root.id, $chain)
            $responseRoots.Add([pscustomobject] @{ id = $root.id; identity = $chain[$chain.Count - 1].identity })
        }
# ENGINEERING-ONLY BEGIN 049
$script:engTicks[23] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_readset_root_acquisition; $script:engCalls[23]++
# ENGINEERING-ONLY END 049
        foreach ($file in $Request.files) {
# ENGINEERING-ONLY BEGIN 050
$script:engOrdinal++
$engFileStart = [Diagnostics.Stopwatch]::GetTimestamp()
$engFileBaseTicks = $script:engTicks.Clone()
$engFileBaseCalls = $script:engCalls.Clone()
Write-Engineering 'file_start' ('"ordinal":' + $script:engOrdinal + ',"id":"' + $file.id + '","stableIdentifier":"file-' + $script:engOrdinal + '"')
# ENGINEERING-ONLY END 050
# ENGINEERING-ONLY BEGIN 051
$engT_file_path_preparation = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 051
            $full = $Roots[$file.root].TrimEnd('\') + '\' + $file.path.Replace('/', '\')
# ENGINEERING-ONLY BEGIN 052
$script:engTicks[24] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_path_preparation; $script:engCalls[24]++
# ENGINEERING-ONLY END 052
# ENGINEERING-ONLY BEGIN 053
$engT_file_open_chain_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 053
            $chain = Open-Chain $full $false $true
# ENGINEERING-ONLY BEGIN 054
$script:engTicks[25] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_open_chain_inclusive; $script:engCalls[25]++
# ENGINEERING-ONLY END 054
            try {
# ENGINEERING-ONLY BEGIN 055
$engT_file_pre_read_identity_and_limits = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 055
                $rootChain = $rootChains[$file.root]
                for ($index = 0; $index -lt $rootChain.Count; $index++) { Assert-SameIdentity $rootChain[$index].identity $chain[$index].identity }
                $leaf = $chain[$chain.Count - 1]
                if (-not $nativeFiles.Add($leaf.identity.volumeSerial + ':' + $leaf.identity.fileId)) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
                if ($leaf.identity.byteLength -gt $file.maxBytes) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
                if ($Request.sequence -eq 3 -and $total + $leaf.identity.byteLength -gt 8388608) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
# ENGINEERING-ONLY BEGIN 056
$script:engTicks[26] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_pre_read_identity_and_limits; $script:engCalls[26]++
# ENGINEERING-ONLY END 056
# ENGINEERING-ONLY BEGIN 057
$engT_file_buffer_and_stream_preparation = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 057
                $data = [byte[]]::new($file.maxBytes + 1)
                # This non-owning wrapper leaves the checked native handle open
                # through after-read identity checks and complete chain checks.
                $borrowed = [Microsoft.Win32.SafeHandles.SafeFileHandle]::new($leaf.handle.DangerousGetHandle(), $false)
                $stream = [IO.FileStream]::new($borrowed, [IO.FileAccess]::Read, 65536, $false)
# ENGINEERING-ONLY BEGIN 058
$script:engTicks[27] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_buffer_and_stream_preparation; $script:engCalls[27]++
# ENGINEERING-ONLY END 058
# ENGINEERING-ONLY BEGIN 059
$engT_file_stream_read_and_dispose = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 059
                try {
                    $used = 0
                    while ($used -lt $data.Length) {
                        $count = $stream.Read($data, $used, $data.Length - $used)
                        if ($count -eq 0) { break }
                        $used += $count
                    }
                } finally { $stream.Dispose(); $borrowed.Dispose() }
# ENGINEERING-ONLY BEGIN 060
$script:engTicks[28] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_stream_read_and_dispose; $script:engCalls[28]++
# ENGINEERING-ONLY END 060
# ENGINEERING-ONLY BEGIN 061
$engT_file_post_read_size_checks = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 061
                if ($used -gt $file.maxBytes) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
                if ($used -ne $leaf.identity.byteLength) { Reject-Protocol 'MO1307_FILESYSTEM_BOUNDARY' }
                $total += $used
# ENGINEERING-ONLY BEGIN 062
$script:engTicks[29] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_post_read_size_checks; $script:engCalls[29]++
# ENGINEERING-ONLY END 062
# ENGINEERING-ONLY BEGIN 063
$engT_file_post_read_chain_verification_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 063
                Assert-ChainStable $chain
# ENGINEERING-ONLY BEGIN 064
$script:engTicks[30] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_post_read_chain_verification_inclusive; $script:engCalls[30]++
# ENGINEERING-ONLY END 064
# ENGINEERING-ONLY BEGIN 065
$engT_file_base64_encoding = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 065
                $encoded = [Convert]::ToBase64String($data, 0, $used)
# ENGINEERING-ONLY BEGIN 066
$script:engTicks[31] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_base64_encoding; $script:engCalls[31]++
# ENGINEERING-ONLY END 066
# ENGINEERING-ONLY BEGIN 067
$engT_file_base64_chunking = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 067
                $chunks = [Collections.Generic.List[string]]::new()
                for ($offset = 0; $offset -lt $encoded.Length; $offset += 4096) {
                    $chunks.Add($encoded.Substring($offset, [Math]::Min(4096, $encoded.Length - $offset)))
                }
# ENGINEERING-ONLY BEGIN 068
$script:engTicks[32] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_base64_chunking; $script:engCalls[32]++
# ENGINEERING-ONLY END 068
# ENGINEERING-ONLY BEGIN 069
$engT_file_result_construction = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 069
                $responseFiles.Add([pscustomobject] @{ id = $file.id; identity = $leaf.identity; bytes = $chunks.ToArray() })
# ENGINEERING-ONLY BEGIN 070
$script:engTicks[33] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_result_construction; $script:engCalls[33]++
# ENGINEERING-ONLY END 070
# ENGINEERING-ONLY BEGIN 071
$engT_file_chain_close = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 071
            } finally { Close-Chain $chain }
# ENGINEERING-ONLY BEGIN 072
$script:engTicks[34] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_file_chain_close; $script:engCalls[34]++
# ENGINEERING-ONLY END 072
# ENGINEERING-ONLY BEGIN 073
$engFileEnd = [Diagnostics.Stopwatch]::GetTimestamp()
$script:engFilesCompleted++; $script:engBytesCompleted += $used
$engLogStart = [Diagnostics.Stopwatch]::GetTimestamp()
$engDeltas = [long[]]::new($script:engTicks.Length); $engCallDeltas = [long[]]::new($script:engCalls.Length)
for ($engI = 0; $engI -lt $engDeltas.Length; $engI++) { $engDeltas[$engI] = $script:engTicks[$engI] - $engFileBaseTicks[$engI]; $engCallDeltas[$engI] = $script:engCalls[$engI] - $engFileBaseCalls[$engI] }
Write-Engineering 'file_complete' ('"ordinal":' + $script:engOrdinal + ',"id":"' + $file.id + '","stableIdentifier":"file-' + $script:engOrdinal + '","byteLength":' + $used + ',"startTick":' + $engFileStart + ',"endTick":' + $engFileEnd + ',"filesCompleted":' + $script:engFilesCompleted + ',"bytesCompleted":' + $script:engBytesCompleted + ',"stageTicks":[' + [string]::Join(',', $engDeltas) + '],"stageCalls":[' + [string]::Join(',', $engCallDeltas) + ']')
$script:engLogPreparationTicks += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engLogStart
# ENGINEERING-ONLY END 073
        }
# ENGINEERING-ONLY BEGIN 074
$engT_readset_final_root_verification_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 074
        foreach ($chain in $rootChains.Values) { Assert-ChainStable $chain }
# ENGINEERING-ONLY BEGIN 075
$script:engTicks[35] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_readset_final_root_verification_inclusive; $script:engCalls[35]++
# ENGINEERING-ONLY END 075
# ENGINEERING-ONLY BEGIN 076
$engT_readset_aggregate_result_construction = [Diagnostics.Stopwatch]::GetTimestamp()
try {
# ENGINEERING-ONLY END 076
        return [pscustomobject] @{ roots = $responseRoots.ToArray(); files = $responseFiles.ToArray(); status = 'OK' }
# ENGINEERING-ONLY BEGIN 077
} finally { $script:engTicks[36] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_readset_aggregate_result_construction; $script:engCalls[36]++ }
# ENGINEERING-ONLY END 077
    } finally { foreach ($chain in $rootChains.Values) { Close-Chain $chain } }
# ENGINEERING-ONLY BEGIN 018
} finally { $script:engTicks[8] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_readset_inclusive; $script:engCalls[8]++ }
# ENGINEERING-ONLY END 018
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
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
        -not [Environment]::Is64BitProcess) { exit 22 }
    $stdin = [Console]::OpenStandardInput()
    $savedStdout = [Console]::OpenStandardOutput()
    Initialize-Native
} catch { exit 22 }

try {
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
        -not [Environment]::Is64BitProcess) { Reject-Protocol }
# ENGINEERING-ONLY BEGIN 078
Write-Engineering 'request_framing_started' ''
$engT_request_framing_and_read = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 078
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
# ENGINEERING-ONLY BEGIN 079
$script:engTicks[37] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_framing_and_read; $script:engCalls[37]++
Write-Engineering 'request_framing_completed' ''
# ENGINEERING-ONLY END 079
# ENGINEERING-ONLY BEGIN 080
$engT_request_utf8_decode = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 080
    $utf8 = [System.Text.UTF8Encoding]::new($false, $true)
    $text = $utf8.GetString($body)
# ENGINEERING-ONLY BEGIN 081
$script:engTicks[38] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_utf8_decode; $script:engCalls[38]++
# ENGINEERING-ONLY END 081
    # Bound nesting before the system JSON parser. Quoted/escaped punctuation
    # cannot affect the depth counter. Canonical equality rejects duplicate keys,
    # alternate escapes, whitespace, exponent/fraction syntax and BOM afterward.
# ENGINEERING-ONLY BEGIN 082
$engT_request_depth_scan = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 082
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
# ENGINEERING-ONLY BEGIN 083
$script:engTicks[39] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_depth_scan; $script:engCalls[39]++
# ENGINEERING-ONLY END 083
# ENGINEERING-ONLY BEGIN 084
$engT_request_json_decode = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 084
    $request = ConvertFrom-Json -InputObject $text
# ENGINEERING-ONLY BEGIN 085
$script:engTicks[40] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_json_decode; $script:engCalls[40]++
# ENGINEERING-ONLY END 085
# ENGINEERING-ONLY BEGIN 086
$engT_request_canonical_reencode_and_equality = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 086
    if (((Encode-Value $request) + "`n") -cne $text) { Reject-Protocol }
# ENGINEERING-ONLY BEGIN 087
$script:engTicks[41] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_canonical_reencode_and_equality; $script:engCalls[41]++
# ENGINEERING-ONLY END 087
# ENGINEERING-ONLY BEGIN 088
Write-Engineering 'request_decoded' ''
$engT_request_semantic_validation_inclusive = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 088
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
# ENGINEERING-ONLY BEGIN 089
$engT_request_roots_validation = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 089
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
# ENGINEERING-ONLY BEGIN 090
$script:engTicks[42] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_roots_validation; $script:engCalls[42]++
# ENGINEERING-ONLY END 090
    $prior = $null
    $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
# ENGINEERING-ONLY BEGIN 091
$engT_request_paths_validation = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 091
    foreach ($file in $request.files) {
# ENGINEERING-ONLY BEGIN 092
$engValidationStart = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 092
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
# ENGINEERING-ONLY BEGIN 093
$engValidationEnd = [Diagnostics.Stopwatch]::GetTimestamp()
$script:engValidationOrdinal++
Write-Engineering 'path_validated' ('"ordinal":' + $script:engValidationOrdinal + ',"id":"' + $file.id + '","stableIdentifier":"file-' + $script:engValidationOrdinal + '","startTick":' + $engValidationStart + ',"endTick":' + $engValidationEnd + ',"durationTicks":' + ($engValidationEnd - $engValidationStart))
# ENGINEERING-ONLY END 093
    }
# ENGINEERING-ONLY BEGIN 094
$script:engTicks[43] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_paths_validation; $script:engCalls[43]++
# ENGINEERING-ONLY END 094
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
# ENGINEERING-ONLY BEGIN 095
$script:engTicks[44] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_request_semantic_validation_inclusive; $script:engCalls[44]++
Write-Engineering 'request_validated' ('"sequence":' + $sequence + ',"fileCount":' + $request.files.Length)
# ENGINEERING-ONLY END 095
    $nativeMode = $true
    if ($operation -ceq 'READ_SET') { $nativeResult = Invoke-ReadSet $request $roots }
    else { $nativeResult = Invoke-Inspection $request $roots }
# ENGINEERING-ONLY BEGIN 096
Write-Engineering 'algorithm_complete' ('"filesCompleted":' + $script:engFilesCompleted + ',"bytesCompleted":' + $script:engBytesCompleted)
# ENGINEERING-ONLY END 096
    $code = $null
} catch {
    # Never disclose internal diagnostics on the product transport.
    if ($_.Exception.Message -cin @('MO1307_INPUT', 'MO1307_FILESYSTEM_BOUNDARY', 'MO1307_RESOURCE_LIMIT', 'MO1307_INTERNAL')) {
        $code = $_.Exception.Message
    } elseif ($nativeMode) { $code = 'MO1307_INTERNAL' } else { $code = 'MO1307_INPUT' }
}

try {
# ENGINEERING-ONLY BEGIN 097
$engT_response_envelope_construction = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 097
    $response = [pscustomobject] @{ code = $code; files = @(); kind = 'MemoryOSReadinessHelperResponse';
        operation = $operation; roots = @(); sequence = $sequence; session = $session; status = 'ERROR'; version = '2.0.0' }
    if ($null -eq $code -and $null -ne $nativeResult) {
        $response.files = $nativeResult.files; $response.roots = $nativeResult.roots; $response.status = $nativeResult.status
    }
# ENGINEERING-ONLY BEGIN 098
$script:engTicks[45] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_response_envelope_construction; $script:engCalls[45]++
Write-Engineering 'response_constructed' ''
$engResponseUtf8 = [Text.UTF8Encoding]::new($false, $true)
$engT_response_canonical_serialization = [Diagnostics.Stopwatch]::GetTimestamp()
$engSerialized = (Encode-Value $response) + "`n"
$script:engTicks[46] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_response_canonical_serialization; $script:engCalls[46]++
Write-Engineering 'serialization_completed' ''
$engT_response_utf8_encoding = [Diagnostics.Stopwatch]::GetTimestamp()
$replyBytes = $engResponseUtf8.GetBytes($engSerialized)
$script:engTicks[47] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_response_utf8_encoding; $script:engCalls[47]++
Write-Engineering 'utf8_encoded' ('"responseBodyBytes":' + $replyBytes.Length)
# ENGINEERING-ONLY END 098
    if ($replyBytes.Length + 4 -gt $responseCeiling) { Reject-Protocol 'MO1307_RESOURCE_LIMIT' }
} catch {
    $reply = '{"code":"MO1307_RESOURCE_LIMIT","files":[],"kind":"MemoryOSReadinessHelperResponse","operation":"' + $operation +
        '","roots":[],"sequence":' + $sequence + ',"session":"' + $session + '","status":"ERROR","version":"2.0.0"}' + "`n"
    $replyBytes = [Text.UTF8Encoding]::new($false, $true).GetBytes($reply)
}
# ENGINEERING-ONLY BEGIN 099
$engT_response_frame_header_encoding = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 099
$length = [uint32] $replyBytes.Length
$replyHeader = [byte[]] @([byte] (($length -shr 24) -band 255), [byte] (($length -shr 16) -band 255), [byte] (($length -shr 8) -band 255), [byte] ($length -band 255))
$stdout = $savedStdout
# ENGINEERING-ONLY BEGIN 100
$script:engTicks[48] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_response_frame_header_encoding; $script:engCalls[48]++
# ENGINEERING-ONLY END 100
# ENGINEERING-ONLY BEGIN 101
$engT_stdout_write_and_flush = [Diagnostics.Stopwatch]::GetTimestamp()
# ENGINEERING-ONLY END 101
$stdout.Write($replyHeader, 0, 4)
$stdout.Write($replyBytes, 0, $replyBytes.Length)
$stdout.Flush()
# ENGINEERING-ONLY BEGIN 102
$script:engTicks[49] += ([Diagnostics.Stopwatch]::GetTimestamp()) - $engT_stdout_write_and_flush; $script:engCalls[49]++
# ENGINEERING-ONLY END 102
# ENGINEERING-ONLY BEGIN 103
Write-Engineering 'stdout_written_flushed' ('"responseBodyBytes":' + $replyBytes.Length)
Write-Engineering 'totals' ('"stageTicks":[' + [string]::Join(',', $script:engTicks) + '],"stageCalls":[' + [string]::Join(',', $script:engCalls) + '],"filesCompleted":' + $script:engFilesCompleted + ',"bytesCompleted":' + $script:engBytesCompleted + ',"logWriteTicks":' + $script:engLogWriteTicks + ',"fileLogPreparationInclusiveTicks":' + $script:engLogPreparationTicks)
Write-Engineering 'script_exit_ready' ''
$script:engWriter.Dispose()
# ENGINEERING-ONLY END 103
exit 0

# Engineering trace functions do not alter stdout or load JSON cmdlets.
$script:__trStream=$null; $script:__trClock=$null; $script:__trUsed=0; $script:__trNormal=0
$script:__trId='T001'; $script:__trLast=$null; $script:__trValue=$null; $script:__trNative=$null
$script:__trFirst=$null; $script:__trOverflow=$false; $script:__trLastError=0; $script:__trRead=$false
function D-Time { if($null -eq $script:__trClock){return 0}; return [Math]::Min(999999,[long]$script:__trClock.Elapsed.TotalMilliseconds) }
function D-Q($Value,[int]$Limit=64) {
    if($null -eq $Value){return 'null'}
    $text=[string]$Value
    $text=[regex]::Replace($text,'[A-Za-z]:[\\/][^\r\n]*','<path>')
    $text=[regex]::Replace($text,'[^\x20-\x7e]','?').Replace('\','/').Replace('"',"'")
    if($text.Length -gt $Limit){$text=$text.Substring(0,$Limit)}
    return '"'+$text+'"'
}
function D-Scalar($Value) {
    if($null -eq $Value){return 'null'}
    if($Value -is [bool]){if($Value){return '1'}else{return '0'}}
    if($Value -is [IntPtr]){return $Value.ToInt64().ToString([Globalization.CultureInfo]::InvariantCulture)}
    if($Value -is [ValueType]){return [string]::Format([Globalization.CultureInfo]::InvariantCulture,'{0}',$Value)}
    return D-Q $Value 16
}
function D-Write([string]$Text,[bool]$Critical=$false) {
    try {
        $b=[Text.Encoding]::UTF8.GetBytes($Text+[char]10)
        if($null -eq $script:__trStream){return}
        if(-not $Critical -and $script:__trNormal+$b.Length -gt 3000){
            if(-not $script:__trOverflow){
                $script:__trOverflow=$true
                D-Write ('{"kind":"MO1307StartupTraceOverflow","id":'+(D-Q $script:__trId 16)+',"elapsedMs":'+(D-Time)+'}') $true
            }
            return
        }
        if($script:__trUsed+$b.Length -le 4096){
            $script:__trStream.Write($b,0,$b.Length)
            $script:__trUsed+=$b.Length
            if(-not $Critical){$script:__trNormal+=$b.Length}
        }
    } catch { }
}
function D-Start([string]$Id) { try {$script:__trId=$Id; $script:__trValue=$null} catch {} }
function D-End([string]$Id,$Value=1,[bool]$Passed=$true,$ErrorCode=$null,[bool]$Meaningful=$false,[bool]$Native=$false) {
    try {
        $script:__trId=$Id; $script:__trValue=$Value
        if($Native){$script:__trNative=@{id=$Id;value=$Value;error=$ErrorCode;meaningful=$Meaningful}}
        if(-not $Passed){D-Failure $null}
        $line='['+(D-Q $Id 16)+','+(D-Time)+','+(D-Scalar $Value)+','+(D-Scalar $ErrorCode)+','+([int]$Meaningful)+','+([int]$Passed)+']'
        D-Write $line ($Id -eq 'T021' -or $Id -eq 'T022')
        if($Passed){$script:__trLast=$Id}
    } catch {}
}
function D-Exception($Caught) {
    if($null -eq $Caught){return $null}
    $e=$Caught.Exception; $inner=$null
    if($null -ne $e.InnerException){$i=$e.InnerException;$inner=@{type=$i.GetType().FullName;hresult=$i.HResult;message=$i.Message}}
    return @{type=$e.GetType().FullName;hresult=$e.HResult;message=$e.Message;inner=$inner}
}
function D-Failure($Caught) {
    try {
        $ex=D-Exception $Caught
        if($null -eq $script:__trFirst){$script:__trFirst=@{id=$script:__trId;lastSuccessfulId=$script:__trLast;value=$script:__trValue;native=$script:__trNative;exception=$ex;elapsedMs=(D-Time)}}
        elseif($null -eq $script:__trFirst.exception -and $null -ne $ex){$script:__trFirst.exception=$ex}
    } catch {}
}
function D-ExceptionJson($Ex,[bool]$WithInner=$true) {
    if($null -eq $Ex){return 'null'}
    $s='{"type":'+(D-Q $Ex.type 64)+',"hresult":'+(D-Scalar $Ex.hresult)+',"message":'+(D-Q $Ex.message 64)
    if($WithInner -and $null -ne $Ex.inner){$s+=',"inner":'+(D-ExceptionJson $Ex.inner $false)}
    return $s+'}'
}
function D-EmitFailure($Caught,[bool]$OuterCatch=$false) {
    try {
        D-Failure $Caught
        $f=$script:__trFirst; $n=$f.native; $native='null'
        if($null -ne $n){$native='{"id":'+(D-Q $n.id 16)+',"value":'+(D-Scalar $n.value)+',"error":'+(D-Scalar $n.error)+',"meaningful":'+([int]$n.meaningful)+'}'}
        $outer=D-Exception $Caught
        if($null -ne $outer -and $null -ne $f.exception -and $outer.type -eq $f.exception.type -and $outer.hresult -eq $f.exception.hresult -and $outer.message -eq $f.exception.message){$outer=$null}
        $record='{"kind":"MO1307StartupTraceFailure","outerId":"T025","outerCatch":'+([int]$OuterCatch)+',"firstFailure":{"id":'+(D-Q $f.id 16)+',"lastSuccessfulId":'+(D-Q $f.lastSuccessfulId 16)+',"value":'+(D-Scalar $f.value)+',"native":'+$native+',"exception":'+(D-ExceptionJson $f.exception)+',"elapsedMs":'+$f.elapsedMs+'},"activeId":'+(D-Q $script:__trId 16)+',"cleanupLastSuccessfulId":'+(D-Q $script:__trLast 16)+',"outerException":'+(D-ExceptionJson $outer $false)+',"traceOverflow":'+([int]$script:__trOverflow)+'}'
        D-Write $record $true
    } catch {}
}
try {$script:__trClock=[Diagnostics.Stopwatch]::StartNew();$script:__trStream=[Console]::OpenStandardError();D-End 'T001' $PID} catch {}

D-Start 'T001.1'
try {
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


    D-End 'T001.1'
} catch { try { D-EmitFailure $_ } catch {}; throw }
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
    D-Start 'T007.1'
    $name = [Reflection.AssemblyName]::new('MemoryOSReadinessNative')
    D-End 'T007.1' ($null -ne $name) ($null -ne $name)
    D-Start 'T007.2'
    $assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly($name, [Reflection.Emit.AssemblyBuilderAccess]::Run)
    D-End 'T007.2' ($null -ne $assembly) ($null -ne $assembly)
    D-Start 'T007.3'
    $module = $assembly.DefineDynamicModule('Native')
    D-End 'T007.3' ($null -ne $module) ($null -ne $module)
    D-Start 'T007.4'
    $builder = $module.DefineType('MemoryOSReadiness.Native', [Reflection.TypeAttributes]'Public, Sealed, Abstract')
    D-End 'T007.4' ($null -ne $builder) ($null -ne $builder)
    D-Start 'T009.0'
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
    D-End 'T009.0' $definitions.Count $true
    D-Start 'T009.1'
    $dllConstructor = [Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]] @([string]))
    D-End 'T009.1' ($null -ne $dllConstructor) ($null -ne $dllConstructor)
    $fields = [Reflection.FieldInfo[]] @(
        $(D-Start 'T009.2'; $__trField = [Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'); D-End 'T009.2' ($null -ne $__trField) ($null -ne $__trField); $__trField),
        $(D-Start 'T009.3'; $__trField = [Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'); D-End 'T009.3' ($null -ne $__trField) ($null -ne $__trField); $__trField),
        $(D-Start 'T009.4'; $__trField = [Runtime.InteropServices.DllImportAttribute].GetField('CharSet'); D-End 'T009.4' ($null -ne $__trField) ($null -ne $__trField); $__trField))
    $script:__trIteration = 0
    foreach ($definition in $definitions) {
        $script:__trIteration++
        D-Start ('T009.' + ($script:__trIteration * 10 + 1))
        $library = if ($definition.Count -eq 4) { $definition[3] } else { 'kernel32.dll' }
        $method = $builder.DefinePInvokeMethod($definition[0], $library, $definition[0],
            [Reflection.MethodAttributes]'Public, Static, PinvokeImpl', [Reflection.CallingConventions]::Standard,
            $definition[1], $definition[2], [Runtime.InteropServices.CallingConvention]::Winapi,
            [Runtime.InteropServices.CharSet]::Unicode)
        D-End ('T009.' + ($script:__trIteration * 10 + 1)) ($null -ne $method) ($null -ne $method)
        D-Start ('T009.' + ($script:__trIteration * 10 + 2))
        $method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
        D-End ('T009.' + ($script:__trIteration * 10 + 2)) 1 $true
        D-Start ('T009.' + ($script:__trIteration * 10 + 3))
        $attribute = [Reflection.Emit.CustomAttributeBuilder]::new($dllConstructor, [object[]] @($library),
            $fields, [object[]] @($true, $true, [Runtime.InteropServices.CharSet]::Unicode))
        D-End ('T009.' + ($script:__trIteration * 10 + 3)) ($null -ne $attribute) ($null -ne $attribute)
        D-Start ('T009.' + ($script:__trIteration * 10 + 4))
        $method.SetCustomAttribute($attribute)
        D-End ('T009.' + ($script:__trIteration * 10 + 4)) 1 $true
    }
    D-Start 'T008'
    $script:native = $builder.CreateType()
    D-End 'T008' ($null -ne $script:native) ($null -ne $script:native)
    D-Start 'T015'
    Confirm-ConsoleQuiescence
    D-End 'T015' 1 $true
}
function Confirm-ConsoleQuiescence {
    # Standard handles are borrowed from this process, not newly owned handles.
    # Only the fixed redirected product pipes admit the headless lifecycle path.
    foreach ($selector in @(-10, -11, -12)) {
        $standardHandle = $(D-Start ('T015.' + (-$selector - 9) + 'a'); $__trNativeResult = $script:native::GetStdHandle($selector); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End ('T015.' + (-$selector - 9) + 'a') $__trNativeResult ($__trNativeResult -ne [IntPtr]::Zero -and $__trNativeResult -ne [IntPtr]::new(-1)) $__trNativeError ($__trNativeResult -eq [IntPtr]::Zero -or $__trNativeResult -eq [IntPtr]::new(-1)) $true; $__trNativeResult)
        if ($(D-Start ('T015.' + (-$selector - 9) + 'b'); $__trGuard = $standardHandle -eq [IntPtr]::Zero; D-End ('T015.' + (-$selector - 9) + 'b') $__trGuard (-not $__trGuard); $__trGuard) -or $(D-Start ('T015.' + (-$selector - 9) + 'c'); $__trGuard = $standardHandle -eq [IntPtr]::new(-1); D-End ('T015.' + (-$selector - 9) + 'c') $__trGuard (-not $__trGuard); $__trGuard) -or
            $(D-Start ('T015.' + (-$selector - 9) + 'd'); $__trNativeResult = $script:native::GetFileType($standardHandle); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End ('T015.' + (-$selector - 9) + 'd') $__trNativeResult ($__trNativeResult -eq 3) $__trNativeError ($__trNativeResult -eq 0) $true; $__trNativeResult) -ne 3) { D-Failure $null; Reject-Protocol 'MO1307_INTERNAL' }
    }
    D-Start 'T010'
    $buffer = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
    D-End 'T010' ($buffer -ne [IntPtr]::Zero) $true
    try {
        $count = $(D-Start 'T011'; $__trNativeResult = $script:native::GetConsoleProcessList($buffer, 1); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End 'T011' $__trNativeResult (($__trNativeResult -eq 0 -and $__trNativeError -eq 6) -or $__trNativeResult -eq 1) $__trNativeError ($__trNativeResult -eq 0) $true; $__trNativeResult)
        $nativeError = $script:__trLastError
        D-End 'T012' $count $true $nativeError ($count -eq 0)
        if ($(D-Start 'T013.1'; $__trValue = ($count -eq 0 -and $nativeError -eq 6); D-End 'T013.1' $__trValue $true; $__trValue)) { return }
        if ($(D-Start 'T013.2'; $__trValue = ($count -ne 1); D-End 'T013.2' $__trValue ($__trValue -eq $false); $__trValue) -or $(D-Start 'T014'; $__trValue = [Runtime.InteropServices.Marshal]::ReadInt32($buffer); D-End 'T014' $__trValue ($__trValue -eq $PID); $__trValue) -ne $PID) { D-Failure $null; Reject-Protocol 'MO1307_INTERNAL' }
        # Membership is topology evidence only. Detach this helper without
        # discovering, opening, terminating or claiming exit of any host process.
        D-End 'T016' $PID $true
        if (-not $(D-Start 'T017'; $__trNativeResult = $script:native::FreeConsole(); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End 'T017' $__trNativeResult ($__trNativeResult) $__trNativeError (-not $__trNativeResult) $true; $__trNativeResult)) { D-Failure $null; Reject-Protocol 'MO1307_INTERNAL' }
        $remaining = $(D-Start 'T018'; $__trNativeResult = $script:native::GetConsoleProcessList($buffer, 1); $__trNativeError = [Runtime.InteropServices.Marshal]::GetLastWin32Error(); $script:__trLastError = $__trNativeError; D-End 'T018' $__trNativeResult ($__trNativeResult -eq 0 -and $__trNativeError -eq 6) $__trNativeError ($__trNativeResult -eq 0) $true; $__trNativeResult)
        $nativeError = $script:__trLastError
        D-End 'T019' $remaining $true $nativeError ($remaining -eq 0)
        if ($(D-Start 'T020.1'; $__trValue = ($remaining -ne 0); D-End 'T020.1' $__trValue ($__trValue -eq $false); $__trValue) -or $(D-Start 'T020.2'; $__trValue = ($nativeError -ne 6); D-End 'T020.2' $__trValue ($__trValue -eq $false); $__trValue)) { D-Failure $null; Reject-Protocol 'MO1307_INTERNAL' }
    } catch { D-Failure $_; throw } finally {
        D-End 'T021' 0
        D-Start 'T022'
        [Runtime.InteropServices.Marshal]::FreeHGlobal($buffer)
        D-End 'T022' 1 $true
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


# Save all redirected transports before self-detachment. A valid response proves
# this helper's startup pipe/membership/console-absence checks, not host exit.
# The supervisor separately requires process termination and complete pipe EOF.
# Actual startup-security failure remains silent exit 22 without a frame.
try {
    if ($(D-Start 'T002.1'; $__trValue = $PSVersionTable.PSVersion.Major; D-End 'T002.1' $__trValue ($__trValue -eq 5); $__trValue) -ne 5 -or $(D-Start 'T002.2'; $__trValue = $PSVersionTable.PSVersion.Minor; D-End 'T002.2' $__trValue ($__trValue -eq 1); $__trValue) -ne 1 -or
        -not $(D-Start 'T003'; $__trValue = [Environment]::Is64BitProcess; D-End 'T003' $__trValue ($__trValue -eq $true); $__trValue)) { try { D-EmitFailure $null } catch {}; exit 22 }
    D-Start 'T004'
    $stdin = [Console]::OpenStandardInput()
    D-End 'T004' 1 $true
    D-Start 'T005'
    $savedStdout = [Console]::OpenStandardOutput()
    D-End 'T005' 1 $true
    D-Start 'T006.1'
    $savedStderr = [Console]::OpenStandardError()
    D-End 'T006.1' 1 $true
    if ($(D-Start 'T006.2'; $__trValue = [object]::ReferenceEquals($stdin, [IO.Stream]::Null); D-End 'T006.2' $__trValue ($__trValue -eq $false); $__trValue) -or
        $(D-Start 'T006.3'; $__trValue = [object]::ReferenceEquals($savedStdout, [IO.Stream]::Null); D-End 'T006.3' $__trValue ($__trValue -eq $false); $__trValue) -or
        $(D-Start 'T006.4'; $__trValue = [object]::ReferenceEquals($savedStderr, [IO.Stream]::Null); D-End 'T006.4' $__trValue ($__trValue -eq $false); $__trValue) -or
        -not $(D-Start 'T006.5'; $__trValue = $stdin.CanRead; D-End 'T006.5' $__trValue ($__trValue -eq $true); $__trValue) -or -not $(D-Start 'T006.6'; $__trValue = $savedStdout.CanWrite; D-End 'T006.6' $__trValue ($__trValue -eq $true); $__trValue) -or -not $(D-Start 'T006.7'; $__trValue = $savedStderr.CanWrite; D-End 'T006.7' $__trValue ($__trValue -eq $true); $__trValue)) { try { D-EmitFailure $null } catch {}; exit 22 }
    D-Start 'T007'
    Initialize-Native
    D-End 'T007' 1 $true
    D-End 'T023' 1 $true
} catch { try { D-EmitFailure $_ $true } catch {}; exit 22 }

try {
    try {
    if ($(D-Start 'T024.1'; $__trValue = $PSVersionTable.PSVersion.Major; D-End 'T024.1' $__trValue ($__trValue -eq 5); $__trValue) -ne 5 -or $(D-Start 'T024.2'; $__trValue = $PSVersionTable.PSVersion.Minor; D-End 'T024.2' $__trValue ($__trValue -eq 1); $__trValue) -ne 1 -or
        -not $(D-Start 'T024.3'; $__trValue = [Environment]::Is64BitProcess; D-End 'T024.3' $__trValue ($__trValue -eq $true); $__trValue)) { D-Failure $null; Reject-Protocol }
    D-Start 'T024.4'
    $header = [byte[]]::new(4)
    D-End 'T024.4' 1 $true
    D-Start 'T024.5'
    $used = 0
    D-End 'T024.5' 1 $true
    } catch { try { D-EmitFailure $_ } catch {}; throw }
    while ($used -lt 4) {
        if (-not $script:__trRead) { $script:__trRead=$true; D-End 'T024' }
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

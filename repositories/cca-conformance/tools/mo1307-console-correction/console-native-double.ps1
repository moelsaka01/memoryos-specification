param([Parameter(Mandatory=$true)][string] $ScenarioPath, [Parameter(Mandatory=$true)][string] $ExtractedPath, [Parameter(Mandatory=$true)][string] $ProofPath)
# Engineering-only deterministic native double. Never dot-source a product entry.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
class ConsoleNativeDouble {
    static [string] $Scenario
    static [int] $Self
    static [uint32] $Owner = 42420
    static [long] $Held = 424242
    static [int] $Lists = 0
    static [int] $Windows = 0
    static [int] $Owners = 0
    static [int] $Ids = 0
    static [int] $LiveWaits = 0
    static [bool] $Detached = $false
    static [Type] $LastErrorNative
    static [System.Collections.Generic.List[object]] $Events
    static [void] Log([string] $Name, [object[]] $Arguments) {
        [ConsoleNativeDouble]::Events.Add([ordered]@{name=$Name;arguments=$Arguments})
    }
    static [void] Error([uint32] $Code) {
        $type = [ConsoleNativeDouble]::LastErrorNative
        $type::SetLastError($Code)
    }
    static [void] HeldOnly([IntPtr] $Handle) {
        if ($Handle.ToInt64() -ne [ConsoleNativeDouble]::Held) { throw 'ENGINEERING_WRONG_HELD_HANDLE' }
    }
    static [uint32] GetConsoleProcessList([IntPtr] $Buffer, [uint32] $Capacity) {
        [ConsoleNativeDouble]::Lists++
        [ConsoleNativeDouble]::Log('GetConsoleProcessList', @($Capacity))
        if ($Capacity -ne 1) { throw 'ENGINEERING_UNEXPECTED_CAPACITY' }
        $selectedScenario=[ConsoleNativeDouble]::Scenario
        if ($selectedScenario -eq 'no-console') { [ConsoleNativeDouble]::Error(6); return 0 }
        if ($selectedScenario -eq 'initial-list-error') { [ConsoleNativeDouble]::Error(5); return 0 }
        if ([ConsoleNativeDouble]::Detached) {
            if ($selectedScenario -eq 'final-console-present') {
                [Runtime.InteropServices.Marshal]::WriteInt32($Buffer,[ConsoleNativeDouble]::Self)
                [ConsoleNativeDouble]::Error(0); return 1
            }
            if ($selectedScenario -eq 'final-absence-wrong-error') { [ConsoleNativeDouble]::Error(5); return 0 }
            [ConsoleNativeDouble]::Error(6); return 0
        }
        if ($selectedScenario -eq 'extra-client' -or ($selectedScenario -eq 'client-added-before-detach' -and [ConsoleNativeDouble]::Lists -gt 1)) {
            [ConsoleNativeDouble]::Error(0); return 2
        }
        $client=[ConsoleNativeDouble]::Self
        if ($selectedScenario -eq 'unrelated-sole-client' -or ($selectedScenario -eq 'sole-client-replaced' -and [ConsoleNativeDouble]::Lists -gt 1)) { $client++ }
        [Runtime.InteropServices.Marshal]::WriteInt32($Buffer,$client)
        [ConsoleNativeDouble]::Error(0); return 1
    }
    static [IntPtr] GetConsoleWindow() {
        [ConsoleNativeDouble]::Windows++
        [ConsoleNativeDouble]::Log('GetConsoleWindow',@())
        if ([ConsoleNativeDouble]::Scenario -eq 'missing-window') { return [IntPtr]::Zero }
        if ([ConsoleNativeDouble]::Scenario -eq 'window-replaced' -and [ConsoleNativeDouble]::Windows -gt 1) { return [IntPtr]::new(102) }
        return [IntPtr]::new(101)
    }
    static [uint32] GetWindowThreadProcessId([IntPtr] $Window, [ref] $OwnerPid) {
        [ConsoleNativeDouble]::Owners++
        [ConsoleNativeDouble]::Log('GetWindowThreadProcessId',@($Window.ToInt64()))
        if ([ConsoleNativeDouble]::Scenario -eq 'missing-owner') { $OwnerPid.Value=[uint32]0; return 0 }
        if ([ConsoleNativeDouble]::Scenario -eq 'owner-is-helper') { $OwnerPid.Value=[uint32][ConsoleNativeDouble]::Self; return 71 }
        if ([ConsoleNativeDouble]::Scenario -eq 'owner-replaced' -and [ConsoleNativeDouble]::Owners -gt 1) {
            $OwnerPid.Value=[uint32]([ConsoleNativeDouble]::Owner+1); return 71
        }
        $OwnerPid.Value=[ConsoleNativeDouble]::Owner
        return 71
    }
    static [IntPtr] OpenProcess([uint32] $Access, [bool] $Inherit, [uint32] $OwnerPid) {
        [ConsoleNativeDouble]::Log('OpenProcess',@($Access,$Inherit,$OwnerPid))
        if ($Access -ne 0x101000 -or $Inherit -or $OwnerPid -ne [ConsoleNativeDouble]::Owner) { throw 'ENGINEERING_UNEXPECTED_OPEN_AUTHORITY' }
        if ([ConsoleNativeDouble]::Scenario -eq 'access-denied') { return [IntPtr]::Zero }
        return [IntPtr]::new([ConsoleNativeDouble]::Held)
    }
    static [uint32] GetProcessId([IntPtr] $Handle) {
        [ConsoleNativeDouble]::HeldOnly($Handle)
        [ConsoleNativeDouble]::Ids++
        [ConsoleNativeDouble]::Log('GetProcessId',@($Handle.ToInt64()))
        if ([ConsoleNativeDouble]::Scenario -eq 'opened-pid-replaced' -or ([ConsoleNativeDouble]::Scenario -eq 'rechecked-pid-replaced' -and [ConsoleNativeDouble]::Ids -gt 1)) {
            return [ConsoleNativeDouble]::Owner+1
        }
        return [ConsoleNativeDouble]::Owner
    }
    static [bool] QueryFullProcessImageNameW([IntPtr] $Handle, [uint32] $Flags, [Text.StringBuilder] $Image, [ref] $Length) {
        [ConsoleNativeDouble]::HeldOnly($Handle)
        [ConsoleNativeDouble]::Log('QueryFullProcessImageNameW',@($Handle.ToInt64(),$Flags,$Length.Value))
        if ([ConsoleNativeDouble]::Scenario -eq 'image-query-denied') { return $false }
        $imagePath=[Environment]::GetFolderPath([Environment+SpecialFolder]::System)+'\conhost.exe'
        if ([ConsoleNativeDouble]::Scenario -eq 'wrong-image') { $imagePath=[Environment]::GetFolderPath([Environment+SpecialFolder]::System)+'\unrelated.exe' }
        if ([ConsoleNativeDouble]::Scenario -eq 'same-basename-wrong-directory') { $imagePath='C:\untrusted\conhost.exe' }
        [void]$Image.Append($imagePath); $Length.Value=[uint32]$imagePath.Length
        return $true
    }
    static [bool] FreeConsole() {
        [ConsoleNativeDouble]::Log('FreeConsole',@())
        if ([ConsoleNativeDouble]::Scenario -eq 'detach-failure') { return $false }
        [ConsoleNativeDouble]::Detached=$true
        return $true
    }
    static [uint32] WaitForSingleObject([IntPtr] $Handle, [uint32] $Milliseconds) {
        [ConsoleNativeDouble]::HeldOnly($Handle)
        [ConsoleNativeDouble]::Log('WaitForSingleObject',@($Handle.ToInt64(),$Milliseconds))
        if ($Milliseconds -eq 0) {
            [ConsoleNativeDouble]::LiveWaits++
            if ([ConsoleNativeDouble]::Scenario -eq 'held-object-already-exited') { return 0 }
            if ([ConsoleNativeDouble]::Scenario -eq 'held-object-exits-before-detach' -and [ConsoleNativeDouble]::LiveWaits -gt 1) { return 0 }
            if ([ConsoleNativeDouble]::Scenario -eq 'liveness-wait-failure') { return [uint32]::MaxValue }
            return 258
        }
        if ($Milliseconds -ne 1000 -or -not [ConsoleNativeDouble]::Detached) { throw 'ENGINEERING_UNEXPECTED_WAIT' }
        if ([ConsoleNativeDouble]::Scenario -eq 'natural-exit-timeout' -or [ConsoleNativeDouble]::Scenario -eq 'client-attaches-after-final-check') { return 258 }
        if ([ConsoleNativeDouble]::Scenario -eq 'natural-exit-wait-failure') { return [uint32]::MaxValue }
        return 0
    }
    static [bool] CloseHandle([IntPtr] $Handle) {
        [ConsoleNativeDouble]::HeldOnly($Handle)
        [ConsoleNativeDouble]::Log('CloseHandle',@($Handle.ToInt64()))
        return $true
    }
}
# Set only the current thread's Win32 last-error slot. No process, console,
# filesystem or termination native API is called by this deterministic double.
$name=[Reflection.AssemblyName]::new('MemoryOSEngineeringLastError')
$assembly=[AppDomain]::CurrentDomain.DefineDynamicAssembly($name,[Reflection.Emit.AssemblyBuilderAccess]::Run)
$module=$assembly.DefineDynamicModule('LastError')
$builder=$module.DefineType('MemoryOSEngineering.LastError',[Reflection.TypeAttributes]'Public, Sealed, Abstract')
$method=$builder.DefinePInvokeMethod('SetLastError','kernel32.dll','SetLastError',[Reflection.MethodAttributes]'Public, Static, PinvokeImpl',[Reflection.CallingConventions]::Standard,[void],[Type[]]@([uint32]),[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Unicode)
$method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
$ctor=[Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]]@([string]))
$fields=[Reflection.FieldInfo[]]@([Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),[Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'))
$attribute=[Reflection.Emit.CustomAttributeBuilder]::new($ctor,[object[]]@('kernel32.dll'),$fields,[object[]]@($true,$true))
$method.SetCustomAttribute($attribute)
[ConsoleNativeDouble]::LastErrorNative=$builder.CreateType()
$scenario=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($ScenarioPath))
[ConsoleNativeDouble]::Scenario=$scenario.name
[ConsoleNativeDouble]::Self=$PID
[ConsoleNativeDouble]::Events=[System.Collections.Generic.List[object]]::new()
$script:native=[ConsoleNativeDouble]
. $ExtractedPath
$accepted=$false; $failure=$null; $failureType=$null
try { Confirm-ConsoleQuiescence; $accepted=$true }
catch { $failure=$_.Exception.Message; $failureType=$_.Exception.GetType().FullName }
$proof=[ordered]@{kind='MO1307ExtractedConsoleFunctionSimulation';scenario=$scenario.name;accepted=$accepted;failure=$failure;failureType=$failureType;events=@([ConsoleNativeDouble]::Events.ToArray());detached=[ConsoleNativeDouble]::Detached;productionFunctionUnmodified=$true;nativeProcessOperationsPerformed=$false;realProcessIdentityProof=$false}
[IO.File]::WriteAllText($ProofPath,(ConvertTo-Json -InputObject $proof -Depth 10 -Compress)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
# Same silent startup disposition as production. This engineering process is
# separate from the unmodified native helper used for the first validation case.
if (-not $accepted) { exit 22 }
exit 0

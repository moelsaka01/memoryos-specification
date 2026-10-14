param([Parameter(Mandatory=$true)][string] $ScenarioPath, [Parameter(Mandatory=$true)][string] $ExtractedPath, [Parameter(Mandatory=$true)][string] $ProofPath)
# Engineering-only substituted native returns; never execute a production entry.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
class HeadlessNativeDouble {
    static [string] $Scenario
    static [int] $Self
    static [bool] $Detached = $false
    static [Type] $LastErrorNative
    static [System.Collections.Generic.List[object]] $Events
    static [void] Log([string] $Name, [object[]] $Arguments) {
        [HeadlessNativeDouble]::Events.Add([ordered]@{name=$Name;arguments=$Arguments})
    }
    static [void] Error([uint32] $Code) {
        $type=[HeadlessNativeDouble]::LastErrorNative
        $type::SetLastError($Code)
    }
    static [IntPtr] GetStdHandle([int] $Selector) {
        [HeadlessNativeDouble]::Log('GetStdHandle',@($Selector))
        if ($Selector -notin @(-10,-11,-12)) { throw 'ENGINEERING_UNEXPECTED_STANDARD_HANDLE' }
        $label=if($Selector -eq -10){'stdin'}elseif($Selector -eq -11){'stdout'}else{'stderr'}
        if ([HeadlessNativeDouble]::Scenario -eq ($label+'-invalid')) {
            if ($label -eq 'stdout') { return [IntPtr]::new(-1) }
            return [IntPtr]::Zero
        }
        return [IntPtr]::new(-$Selector)
    }
    static [uint32] GetFileType([IntPtr] $Handle) {
        [HeadlessNativeDouble]::Log('GetFileType',@($Handle.ToInt64()))
        $number=$Handle.ToInt64()
        if ($number -notin @(10,11,12)) { throw 'ENGINEERING_UNEXPECTED_PIPE_HANDLE' }
        $label=if($number -eq 10){'stdin'}elseif($number -eq 11){'stdout'}else{'stderr'}
        if ([HeadlessNativeDouble]::Scenario -eq ($label+'-not-pipe')) { return 1 }
        return 3
    }
    static [uint32] GetConsoleProcessList([IntPtr] $Buffer, [uint32] $Capacity) {
        [HeadlessNativeDouble]::Log('GetConsoleProcessList',@($Capacity))
        if ($Capacity -ne 1) { throw 'ENGINEERING_UNEXPECTED_CAPACITY' }
        $selected=[HeadlessNativeDouble]::Scenario
        if ([HeadlessNativeDouble]::Detached) {
            if ($selected -eq 'final-console-present') {
                [Runtime.InteropServices.Marshal]::WriteInt32($Buffer,[HeadlessNativeDouble]::Self)
                [HeadlessNativeDouble]::Error(0); return 1
            }
            if ($selected -eq 'final-absence-wrong-error') { [HeadlessNativeDouble]::Error(5); return 0 }
            [HeadlessNativeDouble]::Error(6); return 0
        }
        if ($selected -eq 'no-console') { [HeadlessNativeDouble]::Error(6); return 0 }
        if ($selected -eq 'initial-list-error') { [HeadlessNativeDouble]::Error(5); return 0 }
        if ($selected -eq 'extra-client') { [HeadlessNativeDouble]::Error(0); return 2 }
        if ($selected -eq 'overflow') { [HeadlessNativeDouble]::Error(0); return [uint32]::MaxValue }
        $client=[HeadlessNativeDouble]::Self
        if ($selected -eq 'unrelated-sole-client') { $client++ }
        [Runtime.InteropServices.Marshal]::WriteInt32($Buffer,$client)
        [HeadlessNativeDouble]::Error(0); return 1
    }
    static [bool] FreeConsole() {
        [HeadlessNativeDouble]::Log('FreeConsole',@())
        if ([HeadlessNativeDouble]::Scenario -eq 'detach-failure') { return $false }
        [HeadlessNativeDouble]::Detached=$true
        return $true
    }
}
# The only native engineering operation sets this thread's last-error slot.
# No console, process, termination, or filesystem native action is simulated live.
$name=[Reflection.AssemblyName]::new('MemoryOSHeadlessEngineeringLastError')
$assembly=[AppDomain]::CurrentDomain.DefineDynamicAssembly($name,[Reflection.Emit.AssemblyBuilderAccess]::Run)
$module=$assembly.DefineDynamicModule('LastError')
$builder=$module.DefineType('MemoryOSHeadlessEngineering.LastError',[Reflection.TypeAttributes]'Public, Sealed, Abstract')
$method=$builder.DefinePInvokeMethod('SetLastError','kernel32.dll','SetLastError',[Reflection.MethodAttributes]'Public, Static, PinvokeImpl',[Reflection.CallingConventions]::Standard,[void],[Type[]]@([uint32]),[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Unicode)
$method.SetImplementationFlags([Reflection.MethodImplAttributes]::PreserveSig)
$ctor=[Runtime.InteropServices.DllImportAttribute].GetConstructor([Type[]]@([string]))
$fields=[Reflection.FieldInfo[]]@([Runtime.InteropServices.DllImportAttribute].GetField('SetLastError'),[Runtime.InteropServices.DllImportAttribute].GetField('ExactSpelling'))
$attribute=[Reflection.Emit.CustomAttributeBuilder]::new($ctor,[object[]]@('kernel32.dll'),$fields,[object[]]@($true,$true))
$method.SetCustomAttribute($attribute)
[HeadlessNativeDouble]::LastErrorNative=$builder.CreateType()
$scenario=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($ScenarioPath))
[HeadlessNativeDouble]::Scenario=$scenario.name
[HeadlessNativeDouble]::Self=$PID
[HeadlessNativeDouble]::Events=[System.Collections.Generic.List[object]]::new()
$script:native=[HeadlessNativeDouble]
. $ExtractedPath
$accepted=$false; $failure=$null; $failureType=$null
try { Confirm-ConsoleQuiescence; $accepted=$true }
catch { $failure=$_.Exception.Message; $failureType=$_.Exception.GetType().FullName }
$proof=[ordered]@{kind='MO1307ExtractedHeadlessStartupSimulation';scenario=$scenario.name;accepted=$accepted;failure=$failure;failureType=$failureType;events=@([HeadlessNativeDouble]::Events.ToArray());detached=[HeadlessNativeDouble]::Detached;productionFunctionUnmodified=$true;nativeProcessOperationsPerformed=$false;realHostIdentityProof=$false}
[IO.File]::WriteAllText($ProofPath,(ConvertTo-Json -InputObject $proof -Depth 10 -Compress)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
# Match silent startup refusal disposition after retained private proof.
if (-not $accepted) { exit 22 }
exit 0

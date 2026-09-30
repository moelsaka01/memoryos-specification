param([Parameter(Mandatory=$true)][string] $ScenarioPath, [Parameter(Mandatory=$true)][string] $ExtractedPath, [Parameter(Mandatory=$true)][string] $ProofPath)
# Engineering-only substituted native returns; never execute a production entry.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
class HeadlessNativeDouble {
    static [string] $Scenario
    static [int] $Self
    static [bool] $Detached = $false
    static [int] $MembershipCalls = 0
    static [int] $FreeCalls = 0
    static [System.Collections.Generic.List[object]] $Events
    static [void] Log([string] $Name, [object[]] $Arguments) {
        [HeadlessNativeDouble]::Events.Add([ordered]@{name=$Name;arguments=$Arguments})
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
        [HeadlessNativeDouble]::MembershipCalls++
        [HeadlessNativeDouble]::Log('GetConsoleProcessList',@($Capacity))
        if ($Capacity -ne 1) { throw 'ENGINEERING_UNEXPECTED_CAPACITY' }
        if ([HeadlessNativeDouble]::MembershipCalls -ne 1 -or [HeadlessNativeDouble]::Detached) { throw 'ENGINEERING_FORBIDDEN_SECOND_MEMBERSHIP_QUERY' }
        $selected=[HeadlessNativeDouble]::Scenario
        if ($selected.StartsWith('initial-zero-error')) { return 0 }
        if ($selected -eq 'extra-client') { return 2 }
        if ($selected -eq 'overflow') { return [uint32]::MaxValue }
        $client=[HeadlessNativeDouble]::Self
        if ($selected -eq 'unrelated-sole-client') { $client++ }
        [Runtime.InteropServices.Marshal]::WriteInt32($Buffer,$client)
        return 1
    }
    static [bool] FreeConsole() {
        [HeadlessNativeDouble]::FreeCalls++
        [HeadlessNativeDouble]::Log('FreeConsole',@())
        if ([HeadlessNativeDouble]::Scenario -eq 'detach-throw') { throw [System.InvalidOperationException]::new('ENGINEERING_FREECONSOLE_THROW') }
        if ([HeadlessNativeDouble]::Scenario -eq 'detach-failure') { return $false }
        [HeadlessNativeDouble]::Detached=$true
        return $true
    }
}
# No LastError setter or native process/console call exists in this double.
# Error contexts label simulated zero results; production does not read LastError.
$scenario=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($ScenarioPath))
[HeadlessNativeDouble]::Scenario=$scenario.name
[HeadlessNativeDouble]::Self=$PID
[HeadlessNativeDouble]::Events=[System.Collections.Generic.List[object]]::new()
$script:native=[HeadlessNativeDouble]
. $ExtractedPath
$accepted=$false; $failure=$null; $failureType=$null
try { Confirm-ConsoleQuiescence; $accepted=$true }
catch { $failure=$_.Exception.Message; $failureType=$_.Exception.GetType().FullName }
$configuredErrorContext=$null
if($scenario.name.StartsWith('initial-zero-error')){$configuredErrorContext=[int]$scenario.name.Substring(18)}
$proof=[ordered]@{configuredErrorContext=$configuredErrorContext;nativeLastErrorSet=$false;membershipCalls=[HeadlessNativeDouble]::MembershipCalls;freeConsoleCalls=[HeadlessNativeDouble]::FreeCalls;kind='MO1307ExtractedHeadlessStartupSimulation';scenario=$scenario.name;accepted=$accepted;failure=$failure;failureType=$failureType;events=@([HeadlessNativeDouble]::Events.ToArray());detached=[HeadlessNativeDouble]::Detached;productionFunctionUnmodified=$true;nativeProcessOperationsPerformed=$false;realHostIdentityProof=$false}
[IO.File]::WriteAllText($ProofPath,(ConvertTo-Json -InputObject $proof -Depth 10 -Compress)+[Environment]::NewLine,[Text.UTF8Encoding]::new($false))
# Match silent startup refusal disposition after retained private proof.
if (-not $accepted) { exit 22 }
exit 0


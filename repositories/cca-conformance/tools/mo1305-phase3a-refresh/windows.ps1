param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$os = Get-CimInstance Win32_OperatingSystem
$cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$cpu = @(Get-CimInstance Win32_Processor)
$system = Get-CimInstance Win32_ComputerSystem
$value = [ordered]@{
  kind='MemoryOSRESTWindowsHostIdentity'; version='1.0.0'; detection='Win32_OperatingSystem + CurrentVersion registry + Win32_Processor + Win32_ComputerSystem'
  osName='Windows 11'; osEdition=$os.Caption; osRelease=$cv.DisplayVersion; osVersion=$os.Version
  osBuild=($cv.CurrentBuild + '.' + $cv.UBR); architecture='x64'; osArchitecture=$os.OSArchitecture
  processorArchitecture=@($cpu.Architecture); processorAddressWidth=@($cpu.AddressWidth)
  manufacturer=$system.Manufacturer; model=$system.Model; hypervisorPresent=$system.HypervisorPresent
  virtualizationInterpretation='HypervisorPresent is detected; this alone does not classify the OS as a virtual machine'
  hostname='OMITTED'; supportedFamily='windows-11-x64'; ubuntu='NOT_REQUIRED'; linux='NOT_REQUIRED'; vm='NOT_REQUIRED'; crossPlatformParity='NOT_REQUIRED'
}
if ($os.Caption -notmatch 'Windows 11' -or $os.OSArchitecture -ne '64-bit' -or @($cpu.Architecture | Where-Object { $_ -ne 9 }).Count) { throw 'UNSUPPORTED_HOST' }
[IO.File]::WriteAllText($OutputPath, ($value | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))

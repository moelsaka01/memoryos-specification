$ErrorActionPreference = 'Stop'
$os = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$runtimePath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot((Get-Location).Path))
$result = [ordered]@{
  kind = 'MO1307HelperDeadlineRuntimeEnvironment'
  version = '1.0.0'
  result = 'PASS'
  capturedAtUtc = [DateTime]::UtcNow.ToString('o')
  windows = [ordered]@{ productName=$os.ProductName; displayVersion=$os.DisplayVersion; currentBuild=$os.CurrentBuild; currentBuildNumber=$os.CurrentBuildNumber; updateBuildRevision=$os.UBR; buildLabEx=$os.BuildLabEx; environmentVersion=[Environment]::OSVersion.Version.ToString(); architecture=$env:PROCESSOR_ARCHITECTURE }
  powershell = [ordered]@{ version=$PSVersionTable.PSVersion.ToString(); edition=$PSVersionTable.PSEdition; clrVersion=$PSVersionTable.CLRVersion.ToString(); path=$runtimePath; executableByteLength=(Get-Item -LiteralPath $runtimePath).Length; processIs64Bit=[Environment]::Is64BitProcess }
  filesystem = [ordered]@{ root=$drive.Name; driveFormat=$drive.DriveFormat; driveType=$drive.DriveType.ToString(); volumeLabel=$drive.VolumeLabel; totalSize=$drive.TotalSize; availableFreeSpace=$drive.AvailableFreeSpace; nativeIdentity='Separate production response identities bind actual roots and volumes; this is managed DriveInfo context only.' }
  observation = 'Read-only engineering runtime probe; no production helper invocation, no machine changes, no cache control.'
}
$result | ConvertTo-Json -Depth 8 -Compress

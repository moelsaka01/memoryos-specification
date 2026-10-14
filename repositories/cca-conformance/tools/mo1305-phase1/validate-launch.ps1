param([Parameter(Mandatory=$true)][string]$NodePath,[Parameter(Mandatory=$true)][string]$ConfigPath,[switch]$RequestLoop)
$ErrorActionPreference='Stop'
function Invoke-Validation {
try {
  foreach ($entry in Get-ChildItem Env:) { if ($entry.Name -match '^(NODE_|OPENSSL_|SSL_CERT_|UV_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)') { throw 'ENVIRONMENT' } }
  if ((Get-FileHash -LiteralPath $NodePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32') { throw 'RUNTIME' }
  $serviceSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $allowed=@($serviceSid,'S-1-5-18','S-1-5-32-544')
  function Assert-PrivateFile([string]$FilePath) {
    if (-not [System.IO.Path]::IsPathRooted($FilePath) -or $FilePath.StartsWith('\\') -or $FilePath.Substring(2).Contains(':')) { throw 'PATH' }
    $item=Get-Item -LiteralPath $FilePath
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'FILE' }
    $acl=Get-Acl -LiteralPath $FilePath
    if ($allowed -notcontains $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value) { throw 'OWNER' }
    foreach ($rule in $acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])) {
      if ($rule.AccessControlType -eq 'Allow' -and $allowed -notcontains $rule.IdentityReference.Value) { throw 'ACL' }
    }
  }
  Assert-PrivateFile $ConfigPath
  if ((Get-Item -LiteralPath $ConfigPath).Length -gt 8192) { throw 'CONFIG_SIZE' }
  $configuration=Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  Assert-PrivateFile $configuration.tokenFile
  Assert-PrivateFile $configuration.privateKeyFile
  return @{Line='MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS';Code=0}
} catch { $reason=$_.Exception.Message; if ($reason -notin @('ENVIRONMENT','RUNTIME','PATH','FILE','OWNER','ACL','CONFIG_SIZE')) { $reason='PRECONDITION_CHECK_FAILED' }; return @{Line=('MO1305_TRUSTED_LAUNCH_REFUSED:'+ $reason);Code=2} }
}
if($RequestLoop){while([Console]::ReadLine() -eq 'CHECK'){$result=Invoke-Validation;[Console]::WriteLine($result.Line)}}else{$result=Invoke-Validation;Write-Output $result.Line;exit $result.Code}

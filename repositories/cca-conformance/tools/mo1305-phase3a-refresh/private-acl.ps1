param([string]$PrivateDirectory)
$ErrorActionPreference='Stop'
$serviceSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach($name in @('token','key.pem','config.json','remote.json')){
  $acl=[System.Security.AccessControl.FileSecurity]::new()
  $acl.SetOwner($serviceSid)
  $acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($serviceSid.Value,'S-1-5-18','S-1-5-32-544')){
    $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))
  }
  Set-Acl -LiteralPath (Join-Path $PrivateDirectory $name) -AclObject $acl
}

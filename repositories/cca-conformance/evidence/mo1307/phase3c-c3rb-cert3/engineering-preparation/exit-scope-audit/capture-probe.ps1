Set-StrictMode -Version 2.0
$ErrorActionPreference='Stop'
$Original='C:\m7c2\repositories\cca-conformance\tools\mo1307-phase3c-c3rb-cert2'
. (Join-Path $Original 'git-toolchain.ps1')
$script:EngineeringGit=[IO.File]::ReadAllText((Join-Path $Original 'engineering-toolchain.json')) | ConvertFrom-Json
Assert-EngineeringIdentity $script:EngineeringGit.git
Assert-EngineeringIdentity $script:EngineeringGit.core
$knownGit=$script:EngineeringGit.git.absolute
$rows=New-Object System.Collections.Generic.List[object]
function Capture([string] $label,$output,[bool] $success) {
    $vars=@()
    foreach($scope in @('Local','Script','Global','1','2','3')){try{$v=Get-Variable -Name LASTEXITCODE -Scope $scope -ErrorAction Stop;$vars+=@{scope=$scope;value=$v.Value}}catch{$vars+=@{scope=$scope;missing=$true}}}
    $rows.Add(@{label=$label;output=@($output|ForEach-Object{@{type=$_.GetType().FullName;text=$_.ToString()}});success=$success;variables=$vars})
}
$global:LASTEXITCODE=$null
$output=@(& $knownGit --version 2>&1);$success=$?
Capture 'script-local-executable' $output $success
$global:LASTEXITCODE=$null
$output=@(& $script:EngineeringGit.git.absolute --version 2>&1);$success=$?
Capture 'script-property-executable' $output $success
function FunctionProbe {
    $global:LASTEXITCODE=$null
    $Arguments=@('--version')
    $output=@(& $script:EngineeringGit.git.absolute @Arguments 2>&1);$success=$?
    Capture 'function-property-executable-array' $output $success
    $local:LASTEXITCODE=$null
    $output=@(& $script:EngineeringGit.git.absolute @Arguments 2>&1);$success=$?
    Capture 'function-local-exit-shadow' $output $success
}
FunctionProbe
$rows | ConvertTo-Json -Depth 6

param([string] $Mode)
Set-StrictMode -Version 2.0
$ErrorActionPreference='Stop'
$Original='C:\m7c2\repositories\cca-conformance\tools\mo1307-phase3c-c3rb-cert2'
. (Join-Path $Original 'git-toolchain.ps1')
function Snapshot([string] $Label) {
    $rows=@()
    foreach ($s in @('Local','Script','Global','1','2','3')) {
        try {$v=Get-Variable -Name LASTEXITCODE -Scope $s -ErrorAction Stop; $rows+=@{scope=$s;exists=$true;value=$v.Value;options=$v.Options.ToString()}} catch {$rows+=@{scope=$s;exists=$false}}
    }
    [Console]::Error.WriteLine((@{label=$Label;variables=$rows}|ConvertTo-Json -Depth 4 -Compress))
}
function Git-Text([string[]] $Arguments) {
    Snapshot 'Git-Text-before'
    $v = Invoke-EngineeringGit $Arguments
    Snapshot 'Git-Text-after'
    return ($v -join "`n").Trim()
}
function Assert-Review([bool] $Condition,[string] $Message) { if (-not $Condition) {throw $Message} }
try {
    Snapshot 'before-initialize'
    $init=Initialize-EngineeringGit 'C:/Program Files/Git/cmd/git.exe' (Join-Path $Original 'engineering-toolchain.json')
    Snapshot 'after-initialize'
    if($Mode -eq 'direct') { $a=Invoke-EngineeringGit @('--version'); $b=Invoke-EngineeringGit @('--version') }
    elseif($Mode -eq 'nested') {$a=Git-Text @('--version');$b=Git-Text @('--version')}
    elseif($Mode -eq 'expression') {Assert-Review ((Git-Text @('--version')) -ceq (Git-Text @('--version'))) 'same version'}
    elseif($Mode -eq 'array') {$a=@(Git-Text @('--version'));$b=@(Git-Text @('--version'))}
    elseif($Mode -eq 'pipeline') {$a=Git-Text @('--version') | ForEach-Object {$_};$b=Git-Text @('--version') | ForEach-Object {$_}}
    else {throw 'unknown mode'}
    Snapshot 'after-calls'
    [Console]::Out.WriteLine((@{result='PASS_ENGINEERING_REPRO';mode=$Mode;productSourceRead=$false}|ConvertTo-Json -Compress))
} catch {
    Snapshot 'caught'
    [Console]::Error.WriteLine((@{result='FAIL_ENGINEERING_REPRO';mode=$Mode;message=$_.Exception.Message;scriptStackTrace=$_.ScriptStackTrace;type=$_.Exception.GetType().FullName}|ConvertTo-Json -Compress))
    exit 1
}

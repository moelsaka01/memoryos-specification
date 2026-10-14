param([Parameter(Mandatory=$true)][string]$Path,[Parameter(Mandatory=$true)][string]$Provider)
$tokens=$null
$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
if ($errors.Count -ne 0) { throw 'PowerShell parse failed' }
$commands=@($ast.FindAll({param($a) $a -is [Management.Automation.Language.CommandAst]},$true))
if ($commands.Count -ne 2) { throw 'Unexpected command count' }
$call=$commands | Where-Object { $_.InvocationOperator -eq 'Ampersand' }
$join=$commands | Where-Object { $_.GetCommandName() -eq 'Join-Path' }
if ($call.Count -ne 1 -or $join.Count -ne 1 -or $call.CommandElements.Count -ne 9) { throw 'Unexpected call AST' }
if ($join.CommandElements.Count -ne 3 -or $join.CommandElements[1].VariablePath.UserPath -cne 'env:MEMORYOS_CI_HOME' -or $join.CommandElements[2].Value -cne 'scripts/Invoke-MemoryOSCI.ps1') { throw 'Unexpected launcher' }
$names=@($call.CommandElements | Where-Object {$_ -is [Management.Automation.Language.CommandParameterAst]} | ForEach-Object {$_.ParameterName})
if (($names -join ',') -cne 'Provider,Workspace,ConfigurationDigest,DistributionDigest') { throw 'Unexpected argv' }
if ($call.CommandElements[2].Value -cne $Provider) { throw 'Unexpected provider' }
$workspace=if ($Provider -eq 'gitlab') {'env:CI_PROJECT_DIR'} else {'env:WORKSPACE'}
if ($call.CommandElements[4].VariablePath.UserPath -cne $workspace) { throw 'Unexpected workspace' }
foreach ($index in @(6,8)) {
  if ($call.CommandElements[$index] -isnot [Management.Automation.Language.StringConstantExpressionAst] -or $call.CommandElements[$index].Value -cnotmatch '^sha256:[a-f0-9]{64}$') { throw 'Unexpected pin' }
}
$assignments=@($ast.FindAll({param($a) $a -is [Management.Automation.Language.AssignmentStatementAst]},$true))
$tries=@($ast.FindAll({param($a) $a -is [Management.Automation.Language.TryStatementAst]},$true))
$exits=@($ast.FindAll({param($a) $a -is [Management.Automation.Language.ExitStatementAst]},$true))
if ($assignments.Count -ne 2 -or $tries.Count -ne 1 -or $exits.Count -ne 1) { throw 'Unexpected control flow' }
if ($assignments[0].Extent.Text -cne '$status = 16' -or $assignments[1].Extent.Text -cne '$status = $LASTEXITCODE' -or $exits[0].Extent.Text -cne 'exit $status') { throw 'Unexpected propagation' }
if ($tries[0].CatchClauses.Count -ne 0 -or $null -eq $tries[0].Finally) { throw 'Unexpected try/finally' }
if (@($ast.FindAll({param($a) $a -is [Management.Automation.Language.ExpandableStringExpressionAst] -or $a -is [Management.Automation.Language.InvokeMemberExpressionAst] -or $a -is [Management.Automation.Language.SubExpressionAst]},$true)).Count -ne 0) { throw 'Unexpected expression' }
[Console]::Out.WriteLine('{"status":"PASS","commands":2,"assignments":2,"tryFinally":1,"exit":1}')

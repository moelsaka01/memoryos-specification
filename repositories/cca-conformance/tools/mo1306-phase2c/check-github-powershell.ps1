param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = 'Stop'
$request = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$results = @()
foreach ($pair in $request.scripts) {
    $tokens = $null; $errors = $null
    $actual = [System.Management.Automation.Language.Parser]::ParseInput([string]$pair.actual, [ref]$tokens, [ref]$errors)
    if ($errors.Count -ne 0) { throw "PowerShell parse failed: $($pair.id)" }
    $expectedTokens = $null; $expectedErrors = $null
    $expected = [System.Management.Automation.Language.Parser]::ParseInput([string]$pair.expected, [ref]$expectedTokens, [ref]$expectedErrors)
    if ($expectedErrors.Count -ne 0) { throw 'Independent expected skeleton is invalid' }
    # Compare parsed node kinds and token kinds/values, not generator substrings.
    # The fixed skeleton is independently authored in github_validator.py.
    $actualKinds = @($actual.FindAll({ param($node) $true }, $true) | ForEach-Object { $_.GetType().Name })
    $expectedKinds = @($expected.FindAll({ param($node) $true }, $true) | ForEach-Object { $_.GetType().Name })
    if (($actualKinds -join "`n") -cne ($expectedKinds -join "`n")) { throw "Forbidden PowerShell AST: $($pair.id)" }
    $actualTokens = @($tokens | Where-Object { $_.Kind -notin @('NewLine','EndOfInput') } | ForEach-Object { $_.Kind.ToString() + ':' + $_.Text })
    $expectedValues = @($expectedTokens | Where-Object { $_.Kind -notin @('NewLine','EndOfInput') } | ForEach-Object { $_.Kind.ToString() + ':' + $_.Text })
    if (($actualTokens -join "`n") -cne ($expectedValues -join "`n")) { throw "Forbidden PowerShell token/argument: $($pair.id)" }
    $commands = @($actual.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object { [ordered]@{name=$_.GetCommandName();operator=$_.InvocationOperator.ToString();elements=@($_.CommandElements | ForEach-Object { [ordered]@{kind=$_.GetType().Name;text=$_.Extent.Text} })} })
    $results += [ordered]@{id=$pair.id;nodes=$actualKinds.Count;statements=$actual.EndBlock.Statements.Count;commands=$commands;status='PASS'}
}
[ordered]@{kind='MemoryOSPhase2CGitHubPowerShellAST';version='1.0.0';parser=$PSVersionTable.PSVersion.ToString();scripts=$results;status='PASS'} | ConvertTo-Json -Depth 30 -Compress

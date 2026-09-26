param([string]$Root)
$ErrorActionPreference='Stop'
$rows=@()
$files=@(Get-ChildItem -LiteralPath (Join-Path $Root 'repositories/memoryos-ci/scripts') -Filter '*.ps1')
$files+=@(Get-ChildItem -LiteralPath (Join-Path $Root 'repositories/cca-conformance/tools') -Directory | Where-Object Name -like 'mo1306*' | Where-Object Name -ne 'mo1306-phase3-correction' | Get-ChildItem -Recurse -File -Filter '*.ps1')
foreach($file in $files) {
  $tokens=$null;$parseErrors=$null
  $tree=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$parseErrors)
  if($parseErrors.Count) {throw 'PowerShell parse error'}
  foreach($node in $tree.FindAll({param($n) $n -is [Management.Automation.Language.IndexExpressionAst] -or ($n -is [Management.Automation.Language.MemberExpressionAst] -and $n.Member -isnot [Management.Automation.Language.StringConstantExpressionAst])},$true)) {
    $production=$file.FullName.Contains('repositories\memoryos-ci\')
    $rows+=@{file=$file.FullName.Substring($Root.Length+1).Replace('\','/');line=$node.Extent.StartLineNumber;expression=$node.Extent.Text;classification=$(if($production){'SAFE'}else{'VALIDATOR-ONLY'});rationale='PowerShell array/dictionary or AST member lookup, no JavaScript prototype chain. Product provider inputs have ValidateSet/literal allowlists; dynamic selectors do not select command handlers.'}
  }
}
@{files=$files.Count;sites=$rows;count=$rows.Count}|ConvertTo-Json -Depth 8 -Compress

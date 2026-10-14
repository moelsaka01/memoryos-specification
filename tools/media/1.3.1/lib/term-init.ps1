# Terminal profile for the MemoryOS 1.3.1 release media. Dot-sourced by the recording terminal only: it sets PATH so that `memoryos` resolves to
# the CLI shim (which runs the PINNED Node), and a prompt that also writes a counter to a sync file so the recorder knows when a command finished.
# With -Demo it also defines four short functions used by the ad takes (they wrap the SAME commands that the demo video types in full).
param([string]$SyncFile = 'C:\mos-media\work131\sync\prompt.txt', [string]$StartDirectory = 'C:\mos-demo', [switch]$Demo)
$env:PATH = 'C:\mos-media\work131\bin;' + $env:PATH
$global:MosCount = 0
$global:MosSync = $SyncFile
function global:prompt {
  $global:MosCount++
  [IO.File]::WriteAllText($global:MosSync, [string]$global:MosCount)
  Write-Host -NoNewline 'PS ' -ForegroundColor DarkGray
  Write-Host -NoNewline (Get-Location).Path -ForegroundColor Cyan
  Write-Host -NoNewline '>' -ForegroundColor DarkGray
  return ' '
}
try { Set-PSReadLineOption -PredictionSource None } catch { }
if ($Demo) {
  $global:node = 'C:\mos-node\node.exe'
  $global:repo = 'C:\mos-media\repo131'
  # MO-1304: starts the released MCP server and sends it a real tools/list and tools/call
  function global:demo-mcp { & $node "$repo\tools\media\mcp-call.mjs" 'C:\mos-media\live\memoryos-mcp\bin\memoryos-mcp.mjs' }
  # MO-1302 / MO-1306: a real CI/CD run (pinned Node, 128 MB heap) over the released policy-pass fixture
  function global:demo-ci {
    $w = 'C:\mos-media\live\ci\work'
    $r = & $node --max-old-space-size=128 "$repo\repositories\memoryos-ci\bin\memoryos-ci.mjs" run --workspace $w --config "$w\memoryos-ci.json" | ConvertFrom-Json
    $r | Format-List classification, exitCode, publication
  }
  # MO-1307: a real readiness evaluation over the released READY fixture inputs
  function global:demo-readiness {
    $in = 'C:\mos-media\live\readiness\input'
    $pins = Get-Content "$in\pins.json" | ConvertFrom-Json
    & $node "$repo\repositories\memoryos-readiness\bin\memoryos-readiness.mjs" evaluate --input-root $in --config configuration.json --authority authority.json --authority-sha256 $pins.trustedAuthorityDigest --candidate-sha256 $pins.expectedCandidateDigest --output-root 'C:\mos-media\live\readiness\out' | ConvertFrom-Json | Format-List kind, operation, readiness, blockerCount, qualificationCount
  }
}
Set-Location -LiteralPath $StartDirectory
Clear-Host

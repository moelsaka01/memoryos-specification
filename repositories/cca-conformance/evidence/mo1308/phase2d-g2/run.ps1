$ErrorActionPreference='Continue'
$N='C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1305-phase3br\toolchain\node-v24.21.0-win-x64\node.exe'
$B='C:\Users\melsa\Documents\Codex\b2g2'
$L='C:\Users\melsa\Documents\Codex\b2g2-logs'
$env:PATH='C:\Python314;C:\Python314\Scripts;'+$env:PATH
$studio='tests/memory_studio_web_test.mjs tests/memory_studio_integration_test.mjs tests/mip_canonical_test.mjs tests/memory_investigation_package_test.mjs tests/mip_schema_conformance_test.mjs tests/mip_adversarial_conformance_test.mjs tests/mip_ordering_conformance_test.mjs tests/mip_derived_edge_conformance_test.mjs tests/mip_pipeline_conformance_test.mjs tests/ai_runtime_adapter_test.mjs tests/investigation_core_test.mjs tests/memoryos_sdk_test.mjs tests/cognitive_regression_test.mjs tests/cognitive_investigation_explorer_test.mjs tests/policy_canonical_test.mjs tests/investigation_policy_contracts_test.mjs tests/investigation_policy_test.mjs tests/policy_fact_context_test.mjs tests/regression_policy_fact_source_test.mjs tests/investigation_policy_engine_test.mjs tests/memoryos_policy_sdk_test.mjs tests/memoryos_history_contract_test.mjs tests/memoryos_history_sdk_guard_test.mjs'
$items=@(
 @('MO1308_SUITES','repositories\cca-conformance',"`"$N`" --test --test-concurrency=1 tests/mo1308_*_test.mjs",'mo1308.log',$null),
 @('HISTORY_STORE','repositories\memoryos-cli',"`"$N`" --test --test-concurrency=1 tests/history-store.test.mjs",'history-store.log',$null),
 @('HISTORY_STORE_WINDOWS','repositories\memoryos-cli',"`"$N`" --test --test-concurrency=1 tests/history-store-windows.test.mjs",'history-store-windows.log',$null),
 @('MEMORYOS_CLI','repositories\memoryos-cli',"`"$N`" --test --test-concurrency=1 tests/*.test.mjs",'cli.log',$null),
 @('CCA_STUDIO','repositories\cca-studio',"`"$N`" --test $studio",'studio.log',$null),
 @('MO1307_REGRESSION','repositories\cca-conformance',"`"$N`" --test --test-concurrency=1 tests/mo1307_*_test.mjs",'mo1307.log',$null),
 @('CLI_EXAMPLES','repositories\memoryos-cli',"`"$N`" examples\run-cli-examples.mjs",'cli-examples.log',$null)
)
foreach($e in 'ai_runtime_adapter_usage','cognitive_investigation_explorer_usage','investigation_core_usage','investigation_policy_usage'){ $items+=,@("STUDIO_EXAMPLE_$e",'repositories\cca-studio',"`"$N`" examples\$e.mjs","studio-example-$e.log",$null) }
$items+=,@('WORKSPACE_VERIFIER','.',"python tools\verify_workspace.py --root .",'verify.log',$null)
foreach($c in '2a','2b','2c','2d'){ $items+=,@("CHARACTERIZATION_$c",'.',"`"$N`" --expose-gc repositories\cca-conformance\tools\mo1308-phase$c\characterize.mjs","characterization-$c.json","characterization-$c.stderr.log") }
$times=@()
foreach($i in $items){
  Set-Location (Join-Path $B $i[1])
  $out=Join-Path $L $i[3]
  $cmd=$i[2]+" > `"$out`""
  if($i[4]){ $cmd+=" 2> `"$(Join-Path $L $i[4])`"" } else { $cmd+=" 2>&1" }
  $sw=[Diagnostics.Stopwatch]::StartNew()
  cmd /c $cmd
  $code=$LASTEXITCODE
  $sw.Stop()
  $times+=[pscustomobject]@{name=$i[0];command=$i[2];cwd=($i[1] -replace '\\','/');exitCode=$code;seconds=[math]::Round($sw.Elapsed.TotalSeconds,1);log=$i[3];stderr=$i[4]}
  Write-Host ("{0} exit={1} {2}s" -f $i[0],$code,[math]::Round($sw.Elapsed.TotalSeconds,1))
}
Set-Location $B
cmd /c "git status --porcelain > `"$L\porcelain.txt`""
$times | ConvertTo-Json -Depth 4 | Set-Content "$L\runs.json" -Encoding utf8
Write-Host DONE



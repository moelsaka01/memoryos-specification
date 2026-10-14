stages:
  - 'test'
memoryos_policy:
  stage: 'test'
  tags:
    - '{{LABEL}}'
  when: 'manual'
  allow_failure: false
  timeout: '5m'
  retry: 0
  script:
    - |
      $status = 16
      try {
        & (Join-Path $env:MEMORYOS_CI_HOME 'scripts/Invoke-MemoryOSCI.ps1') -Provider 'gitlab' -Workspace $env:CI_PROJECT_DIR -ConfigurationDigest '{{CONFIGURATION_DIGEST}}' -DistributionDigest '{{DISTRIBUTION_DIGEST}}'
        $status = $LASTEXITCODE
      } finally {
        exit $status
      }

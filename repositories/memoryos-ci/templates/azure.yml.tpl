trigger: 'none'
pr: 'none'
pool:
  name: '{{pool}}'
  demands:
    - 'Agent.OS -equals Windows_NT'
jobs:
  - job: 'memoryos_policy'
    timeoutInMinutes: 5
    cancelTimeoutInMinutes: 1
    steps:
      - checkout: 'self'
        persistCredentials: false
        submodules: false
        lfs: false
      - powershell: |
          $ErrorActionPreference = 'Stop'
          & (Join-Path $env:MEMORYOS_CI_HOME 'scripts\Invoke-MemoryOSCI.ps1') -Provider 'azure' -Workspace $env:BUILD_SOURCESDIRECTORY -ConfigurationDigest '{{configurationDigest}}' -DistributionDigest '{{distributionDigest}}'
          $gateExit = $LASTEXITCODE
          exit $gateExit
        displayName: 'MemoryOS Policy'
        failOnStderr: false
        ignoreLASTEXITCODE: false

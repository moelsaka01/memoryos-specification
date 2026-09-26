pipeline {
  agent {
    label '{{LABEL}}'
  }
  options {
    skipDefaultCheckout()
    timeout(time: 5, unit: 'MINUTES')
  }
  stages {
    stage('MemoryOS Policy') {
      steps {
        checkout scm
        powershell(encoding: 'UTF-8', script: '''
$status = 16
try {
  & (Join-Path $env:MEMORYOS_CI_HOME 'scripts/Invoke-MemoryOSCI.ps1') -Provider 'jenkins' -Workspace $env:WORKSPACE -ConfigurationDigest '{{CONFIGURATION_DIGEST}}' -DistributionDigest '{{DISTRIBUTION_DIGEST}}'
  $status = $LASTEXITCODE
} finally {
  exit $status
}
''')
      }
    }
  }
}

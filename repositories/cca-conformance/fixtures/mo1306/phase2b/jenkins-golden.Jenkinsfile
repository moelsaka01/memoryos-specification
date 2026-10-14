pipeline {
  agent {
    label 'windows-agent'
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
  & (Join-Path $env:MEMORYOS_CI_HOME 'scripts/Invoke-MemoryOSCI.ps1') -Provider 'jenkins' -Workspace $env:WORKSPACE -ConfigurationDigest 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' -DistributionDigest 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  $status = $LASTEXITCODE
} finally {
  exit $status
}
''')
      }
    }
  }
}

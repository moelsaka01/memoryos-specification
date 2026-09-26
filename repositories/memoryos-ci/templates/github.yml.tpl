name: 'MemoryOS Provider-Neutral CI'
'on':
  workflow_dispatch: {}
permissions:
  contents: 'read'
jobs:
  memoryos_ci:
    name: 'MemoryOS CI'
    runs-on: 'windows-2022'
    timeout-minutes: 10
    steps:
      - id: 'tools'
        uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
        with:
          repository: '@@REPOSITORY@@'
          ref: '@@TOOL_REVISION@@'
          path: '_memoryos/tool'
          persist-credentials: false
          submodules: false
          lfs: false
      - id: 'data'
        uses: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
        with:
          ref: ${{ github.sha }}
          path: '_memoryos/data'
          persist-credentials: false
          submodules: false
          lfs: false
      - id: 'bootstrap'
        shell: 'powershell'
        run: |
          $ErrorActionPreference = 'Stop'
          $env:MEMORYOS_CI_HOME = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\tool\repositories\memoryos-ci')
          $env:MEMORYOS_CI_CONFIG = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\tool\@@CONFIG_PATH@@')
          & ([IO.Path]::Combine($env:MEMORYOS_CI_HOME, 'scripts\Initialize-GitHubCI.ps1')) -WorkspaceRoot $env:GITHUB_WORKSPACE -ConfigurationDigest '@@CONFIGURATION_DIGEST@@' -DistributionDigest '@@DISTRIBUTION_DIGEST@@'
          exit $LASTEXITCODE
      - id: 'evaluate'
        shell: 'powershell'
        run: |
          $ErrorActionPreference = 'Stop'
          $env:MEMORYOS_CI_HOME = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\tool\repositories\memoryos-ci')
          $env:MEMORYOS_CI_CONFIG = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\tool\@@CONFIG_PATH@@')
          & ([IO.Path]::Combine($env:MEMORYOS_CI_HOME, 'scripts\Invoke-GitHubCI.ps1')) -Mode 'Evaluate' -WorkspaceRoot $env:GITHUB_WORKSPACE -ConfigurationDigest '@@CONFIGURATION_DIGEST@@' -DistributionDigest '@@DISTRIBUTION_DIGEST@@'
          exit $LASTEXITCODE
      - id: 'upload'
        if: always() && steps.evaluate.outputs.complete == 'true'
        uses: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'
        with:
          name: 'memoryos-ci-${{ github.run_id }}-${{ github.run_attempt }}'
          path: |
            _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/evaluation-identity.json
            _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/memoryos-ci-artifacts.json
            _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/memoryos-ci-complete.json
            _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/memoryos-ci-evidence.json
            _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/memoryos-ci-result.json
            _memoryos/data/.memoryos-ci/out/${{ steps.evaluate.outputs.run-id }}/policy-outcome.json
          if-no-files-found: 'error'
          include-hidden-files: true
          retention-days: 7
      - id: 'gate'
        if: always()
        shell: 'powershell'
        env:
          COMPLETE: ${{ steps.evaluate.outputs.complete }}
          EXIT_CODE: ${{ steps.evaluate.outputs.exit-code }}
          RUN_ID: ${{ steps.evaluate.outputs.run-id }}
          EVALUATE_OUTCOME: ${{ steps.evaluate.outcome }}
          UPLOAD_OUTCOME: ${{ steps.upload.outcome }}
        run: |
          $ErrorActionPreference = 'Stop'
          $env:MEMORYOS_CI_HOME = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\tool\repositories\memoryos-ci')
          $env:MEMORYOS_CI_CONFIG = [IO.Path]::Combine($env:GITHUB_WORKSPACE, '_memoryos\tool\@@CONFIG_PATH@@')
          & ([IO.Path]::Combine($env:MEMORYOS_CI_HOME, 'scripts\Invoke-GitHubCI.ps1')) -Mode 'Gate' -WorkspaceRoot $env:GITHUB_WORKSPACE -ConfigurationDigest '@@CONFIGURATION_DIGEST@@' -DistributionDigest '@@DISTRIBUTION_DIGEST@@'
          exit $LASTEXITCODE

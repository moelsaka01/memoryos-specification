# CCA-PROC-1.0 conformance evidence

This file maps every mandatory CCA-PROC-1.0 requirement to automated evidence
in the IM-005 implementation. Test discovery exposes each GoogleTest case as a
separate CTest test. `cca.process.architecture` is an automated source and
dependency-boundary audit.

| Requirement | Automated evidence |
|---|---|
| CCA-PROC-001 | `cca.process.architecture`; `RuntimeIntegrationTest.ExposesTheProcessDomainServiceThroughRuntime` |
| CCA-PROC-002 | `cca.process.architecture`; `ProcessApiTest.PublicSurfacePreservesLayerBoundaries` |
| CCA-PROC-003 | `cca.process.architecture`; `RuntimeIntegrationTest.ExposesTheProcessDomainServiceThroughRuntime` |
| CCA-PROC-004 | `ProcessInputTest.PreservesCompleteMutableValidatedAndFrozenState` |
| CCA-PROC-005 | `ProcessDeterminismTest.EquivalentSemanticVariantsProduceEqualOutcomes` |
| CCA-PROC-006 | `cca.process.architecture`; `RuntimeIntegrationTest.KeepsRuntimeInstancesAndEnginesIsolated` |
| CCA-PROC-007 | `cca.process.architecture`; `ProcessDeterminismTest.GraphShapesRemainStructuralAndSideEffectFree` |
| CCA-PROC-008 | `ProcessDeterminismTest.EquivalentSemanticVariantsProduceEqualOutcomes` |
| CCA-PROC-009 | `ProcessApiTest.RequiredEmptyDocumentExampleSucceeds` |
| CCA-PROC-010 | `ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution` |
| CCA-PROC-011 | `ProcessInputTest.PreservesCompleteMutableValidatedAndFrozenState` |
| CCA-PROC-012 | `ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution` |
| CCA-PROC-013 | `ProcessDefinitionTest.InvalidConstructionIsDeterministicAndStrong`; `ProcessAllocationFailureTest.DefinitionConstructionPreservesTheSourceAtEveryAllocationFailure` |
| CCA-PROC-014 | `ProcessDefinitionTest.MaterializesCanonicalOwnedOrderAndCounts` |
| CCA-PROC-015 | `ProcessDefinitionTest.PlanSurvivesMutationRemovalRollbackAndDestruction` |
| CCA-PROC-016 | `ProcessDefinitionTest.MaterializesCanonicalOwnedOrderAndCounts` |
| CCA-PROC-017 | `ProcessDeterminismTest.GraphShapesRemainStructuralAndSideEffectFree` |
| CCA-PROC-018 | `ProcessDeterminismTest.EquivalentSemanticVariantsProduceEqualOutcomes` |
| CCA-PROC-019 | `ProcessApiTest.PublicDeclarationsMatchTheFrozenContract` |
| CCA-PROC-020 | `ExecutionContextTest.ReadyExecutionCompletesWithTheCanonicalTrace` |
| CCA-PROC-021 | `ExecutionContextTest.CompletedContextIsOneShotAndRejectedStrongly`; `ExecutionContextTest.EveryNonReadyStateIsRejectedWithoutMutation` |
| CCA-PROC-022 | `ExecutionContextTest.ContextsOwnIsolatedDefinitionStateAndTraces` |
| CCA-PROC-023 | `ProcessResultTest.SuccessValuesOwnEveryRequiredInvariant` |
| CCA-PROC-024 | `ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution` |
| CCA-PROC-025 | `ProcessInputTest.InvalidDirectInputIsValidatedBeforeExecution` |
| CCA-PROC-026 | `ProcessApiTest.RequiredEmptyDocumentExampleSucceeds`; `ProcessEngineTest.AllValidEntrySurfacesAreEquivalent` |
| CCA-PROC-027 | `ExecutionContextTest.ReadyExecutionCompletesWithTheCanonicalTrace` |
| CCA-PROC-028 | `ProcessApiTest.PublicDeclarationsMatchTheFrozenContract` |
| CCA-PROC-029 | `ProcessEngineTest.AllValidEntrySurfacesAreEquivalent` |
| CCA-PROC-030 | All four `ProcessAllocationFailureTest.*` campaigns; `ExecutionContextTest.CompletedContextIsOneShotAndRejectedStrongly` |
| CCA-PROC-031 | `RuntimeIntegrationTest.ExposesTheProcessDomainServiceThroughRuntime` |
| CCA-PROC-032 | `cca.process.architecture`; `ProcessApiTest.PublicSurfacePreservesLayerBoundaries` |
| CCA-PROC-033 | `RuntimeIntegrationTest.ProviderLifecycleSurroundsHostedExecution` |
| CCA-PROC-034 | `RuntimeIntegrationTest.KeepsRuntimeInstancesAndEnginesIsolated` |
| CCA-PROC-035 | `RuntimeIntegrationTest.InvalidInputDoesNotFailTheRunningRuntime`; `RuntimeIntegrationTest.ProcessProviderLifecycleFailuresRemainRuntimeFailures` |
| CCA-PROC-036 | `ProcessThreadSafetyTest.SupportsTheDocumentedConcurrentOperations` |
| CCA-PROC-037 | `ProcessApiTest.PublicDeclarationsMatchTheFrozenContract`; public-header self-containment compilation |
| CCA-PROC-038 | This matrix, all Process-labeled CTest tests, and the warnings-as-errors build |

Run Process evidence from a configured build directory with:

```console
ctest --output-on-failure -L process
```

The allocation campaigns reside in an isolated executable because they replace
the test executable's global allocation functions. No failure hook or mutable
global allocation state is present in the Process implementation.

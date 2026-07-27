# CCA-RF-1.0 Runtime Foundation conformance evidence

## Evidence status

This record maps every approved CCA-RF-1.0 requirement and architecture
decision to concrete implementation, test-source, or documentation evidence in
this workspace. It is an implementation trace, not an independent
certification.

The presence of a test source is not a claim that the test was configured,
built, or executed. This document intentionally records no test result.
Configure, build, test count, platform, compiler, generator, and pass/fail
evidence must be reported separately by the workspace verification workflow.

The [Runtime programming model](runtime-programming-model.md) explains the
concrete API without redefining CCA-RF-1.0.

## Requirement evidence

| Requirement | Concrete evidence | Evidence available |
|---|---|---|
| CCA-RF-001 | [Architecture §4](../../../ARCHITECTURE.md) defines one Layer 3 boundary; [`Runtime`](../include/cca/runtime/runtime.hpp) owns the single six-component aggregate. | Architecture and implementation source |
| CCA-RF-002 | [Architecture §4](../../../ARCHITECTURE.md) states the standard responsibilities independently; the [programming model](runtime-programming-model.md) labels C++ mechanisms as implementation surfaces. | Documentation |
| CCA-RF-003 | [`DependencyInjector`](../src/runtime/dependency_injector.cpp) sorts edges and levels by registration identity; [`Runtime`](../src/runtime/runtime.cpp) applies fixed lifecycle, startup, shutdown, and cleanup ordering; `EquivalentDiamondCompositionsProduceEquivalentDependencyOrder` in [`dependency_injector_test.cpp`](../tests/dependency_injector_test.cpp) and `EquivalentStartFailuresProduceEquivalentRollbackCleanup` in [`runtime_test.cpp`](../tests/runtime_test.cpp) repeat equivalent inputs and compare documented outcomes. | Implementation and test source |
| CCA-RF-004 | [`RuntimeBuilder::add_provider`](../include/cca/runtime/runtime_builder.hpp) accepts typed dependency contracts and a constructor factory; `InjectsTypedDependenciesInLevelOrder` in [`dependency_injector_test.cpp`](../tests/dependency_injector_test.cpp) defines injection evidence. | Implementation and test source |
| CCA-RF-005 | [`Runtime`](../include/cca/runtime/runtime.hpp) owns instance members and [`RuntimeHost`](../src/runtime/runtime_host.cpp) owns a host-local map; no Runtime singleton or mutable global registry is exposed. | Implementation source and interface review |
| CCA-RF-006 | [`RuntimeState`](../include/cca/runtime/runtime_state.hpp), [`LifecycleManager`](../src/runtime/lifecycle_manager.cpp), and [`Runtime`](../src/runtime/runtime.cpp) publish and enforce the approved state machine. | Implementation source |
| CCA-RF-007 | [`ServiceRegistry::resolve<Contract>`](../include/cca/runtime/service_registry.hpp) resolves only the consumer-visible typed interface; Runtime records failed wired resolutions as Service Registry diagnostics; `ResolvesOnlyAfterFreezeWithCardinalityDependentTypes` in [`service_registry_test.cpp`](../tests/service_registry_test.cpp) defines resolution evidence. | Implementation and test source |
| CCA-RF-008 | [`EventBus`](../include/cca/runtime/event_bus.hpp) is the typed instance event boundary; Runtime-only close rejects publication before destruction and drain completes accepted work; [`event_bus_test.cpp`](../tests/event_bus_test.cpp) defines typed separation, asynchronous delivery, ordering, failure, drain, concurrency, and isolation evidence. | Implementation and test source |
| CCA-RF-009 | [Programming model §3](runtime-programming-model.md) documents builder configuration, Configuration Manager validation, snapshot ownership, and Runtime Freeze interaction. | Documentation |
| CCA-RF-010 | [Programming model §7](runtime-programming-model.md) documents the logging, diagnostics, metrics, and health facets of Observability. | Documentation |
| CCA-RF-011 | [Runtime API philosophy](runtime-programming-model.md#runtime-api-philosophy) publishes the instance-oriented, typed, explicit, immutable-after-freeze API approach. | Documentation |
| CCA-RF-012 | This requirement table covers CCA-RF-001 through CCA-RF-040, and the ADR table below covers ADR-003-001 through ADR-003-008. | Conformance trace |
| CCA-RF-013 | [`main.cpp`](../src/runtime/main.cpp) composes and operates a Runtime without a GUI; the [minimal example](../../../examples/runtime_foundation.cpp) uses the same headless lifecycle. | Artifact and example source |
| CCA-RF-014 | [`cca-core/CMakeLists.txt`](../CMakeLists.txt) sets the official host target's output name to `cca-runtime`; [`main.cpp`](../src/runtime/main.cpp) is its composition root. | Build and executable source |
| CCA-RF-015 | [`RuntimeHost`](../include/cca/runtime/runtime_host.hpp) owns a map of `RuntimeId` to Runtime and exposes identity enumeration and per-instance lifecycle operations. | Implementation source |
| CCA-RF-016 | The [`Runtime` constructor](../src/runtime/runtime.cpp) constructs a distinct Configuration Manager, registry, injector, Event Bus, Observability, Lifecycle Manager, and [`RuntimeContext`](../include/cca/runtime/runtime_context.hpp) for each instance; registry, Event Bus, and Observability isolation tests are defined in their respective test sources. | Implementation and test source |
| CCA-RF-017 | [`RuntimeBuilder`](../include/cca/runtime/runtime_builder.hpp) and [`RuntimeHost`](../include/cca/runtime/runtime_host.hpp) require explicit object ownership and identity; the public interface has no global Runtime accessor. | Interface review |
| CCA-RF-018 | [`Runtime`](../include/cca/runtime/runtime.hpp) explicitly owns exactly Lifecycle Manager, Service Registry, Dependency Injector, Event Bus, Configuration Manager, and Observability; [Architecture §4](../../../ARCHITECTURE.md) distinguishes the API surfaces and Observability facets. | Architecture and implementation source |
| CCA-RF-019 | [Architecture §4](../../../ARCHITECTURE.md) records Layers 1–5 and the Representation, Process, and Persistence Domain Engines. | Architecture |
| CCA-RF-020 | [Architecture §4](../../../ARCHITECTURE.md) records the higher-numbered-to-lower-numbered rule; [`cca_runtime`](../CMakeLists.txt) links only the lower-layer core facilities and platform thread abstraction, not compiler or Domain Engine interfaces. | Architecture and dependency definition |
| CCA-RF-021 | [`RuntimeState`](../include/cca/runtime/runtime_state.hpp), [`LifecycleManager::permits`](../src/runtime/lifecycle_manager.cpp), and [`Runtime::start`/`stop`](../src/runtime/runtime.cpp) encode the complete ordered normal sequence. | Implementation source |
| CCA-RF-022 | [`Runtime::resolve_validate_and_freeze`](../src/runtime/runtime.cpp) freezes the four mutable structural components; mutation-rejection tests are defined in [`configuration_manager_runtime_test.cpp`](../tests/configuration_manager_runtime_test.cpp), [`service_registry_test.cpp`](../tests/service_registry_test.cpp), [`dependency_injector_test.cpp`](../tests/dependency_injector_test.cpp), and [`event_bus_test.cpp`](../tests/event_bus_test.cpp). | Implementation and test source |
| CCA-RF-023 | [`Runtime::resolve_validate_and_freeze`](../src/runtime/runtime.cpp) completes all freezes and enters `runtime_freeze` before `Runtime::start` transitions to `starting` and calls any Provider. | Implementation source |
| CCA-RF-024 | [`ServiceContract`, `ServiceContractType`, and `ServiceResolution`](../include/cca/runtime/service_registry.hpp) use C++ concepts and templates; the positive and negative `ResolvesAs` assertions in [`service_registry_test.cpp`](../tests/service_registry_test.cpp) verify cardinality-specific interface types, while `ResolvableContract` accepts an approved typed contract and rejects a non-Service Contract candidate at compile time. | Compile-time interface definition and test source |
| CCA-RF-025 | The complete public [`ServiceRegistry`](../include/cca/runtime/service_registry.hpp) interface uses contract types and contains no string service-lookup operation. | Interface review |
| CCA-RF-026 | [`ServiceRegistry`](../include/cca/runtime/service_registry.hpp) exposes contract interfaces while keeping Provider records, factories, concrete-type identity, and instances private to Runtime composition. | Implementation source |
| CCA-RF-027 | [`ServiceContract`](../include/cca/runtime/provider.hpp) requires a compile-time `ServiceCardinality` parameter for every contract. | Compile-time interface definition |
| CCA-RF-028 | [`ServiceCardinality`](../include/cca/runtime/provider.hpp) contains only `exactly_one`, `zero_or_one`, and `one_or_more`; the three `Enforces...Cardinality` cases in [`service_registry_test.cpp`](../tests/service_registry_test.cpp) define cardinality evidence. | Implementation and test source |
| CCA-RF-029 | [`EventBus::publish<Event>`](../include/cca/runtime/event_bus.hpp) returns a shared future and [`EventBus::publish_erased`](../src/runtime/event_bus.cpp) launches asynchronous typed delivery; `DeliveryRunsAsynchronouslyRatherThanInline` in [`event_bus_test.cpp`](../tests/event_bus_test.cpp) defines the behavioral evidence. | Implementation and test source |
| CCA-RF-030 | [`Runtime::resolve_validate_and_freeze`](../src/runtime/runtime.cpp) calls `build_and_validate` before freeze and startup; [`DependencyInjector`](../src/runtime/dependency_injector.cpp) computes the complete edge and level snapshots. | Implementation source |
| CCA-RF-031 | [`Runtime::start_providers`](../src/runtime/runtime.cpp) completes each dependency level before advancing to the next under either execution policy. | Implementation source |
| CCA-RF-032 | [`StartupExecutionPolicy`](../include/cca/runtime/execution_policy.hpp) offers sequential or `parallel_within_level`; [`Runtime::start_level_parallel`](../src/runtime/runtime.cpp) confines asynchronous starts to one level and joins them before advancing. | Implementation source |
| CCA-RF-033 | [`Runtime::stop_started_providers`](../src/runtime/runtime.cpp) traverses dependency levels and Providers in reverse, stopping dependents before their dependencies. A stop failure ceases normal shutdown and rollback preserves deterministic reverse-lifetime cleanup through Event Bus close/drain and reverse Provider destruction without further stop callbacks. Startup and shutdown diagnostics retain typed Provider identity and dependency level as ordering evidence. | Implementation source |
| CCA-RF-034 | [`LifecycleManager`](../src/runtime/lifecycle_manager.cpp) permits lifecycle failures only into the explicit `failed` state; [`Runtime::rollback`](../src/runtime/runtime.cpp) performs that transition. | Implementation source |
| CCA-RF-035 | [`Runtime::rollback`](../src/runtime/runtime.cpp) transitions from `failed` directly to `rollback` before cleanup. | Implementation source |
| CCA-RF-036 | [`Runtime::rollback`](../src/runtime/runtime.cpp) stops already-started Providers in reverse dependency order for failures before normal shutdown; a stop-callback failure invokes no additional stop callbacks. Both paths close the Event Bus, drain accepted events, destroy Provider instances in reverse dependency order, record cleanup, and transition to `destroyed`, where later publication is rejected. `StartFailureRunsFailureRollbackAndDeterministicCleanup`, `EquivalentStartFailuresProduceEquivalentRollbackCleanup`, and `StopFailureDoesNotStopDependenciesAndUsesReverseDestruction` in [`runtime_test.cpp`](../tests/runtime_test.cpp) verify both paths; the equivalent-failure case compares lifecycle, cleanup trace, and the complete typed metric snapshot while intentionally excluding instance identity. | Implementation and failure-test source |
| CCA-RF-037 | [Programming model §4](runtime-programming-model.md) contains a distinct contract, Provider, cardinality, and service-registration section. | Documentation |
| CCA-RF-038 | [Programming model §5](runtime-programming-model.md) contains a distinct dependency-declaration and constructor-injection section. | Documentation |
| CCA-RF-039 | [Programming model §7](runtime-programming-model.md) contains a distinct lifecycle, `RuntimeResult`, diagnostic, failure, and rollback error-reporting section. | Documentation |
| CCA-RF-040 | [Programming model §9](runtime-programming-model.md) distinguishes instance confinement from shared state and specifies concurrency guarantees and limits for the host, Runtime, all six components, contracts, Providers, Event handlers, and value/snapshot surfaces. | Documentation |

## Architecture-decision evidence

| Decision | Concrete evidence | Evidence available |
|---|---|---|
| ADR-003-001 | [`RuntimeHost`](../include/cca/runtime/runtime_host.hpp), [`RuntimeId`](../include/cca/runtime/runtime_id.hpp), [`Runtime`](../include/cca/runtime/runtime.hpp), and [`main.cpp`](../src/runtime/main.cpp) implement the headless named host, explicit identity, multiple owned instances, independent contexts, and no singleton. | Implementation source |
| ADR-003-002 | [Architecture §4](../../../ARCHITECTURE.md) records the five layers and six-component inventory; [`Runtime`](../include/cca/runtime/runtime.hpp) owns that exact inventory and identifies its surrounding types as implementation surfaces. | Architecture and implementation source |
| ADR-003-003 | [`RuntimeState`](../include/cca/runtime/runtime_state.hpp), [`LifecycleManager`](../src/runtime/lifecycle_manager.cpp), and [`Runtime::resolve_validate_and_freeze`](../src/runtime/runtime.cpp) implement the lifecycle, freeze point, pre-start immutability, and mutation rejection. | Implementation and freeze-test source |
| ADR-003-004 | [`provider.hpp`](../include/cca/runtime/provider.hpp) and [`service_registry.hpp`](../include/cca/runtime/service_registry.hpp) define typed contracts, only the three cardinalities, internal Provider bindings, typed resolution, duplicate rejection, and no string lookup; [`service_registry_test.cpp`](../tests/service_registry_test.cpp) defines the associated behavioral evidence. | Implementation and test source |
| ADR-003-005 | [`RuntimeBuilder::add_provider`](../include/cca/runtime/runtime_builder.hpp) and [`DependencyInjector`](../src/runtime/dependency_injector.cpp) implement required constructor injection; [`EventBus`](../src/runtime/event_bus.cpp) implements typed asynchronous notification. | Implementation and test source |
| ADR-003-006 | [`DependencyInjector`](../src/runtime/dependency_injector.cpp) computes deterministic dependency-first levels; [`Runtime`](../src/runtime/runtime.cpp) executes levels sequentially and permits concurrency only within the selected level. | Implementation and test source |
| ADR-003-007 | [`Runtime::stop_started_providers`](../src/runtime/runtime.cpp) and `destroy_provider_instances` traverse the graph in reverse dependency-level order with a deterministic reverse-registration tie-breaker. | Implementation source |
| ADR-003-008 | [`Runtime::rollback`](../src/runtime/runtime.cpp), [`LifecycleManager`](../src/runtime/lifecycle_manager.cpp), and [`Observability`](../src/runtime/observability.cpp) implement explicit failure, rollback, deterministic reverse cleanup, diagnostic evidence, and termination in `Destroyed`. | Implementation source |

## Verification handoff

The implementation trace is complete only when the change handoff separately
records:

- the exact configure command and result;
- the exact build command and compiler result;
- the exact `ctest` command, discovered test count, and result;
- platform, compiler, generator, and dependency context;
- any format, static-analysis, sanitizer, or coverage checks actually run;
- checks not run and the reason.

No such execution result is asserted by this document.

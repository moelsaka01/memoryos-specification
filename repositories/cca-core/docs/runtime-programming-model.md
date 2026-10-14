# Runtime Foundation programming model

## Status and authority

This document explains how the `cca::runtime` C++ implementation realizes
CCA-RF-1.0. CCA-RF-1.0 remains authoritative. C++ class names, templates,
error codes, ordering tie-breakers, and ownership techniques in this document
are implementation surfaces; they do not add architecture to the standard.

The Runtime Foundation contains exactly six components:

1. Lifecycle Manager;
2. Service Registry;
3. Dependency Injector;
4. Event Bus;
5. Configuration Manager;
6. Observability.

`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` compose, expose, or host those components. They are not
additional peer components. Logging, diagnostics, metrics, and health are four
facets of Observability, not four more components.

## Runtime API philosophy

The API is instance-oriented, typed, explicit, and one-shot:

- callers compose one identified Runtime through a move-only `RuntimeBuilder`;
- required collaboration is represented by typed constructor dependencies,
  never a mutable global locator;
- expected operational failure is returned as `RuntimeResult`, with a stable
  code and a human-readable message;
- Runtime-owned structure becomes immutable at Runtime Freeze;
- typed values and Service Contract templates prevent string-based service
  lookup;
- ownership is expressed with values and smart pointers, while non-owning
  references state their lifetime limits;
- deterministic registration order supplies an implementation tie-breaker
  where CCA-RF-1.0 does not order unrelated Providers;
- lifecycle methods perform the approved transitions; callers do not set
  `RuntimeState` directly.

A built Runtime begins in `Constructed`. `start()` performs the complete path
to `Running`; `stop()` performs the complete path from `Running` through
`Destroyed`. A destroyed Runtime is not restarted.

## 1. Headless host, creation, ownership, and destruction

The `cca-runtime` executable is the official headless host artifact. Its
composition root creates a `RuntimeHost`, submits a `RuntimeBuilder`, starts
the resulting instance, stops it, and removes it. It has no graphical or
interactive dependency.

`RuntimeHost::create(RuntimeBuilder)` consumes the builder, constructs a
Runtime in `Constructed`, and stores shared ownership in a host-local map keyed
by `RuntimeId`. Duplicate identity is rejected. The map permits one host to
own multiple instances without sharing any Runtime component state.

`RuntimeHost::start(id)` and `stop(id)` delegate to the selected Runtime.
`RuntimeHost::destroy(id)` stops an instance that is still `Running`, requires
the instance to have completed normal shutdown or rollback into `Destroyed`,
and then removes host ownership. The host destructor stops instances that are
still running and releases all remaining ownership. Runtime and Event Bus
destructors provide the final RAII cleanup boundary and drain accepted
notifications.

The minimal lifecycle example is
[runtime_foundation.cpp](../../../examples/runtime_foundation.cpp).

## 2. Runtime identity and instance isolation

`RuntimeId` is an owning, non-empty string value selected by the caller. It is
copied into the Runtime, its `RuntimeContext`, Event Bus, Observability, and
the host map. Callers retain a `RuntimeId` value and use it for host
operations; there is no process-global "current Runtime" and no singleton
accessor.

Each Runtime constructs its own six components, context, configuration
snapshot, Provider registry, dependency graph, Event Bus subscriptions,
diagnostic sequence, metrics, and health projection. Contract registrations,
events, failures, and Observability records in one instance do not enter
another instance.

`RuntimeHost::runtime_ids()` returns the host's identities in deterministic
lexical map order. `find(id)` is a non-owning inspection seam. Its returned
pointer does not extend Runtime lifetime and must not race with
`RuntimeHost::destroy(id)` or host destruction.

## 3. Configuration and Runtime Freeze

Callers supply configuration while composing a `RuntimeBuilder`:

```cpp
builder.set_configuration(
    cca::core::ConfigurationKey{"runtime.mode"},
    "headless");
```

Repeated assignment of one key is deterministic last-write-wins behavior in
the builder. File, environment, command-line, and precedence policy are not
part of `ConfigurationManager`; the caller must resolve those policies before
supplying values.

During `Configuring`, Runtime transfers the builder's immutable
`core::Configuration` value to its instance-local `ConfigurationManager`.
During `Validating`, the manager verifies that a snapshot exists. Runtime then
freezes the Configuration Manager, Service Registry, Dependency Injector, and
Event Bus before entering `Runtime Freeze` and before entering `Starting`.

After freeze:

- configuration replacement is rejected;
- Service Contract declarations and Provider bindings are rejected;
- the validated dependency graph and instantiated Provider set cannot change;
- Event Bus subscription mutation is rejected;
- immutable configuration snapshots remain available to concurrent readers.

`RuntimeContext::configuration()` exposes the frozen snapshot to Providers.
The snapshot and references into it remain valid until their owning Runtime is
destroyed.

## 4. Typed Service Contracts, Providers, cardinality, and registration

A consumer-visible interface becomes a typed Service Contract by pairing it
with exactly one approved cardinality:

```cpp
using ClockContract = cca::runtime::ServiceContract<
    Clock,
    cca::runtime::ServiceCardinality::exactly_one>;
```

The C++ enumerators correspond to the standard values as follows:

| CCA-RF-1.0 cardinality | C++ value | Resolution type |
|---|---|---|
| `ExactlyOne` | `ServiceCardinality::exactly_one` | `Interface&` |
| `ZeroOrOne` | `ServiceCardinality::zero_or_one` | `std::optional<std::reference_wrapper<Interface>>` |
| `OneOrMore` | `ServiceCardinality::one_or_more` | `std::vector<std::reference_wrapper<Interface>>` |

Composition declares the contract and registers an internal Provider factory
on the builder:

```cpp
builder.declare_contract<ClockContract>()
    .add_provider<ClockContract, SystemClock>(
        [] { return std::make_unique<SystemClock>(); });
```

`SystemClock` implements both the contract interface and `ServiceProvider`.
The registry exposes resolution by `ClockContract`; it exposes no operation
that accepts a string service identifier. Provider concrete types are used
only for registration, factory construction, and duplicate detection. Runtime
consumers resolve the contract interface rather than the Provider type.

During `Registering Services`, the builder's ordered actions declare contracts
and bindings. The Service Registry rejects:

- a repeated contract declaration;
- a binding for an undeclared contract;
- conflicting or unsupported cardinality;
- the same contract/concrete-Provider type binding more than once;
- mutation after freeze.

Validation checks every declared contract's Provider count. Distinct concrete
Provider types may satisfy a `OneOrMore` contract and resolve in deterministic
registration order. Public `resolve<Contract>()` is available only after
Runtime Freeze; attempted pre-freeze resolution is an explicit programming
error. Resolved interface references are non-owning and remain valid only until
shutdown, rollback, or destruction removes the corresponding Provider.

## 5. Dependency declaration, injection, startup, and shutdown

Required dependencies are listed as Service Contract template arguments to
`RuntimeBuilder::add_provider`. The factory receives their
cardinality-specific `ServiceResolution` values in that same order. The
factory returns unique ownership of the concrete Provider, so the required
collaborators are constructor inputs rather than lookups performed during
`start()`.

Conceptually:

```cpp
builder.add_provider<WorkerContract, WorkerProvider, ClockContract>(
    [] (Clock& clock) {
        return std::make_unique<WorkerProvider>(clock);
    });
```

During `Resolving Dependencies` and `Validating`, `DependencyInjector`:

1. reads every typed Provider dependency declaration;
2. rejects undeclared, missing, cardinality-conflicting, or duplicate
   dependency declarations;
3. creates one edge from the dependent Provider to every Provider selected by
   the dependency contract;
4. detects self-cycles and multi-node cycles;
5. derives dependency-first levels ordered by Provider registration ID;
6. instantiates factories level by level so earlier collaborators exist before
   injection;
7. freezes the complete graph before Provider startup.

Runtime executes dependency levels sequentially. The default
`StartupExecutionPolicy::sequential` starts Providers in registration order
within a level. An explicit
`StartupExecutionPolicy::parallel_within_level` uses asynchronous tasks for
distinct Providers in the same validated level, waits for the entire level,
and only then advances. A failed task does not allow the next level to begin.

Shutdown iterates dependency levels in reverse and Providers within each level
in reverse registration order. The latter is a deterministic implementation
tie-breaker for otherwise unrelated Providers; the architectural guarantee is
that every dependent stops before the Providers it depends on. A Provider stop
failure ceases normal shutdown immediately. Runtime enters the failure path,
and rollback does not invoke another Provider stop callback. It preserves
deterministic reverse-lifetime cleanup by closing and draining the Event Bus
and destroying Provider instances in reverse dependency order.

## 6. Typed asynchronous Event Bus

Event identity is the C++ event type. Callers register copyable typed handlers
through `RuntimeBuilder::subscribe<Event>()`; those actions are applied during
`Registering Services` and become immutable at Runtime Freeze.

`EventBus::publish(Event)` owns the event value and returns a
`std::shared_future<EventDeliveryResult>`. Publishing is asynchronous rather
than inline. Each publication snapshots the handlers for its event type and
one delivery task invokes that snapshot in subscription order. The result
states whether publication was accepted and counts subscribers, successful
deliveries, and handler failures.

One handler exception does not prevent later handlers in the same snapshot
from running. The failure is counted and recorded through Observability.
Separate publications may deliver concurrently. `drain()` waits for accepted
delivery work. Before Runtime can complete destruction, it closes the Event Bus
to reject new publications, then drains every publication accepted before the
close. The Event Bus destructor repeats that close-and-drain operation
idempotently as the final RAII boundary. Consequently, a Runtime in
`Destroyed` cannot accept a new publication.

This implementation intentionally defines no queue bound, backpressure,
priority, retry, or delivery-persistence policy. Because publication may
continue concurrently, a caller that needs a bounded drain must first quiesce
its publishers.

## 7. Lifecycle, error reporting, and Observability

`LifecycleManager` enforces the normal sequence:

```text
Constructed -> Initializing -> Configuring -> Registering Services
-> Resolving Dependencies -> Validating -> Runtime Freeze -> Starting
-> Running -> Stopping -> Stopped -> Destroyed
```

An invalid transition returns `CCA-RUNTIME-LIFECYCLE-001` and is recorded.
Configuration, registration, dependency construction, validation, Provider
startup, Provider shutdown, and explicit `Runtime::fail()` failures enter:

```text
Failed -> Rollback -> Destroyed
```

Expected operations return `RuntimeResult`. Success has no diagnostic payload;
failure carries a stable machine-facing code and explanatory message. Provider
exceptions are converted to explicit failure results. Runtime retains the
failure path in lifecycle history and returns the initiating failure after
rollback unless a lifecycle transition itself fails.

Observability is instance-scoped and provides:

- **Logging:** diagnostic outcomes are forwarded to an injected
  `core::LogSink`; a throwing sink cannot replace or alter the retained
  diagnostic.
- **Diagnostics:** ordered records include Runtime identity, sequence, state,
  severity, category, code, and message for lifecycle, configuration,
  validation, registry, dependency graph, startup, shutdown, Event Bus,
  failure, rollback, and cleanup outcomes. Provider startup and shutdown
  records additionally carry a typed `ProviderId` and dependency-level index,
  allowing dependency order to be reconstructed without parsing messages.
  Runtime-wired typed resolution failures are recorded as Service Registry
  outcomes before the lifecycle enters failure handling.
- **Metrics:** typed counters cover diagnostic records, lifecycle transitions,
  rejected transitions, validation and composition failures, Provider starts
  and stops, Event Bus activity, failures, rollbacks, and cleanup.
- **Health:** a `HealthSnapshot` projects `healthy`, `degraded`, `failed`, or
  `inactive` from current lifecycle and recorded errors.

`Runtime::observability()` and `RuntimeContext::observability()` expose
inspection-only views. Callers and Providers can read identity, state,
diagnostics, metrics, and health, while foundation outcome recording and
foundation metric mutation are reserved to `Runtime`, Lifecycle Manager,
Service Registry, and Event Bus. This prevents application or Provider code
from forging lifecycle, startup, shutdown, failure, rollback, or cleanup
evidence. The configured log sink continues to receive those authoritative
diagnostic outcomes.

Diagnostics use deterministic instance-local sequence numbers and contain no
clock or process-global metadata. Snapshot methods return owned values.

## 8. Ownership, lifetime, rollback, and deterministic cleanup

`Runtime` owns all six components and one `RuntimeContext`. The Service
Registry owns each Provider with `std::unique_ptr`; Provider factories transfer
that ownership. `RuntimeContext` and resolved Service Contract references are
non-owning. A Provider may retain constructor-injected contract references
while it is owned by that Runtime because reverse shutdown keeps dependencies
alive until dependents stop. Callers outside Provider ownership must stop using
resolved references before `stop()`, `fail()`, host destruction, or any other
cleanup begins. No context or contract reference may outlive the owning
Runtime.

Normal shutdown:

1. enters `Stopping`;
2. stops every started Provider in reverse dependency order, unless a stop
   failure transfers control immediately to rollback;
3. enters `Stopped`;
4. closes the Event Bus and drains accepted delivery;
5. destroys Provider instances in reverse dependency order;
6. records cleanup and enters `Destroyed`, after which publication remains
   rejected.

On failure before normal shutdown begins, Runtime records the cause, enters
`Failed` and `Rollback`, stops Providers that reached started state, closes the
Event Bus, drains accepted delivery, destroys Provider instances in reverse
dependency order, records rollback and cleanup, and enters `Destroyed`. If a
Provider stop callback itself caused failure, normal shutdown ends immediately
and rollback performs the same close, drain, and reverse destruction without
invoking additional Provider stop callbacks.
Equivalent registration, graph, state, and failure inputs therefore select the
same cleanup order.

Provider `stop()` is invoked at most once by a given cleanup attempt. Provider
code owns any resources and worker activity it creates and must make their
lifetime safe before returning from `stop()`. Futures returned by Event Bus
publication own their delivery result; they do not extend Runtime or
Observability lifetime beyond the Event Bus drain/destruction boundary.

## 9. Thread-safety contract

Thread safety is instance-scoped. There is no mutable global Runtime state.
The guarantees and limits are:

| Surface | Guarantee and limit |
|---|---|
| `RuntimeHost` | Map operations are mutex-protected. Operations on different Runtime instances may proceed concurrently. Competing lifecycle operations on one identity are serialized by that Runtime but may be rejected as invalid transitions. Host destruction must not race with host method calls. A pointer returned by `find()` is non-owning and must not race with `destroy()` for that identity. |
| `Runtime` | `start()`, `stop()`, and `fail()` are serialized per instance. `state()` and `lifecycle_history()` use synchronized Lifecycle Manager reads. `frozen()` and direct component inspection must not race with the pre-freeze portion of `start()`; inspect them after `Running`/`Destroyed` or with caller synchronization. No Runtime reference may race with destruction. |
| `RuntimeBuilder` | Instance-confined and move-only. Configuration, Provider, subscription, sink, and policy mutations must not execute concurrently. Moving it to `build()` or `RuntimeHost::create()` ends caller use. |
| `RuntimeContext` | Its identity and component references do not change. Distinct same-level Providers may receive the same context concurrently. Safety comes from immutable configuration and the Event Bus and Observability guarantees; the context itself does not make Provider-owned state safe. |
| Lifecycle Manager | State, history, and transitions are mutex-protected. Runtime is the only transition orchestrator; external callers receive a const view. |
| Configuration Manager | Configure, validate, freeze, state queries, and snapshot acquisition are mutex-protected. A returned shared snapshot is immutable and safe for concurrent reads. |
| Service Registry | Declarations, registrations, validation, instantiation, and lifecycle bookkeeping are instance-confined to composition/lifecycle. After freeze, typed `resolve()` calls may execute concurrently while Provider instances remain intact. Resolution and use of returned references must not race with `stop()`, `fail()`, host destruction, or other cleanup. |
| Dependency Injector | Graph construction, validation, instantiation, and freeze are instance-confined. After freeze, level and edge snapshots are immutable and safe for concurrent reads while the Runtime remains alive. |
| Event Bus | Subscription, freeze, publication bookkeeping, close, drain, and queries are synchronized. Runtime-only close is idempotent and rejects later publication; accepted work remains drainable. One publication invokes its handler snapshot in order; separate publication tasks may execute handlers concurrently. Publication must be quiesced or closed before a bounded `drain()`. |
| Observability | Foundation recording and metric mutation are private to the coordinating Runtime components; callers and Providers receive inspection-only views. Recording, metric updates, state, diagnostics, metrics, and health snapshots are mutex-protected. Concurrent authentic records receive unique sequence numbers in mutex-acquisition order. An injected custom `LogSink` is responsible for its own synchronization when shared or called concurrently; the built-in ostream sink serializes writes. |
| Service Contracts | Contract interface thread safety is defined by the contract author. A lower-level collaborator may be used concurrently by multiple same-level Provider starts or Event handlers, so such use must be safe when parallel startup or concurrent publication is enabled. |
| Providers | Runtime never starts or stops the same Provider concurrently. Distinct Providers in one level may start concurrently only under the parallel policy. Provider code must synchronize its own state, required collaborators, and background work for the selected policy. Current shutdown invokes Providers sequentially in deterministic reverse order. |
| Event handlers | A single stored handler object may be invoked concurrently by separate publications. Handlers must be reentrant, immutable, or internally synchronized, and must not outlive captured state. Exceptions are contained and reported but do not make unsafe state access valid. |
| Runtime values and snapshots | `RuntimeId`, `RuntimeState`, `RuntimeResult`, diagnostic/metric/health snapshots, and frozen configuration are value or immutable surfaces and support concurrent const reads. References into a Runtime remain bounded by Runtime lifetime. |

Selecting sequential Provider startup does not turn otherwise concurrent Event
Bus delivery, host operations, or caller-owned background work into serialized
execution. Correctness must follow the guarantees above rather than accidental
execution order.

## Scope exclusions

This programming model does not define MemoryOS, Representation, Process,
Persistence, application-domain behavior, a GUI, plugins, networking, SDK
bindings, AI, reasoning, database access, or a new conformance engine. Those
systems are outside IM-003.

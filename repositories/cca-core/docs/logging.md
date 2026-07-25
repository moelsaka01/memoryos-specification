# Logging module

`Logger` filters `LogEntry` values and forwards them to an injected `LogSink`.
There is no global logger and no implicit I/O. `NullLogSink` supports intentionally
silent contexts, while `OstreamLogSink` provides deterministic console output.

```cpp
auto sink = std::make_shared<cca::core::OstreamLogSink>(std::clog);
const cca::core::Logger logger{sink, cca::core::LogLevel::info};
logger.info("compiler", "foundation ready");
```

Timestamps, structured serialization, rotation, tracing, and remote backends are
not specified in this milestone. A future design can implement them as sinks
without changing callers.


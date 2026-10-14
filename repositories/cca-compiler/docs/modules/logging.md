# Logging

`ILogger` is the compiler logging boundary. `NullLogger` discards records and
`StreamLogger` writes deterministic lines in the form
`[level] component: message`. The stream logger serializes writes with a mutex;
the caller owns the stream and must keep it alive.
`NullLogger` is stateless and `StreamLogger` is safe for concurrent `log()`
calls. Other `ILogger` implementations define their own synchronization.

Records intentionally contain no wall-clock time, thread identifier, or process
identifier so output remains reproducible. Logging policy,
filtering, and structured serialization remain deferred.

```cpp
#include <iostream>
#include <memory>

#include <cca/compiler/logging.hpp>

std::shared_ptr<cca::compiler::ILogger> quiet =
    std::make_shared<cca::compiler::NullLogger>();
quiet->log({cca::compiler::LogLevel::debug, "compiler", "discarded"});

std::shared_ptr<cca::compiler::ILogger> logger =
    std::make_shared<cca::compiler::StreamLogger>(std::clog);
logger->log({cca::compiler::LogLevel::info, "compiler", "ready"});
```

Implementation: `src/logging.cpp`. Tests:
`tests/logging_test.cpp`.

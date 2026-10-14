# Testing utilities

`cca::testing::RecordingLogSink` is a thread-safe in-memory sink. Tests call
`snapshot()` to obtain an independent copy before asserting.

```cpp
auto sink = std::make_shared<cca::testing::RecordingLogSink>();
const cca::core::Logger logger{sink};
logger.info("test", "expected");
const auto entries = sink->snapshot();
```

The utility library contains no test-runner dependency, so production targets can
reuse it in integration harnesses without linking GoogleTest.


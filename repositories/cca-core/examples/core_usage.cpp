#include <cca/core/configuration.hpp>
#include <cca/core/logging.hpp>

#include <iostream>
#include <memory>

int main() {
    auto configuration = cca::core::ConfigurationBuilder{}
                             .set(cca::core::ConfigurationKey{"compiler.command"}, "doctor")
                             .build();

    const auto sink = std::make_shared<cca::core::OstreamLogSink>(std::cout);
    const cca::core::Logger logger{sink};
    logger.info("example",
                configuration.get_or(cca::core::ConfigurationKey{"compiler.command"}, "help"));
}

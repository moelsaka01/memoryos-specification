#include <cca/process/process.hpp>
#include <cca/representation/representation.hpp>

using cca::process::ExecutionResult;
using cca::process::ProcessEngine;
using cca::representation::RepresentationDocument;

int main() {
    RepresentationDocument model;

    ProcessEngine engine;

    ExecutionResult result = engine.execute(model);

    return result.succeeded() ? 0 : 1;
}

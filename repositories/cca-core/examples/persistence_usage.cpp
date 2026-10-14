#include <cca/persistence/persistence.hpp>
#include <cca/representation/representation.hpp>

#include <iostream>

int main() {
    cca::representation::RepresentationDocument workspace{
        cca::representation::RepresentationMetadata{"example", "1", "demo"}};
    workspace.createEntity(cca::representation::RepresentationType{"Example"});

    cca::persistence::PersistenceEngine engine;
    const cca::persistence::PersistenceMetadata metadata{"example", "snapshot"};
    const auto saved = engine.save(workspace, metadata);
    if (!saved.succeeded()) {
        std::cerr << saved.code() << ": " << saved.message() << '\n';
        return 1;
    }

    const auto checked = engine.validate(*saved.package());
    if (!checked.succeeded()) {
        std::cerr << checked.code() << ": " << checked.message() << '\n';
        return 1;
    }

    const auto restored = engine.load(*saved.package());
    return restored.succeeded() ? 0 : 1;
}

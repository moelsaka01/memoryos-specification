#include <cca/representation/representation.hpp>

#include <cstdint>
#include <exception>
#include <iostream>
#include <stdexcept>
#include <string>

namespace rep = cca::representation;

namespace {

void printDiagnostics(const rep::ValidationResult& result) {
    for (const auto& diagnostic : result.diagnostics) {
        std::cerr << "diagnostic " << static_cast<int>(diagnostic.code) << ": "
                  << diagnostic.message << '\n';
    }
}

} // namespace

int main() {
    try {
        rep::RepresentationDocument document{rep::RepresentationMetadata{
            "CCA example",
            "1.0",
            "representation_usage.cpp"}};

        rep::TransactionService transactions;
        auto transaction = transactions.begin(document);

        const rep::RepresentationType service_type{"Service"};
        auto& gateway = document.createEntity(service_type);
        gateway.addProperty("name",
                            rep::RepresentationType{"Text"},
                            rep::RepresentationValue{"gateway"});
        gateway.addProperty("replicas",
                            rep::RepresentationType{"Count"},
                            rep::RepresentationValue{std::int64_t{3}});

        auto& catalog = document.createEntity(service_type);
        catalog.addProperty("name",
                            rep::RepresentationType{"Text"},
                            rep::RepresentationValue{std::string{"catalog"}});

        auto& request_path = document.createRelationship(gateway,
                                                         catalog,
                                                         rep::RepresentationType{"Calls"});
        request_path.addProperty("protocol",
                                 rep::RepresentationType{"Protocol"},
                                 rep::RepresentationValue{
                                     rep::EnumerationValue{"HTTPS"}});

        const rep::RepresentationId gateway_id{gateway.id().toString()};
        const rep::RepresentationId relationship_id{
            request_path.id().toString()};

        const rep::ValidationResult commit_result = transaction.commit();
        if (!commit_result.valid) {
            printDiagnostics(commit_result);
            transaction.rollback();
            return 1;
        }

        const rep::QueryService queries;
        const rep::RepresentationEntity* const found_gateway =
            queries.findEntity(document, gateway_id);
        const rep::RepresentationRelationship* const found_relationship =
            queries.findRelationship(document, relationship_id);
        const rep::EntityCollection services =
            queries.entitiesByType(document, service_type);

        if (found_gateway == nullptr || found_relationship == nullptr) {
            std::cerr << "committed objects were not found\n";
            return 2;
        }

        const rep::RepresentationProperty* const name =
            found_gateway->property("name");
        if (name != nullptr) {
            std::cout << name->value().asString() << " is the source of "
                      << found_relationship->type().name() << '\n';
        }
        std::cout << "service count: " << services.size() << '\n';

        const rep::ValidationResult validation =
            rep::ValidationService{}.validate(document);
        if (!validation.valid) {
            printDiagnostics(validation);
            return 3;
        }

        const rep::ValidationResult freeze_result =
            rep::FreezeService{}.freeze(document);
        if (!freeze_result.valid || !document.isFrozen()) {
            printDiagnostics(freeze_result);
            return 4;
        }

        try {
            document.createEntity(rep::RepresentationType{"Rejected"});
            std::cerr << "frozen mutation unexpectedly succeeded\n";
            return 5;
        } catch (const std::logic_error& error) {
            std::cout << "frozen mutation rejected: " << error.what() << '\n';
        }

        const rep::RepresentationEntity* const frozen_gateway =
            queries.findEntity(document, gateway_id);
        if (frozen_gateway == nullptr) {
            std::cerr << "query after freeze unexpectedly failed\n";
            return 6;
        }

        return 0;
    } catch (const std::exception& error) {
        std::cerr << "representation example failed: " << error.what() << '\n';
        return 7;
    }
}

#include <cca/representation/representation.hpp>

#include <gtest/gtest.h>

#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>

#include "representation_test_access.hpp"

namespace {

using cca::representation::DiagnosticCode;
using cca::representation::DiagnosticSeverity;
using cca::representation::RepresentationDocument;
using cca::representation::RepresentationInternalAccess;
using cca::representation::RepresentationType;
using cca::representation::RepresentationValue;
using cca::representation::ValidationService;

TEST(IdentityInternalTest, AllocatesTheFinalOrdinalThenRejectsExhaustionStrongly) {
    RepresentationDocument document;
    RepresentationInternalAccess::setIdentifierState(
        document, std::numeric_limits<std::uint64_t>::max(), false);

    const auto& final_entity =
        document.createEntity(RepresentationType{"FinalOrdinal"});
    EXPECT_EQ(final_entity.id().toString(), "cca-rep-ffffffffffffffff");

    const auto size_before_failure = document.entities().size();
    EXPECT_THROW(
        document.createEntity(RepresentationType{"Exhausted"}),
        std::overflow_error);
    EXPECT_EQ(document.entities().size(), size_before_failure);

    EXPECT_THROW(
        document.createEntity(RepresentationType{"StillExhausted"}),
        std::overflow_error);
    EXPECT_EQ(document.entities().size(), size_before_failure);
}

TEST(ValidationInternalTest, ReportsEveryDefensiveCategoryInNormativeOrder) {
    RepresentationDocument document;
    auto& first = document.createEntity(RepresentationType{"First"});
    auto& first_property = first.addProperty(
        "first",
        RepresentationType{"Text"},
        RepresentationValue{"first"});
    auto& duplicate_property = first.addProperty(
        "second",
        RepresentationType{"Text"},
        RepresentationValue{"second"});
    auto& empty_name_property = first.addProperty(
        "third",
        RepresentationType{"Text"},
        RepresentationValue{"third"});
    auto& missing_type = document.createEntity(RepresentationType{""});
    auto& relationship = document.createRelationship(
        first, missing_type, RepresentationType{"Connects"});

    RepresentationDocument foreign_document;
    auto& foreign =
        foreign_document.createEntity(RepresentationType{"Foreign"});

    RepresentationInternalAccess::replaceId(missing_type, first.id());
    RepresentationInternalAccess::renameProperty(
        duplicate_property, std::string{first_property.name()});
    RepresentationInternalAccess::renameProperty(empty_name_property, "");
    RepresentationInternalAccess::setEndpoints(
        relationship, first, foreign);

    const auto first_result = ValidationService{}.validate(document);
    const auto second_result = ValidationService{}.validate(document);

    ASSERT_FALSE(first_result.valid);
    ASSERT_EQ(first_result.diagnostics.size(), 5U);
    EXPECT_EQ(
        std::vector<DiagnosticCode>({
            first_result.diagnostics[0].code,
            first_result.diagnostics[1].code,
            first_result.diagnostics[2].code,
            first_result.diagnostics[3].code,
            first_result.diagnostics[4].code,
        }),
        std::vector<DiagnosticCode>({
            DiagnosticCode::DuplicateIdentifier,
            DiagnosticCode::MissingType,
            DiagnosticCode::DuplicateProperty,
            DiagnosticCode::InvalidRelationship,
            DiagnosticCode::ValidationError,
        }));

    for (const auto& diagnostic : first_result.diagnostics) {
        EXPECT_EQ(diagnostic.severity, DiagnosticSeverity::Error);
    }

    using Fingerprint =
        std::tuple<DiagnosticCode, DiagnosticSeverity, std::string>;
    std::vector<Fingerprint> first_fingerprints;
    std::vector<Fingerprint> second_fingerprints;
    for (const auto& diagnostic : first_result.diagnostics) {
        first_fingerprints.emplace_back(
            diagnostic.code, diagnostic.severity, diagnostic.message);
    }
    for (const auto& diagnostic : second_result.diagnostics) {
        second_fingerprints.emplace_back(
            diagnostic.code, diagnostic.severity, diagnostic.message);
    }
    EXPECT_EQ(first_fingerprints, second_fingerprints);
}

} // namespace

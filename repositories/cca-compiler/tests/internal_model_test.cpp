#include <gtest/gtest.h>
#include <stdexcept>
#include <string>

#include "cca/compiler/internal_model.hpp"

namespace cca::compiler {
namespace {

TEST(InternalModelTest, IdentifierEnforcesCanonicalGrammar) {
    const Identifier identifier{"core.contract-1"};

    EXPECT_EQ(identifier.value(), "core.contract-1");
    EXPECT_FALSE(identifier.empty());
    EXPECT_TRUE(Identifier::is_valid("architecture.component-2"));
    EXPECT_FALSE(Identifier::is_valid("Architecture_Component"));
    EXPECT_THROW(static_cast<void>(Identifier{"UPPER"}), std::invalid_argument);
    EXPECT_TRUE(Identifier{}.empty());
}

TEST(InternalModelTest, VersionParsesAndRoundTripsSemanticVersion) {
    const auto version = Version::parse("12.3.4-rc.1+build.7");

    ASSERT_TRUE(version.has_value());
    EXPECT_EQ(version->major(), 12U);
    EXPECT_EQ(version->minor(), 3U);
    EXPECT_EQ(version->patch(), 4U);
    EXPECT_EQ(version->prerelease(), "rc.1");
    EXPECT_EQ(version->build_metadata(), "build.7");
    EXPECT_EQ(version->to_string(), "12.3.4-rc.1+build.7");
}

TEST(InternalModelTest, VersionRejectsMalformedAndOverflowValues) {
    EXPECT_FALSE(Version::parse("1.2").has_value());
    EXPECT_FALSE(Version::parse("01.2.3").has_value());
    EXPECT_FALSE(Version::parse("999999999999999999999.2.3").has_value());
}

TEST(InternalModelTest, SpecificationCountsAllTypedObjects) {
    Specification specification;
    specification.packages.push_back({});
    specification.domains.push_back({});
    specification.components.push_back({});
    specification.contracts.push_back({});
    specification.requirements.push_back({});

    EXPECT_EQ(specification.object_count(), 5U);
}

TEST(InternalModelTest, TypedObjectsRetainArchitectureNeutralReferences) {
    Package package;
    package.header.id = Identifier{"platform"};
    package.members.emplace_back("core.domain");

    Domain domain;
    domain.header.id = Identifier{"core.domain"};
    domain.components.emplace_back("core.component");

    Component component;
    component.contracts.emplace_back("core.contract");
    component.requirements.emplace_back("core.requirement");

    Requirement requirement;
    requirement.satisfied_by.emplace_back("core.component");

    EXPECT_EQ(package.members.front().value(), "core.domain");
    EXPECT_EQ(domain.components.front().value(), "core.component");
    EXPECT_EQ(component.contracts.front().value(), "core.contract");
    EXPECT_EQ(requirement.satisfied_by.front().value(), "core.component");
}

} // namespace
} // namespace cca::compiler

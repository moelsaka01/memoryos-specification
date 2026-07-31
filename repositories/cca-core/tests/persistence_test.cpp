#include <cca/persistence/persistence.hpp>

#include <gtest/gtest.h>

namespace {

TEST(PersistenceFoundation, MetadataAndSnapshotPreserveValues) {
    using namespace cca::persistence;
    PersistenceMetadata metadata{"workspace", "description"};
    EXPECT_EQ(metadata.workspaceName(), "workspace");
    EXPECT_EQ(metadata.description(), "description");

    ExecutionContextSnapshot snapshot{
        3, cca::process::ExecutionState::Running,
        {cca::representation::RepresentationId{"a"},
         cca::representation::RepresentationId{"b"}}};
    EXPECT_EQ(snapshot.processDefinitionIndex(), 3U);
    EXPECT_EQ(snapshot.state(), cca::process::ExecutionState::Running);
    ASSERT_EQ(snapshot.trace().size(), 2U);
    EXPECT_EQ(snapshot.trace()[1].toString(), "b");
}

TEST(PersistenceFoundation, SaveValidateAndLoadAreDeterministic) {
    using namespace cca::persistence;
    cca::representation::RepresentationDocument workspace{
        cca::representation::RepresentationMetadata{"author", "1", "test"}};
    workspace.createEntity(cca::representation::RepresentationType{"Entity"});
    PersistenceEngine engine;
    const auto saved = engine.save(
        workspace, PersistenceMetadata{"w", "d"}, {"policy-a", "policy-b"});
    ASSERT_TRUE(saved.succeeded()) << saved.message();
    ASSERT_NE(saved.package(), nullptr);
    EXPECT_EQ(saved.package()->policies().size(), 2U);

    const auto validated = engine.validate(*saved.package());
    EXPECT_TRUE(validated.succeeded()) << validated.message();
    const auto loaded = engine.load(*saved.package());
    ASSERT_TRUE(loaded.succeeded()) << loaded.message();
    ASSERT_NE(loaded.package(), nullptr);
    EXPECT_EQ(loaded.package()->metadata().workspaceName(), "w");
    EXPECT_EQ(loaded.package()->workspace().entities().size(), 1U);
    EXPECT_NE(loaded.package(), saved.package());
}

TEST(PersistenceFoundation, PackageOwnsWorkspaceAndRejectsInvalidContextReferences) {
    using namespace cca::persistence;
    cca::representation::RepresentationDocument workspace;
    workspace.createEntity(cca::representation::RepresentationType{"Entity"});
    PersistenceEngine engine;
    const auto saved = engine.save(workspace, PersistenceMetadata{"w", "d"});
    ASSERT_TRUE(saved.succeeded());
    workspace.createEntity(cca::representation::RepresentationType{"Later"});
    EXPECT_EQ(saved.package()->workspace().entities().size(), 1U);

    const auto invalid = engine.save(
        workspace, PersistenceMetadata{"w", "d"}, {}, {},
        {ExecutionContextSnapshot{1, cca::process::ExecutionState::Ready, {}}});
    EXPECT_FALSE(invalid.succeeded());
    EXPECT_EQ(invalid.code(), "INVALID_CONTEXT");
    EXPECT_EQ(invalid.package(), nullptr);
}

TEST(PersistenceFoundation, PreservesFrozenLifecycleIdentifiersAndValues) {
    using namespace cca::persistence;
    using namespace cca::representation;
    RepresentationDocument workspace{RepresentationMetadata{"a", "v", "p"}};
    auto& entity = workspace.createEntity(RepresentationType{"Entity"});
    const auto& property = entity.addProperty("enum", RepresentationType{"E"}, RepresentationValue{EnumerationValue{"Ready"}});
    const auto& collection = entity.addProperty("items", RepresentationType{"List"}, RepresentationValue{std::vector<RepresentationValue>{RepresentationValue{std::int64_t{1}}, RepresentationValue{"two"}}});
    ASSERT_TRUE(FreezeService{}.freeze(workspace).valid);
    PersistenceEngine engine;
    const auto result = engine.save(workspace, PersistenceMetadata{"w", "d"});
    ASSERT_TRUE(result.succeeded()) << result.message();
    ASSERT_TRUE(result.package()->workspace().isFrozen());
    const auto& restored_entity = result.package()->workspace().entities().front().get();
    EXPECT_EQ(restored_entity.id().toString(), entity.id().toString());
    ASSERT_EQ(restored_entity.properties().size(), 2U);
    EXPECT_EQ(restored_entity.properties()[0].get().id().toString(), property.id().toString());
    EXPECT_EQ(restored_entity.properties()[0].get().value().asString(), "Ready");
    EXPECT_EQ(restored_entity.properties()[1].get().id().toString(), collection.id().toString());
    EXPECT_EQ(restored_entity.properties()[1].get().value().asCollection().size(), 2U);
}

TEST(PersistenceFoundation, RejectsInvalidRepresentationBeforePackagePublication) {
    using namespace cca::persistence;
    cca::representation::RepresentationDocument workspace;
    workspace.createEntity(cca::representation::RepresentationType{""});
    const auto result = PersistenceEngine{}.save(workspace, PersistenceMetadata{});
    EXPECT_FALSE(result.succeeded());
    EXPECT_EQ(result.code(), "INVALID_REPRESENTATION");
    EXPECT_EQ(result.package(), nullptr);
}

} // namespace

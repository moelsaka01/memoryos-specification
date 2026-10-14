#include <cstdint>
#include <gtest/gtest.h>
#include <string>

#include "cca/compiler/canonical_value.hpp"

namespace cca::compiler {
namespace {

TEST(CanonicalValueTest, RepresentsEveryCanonicalType) {
    const CanonicalValue null_value;
    const CanonicalValue boolean_value{true};
    const CanonicalValue integer_value{std::int64_t{42}};
    const CanonicalValue number_value{4.5};
    const CanonicalValue string_value{"text"};
    const CanonicalValue array_value{CanonicalValue::Array{CanonicalValue{"item"}}};
    const CanonicalValue object_value{CanonicalValue::Object{{"key", CanonicalValue{"value"}}}};

    EXPECT_TRUE(null_value.is_null());
    EXPECT_TRUE(boolean_value.is_boolean());
    EXPECT_TRUE(boolean_value.as_boolean());
    EXPECT_TRUE(integer_value.is_integer());
    EXPECT_TRUE(integer_value.is_number());
    EXPECT_EQ(integer_value.as_integer(), 42);
    EXPECT_DOUBLE_EQ(integer_value.as_number(), 42.0);
    EXPECT_EQ(number_value.as_number(), 4.5);
    EXPECT_EQ(string_value.as_string(), "text");
    EXPECT_EQ(array_value.as_array().size(), 1U);
    ASSERT_NE(object_value.find("key"), nullptr);
    EXPECT_EQ(object_value.find("key")->as_string(), "value");
}

TEST(CanonicalValueTest, ObjectStorageAndLocationAreDeterministic) {
    CanonicalValue value{
        CanonicalValue::Object{{"z", CanonicalValue{nullptr}}, {"a", CanonicalValue{nullptr}}},
        DiagnosticLocation{"spec.yaml", 3, 7}};

    ASSERT_TRUE(value.is_object());
    EXPECT_EQ(value.as_object().begin()->first, "a");
    EXPECT_EQ(value.location(), (DiagnosticLocation{"spec.yaml", 3, 7}));
    EXPECT_EQ(value.find("missing"), nullptr);

    value.as_object().emplace("middle", CanonicalValue{true});
    ASSERT_NE(value.find("middle"), nullptr);
    EXPECT_TRUE(value.find("middle")->as_boolean());
}

TEST(CanonicalValueTest, StableTypeNamesMatchSchemaVocabulary) {
    EXPECT_EQ(to_string(CanonicalValue::Type::null), "null");
    EXPECT_EQ(to_string(CanonicalValue::Type::boolean), "boolean");
    EXPECT_EQ(to_string(CanonicalValue::Type::integer), "integer");
    EXPECT_EQ(to_string(CanonicalValue::Type::number), "number");
    EXPECT_EQ(to_string(CanonicalValue::Type::string), "string");
    EXPECT_EQ(to_string(CanonicalValue::Type::array), "array");
    EXPECT_EQ(to_string(CanonicalValue::Type::object), "object");
}

} // namespace
} // namespace cca::compiler

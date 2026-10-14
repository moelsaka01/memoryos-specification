# Serialization

The serialization functions produce deterministic JSON fragments for CLI and
artifact generation:

- `json_string` escapes one UTF-8 string as JSON;
- `serialize_validation_report` emits ordered diagnostics and counts;
- `serialize_specification_report` emits the model summary;
- `serialize_object_inventory` emits typed objects in identifier order.

Member order is fixed, collections are sorted before emission, and no function
consults time, locale, network, environment, or host identity. Results contain
no trailing timestamp or machine-specific absolute path. The functions are
pure apart from returned string allocation and are safe to call concurrently
with independent inputs.

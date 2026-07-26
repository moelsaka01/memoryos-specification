# Canonical Value

`CanonicalValue` is the recursively typed, YAML-independent syntax value used
between parsing and model construction. It represents null, Boolean, integer,
number, string, array, and ordered object values with a source location.

The type owns its children and uses value semantics. Consumers query the
active type before calling a typed accessor. It is syntax data, not the
semantic `Specification` model.

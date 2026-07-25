# Common utilities

The string utilities are deliberately locale-independent:

- `trim_ascii` removes only the six ASCII whitespace characters.
- `to_lower_ascii` maps only `A` through `Z`.
- `is_blank_ascii` checks for empty or ASCII-whitespace-only text.

This narrow behavior is deterministic across operating systems and user locales.
Unicode normalization and case folding require an explicit dependency and policy,
which the architecture has not yet selected.


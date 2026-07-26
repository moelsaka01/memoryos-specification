# Dependency Resolver

`DependencyResolver` consumes a schema-valid and analyzed document. It checks
that dependency endpoints resolve, target versions satisfy constraints, and
the directed graph is acyclic.

`DependencyResolution` contains a deterministic topological order plus
structured validation. Lexical identifier order breaks otherwise equivalent
traversal choices. The resolver performs no registry or network lookup.

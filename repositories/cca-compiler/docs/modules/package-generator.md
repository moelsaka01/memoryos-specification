# Package Generator compatibility seam

`PackageGenerator` reserves an IM-001 public boundary. It is not part of the
IS-002 pipeline and does not create archives, resolve remote dependencies,
sign packages, install files, or implement a registry.

Canonical dependency resolution is limited to the in-document directed graph.
A package format and package manager require separate architecture.

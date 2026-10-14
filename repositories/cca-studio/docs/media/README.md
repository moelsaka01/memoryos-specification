# MemoryOS Studio media manifest

This directory separates public release media from the capture inputs and
historical evidence used to produce it.

## Release media

- memoryos-v1.2-demo.gif is the canonical GitHub demonstration for MemoryOS
  v1.2.0.
- memoryos-v1.2-demo.mp4 is the canonical full-quality release demonstration
  for MemoryOS v1.2.0.
- The three memoryos-v1.2 screenshots in ../screenshots/ are real production
  captures selected from the official v1.2 recording.

## Historical release media

- `memoryos-1.1-official-demo.gif` is the canonical MemoryOS 1.1 product
  demonstration.
- `memory-studio-mo1108-engineering-excellence.gif` is the concise
  MemoryOS 1.1 Engineering Excellence demonstration.
- `mo-1108/` contains the integration-workflow GIF and the specific workflow
  stills cited by the MO-1108 record.
- `../screenshots/` contains only screenshots cited by current release or
  milestone documentation. MemoryOS v1.2 screenshots are genuine JPEG frames
  from the official release capture; retained MO-1108 release screenshots are
  PNG and other milestone captures keep their truthful JPEG extensions.

## Historical milestone media

The remaining top-level GIFs preserve the reviewed MO-1103 through MO-1107
demonstrations. They remain linked from the documentation index and are not
presented as current Mission Control captures.

## Source frames

[`source-frames/`](source-frames/README.md) contains ordered capture inputs retained to make the checked-in
GIF demonstrations auditable:

| Directory | Derived demonstration |
| :--- | :--- |
| `mo-1104-cognitive-replay/` | `memory-studio-sprint4-cognitive-replay.gif` |
| `mo-1105-cognitive-polish/` | `memory-studio-sprint5-cognitive-polish.gif` |
| `mo-1108-official-demo/` | `memoryos-1.1-official-demo.gif` |
| `mo-1108-integration/` | `mo-1108/integration-workflow-demo.gif` |

Source frames are production inputs, not additional public release assets.
Some are byte-identical to canonical stills because the selected demonstration
frame is also the documented screenshot. Those intentional source/output
pairs are recorded in the RC-001B repository audit.

## Archive

Superseded pre-MemoryOS 1.1 captures are outside the active media surface in
[`../archive/screenshots/pre-memoryos-1.1/`](../archive/screenshots/pre-memoryos-1.1/README.md).
They must not be used to support current release claims.

## Retention rules

1. Every current release screenshot or GIF must have an inbound documentation
   reference.
2. Capture inputs belong under `source-frames/`, never beside release media.
3. Superseded visual material belongs under `archive/` with an explicit
   historical purpose.
4. File extensions must match encoded media formats.
5. Temporary browser, encoder, and generated-work directories are not release
   artifacts.

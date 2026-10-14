# MemoryOS 1.1 Accessibility Audit

## Purpose

This document records the MO-1108 accessibility audit of Memory Studio. It describes implemented usability safeguards; it is not a claim of third-party certification.

## Keyboard-Only Workflow

The complete investigation path is operable without a pointer:

1. The skip link moves focus to the Studio main region.
2. Navigation links select a MemoryOS lifecycle perspective.
3. The graph surface exposes camera shortcuts and one roving semantic-node Tab stop.
4. Arrow keys move deterministically between spatial neighbors in Select mode.
5. Enter or Space selects the focused node.
6. Trace, Replay, Evolution, and Comparative Reconstruction controls use native buttons.
7. The inspector and mobile navigation move focus inside only after becoming interactive, and return focus when closed.

Global Replay and Comparative shortcuts apply only when focus is outside an interactive control. This preserves native Space activation and prevents arrow shortcuts from hijacking links, buttons, form controls, summaries, or graph nodes.

## Focus Order and Visibility

- The graph contributes exactly one node to the Tab order regardless of graph size.
- The graph surface remains a separate Tab stop for camera operation.
- Focused graph nodes receive a high-contrast body stroke and halo, not color alone.
- Toolbar, layer-filter, graph-inventory, and trace-list controls receive an explicit focus treatment.
- Play/Pause replacement never leaves focus on a hidden control.
- Autonomous Replay completion and divergence pauses move focus only when the replaced control already owned focus.
- Route changes move focus to the main region rather than leaving it on hidden mobile navigation.

## Semantics and Announcements

- Graph nodes retain button semantics, exact accessible names, selection state, and current-step state.
- Replay, Evolution, and Comparative control groups have names and deterministic status outputs.
- Replay and Comparative shortcuts are exposed through `aria-keyshortcuts`.
- Busy operations set `aria-busy` on the result region.
- Successful notifications use `status`; failures use `alert`.
- The full graph result is not an unbounded live region. Only focused status outputs and notifications announce changes.
- Accessible graph, trace, and comparative inventories remain available alongside the visual topology.

## Contrast and Typography

- Primary text, control text, focus outlines, and status text use high-contrast light values on the dark Studio surfaces.
- Critical investigation labels and state readouts are at least 11 px.
- Comparative explanatory copy is 12 px.
- Observation A and B use square/solid and diamond/dashed structure in addition to color.
- Evolution, trace roles, current steps, and graph regions use shape, stroke, grouping, labels, or ordering in addition to hue.
- Forced-colors rules retain visible focus and routes with system colors.

## Layout and Motion

- At narrow widths the graph toolbar becomes a keyboard-scrollable horizontal control strip with 40 px minimum control height.
- Investigation context remains present and scrollable rather than being removed.
- Mobile navigation and inspector state remain synchronized with breakpoint changes.
- Reduced-motion preferences disable nonessential transitions and accepted-observation motion without altering runtime truth.

## Regression Evidence

Automated regression coverage verifies:

- deterministic roving Tab behavior;
- spatial arrow-key navigation;
- Enter and Space graph selection;
- interactive-target exclusion from global shortcuts;
- Play/Pause/Restart/Reset focus restoration;
- deferred navigation and inspector focus;
- bounded live-region scope;
- busy and notification semantics;
- responsive toolbar reachability;
- readable critical typography;
- reduced-motion and forced-colors support.

Browser verification at 1440 × 900 and 390 × 844 confirmed the keyboard and responsive behaviors in the running local application with no console warnings or errors.

## Final Assessment

No accessibility release blocker remains in the audited Memory Studio workflow. Formal conformance evaluation with assistive-technology user testing remains an external release-governance activity rather than an implementation defect.


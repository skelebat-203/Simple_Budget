# UI/UX Review Checklist

Agent pre-check before requesting human UI/UX approval. Run before marking any UI-touching item complete and before the accessibility pass. Human approves against the design doc (`0004-table-design.md` and version-specific design), not this checklist.

## Structure fidelity (against the version's design doc)

- [ ] Layout matches design doc: table structure, column order, row grouping.
- [ ] Category/subcategory indentation matches design.
- [ ] Computed rows present with `*` marker and correct formula.
- [ ] Only rows with amounts shown where design specifies.
- [ ] Responsive at 320px and 640px without 2D scroll (except data tables).

## Visual fidelity

- [ ] Colors match design tokens / per-category colors.
- [ ] Typography (font, size, weight) matches design.
- [ ] Spacing follows design tokens.
- [ ] Touch targets ≥ 44x44 CSS px.
- [ ] Visible focus indicators on all focusable elements.

## Interaction/UX

- [ ] All interactive elements reachable and operable via keyboard.
- [ ] Error messaging clear and actionable.
- [ ] Empty states present and informative.
- [ ] Loading states present where async work occurs.

## Form controls

- [ ] Every input has a persistent visual label.
- [ ] Required fields marked visually and via `aria-required`.
- [ ] Inline errors associated via `aria-describedby`.
- [ ] Focus management on submit (first errant field ≤3 errors, banner ≥4).
- [ ] Validation messages follow the standard set ("cannot be empty", etc.).
- [ ] Input types appropriate.

## Overall app design

- [ ] Navigation consistent across screens.
- [ ] Page structure: landmarks, headings hierarchy, unique `h1`.
- [ ] Consistency of components and spacing across screens.
- [ ] Responsive reflow at 320/640px.

## Version-specific checks

<!-- Fill per version. -->

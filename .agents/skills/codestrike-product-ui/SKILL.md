---
name: codestrike-product-ui
description: professional mobile product UI redesign and review for the CodeStrike uni-app student application
---

# CodeStrike Product UI

Use this skill for product-facing redesigns of the CodeStrike Vue 3 and uni-app student client.

## Start with evidence

- Review the relevant SRS journey, existing page, shared components, browser tests, and current screenshots before editing.
- Identify the student's primary goal, required information, business states, privacy boundaries, and critical actions.
- Separate product content from prototype controls and engineering evidence. Put local actor/state controls in a clearly labelled, collapsed Prototype Lab; never imply that Mock identity is real authentication.

## Design and implementation

- Upgrade existing routes and components in place. Preserve API calls, Mock state transitions, navigation contracts, eligibility rules, planner calculations, and authorization semantics.
- Reuse the tokens in `src/uni.scss` and the existing shared components. Add a component only when it represents a recurring interaction that existing components cannot express.
- Favor a calm light canvas, white surfaces, deep navy text, restrained blue actions, and sparse lime emphasis. Avoid decorative gradients, glass effects, fake metrics, nested card stacks, excessive pills, and generic dashboard decoration.
- Use a deliberate mobile type hierarchy: normally 15–16 CSS px body text, readable secondary text, and no unnecessary text below 12 px. Keep primary controls at least 44 px high.
- Design loading, empty, error, success, disabled, focus/active, and destructive states with direct student-facing language.
- Keep essential actions visible and leave clearance for the fixed bottom navigation.
- Use meaningful, labelled navigation icons with one consistent stroke language; do not substitute letters or emoji for product navigation.
- Keep prototype tooling behind the same subtle header entry on pilot pages. Actor changes must be explicit, reversible, and described as local Mock switching rather than authentication.

## Compatibility and review

- Use uni-app-compatible Vue, CSS, and APIs only. Do not add GSAP, React, Tailwind, a second component framework, browser-only runtime dependencies, or large visual packages.
- Preserve H5 and mp-weixin behavior. Treat CSS that works only in a desktop browser as a defect.
- Check actual production H5 output at 320, 390, 430, and 680 CSS px for wrapping, overflow, fixed-nav clearance, touch targets, active states, empty/error states, and long content.
- At the bottom of every reviewed page, compare the actual rectangle of the final product card, action group, or occurrence with the fixed navigation rectangle. Page padding alone is not evidence that content is reachable.
- Compare before and after browser screenshots. Score clarity, typography, spacing, consistency, usability, and accessibility as a review aid; record factual differences and remaining weaknesses, not certified quality claims.
- Iterate until the browser output, tests, TypeScript checks, and both student builds pass. Stop if a critical business or privacy behavior cannot be preserved.

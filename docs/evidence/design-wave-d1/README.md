# Design Wave D1 Evidence

## Build source and method

The retained images were captured from the local H5 production build generated from branch `feature/assignment4-prototype` after the Design Wave D1 working-tree changes. The authorized baseline was `35f9cec992f929db3e96e64c475b495725692fb5`. Microsoft Edge headless DevTools used a 390 × 900 CSS-pixel viewport and device scale factor 1.

The final D1.1 implementation was exercised at 320, 390, 430, and 680 CSS-pixel widths by `scripts/verify-h5-design-d1.mjs`. Checks covered the 16 px mobile content alignment line, horizontal overflow, labelled icon navigation, main action presence, rectangle-based bottom-navigation clearance, UI-04 empty/error states, all four UI-05 tabs, Prototype Lab open/select/close behavior, UI-16 Day/Week selection, last occurrence/add-action clearance, and 44 px primary touch targets. Only representative 390 px after images are retained here; the existing filenames were updated in place after the safe-area padding correction.

## Before and after mapping

| Page | Baseline reference | D1 production image | Factual change |
| --- | --- | --- | --- |
| UI-04 Competition Hub | `docs/evidence/phase2-wave1/ui04-hub-390.png` plus a temporary authorized-baseline capture | `ui04-after-390.png` | Removed the navy hero and decorative cover numbers; search, count, empty/error states and deadlines remain. |
| UI-05 Competition Detail / Community | `docs/evidence/phase2-wave1/ui05-community-390.png` plus a temporary baseline capture | `ui05-after-390.png` | The full long title wraps in content; all four tabs fit at 320 px; discussion/resource counts remain direct Mock projections; expired-community behavior is unchanged. |
| UI-09 Recruitment Detail | `docs/evidence/phase2-wave1/ui09-open-390.png` plus a temporary baseline capture | `ui09-after-390.png` | Capacity, match guidance, status, deadline, captain and skills remain; secondary facts use one coherent panel and scenarios moved into Prototype Lab. |
| UI-11 My Teams | `docs/evidence/phase2-wave3/ui11-my-teams-390.png` plus a temporary baseline capture | `ui11-after-390.png` | Roles and membership facts remain; management actions are a compact, readable group with their original permission boundaries. |
| UI-16 Personal Planner | `docs/evidence/phase2-wave4/ui16-day-390.png` plus a temporary baseline capture | `ui16-after-390.png` | Day/Week, date movement, occurrences, completion and add actions remain; occurrences now scan in chronological rows and demo controls open from the header. |

## Product design rubric

This rubric is a review aid based on the captured output, not an objective certification.

| Criterion | Baseline | D1 | Observed basis |
| --- | ---: | ---: | --- |
| Clarity | 10/20 | 17/20 | Primary goals and actions now precede demo controls and engineering explanation. |
| Typography | 8/20 | 17/20 | Body copy is normally 15–16 px and the hierarchy uses a consistent scale. |
| Layout and spacing | 9/20 | 17/20 | Compact headers recover space; tested layouts have no horizontal overflow. |
| Component consistency | 8/15 | 13/15 | Shared navigation, states, badges, cards, actions, borders and radii now use one language. |
| Interaction usability | 9/15 | 13/15 | Primary targets are at least 44 px, active states are visible, and fixed navigation clears controls. |
| Accessibility | 5/10 | 8/10 | Text size, contrast, labels, touch targets, wrapping and non-color cues improved; assistive-technology testing remains. |
| Total | 49/100 | 85/100 | Directional design-review score only. |

Page-level review totals were UI-04 86, UI-05 85, UI-09 87, UI-11 84, and UI-16 88. UI-11 remains slightly denser for captains because three legitimate management actions must remain available.

## Remaining weaknesses

- UI-01–UI-03, UI-06–UI-08, UI-10, UI-12–UI-15, and UI-17–UI-27 were not redesigned. Shared components are improved there, but page-specific wording and spacing need a later approved wave.
- The compact app bar truncates very long titles; UI-05 repeats the complete title in wrapping content.
- Prototype Lab stays discoverable so deterministic Mock roles and states remain testable. It is not production account UI.
- The mp-weixin build passes, but WeChat Developer Tools and physical-device visual inspection were not performed.
- Keyboard and automated viewport checks do not replace assistive-technology testing.

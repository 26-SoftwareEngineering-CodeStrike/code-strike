# Design Wave D2 Evidence

## Build source

These nine representative images were captured from the local H5 production build on branch
`feature/assignment4-prototype`, based on HEAD `64496e381a838804ac99cc4fb145f6d08f34da6a`
plus the unstaged Design Wave D2 working-tree changes. Microsoft Edge headless DevTools used a
390 x 900 CSS-pixel viewport with device scale factor 1.

## Page mapping

| Image | Implemented page |
| --- | --- |
| `ui10-390.png` | UI-10 Create Team |
| `ui12-390.png` | UI-12 Recruitment Management |
| `ui15-390.png` | UI-15 Team Operations |
| `ui13-390.png` | UI-13 My Applications |
| `ui14-390.png` | UI-14 Captain Review |
| `ui17-390.png` | UI-17 Manual Course |
| `ui18-390.png` | UI-18 Timed Plan / To-do |
| `ui19-390.png` | UI-19 Occurrence Actions |
| `review-390.png` | Isolated Recruitment Design Review |

## Runtime checks

`scripts/verify-h5-design-d2.mjs` exercised every page at 320, 390, 430 and 680 CSS pixels. It
measured content padding, major element rectangles, horizontal overflow, final-action reachability,
Prototype Lab open/select/close behavior and touch targets. Existing Wave 1-4 and frozen D1 browser
checks were also run against the same production build. D1 screenshots were not regenerated.

The images demonstrate implemented H5 output, not a design mockup or WeChat physical-device result.
The known Actual Start Week normalization limitation was not changed by D2.

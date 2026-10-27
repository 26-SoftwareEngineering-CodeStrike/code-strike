# Manual MoDao handoff guide

No MoDao connection, account access or automatic import was performed by Codex.

1. Open one HTML file locally and confirm the intended page and width.
2. In MoDao, use the product's current HTML-to-design workflow manually. Product labels and exact
   steps may change, so follow the editor UI shown in your own account.
3. Inspect whether the result is an AI/generated component, grouped vector content or native
   editable layers. Converted content may not preserve semantic HTML, responsive CSS or scripts.
4. Compare typography, spacing, cards, status chips and fixed navigation against the local HTML.
5. At 390px first, then 320px and 430px, check for clipped text and horizontal overflow.
6. Recreate links listed in `interaction-map.md`; do not assume HTML anchors or JavaScript survived.
7. Recreate search, tabs, persona choice, alerts and feedback using MoDao-native interactions where
   required.
8. Confirm that unpublished/Delisted recruitment is absent and that no real contact data appears.
9. If conversion is incomplete, import pages separately, simplify one component at a time, or use
   the local render as a visual reference for manual native reconstruction.
10. Before sharing, review every artboard and interaction inside MoDao yourself.

`HTML_EXPORT_READY` means only that the repository contains locally reviewable HTML files.
`MODAO_MANUAL_IMPORT_PENDING` remains true until the user performs and verifies the import.


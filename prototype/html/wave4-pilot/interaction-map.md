# Interaction map

| Current page | Action | Target/result | Success state | Failure state | Manual MoDao link needed |
| --- | --- | --- | --- | --- | --- |
| UI-04 | Search | Filter published cards | Matching cards and count | Explicit empty state | No, but search interaction may need recreation |
| UI-04 | Open competition | UI-05 | Detail page | N/A | Yes |
| UI-04 | Teams / Planner / Me | Future artboards | Prototype boundary alert | No linked artboard | Yes |
| UI-05 | Overview / Discussion / Resources / Recruitment | Same-page content panels | Selected panel visible | N/A | Recreate as component states if scripts are flattened |
| UI-05 | Select recruitment | UI-09 | Recruitment detail | N/A | Yes |
| UI-05 | Back | UI-04 | Competition Hub | N/A | Yes |
| UI-09 | Preview skill guidance | Same page | Matched / Not Matched advisory copy | N/A | Recreate as component states if desired |
| UI-09 | Apply to join | Same page feedback | Example Pending feedback, including Not Matched | N/A | Recreate feedback interaction |
| UI-09 | Community / Back | UI-05 | Competition community | N/A | Yes |

HTML links and JavaScript handlers are local review aids. They do not prove that imported artboards
have interactive connections.

Delisted recruitment is intentionally absent from UI-05. The standalone feedback demonstrates the
visible contract only; it does not reproduce or claim the full `MockBusinessState` workflow.

Status: `HTML_EXPORT_READY / MODAO_MANUAL_IMPORT_PENDING`


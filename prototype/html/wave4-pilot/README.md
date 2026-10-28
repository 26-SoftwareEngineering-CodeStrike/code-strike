# Wave 4 standalone HTML handoff

Status: `HTML_EXPORT_READY / MODAO_MANUAL_IMPORT_PENDING`

These three files were synchronized in Design Wave D3 with the frozen D1 product UI. They are
self-contained HTML prototype pages for manual conversion. They are not
Vue entry points, do not replace the uni-app student client, and do not call CodeStrike APIs. Each
HTML file can be opened directly from disk and contains its own DOM, CSS and small optional
interaction script.

Included pages:

- `ui04-competition-hub.html`
- `ui05-competition-detail.html`
- `ui09-recruitment-detail.html`

The export uses the D1 light canvas, 16px mobile alignment line, white surfaces, restrained blue
actions, semantic SVG navigation icons and fixed-navigation clearance. All competitions, teams,
users and dates are fictional prototype data. Successful local rendering
does not mean that MoDao import, native-element conversion, page linking or sharing has succeeded.
Those steps remain manual user work.

The JavaScript search, tab and feedback interactions exist only to make the standalone files
reviewable. A conversion tool may flatten or discard them, so verify and reconnect interactions in
the target editor.

Local browser verification covers 320px, 390px and 430px widths, offline `file://` rendering,
overflow, UI-04 search, the UI-04 to UI-05 to UI-09 link path, all four UI-05 tabs, public-only
recruitment, UI-09 no-overlap application guidance and fixed-navigation clearance.


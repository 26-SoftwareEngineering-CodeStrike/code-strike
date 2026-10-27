# Wave 4 standalone HTML pilot

Status: `HTML_EXPORT_READY / MODAO_MANUAL_IMPORT_PENDING`

These files are self-contained HTML prototype pages for manual conversion experiments. They are not
Vue entry points, do not replace the uni-app student client, and do not call CodeStrike APIs. Each
HTML file can be opened directly from disk and contains its own DOM, CSS and small optional
interaction script.

Included pages:

- `ui04-competition-hub.html`
- `ui05-competition-detail.html`
- `ui09-recruitment-detail.html`

All competitions, teams, users and dates are fictional prototype data. Successful local rendering
does not mean that MoDao import, native-element conversion, page linking or sharing has succeeded.
Those steps remain manual user work.

The JavaScript search, tab and feedback interactions exist only to make the standalone files
reviewable. A conversion tool may flatten or discard them, so verify and reconnect interactions in
the target editor.


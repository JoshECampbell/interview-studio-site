CodeMirror 5.65.20 (MIT), vendored so the app works offline.

Source: https://www.npmjs.com/package/codemirror/v/5.65.20
Downloaded from https://cdn.jsdelivr.net/npm/codemirror@5.65.20/

- `lib/codemirror.js` → `codemirror.js`
- `lib/codemirror.css` → `codemirror.css`
- `mode/python/python.js` → `python.js`
- `LICENSE` retained verbatim

No CDN or analytics requests are made by the running app.

Additional CodeMirror files from the same 5.65.20 package: `addon/hint/show-hint.js`, `addon/hint/show-hint.css`, and `mode/sql/sql.js` (stored as `sql-mode.js`).

SQL practice uses sql.js 1.13.0 (`dist/sql-wasm.js`, `dist/sql-wasm.wasm`) from https://www.npmjs.com/package/sql.js/v/1.13.0. Its license is retained in `SQLJS-LICENSE`. SQLite itself is public domain. The SQL runtime is loaded only inside a worker when a SQL check is requested, not on page startup.

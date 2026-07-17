# dashboard-kit

Shared front-end kit for the **DEVPROTOCOL** and **AGENTS-ROUTER** FastAPI config
dashboards. Pure static assets + Jinja2 templates — **no Python**. Consumed by each
project as a **git submodule** at `<dashboard>/kit/`; the version is the pinned
submodule SHA (no package publish).

## Contents

```
static/kit.css        # component rules referencing CSS custom properties (theme tokens)
static/kit.js         # showSection / drill-in, secret-toggle, generic add/remove rows,
                      # optional-block enable toggle, validate-swap section routing,
                      # toasts, modals, kitConfirm/kitToast programmatic API (§11)
templates/kit/
  _launcher.html      # section launcher — link mode (route-per-button) or drill-in mode
  _validation.html    # HTMX validate partial (errors / ok)
  _field_macros.html  # switch, field_control, field_row, field_grid (shared by both apps)
                      # + cell, string_list, keyed_map, object_list, toggle_block (AR)
  _picker.html        # folderPicker / filesPicker — project-tree browse dialogs
                      # (correctly-titled modal + browse scaffold; app supplies the
                      # data driver via data-browse-url + selection handling)
```

## Demo / component gallery

`demo/gallery.html` — a single self-contained page rendering **every** kit object
live, each tagged with the name to use when referring to it. Open it directly in a
browser (`file://…/demo/gallery.html`); it links the real `../static/kit.css` +
`../static/kit.js`, so what you see is the actual component driven by the real
behaviour. Not vendored into app wheels — a dev aid only.

## Visual snapshot tests

A Playwright suite screenshots `demo/gallery.html` (full page + interactive states)
and diffs against committed baselines in `tests/__screenshots__/`, so an edit to
`static/` or `templates/` that changes the render is caught before it ships. A
`.githooks/pre-commit` hook runs it automatically on any commit touching a
render path. **Dev-only — no Python ships in a consumer wheel.**

**New dev machine — once per clone:**

```bash
git config core.hooksPath .githooks          # arm the pre-commit gate
uv sync && uv run playwright install chromium # test venv + headless browser (~177MB)
```

Then:

```bash
uv run pytest                   # compare against baselines
uv run pytest --snapshot-update # re-baseline after an INTENDED visual change, then
                                # git add tests/__screenshots__
```

Baselines are headless-Chromium + Linux specific; a different OS/browser can
false-fail on font anti-aliasing. Bypass the hook in a pinch (discouraged):
`SKIP_SNAPSHOT_TESTS=1 git commit …`. See `CLAUDE.md` for the full rule.

## Lint

The same `.githooks/pre-commit` also runs `ruff check` + `ruff format --check`
when a commit stages `*.py` or `pyproject.toml` — the kit's only lint gate (there
is no CI here, and both consumers exclude this submodule from their own ruff).
Bypass in a pinch (discouraged): `SKIP_LINT=1 git commit …`; it skips only the
ruff gate, never the snapshots.

```bash
uv run ruff check . && uv run ruff format --check .   # what the gate runs
uv run ruff format .                                  # fix drift
```

## Component rules

- **`.actions` — action section.** The single rule for a page-bottom button row.
  Any group of action buttons at the foot of a page, form, or section goes in a
  `<div class="actions">` (or `<p class="actions">`) and renders **flush-right**.
  Every save / validate / create / delete / nav button row in both consumers uses
  it — buttons needed as page actions must live in a `.actions` row, not loose.
  Inside a `<form>` the row also sticks to the bottom with a fade backdrop. A
  consumer that needs a **left-aligned** row (e.g. DEVPROTOCOL's read-only detail
  panel `article .actions`) overrides `justify-content` at higher specificity.
- **Delete buttons — always `icon_button("delete", …)`.** The macro auto-adds the
  `trash danger` classes, so every delete renders as the same solid-red trash
  icon button (`.icon-btn.trash`) on both dashboards, whether it's an `<a>` link
  or a `<button>` submit. Do not hand-roll a delete control or pass `cls="danger"`
  for it — the macro owns the destructive styling.

## Programmatic API (`window`)

The IIFE keeps internals private and exposes exactly two helpers for app scripts:

- **`kitConfirm({title, message, confirmLabel, cancelLabel, danger}) → Promise<boolean>`**
  — native `<dialog>` confirm built on demand (no markup/macro). Resolves `true`
  on Confirm, `false` on Cancel / Esc / backdrop. Set `danger:true` for a
  destructive (red) confirm button. Replaces blocking `window.confirm`.
- **`kitToast(message, severity)`** — spawn a floating toast (`severity ∈
  {success, error, warning, info}`); the same renderer the server-seed lift uses.

```js
window.kitConfirm({ message: "Discard unsaved changes?", danger: true })
  .then(function (ok) { if (ok) location.assign("/config"); });
```

## How a consumer wires it

1. **Submodule**: `git submodule add <url> <dashboard>/kit`.
2. **Templates**: add the kit dir to the Jinja loader search path —
   `Jinja2Templates(directory=[str(app_templates), str(kit_templates)])`.
   App templates win on name clashes.
3. **Static**: mount the kit static dir — `app.mount("/kit", StaticFiles(...))` —
   and link `/kit/kit.css?v={{ asset_v }}`, `/kit/kit.js?v={{ asset_v }}`.
4. **Cache-busting**: the app's `asset_version()` must hash **both** its own static
   dir and `kit/static/` so the `?v=` busts when kit bytes change.
5. **Theme**: the kit references theme tokens by name only. Each app ships a `:root{}`
   block setting the values for: `--bg --surface --border --text --text-dim --accent
   --ok --err --radius --radius-sm --mono --sans`.
6. **Host-app contract**: register a `field_unit(name)` Jinja global and a
   `humanize_no_unit` Jinja filter (both apps already do).

## Templates / packaging note

The kit's `templates/` + `static/` must be vendored into each app's wheel
(hatch `force-include`), and CI checkouts must use `submodules: recursive`, or the
kit dir is empty at build time.

See the federation hub ADR-002 for the cross-project decision record.

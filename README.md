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

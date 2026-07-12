# CLAUDE.md — dashboard-kit

Shared front-end kit for the **DEVPROTOCOL** and **AGENTS-ROUTER** FastAPI config
dashboards. **Pure static assets + Jinja2 templates — no Python at runtime.**
Consumed by each project as a **git submodule** at `<dashboard>/kit/`; the version
is the pinned submodule SHA (no package publish). See `README.md` for the wiring
contract and the federation hub ADR-002 for the cross-project decision record.

## This repo IS the upstream

The two consumers check this repo out **twice** as a pinned submodule. Those
checkouts are **read-only pins, not editable copies** — never hand-edit kit files
inside a consumer's `kit/` dir. All kit changes happen **here**, then each
superproject advances its submodule pointer. Full ceremony lives in the paired
root's `CLAUDE.md` ("Dashboard-kit — edit upstream, never the checkout").

## Layout

```
static/kit.css · static/kit.js   # the consumed assets (theme-token CSS + vanilla-JS IIFE)
templates/kit/*.html             # the consumed Jinja macros/layouts
demo/gallery.html                # live component gallery — links the REAL static/, renders every component
tests/                           # dev-only visual snapshot suite (NEVER vendored into an app wheel)
  conftest.py · test_gallery_visual.py · __screenshots__/*.png
pyproject.toml                   # dev-only toolchain for tests/ ([tool.uv] package=false — kit is not a package)
```

## Visual snapshots — the render is under test — MANDATORY

`static/` and `templates/` are the bytes both dashboards render. A wrong edit
there regresses **both** products silently. The guard is a Playwright visual
snapshot suite over `demo/gallery.html` (it links the real `kit.css`/`kit.js`, so
a screenshot is the true render). **The suite must stay 100% green.**

> **Editing the kit → run the snapshots, every time.** Any change under
> `static/`, `templates/`, or `demo/` must keep `uv run pytest` green against the
> committed baselines in `tests/__screenshots__/`. A diff means the render
> changed:
> - **Unintended** → a regression. Fix it; do **not** re-baseline to hide it.
> - **Intended** → re-baseline in the same commit:
>   `uv run pytest --snapshot-update` → `git add tests/__screenshots__`.
>
> **Keep coverage at 100%.** Every kit component is rendered in `demo/gallery.html`
> and covered by a baseline. **Add a new component → add it to the gallery AND add
> a baseline** (full-page catches it; add a clipped `assert_screenshot(..., locator=…)`
> case for a new interactive state). A component absent from the gallery is a
> component no snapshot protects — that gap is a bug.

### Enforcement — `pre-commit`

`.githooks/pre-commit` runs the suite automatically on any commit that stages a
`static`/`templates`/`demo`/`tests` path (docs-only commits skip it, stay fast).
It blocks the commit on a mismatch and prints how to re-baseline. One-time machine
setup (arm the hook, install the browser) is the human dev's job — see
`README.md` §"Visual snapshot tests". Assume it is already armed.

### What Claude runs when it edits the kit

```bash
uv run pytest                    # after any static/·templates/·demo/ edit → must be green
uv run pytest --snapshot-update  # ONLY for an intended render change, then:
git add tests/__screenshots__    # stage the new baselines in the SAME commit
```

Never `--snapshot-update` to silence a diff you did not intend — that hides a
regression. On a mismatch the suite dumps `tests/__screenshots__/<name>.actual.png`
(git-ignored) — read it to see what moved. Determinism knobs (fixed 1280×900
viewport, device scale 1, reduced motion, UTC, killed animations) + the tolerant
PIL pixel-diff (`_MAX_DIFF_RATIO = 0.01`, absorbs font anti-aliasing jitter) live in
`tests/conftest.py`. Emergency bypass exists (`SKIP_SNAPSHOT_TESTS=1`) — **do not
use it**; fix the render or re-baseline instead.

## Conventions

- **Commits**: `🤖 <type>(<scope>): <subject>` (e.g. `🤖 style(kit): …`,
  `🤖 docs(kit): …`), typed branch → `--no-ff` merge to `main`, matching this
  repo's history.
- **kit.js** is a single vanilla-JS IIFE — no build step, no framework, no deps.
  It exposes exactly `window.kitConfirm` + `window.kitToast` (see `README.md §API`).
- **Error toasts are sticky** — `severity="error"` toasts have no auto-dismiss
  timer (enforced in `kit.js` `spawnToast`). Never reintroduce a TTL on the error
  path. `gallery_toast_error` snapshots this state.

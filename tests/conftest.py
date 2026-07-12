"""Playwright visual-snapshot fixtures for the dashboard-kit component gallery.

``demo/gallery.html`` is a single self-contained page that links the REAL
``static/kit.css`` + ``static/kit.js``, so a headless-Chromium screenshot of it
is a true visual regression check on the kit's rendered CSS *and* its
kit.js-driven interactive states (toasts, the kitConfirm dialog, secret reveal,
optional-block expand) — things an HTML/DOM snapshot cannot reach.

This mirrors the fixture both consumer repos already run in ``tests/e2e`` (tolerant
PIL pixel-diff, committed baselines under ``__screenshots__/``, ``--snapshot-update``
to re-baseline) so the pair keeps one visual-testing convention. The kit stays
Python-free at runtime — this suite is dev-only and never ships in an app wheel.

Baselines are headless-Chromium + Linux specific; regenerate on an intended
change with ``uv run pytest --snapshot-update``.
"""

from __future__ import annotations

import io
from collections.abc import Callable
from pathlib import Path

import pytest
from playwright.sync_api import Locator, Page

_ROOT = Path(__file__).parents[1]
_GALLERY = _ROOT / "demo" / "gallery.html"
_SHOTS = Path(__file__).parent / "__screenshots__"
# fraction of pixels allowed to differ — absorbs font anti-aliasing jitter while
# still catching real layout/colour regressions (same tolerance as both consumers)
_MAX_DIFF_RATIO = 0.01


def pytest_addoption(parser: pytest.Parser) -> None:
    """``--snapshot-update`` (re)writes the committed baselines instead of comparing."""
    parser.addoption(
        "--snapshot-update",
        action="store_true",
        default=False,
        help="(re)write the committed screenshot baselines instead of comparing",
    )


@pytest.fixture()
def browser_context_args(browser_context_args: dict) -> dict:
    """Fixed viewport + UTC + reduced motion → deterministic screenshots."""
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 900},
        "device_scale_factor": 1,
        "reduced_motion": "reduce",
        "timezone_id": "UTC",
    }


@pytest.fixture(autouse=True)
def _fast_timeouts(page: Page) -> None:
    """Fail fast — 30s defaults make a broken selector hang the whole suite."""
    page.set_default_timeout(5000)
    page.set_default_navigation_timeout(15000)


@pytest.fixture()
def gallery_url() -> str:
    """``file://`` URL of the gallery.

    The page links ``../static`` relatively, so Chromium loads the real
    kit.css/kit.js straight off disk — no static server to stand up.
    """
    if not _GALLERY.exists():  # pragma: no cover - guards a misconfigured checkout
        raise RuntimeError(f"gallery not found at {_GALLERY}")
    return _GALLERY.as_uri()


def _diff_ratio(baseline: bytes, shot: bytes) -> float:
    """Fraction of pixels differing beyond a per-channel threshold."""
    from PIL import Image, ImageChops

    base = Image.open(io.BytesIO(baseline)).convert("RGB")
    cur = Image.open(io.BytesIO(shot)).convert("RGB")
    if base.size != cur.size:
        return 1.0
    delta = ImageChops.difference(base, cur).convert("L").point(lambda p: 255 if p > 24 else 0)
    changed = delta.histogram()[-1]
    total = base.size[0] * base.size[1]
    return changed / total if total else 0.0


@pytest.fixture()
def assert_screenshot(request: pytest.FixtureRequest) -> Callable[..., None]:
    """Compare a screenshot to a committed baseline (tolerant pixel diff).

    ``locator=None`` shoots the full page; pass a Playwright ``Locator`` to clip to
    one component/overlay — that keeps an interactive-state baseline from churning
    when an unrelated part of the gallery changes. Missing baseline or
    ``--snapshot-update`` (re)writes it; otherwise a diff over the tolerance fails
    and dumps ``<name>.actual.png`` for inspection.
    """
    updating = bool(request.config.getoption("--snapshot-update"))

    def _assert(page: Page, name: str, locator: Locator | None = None) -> None:
        _SHOTS.mkdir(exist_ok=True)
        # kill animations + caret so the bytes are stable
        page.add_style_tag(
            content="*,*::before,*::after{animation:none!important;"
            "transition:none!important;caret-color:transparent!important}"
        )
        if locator is not None:
            shot = locator.screenshot(animations="disabled")
        else:
            shot = page.screenshot(full_page=True, animations="disabled")
        baseline = _SHOTS / f"{name}.png"
        if updating or not baseline.exists():
            baseline.write_bytes(shot)
            return
        ratio = _diff_ratio(baseline.read_bytes(), shot)
        if ratio > _MAX_DIFF_RATIO:
            (_SHOTS / f"{name}.actual.png").write_bytes(shot)
            raise AssertionError(
                f"screenshot {name!r} differs {ratio:.3%} > {_MAX_DIFF_RATIO:.1%}; "
                f"wrote {name}.actual.png — re-baseline with --snapshot-update if intended"
            )

    return _assert

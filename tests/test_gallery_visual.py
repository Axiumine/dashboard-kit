"""Visual regression for the dashboard-kit component gallery.

One full-page baseline of the whole component sheet plus a handful of
kit.js-driven interactive states (sticky error toast, kitConfirm danger dialog,
secret reveal, optional-block expand) — the states a static HTML snapshot can't
reach. The interactive shots are clipped to the relevant overlay/card so an
unrelated component tweak re-baselines only ``gallery_full``, not all five.

Baselines are headless-Chromium + Linux specific; regenerate with
``uv run pytest --snapshot-update`` after an intended visual change.
"""

from __future__ import annotations

from collections.abc import Callable

from playwright.sync_api import Page


def _settle(page: Page) -> None:
    """Wait for fonts + initial paint so the screenshot bytes are stable."""
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts && document.fonts.ready")


def test_gallery_full(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """The whole gallery — every kit component rendered by the real kit.css."""
    page.goto(gallery_url)
    _settle(page)
    assert_screenshot(page, "gallery_full")


def test_gallery_toast_error(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """Sticky error toast — spawnToast into #toast-host with no auto-dismiss timer."""
    page.goto(gallery_url)
    _settle(page)
    page.click('[data-toast-demo="error"]')
    toast = page.locator("#toast-host .toast-error").first
    toast.wait_for(state="visible")
    assert_screenshot(page, "gallery_toast_error", locator=toast)


def test_gallery_confirm_danger(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """kitConfirm danger dialog — native <dialog> built on demand, red confirm button."""
    page.goto(gallery_url)
    _settle(page)
    page.click('[data-confirm-demo="danger"]')
    dialog = page.locator("dialog[open]")
    dialog.wait_for(state="visible")
    assert_screenshot(page, "gallery_confirm_danger", locator=dialog)


def test_gallery_secret_shown(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """Secret field revealed — the eye toggle flips its input password → text."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("secret field"))')
    card.locator('[data-action="toggle-secret"]').click()
    # confirm the reveal actually landed before shooting
    card.locator('input[type="text"]').first.wait_for(state="visible")
    assert_screenshot(page, "gallery_secret_shown", locator=card)


def test_gallery_block_open(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """optional-block expanded — ticking the enable switch reveals its content."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("toggle_block"))')
    # first block (Azure) starts disabled → click its switch to open it
    card.locator("label.switch").first.click()
    card.locator('[data-role="enable-content"]').first.wait_for(state="visible")
    assert_screenshot(page, "gallery_block_open", locator=card)


def test_gallery_reorder_moved(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """Opt-in reorder — move-down on the first keyed_map row DOM-swaps it below the
    second (kit.js §3), so ``default`` and ``premium`` trade places with no save."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("keyed_map"))')
    card.locator("tbody[data-rows] tr").first.locator("[data-move-down]").click()
    # after the move the first row's id cell now reads "premium" — wait then shoot
    page.wait_for_function(
        "document.querySelector('.keyed-map tbody[data-rows] tr input').value === 'premium'"
    )
    assert_screenshot(page, "gallery_reorder_moved", locator=card)

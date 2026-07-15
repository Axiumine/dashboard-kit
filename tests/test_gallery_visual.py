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


def test_gallery_nested_add(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """nested_map interactive add — '+ add Doc stem' clones a parent row (fresh id
    for __RID__), then that new row's '+ add section' adds a child chip; kit.js §3
    delegation drives both with no per-consumer JS."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("nested_map"))')
    nmap = card.locator("[data-nmap]")
    card.locator("[data-add-row]").click()  # add a 3rd parent row
    page.wait_for_function(
        "document.querySelector('[data-nmap] > [data-rows]')"
        ".querySelectorAll(':scope > .nmap-row').length === 3"
    )
    # add a child section to the freshly-added (last) parent row
    nmap.locator(".nmap-row").last.locator("[data-add-chip]").click()
    page.wait_for_function(
        "document.querySelectorAll('[data-nmap] > [data-rows] > .nmap-row')[2]"
        ".querySelectorAll('[data-chips] > .chip').length === 1"
    )
    assert_screenshot(page, "gallery_nested_add", locator=nmap)


def test_gallery_nol_add(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """nested_object_list interactive add — '+ add target' clones a row (fresh id
    for __RID__, re-keying its envelope fields + nested child template), then that
    new row's '+ add header' adds a key:value chip; kit.js §3 delegation drives
    both with no per-consumer JS (mirrors nested_map's test_gallery_nested_add)."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("nested_object_list"))')
    nol = card.locator("[data-nmap]")
    card.locator("[data-add-row]").click()  # add a 3rd row
    page.wait_for_function(
        "document.querySelector('.nested-object-list > [data-rows]')"
        ".querySelectorAll(':scope > .nol-row').length === 3"
    )
    # add a header chip to the freshly-added (last) row
    nol.locator(".nol-row").last.locator("[data-add-chip]").click()
    page.wait_for_function(
        "document.querySelectorAll('.nested-object-list > [data-rows] > .nol-row')[2]"
        ".querySelectorAll('[data-chips] > .chip').length === 1"
    )
    assert_screenshot(page, "gallery_nol_add", locator=nol)


def test_gallery_nol_format_reveal(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """nested_object_list format-select reveal (E152-S04) — switching row 1's format
    from splunk-hec to json hides the splunk_* cells with no group visible (kit.js
    §13), live with no save."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("nested_object_list"))')
    first = card.locator(".nol-row").first
    first.locator("[data-format-select]").select_option("json")
    first.locator('[data-format-group="splunk-hec"]').first.wait_for(state="hidden")
    assert_screenshot(page, "gallery_nol_format_reveal", locator=first)


def test_gallery_format_reveal(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """format-select reveal — changing row 1's format from splunk-hec to datadog-logs
    swaps its revealed cell live (kit.js §13), with no save."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("format-select reveal"))')
    first = card.locator("tbody[data-rows] tr").first
    first.locator("[data-format-select]").select_option("datadog-logs")
    # the datadog cell becomes visible, the splunk cell hides — assert then shoot
    first.locator('[data-format-group="datadog-logs"]').wait_for(state="visible")
    page.wait_for_function(
        "document.querySelector('[data-olist] tbody tr [data-format-group=\"splunk-hec\"]').hidden === true"
    )
    assert_screenshot(page, "gallery_format_reveal", locator=card.locator("[data-olist]"))


def test_gallery_picker_open(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """picker_list open state — '+ Add folder' opens the kit_driven folderPicker and
    kit.js §12 loads the (gallery-stubbed) /config/browse listing into it."""
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("picker_list"))')
    card.locator("[data-picker-open]").click()
    dialog = page.locator("dialog#demo-kit-folder-picker")
    dialog.wait_for(state="visible")
    # wait for the stubbed listing to render (dir rows appear)
    page.wait_for_function(
        "document.querySelector('#demo-kit-folder-picker [data-picker-list]')"
        ".querySelectorAll('li').length >= 3"
    )
    assert_screenshot(page, "gallery_picker_open", locator=dialog)


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

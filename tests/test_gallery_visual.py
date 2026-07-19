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


def test_gallery_full_light(page: Page, gallery_url: str, assert_screenshot: Callable) -> None:
    """The whole gallery again, in LIGHT theme — the broad light-mode guard.

    ``gallery_full`` only ever shot the dark default, so every light-theme rule was
    unguarded except where a clipped case happened to cover it. That gap shipped two
    bugs in a row: kit.css's near-black input backgrounds with no light override, and
    a ``[data-theme="light"] .icon-btn`` rule that tied ``.icon-btn.trash`` on
    specificity (both 0,2,0) and won on source order — silently replacing the
    canonical red delete button with a grey wash everywhere in light mode. Neither
    was visible to any existing baseline. A full-page light shot covers every
    component the sheet renders, so the next light-only regression re-baselines here
    instead of reaching a dashboard.
    """
    page.goto(gallery_url)
    _settle(page)
    toggle_card = page.locator('.demo-item:has(code.demo-name:text-is("theme toggle"))')
    toggle_card.locator('[data-action="toggle-theme"]').click()
    page.wait_for_function('document.documentElement.getAttribute("data-theme") === "light"')
    assert_screenshot(page, "gallery_full_light")


def test_gallery_light_theme_trash(
    page: Page, gallery_url: str, assert_screenshot: Callable
) -> None:
    """The canonical red delete button, clipped, in LIGHT theme.

    ``gallery_full_light`` above cannot guard this on its own: a 34px button on an
    ~11.6k-px-tall page is far below ``_MAX_DIFF_RATIO`` (1%), so the full-page shot
    passes whether or not the delete button keeps its red gradient — verified
    empirically by reintroducing the bug and watching it stay green. Same reasoning
    as ``test_gallery_eye_glyph_swaps_on_reveal``: only a tight clip can hold a small
    element to account.

    The bug this pins: ``[data-theme="light"] .icon-btn`` ties ``.icon-btn.trash``
    (L345) on specificity — both (0,2,0) — and wins on source order, so its
    ``background`` SHORTHAND replaces the solid-red gradient with a 2% grey wash. The
    red is deliberate, self-contained chrome in BOTH themes, so the light rule
    excludes ``.trash`` (and ``.danger`` on hover).
    """
    page.goto(gallery_url)
    _settle(page)
    toggle_card = page.locator('.demo-item:has(code.demo-name:text-is("theme toggle"))')
    toggle_card.locator('[data-action="toggle-theme"]').click()
    page.wait_for_function('document.documentElement.getAttribute("data-theme") === "light"')
    trash = (
        page.locator('.demo-item:has(code.demo-name:text-is("icon_button"))')
        .locator(".icon-btn.trash")
        .first
    )
    trash.wait_for(state="visible")
    assert_screenshot(page, "gallery_light_theme_trash", locator=trash)


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


def test_gallery_eye_glyph_swaps_on_reveal(
    page: Page, gallery_url: str, assert_screenshot: Callable
) -> None:
    """The eye button itself, masked vs revealed — a slashed eye once the value shows.

    Clipped to the 34px button on purpose. ``gallery_secret_shown`` above shoots the
    whole card, where a 17px glyph is a smaller share of the frame than the diff
    tolerance absorbs (_MAX_DIFF_RATIO) — so it passes whether or not the glyph
    swaps, and cannot guard this. Two tight baselines can.
    """
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("secret field"))')
    eye = card.locator('[data-action="toggle-secret"]')
    assert_screenshot(page, "gallery_eye_masked", locator=eye)
    eye.click()
    card.locator('input[type="text"]').first.wait_for(state="visible")
    assert_screenshot(page, "gallery_eye_revealed", locator=eye)


def test_gallery_theme_toggle_glyph_swaps(
    page: Page, gallery_url: str, assert_screenshot: Callable
) -> None:
    """The theme-toggle button itself, dark-active vs light-active — sun swaps to
    moon once clicked. Mirrors ``test_gallery_eye_glyph_swaps_on_reveal``: clipped
    to the 34px button so a 17px glyph swap isn't lost in the diff tolerance, and
    asserts the underlying state (data-theme + aria-pressed) rather than trusting
    the pixels alone.
    """
    page.goto(gallery_url)
    _settle(page)
    card = page.locator('.demo-item:has(code.demo-name:text-is("theme toggle"))')
    toggle = card.locator('[data-action="toggle-theme"]')
    assert toggle.get_attribute("aria-pressed") == "true"  # dark, the hard default
    assert page.evaluate("document.documentElement.getAttribute('data-theme')") is None
    assert_screenshot(page, "gallery_theme_dark", locator=toggle)

    toggle.click()
    page.wait_for_function('document.documentElement.getAttribute("data-theme") === "light"')
    assert toggle.get_attribute("aria-pressed") == "false"
    assert_screenshot(page, "gallery_theme_light", locator=toggle)


def test_gallery_light_theme_fields(
    page: Page, gallery_url: str, assert_screenshot: Callable
) -> None:
    """Text input + select + textarea rendered in LIGHT theme.

    Regression guard for the bug where kit.css's own hardcoded near-black
    backgrounds (#0d1019 resting / #0f131e focus / #0a0d14 disabled) on every
    input/select/textarea shipped with ZERO [data-theme="light"] override —
    trapping var(--text)'s light-mode near-black glyphs on a near-black field
    (near-invisible text) in both dashboards. No prior snapshot exercised any
    typeable control under light theme, so the bug shipped unguarded — this
    is the missing case. Clips to the ``field_grid`` demo card, which carries
    a live text input, select and textarea (plus password/date/checkbox/
    disabled/invalid states) side by side.
    """
    page.goto(gallery_url)
    _settle(page)
    toggle_card = page.locator('.demo-item:has(code.demo-name:text-is("theme toggle"))')
    toggle_card.locator('[data-action="toggle-theme"]').click()
    page.wait_for_function('document.documentElement.getAttribute("data-theme") === "light"')
    fields_card = page.locator('.demo-item:has(code.demo-name:text-is("field_grid"))')
    assert fields_card.locator('input[type="text"]').first.is_visible()
    assert fields_card.locator("select").first.is_visible()
    assert fields_card.locator("textarea").first.is_visible()
    assert_screenshot(page, "gallery_light_theme_fields", locator=fields_card)


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


def test_gallery_nol_format_reveal(
    page: Page, gallery_url: str, assert_screenshot: Callable
) -> None:
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

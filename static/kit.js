// Shared dashboard-kit: drill-in nav, secret eye-toggle, template-clone rows,
// optional-block enable toggle, HTMX validate routing. Vanilla JS IIFE — no
// framework, no build. Every behavior is a no-op when its target elements are absent.
(function () {
  "use strict";

  // ── 1. Drill-in section nav ────────────────────────────────────────────────
  //   Clicking [data-open-section] reveals the matching [data-section] panel and
  //   hides the grid. Back button restores the grid. No auto-open on load when
  //   there are no tiles — the server may have rendered a single section directly.
  var grid = document.querySelector("[data-role='section-grid']");
  var bar = document.querySelector("[data-role='section-bar']");
  var titleEl = document.querySelector("[data-role='section-title']");
  var openTiles = document.querySelectorAll("[data-open-section]");
  var hasDrillIn = openTiles.length > 0;

  function labelFor(id) {
    var tile = document.querySelector("[data-open-section='" + id + "']");
    var lbl = tile && tile.querySelector(".section-label");
    return lbl ? lbl.textContent : id;
  }

  function showSection(id) {
    document.querySelectorAll("[data-section]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-section") !== id;
    });
    if (hasDrillIn) {
      if (grid) grid.hidden = true;
      if (bar) bar.hidden = false;
      if (titleEl) titleEl.textContent = labelFor(id);
    }
  }

  function showGrid() {
    document.querySelectorAll("[data-section]").forEach(function (panel) {
      panel.hidden = true;
    });
    if (grid) grid.hidden = false;
    if (bar) bar.hidden = true;
  }

  if (hasDrillIn) {
    openTiles.forEach(function (tile) {
      tile.addEventListener("click", function (e) {
        e.preventDefault();
        showSection(tile.getAttribute("data-open-section"));
      });
    });

    document.querySelectorAll("[data-action='section-back']").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        showGrid();
      });
    });

    // Start with grid visible (panels hidden) — server may have set initial state
    // via URL; if so the server renders only one section and there are no tiles.
    showGrid();
  }

  // ── 2. Secret eye-toggle ──────────────────────────────────────────────────
  //   Handles both conventions: [data-eye] (AR) and [data-action=toggle-secret] (DP).
  //   [data-secret] (AR) and [data-role=secret-input] (DP) for the input target.
  //   One delegated handler owns this; do not add a second in app code.
  document.addEventListener("click", function (e) {
    var eye = e.target.closest("[data-eye], [data-action='toggle-secret']");
    if (!eye) return;
    e.preventDefault();

    // AR convention: [data-secret] sibling inside same parent
    var input = eye.parentElement && eye.parentElement.querySelector("[data-secret]");
    // DP convention: [data-role=secret-input] inside a [data-block=secret] ancestor
    if (!input) {
      var box = eye.closest("[data-block='secret']");
      input = box && box.querySelector("[data-role='secret-input']");
    }
    if (!input) return;

    var shown = input.type === "text";
    input.type = shown ? "password" : "text";
    if (eye.hasAttribute("aria-pressed")) {
      eye.setAttribute("aria-pressed", shown ? "false" : "true");
    }
    if (eye.hasAttribute("aria-label")) {
      eye.setAttribute("aria-label", shown ? "Show value" : "Hide value");
    }
  });

  // ── 3. Generic add/remove rows via <template> clone ───────────────────────
  //   [data-add-chip]    → clones [data-chip-template]    into [data-chips]
  //                         within closest [data-list]
  //   [data-add-row]     → clones [data-row-template]     into [data-rows]
  //                         within closest [data-kmap] or [data-olist]
  //   [data-add-backend] → clones [data-backend-template] into [data-backend-rows]
  //                         within closest [data-backend-add]
  //   [data-remove] / [data-remove-row] → removes closest tr, .chip, .backend-new
  function cloneInto(template, container) {
    if (template && container) {
      container.appendChild(template.content.cloneNode(true));
    }
  }

  document.addEventListener("click", function (e) {
    var target = e.target;

    var addChip = target.closest("[data-add-chip]");
    if (addChip) {
      var listField = addChip.closest("[data-list]");
      if (listField) {
        cloneInto(
          listField.querySelector("[data-chip-template]"),
          listField.querySelector("[data-chips]")
        );
      }
      return;
    }

    var addRow = target.closest("[data-add-row]");
    if (addRow) {
      var collection = addRow.closest("[data-kmap], [data-olist]");
      if (collection) {
        cloneInto(
          collection.querySelector("[data-row-template]"),
          collection.querySelector("[data-rows]")
        );
      }
      return;
    }

    var addBackend = target.closest("[data-add-backend]");
    if (addBackend) {
      var editor = addBackend.closest("[data-backend-add]");
      if (editor) {
        cloneInto(
          editor.querySelector("[data-backend-template]"),
          editor.querySelector("[data-backend-rows]")
        );
      }
      return;
    }

    var remove = target.closest("[data-remove], [data-remove-row]");
    if (remove) {
      var row = remove.closest("tr, .chip, .backend-new");
      if (row) row.remove();
    }
  });

  // ── 4. Optional-block enable toggle ───────────────────────────────────────
  //   A change on [data-enable] shows/hides the .toggle-fields block inside
  //   the closest [data-toggle] ancestor.
  document.addEventListener("change", function (e) {
    var enable = e.target.closest("[data-enable]");
    if (!enable) return;
    var toggleBlock = enable.closest("[data-toggle]");
    if (!toggleBlock) return;
    var fields = toggleBlock.querySelector(".toggle-fields");
    if (fields) fields.hidden = !enable.checked;
  });

  // ── 5. HTMX validate routing ──────────────────────────────────────────────
  //   On htmx:afterSwap where the swapped target id is "validation-panel",
  //   find the first [data-error-field], locate [data-field="<name>"], and if
  //   it is inside a [data-section], call showSection() to open that section.
  //   No-op when not in drill-in mode or when the field has no section parent.
  document.addEventListener("htmx:afterSwap", function (e) {
    if (!e.detail || e.detail.target.id !== "validation-panel") return;
    var firstError = e.detail.target.querySelector("[data-error-field]");
    if (!firstError) return;
    var fieldName = firstError.getAttribute("data-error-field");
    if (!fieldName) return;
    var control = document.querySelector("[data-field='" + fieldName + "']");
    var section = control && control.closest("[data-section]");
    if (section) showSection(section.getAttribute("data-section"));
  });

})();

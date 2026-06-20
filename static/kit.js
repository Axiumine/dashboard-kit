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

  // Section-aware breadcrumb: in drill-in mode the open section is appended to the
  // page-head trail as the current crumb, and the previously-current crumb (e.g.
  // "Project config") becomes a back-to-grid link. `crumbBase` is that last static
  // crumb; `crumbSection` is the {sep, cur} pair appended for the open section.
  var crumbNav = document.querySelector(".page-head .breadcrumb");
  var crumbBase = crumbNav ? crumbNav.querySelector(".crumb-current") : null;
  var crumbSection = null;

  function labelFor(id) {
    var tile = document.querySelector("[data-open-section='" + id + "']");
    var lbl = tile && tile.querySelector(".section-label");
    return lbl ? lbl.textContent : id;
  }

  function setCrumb(id) {
    if (!crumbNav || !crumbBase) return;
    crumbBase.classList.remove("crumb-current");
    crumbBase.classList.add("crumb-back");
    crumbBase.removeAttribute("aria-current");
    crumbBase.setAttribute("role", "link");
    crumbBase.setAttribute("tabindex", "0");
    if (!crumbSection) {
      var sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "/";
      var cur = document.createElement("span");
      cur.className = "crumb-current";
      cur.setAttribute("aria-current", "page");
      crumbNav.appendChild(sep);
      crumbNav.appendChild(cur);
      crumbSection = { sep: sep, cur: cur };
    }
    crumbSection.cur.textContent = labelFor(id);
  }

  function clearCrumb() {
    if (crumbBase) {
      crumbBase.classList.remove("crumb-back");
      crumbBase.classList.add("crumb-current");
      crumbBase.setAttribute("aria-current", "page");
      crumbBase.removeAttribute("role");
      crumbBase.removeAttribute("tabindex");
    }
    if (crumbSection) {
      crumbSection.sep.remove();
      crumbSection.cur.remove();
      crumbSection = null;
    }
  }

  function showSection(id) {
    document.querySelectorAll("[data-section]").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-section") !== id;
    });
    if (hasDrillIn) {
      if (grid) grid.hidden = true;
      if (bar) bar.hidden = false;
      if (titleEl) titleEl.textContent = labelFor(id);
      setCrumb(id);
    }
  }

  function showGrid() {
    document.querySelectorAll("[data-section]").forEach(function (panel) {
      panel.hidden = true;
    });
    if (grid) grid.hidden = false;
    if (bar) bar.hidden = true;
    clearCrumb();
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

    // the back-to-grid crumb ("Project config") acts as a link once a section opens
    if (crumbBase) {
      crumbBase.addEventListener("click", function () {
        if (crumbBase.classList.contains("crumb-back")) showGrid();
      });
      crumbBase.addEventListener("keydown", function (e) {
        if (crumbBase.classList.contains("crumb-back") && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          showGrid();
        }
      });
    }

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

  // ── 4. Optional-block enable switch (switch-header card) ──────────────────
  //   A change on [data-role=enable-toggle] inside a [data-block=enable] card
  //   reveals/hides that card's [data-role=enable-content] — which holds ALL the
  //   block's controls (fields + keyed-map tables), so nothing escapes the box.
  function applyEnable(box) {
    var cb = box.querySelector("[data-role='enable-toggle']");
    if (!cb) return;
    var content = box.querySelector("[data-role='enable-content']");
    if (content) content.hidden = !cb.checked;
  }
  document.addEventListener("change", function (e) {
    var cb = e.target.closest("[data-role='enable-toggle']");
    if (!cb) return;
    var box = cb.closest("[data-block='enable']");
    if (box) applyEnable(box);
  });
  // initial sync — server renders the correct hidden state, this is belt-and-braces
  document.querySelectorAll("[data-block='enable']").forEach(applyEnable);

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

  // ── 6. Toast notifications ────────────────────────────────────────────────
  //   The server renders hidden [data-toast] seeds (kit/_toast.html) in place of
  //   the old inline banners. On page load (full-page POST re-renders) and after
  //   every htmx swap (e.g. the validate dry-run), lift each seed into a floating
  //   toast inside the #toast-host overlay (created on demand), then remove the
  //   seed. Each toast auto-dismisses after TOAST_TTL and has a manual close
  //   button. No-op when no seeds are present.
  var TOAST_TTL = 4500;

  function toastHost() {
    var host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.setAttribute("aria-live", "polite");
      host.setAttribute("aria-atomic", "false");
      document.body.appendChild(host);
    }
    return host;
  }

  function dismissToast(el) {
    if (el.dataset.dismissing) return;        // a TTL + a click can both fire
    el.dataset.dismissing = "1";
    el.classList.remove("toast-in");
    el.classList.add("toast-out");
    var done = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    el.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 300);                    // fallback when no transition fires
  }

  function spawnToast(message, severity) {
    var sev = severity || "info";
    var host = toastHost();
    var el = document.createElement("div");
    el.className = "toast toast-" + sev;
    el.setAttribute("role", sev === "error" ? "alert" : "status");

    var msg = document.createElement("span");
    msg.className = "toast-msg";
    msg.textContent = message;
    el.appendChild(msg);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";             // ×
    close.addEventListener("click", function () { dismissToast(el); });
    el.appendChild(close);

    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("toast-in"); });
    setTimeout(function () { dismissToast(el); }, TOAST_TTL);
  }

  function liftToasts(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("[data-toast]").forEach(function (seed) {
      var severity = seed.getAttribute("data-toast-severity") || "info";
      var message = (seed.textContent || "").trim();
      if (message) spawnToast(message, severity);
      if (seed.parentNode) seed.parentNode.removeChild(seed);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { liftToasts(document); });
  } else {
    liftToasts(document);                     // kit.js loads at end of <body>
  }
  document.addEventListener("htmx:afterSwap", function (e) {
    if (e.detail && e.detail.target) liftToasts(e.detail.target);
  });

})();

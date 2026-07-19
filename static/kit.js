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

  // ── 3. Generic add/remove/reorder rows via <template> clone ───────────────
  //   [data-add-chip]    → clones [data-chip-template]    into [data-chips]
  //                         within closest [data-list]
  //   [data-add-row]     → clones [data-row-template]     into [data-rows]
  //                         within closest [data-kmap], [data-olist] or [data-nmap]
  //                         (nested_map parent row: __RID__ → fresh id on clone)
  //   [data-add-backend] → clones [data-backend-template] into [data-backend-rows]
  //                         within closest [data-backend-add]
  //   [data-remove] / [data-remove-row] → removes closest tr, .chip, .backend-new
  //   [data-move-up] / [data-move-down] → DOM-swaps the closest tr/.chip with its
  //                         previous/next element sibling (opt-in reorder=True on
  //                         the collection macros). Order is DOM-order-only — the
  //                         index-aligned wire format needs no change; boundary
  //                         moves (first-up / last-down) are silent no-ops.
  function cloneInto(template, container) {
    if (template && container) {
      container.appendChild(template.content.cloneNode(true));
    }
  }

  // add-row clone. A flat kmap/olist row template is a plain fragment clone. A
  // nested_map (E152-S02) parent-row template carries the token __RID__ in every
  // per-row field name (and inside its nested child <template>); substitute one
  // fresh unique id across the whole clone so the new row — and its child list —
  // post under their own rid. String-replace via innerHTML reaches the nested
  // template too (a fragment clone would not); flat rows have no token → identical.
  var rowSeq = 0;
  function addRowInto(template, container) {
    if (!template || !container) return null;
    var html = template.innerHTML;
    if (html.indexOf("__RID__") !== -1) {
      container.insertAdjacentHTML("beforeend", html.replace(/__RID__/g, "r" + rowSeq++));
    } else {
      cloneInto(template, container);
    }
    return container.lastElementChild;   // the freshly-added row (for a post-add sync)
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
      var collection = addRow.closest("[data-kmap], [data-olist], [data-nmap]");
      if (collection) {
        var added = addRowInto(
          collection.querySelector("[data-row-template]"),
          collection.querySelector("[data-rows]")
        );
        syncFormatRow(added);   // §13: reveal the new row's default group now, not after a save
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

    var moveUp = target.closest("[data-move-up]");
    if (moveUp) {
      var upRow = moveUp.closest("tr, .chip");
      var prev = upRow && upRow.previousElementSibling;
      if (prev) upRow.parentNode.insertBefore(upRow, prev);
      return;
    }

    var moveDown = target.closest("[data-move-down]");
    if (moveDown) {
      var downRow = moveDown.closest("tr, .chip");
      var next = downRow && downRow.nextElementSibling;
      if (next) downRow.parentNode.insertBefore(next, downRow);
      return;
    }

    var remove = target.closest("[data-remove], [data-remove-row]");
    if (remove) {
      var row = remove.closest("tr, .chip, .backend-new, .nmap-row");
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
  //   seed. Every toast has a manual close button; success/info/warning auto-dismiss
  //   after TOAST_TTL — counted down by a 100%→0% progress bar that FREEZES while the
  //   operator hovers or focuses the toast (banking the remaining "on" time so it can
  //   be read at leisure, then resuming on leave). ERROR toasts are sticky — no bar,
  //   no timer; the operator dismisses them by hand so a failure is never missed.
  //   No-op when no seeds are present.
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

  // Auto-dismiss countdown with a visible 100%→0% progress bar. The bar scales from
  // full to empty over TOAST_TTL; at 0% the toast dismisses. Hover OR focus FREEZES
  // the countdown — the bar holds and the remaining "on" time is banked — so the
  // operator reads at their pace; leaving resumes from where it paused. A held-count
  // keeps hover and focus independent (frozen while EITHER is active). Driven by rAF
  // + performance.now for exact pause/resume; scaleX keeps the bar compositor-cheap.
  // Errors never call this — they are sticky.
  function startToastCountdown(el) {
    var track = document.createElement("div");
    track.className = "toast-progress";
    track.setAttribute("aria-hidden", "true");   // decorative — live region already spoke
    var bar = document.createElement("div");
    bar.className = "toast-progress-bar";
    track.appendChild(bar);
    el.appendChild(track);

    var remaining = TOAST_TTL;   // ms of on-time still to run
    var segmentStart = 0;        // performance.now() when the running segment began
    var rafId = 0;
    var held = 0;                // >0 while hovered/focused → frozen
    // honour reduced-motion: step the bar in coarse 10% jumps instead of a smooth
    // per-frame slide — keeps the remaining-time cue without continuous motion (the
    // slide is JS-driven inline style, so kit.css's transition:none can't suppress it)
    var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function frame() {
      if (el.dataset.dismissing) { rafId = 0; return; }   // closed by hand mid-run
      var left = remaining - (performance.now() - segmentStart);
      if (left <= 0) { bar.style.transform = "scaleX(0)"; dismissToast(el); return; }
      var scale = left / TOAST_TTL;
      bar.style.transform = "scaleX(" + (reduce ? Math.ceil(scale * 10) / 10 : scale) + ")";
      rafId = requestAnimationFrame(frame);
    }
    function freeze() {                       // hover/focus enter
      if (++held > 1 || !rafId) return;       // already frozen / not running
      cancelAnimationFrame(rafId);
      rafId = 0;
      remaining -= performance.now() - segmentStart;   // bank the consumed slice
    }
    function thaw() {                         // hover/focus leave
      if (held > 0) held--;
      if (held > 0 || rafId || el.dataset.dismissing) return;
      segmentStart = performance.now();
      rafId = requestAnimationFrame(frame);
    }

    el.addEventListener("mouseenter", freeze);
    el.addEventListener("mouseleave", thaw);
    el.addEventListener("focusin", freeze);   // keyboard hover — same freeze
    el.addEventListener("focusout", thaw);
    segmentStart = performance.now();
    rafId = requestAnimationFrame(frame);
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
    // errors sticky — operator dismisses by hand; success/info/warning auto-expire
    // via a hover-pausable 100%→0% countdown bar
    if (sev !== "error") startToastCountdown(el);
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

  // ── 7. Invalid-field highlight ────────────────────────────────────────────
  //   The server marks every rejected field with [data-error-field] — both the
  //   inline per-field <span class="error"> (full-page save re-render) and the
  //   <li> rows in the validate partial (kit/_validation.html). For each marked
  //   name, add .is-invalid to its control so the wrong field is visibly flagged
  //   (kit.css paints the red outline). Clear-then-set on page load AND after
  //   every htmx swap, so a re-validate that now passes drops the stale highlight.
  function markInvalidField(name) {
    if (!name) return;
    try {
      // kit-macro forms wrap the control in [data-field] — flag the wrapper
      var field = document.querySelector('[data-field="' + name + '"]');
      if (field) { field.classList.add("is-invalid"); return; }
      // bespoke forms (no wrapper) + keyed-map base paths → flag the control by name
      var control = document.querySelector('[name="' + name + '"]')
        || document.querySelector('[name^="' + name + '."]');
      if (control) control.classList.add("is-invalid");
    } catch (err) { /* field name is not a valid selector — skip it */ }
  }

  function refreshInvalidFields() {
    document.querySelectorAll(".is-invalid").forEach(function (el) {
      el.classList.remove("is-invalid");
    });
    var seen = {};
    document.querySelectorAll("[data-error-field]").forEach(function (marker) {
      var name = marker.getAttribute("data-error-field");
      if (name && !seen[name]) { seen[name] = true; markInvalidField(name); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshInvalidFields);
  } else {
    refreshInvalidFields();
  }
  document.addEventListener("htmx:afterSwap", refreshInvalidFields);

  // ── 8. datetime-local UTC bridge ──────────────────────────────────────────
  //   A [data-utc-local] picker shows the operator's LOCAL time; its paired
  //   hidden [data-utc-value] (same cell) always holds the UTC value that posts.
  //   The server speaks UTC; the browser converts to/from local with native Date
  //   (no library needed). On load each picker is filled from its hidden's UTC
  //   value; on every edit the hidden is rewritten back to UTC.
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function toLocalInput(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
      "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  function pairedHidden(picker) {
    return picker.parentNode && picker.parentNode.querySelector("[data-utc-value]");
  }

  function fillLocalFromUtc(picker) {
    var hidden = pairedHidden(picker);
    if (!hidden || !hidden.value) return;                 // empty → leave blank
    var iso = hidden.value;
    if (iso.charAt(iso.length - 1) !== "Z") iso += "Z";   // server sends naive UTC
    var d = new Date(iso);
    if (!isNaN(d.getTime())) picker.value = toLocalInput(d);
  }

  function syncUtcFromLocal(picker) {
    var hidden = pairedHidden(picker);
    if (!hidden) return;
    if (!picker.value) { hidden.value = ""; return; }     // cleared → unchanged on save
    var d = new Date(picker.value);                       // parsed as local wall-clock
    if (!isNaN(d.getTime())) hidden.value = d.toISOString().slice(0, 19);  // UTC, no ms/Z
  }

  function initUtcPickers(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("[data-utc-local]").forEach(fillLocalFromUtc);
  }

  // delegation covers cloned table rows added after load
  document.addEventListener("input", function (e) {
    var picker = e.target.closest && e.target.closest("[data-utc-local]");
    if (picker) syncUtcFromLocal(picker);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { initUtcPickers(); });
  } else {
    initUtcPickers();
  }
  document.addEventListener("htmx:afterSwap", function (e) {
    if (e.detail && e.detail.target) initUtcPickers(e.detail.target);
  });

  // ── 9. Modal dialogs (kit/_modal.html) ────────────────────────────────────
  //   [data-open-modal="<id>"] → showModal() that <dialog>; [data-close-modal]
  //   inside a [data-modal] dialog → close() it; a click that lands on the
  //   <dialog> element itself (its padded card swallows content clicks) is the
  //   backdrop → close. Esc is native. No-op when a page has no modals — both
  //   dashboards share this file and both mount kit dialogs.
  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-open-modal]");
    if (opener) {
      var dlg = document.getElementById(opener.getAttribute("data-open-modal"));
      if (dlg && typeof dlg.showModal === "function") {
        e.preventDefault();
        if (!dlg.open) dlg.showModal();
      }
      return;
    }
    var closer = e.target.closest("[data-close-modal]");
    if (closer) {
      var owner = closer.closest("dialog[data-modal]");
      if (owner) { e.preventDefault(); owner.close(); }
      return;
    }
    // backdrop: the event target is the <dialog> itself, never its inner card
    var backdrop = e.target.closest("dialog[data-modal]");
    if (backdrop && e.target === backdrop) backdrop.close();
  });

  //   A server-rendered dialog can ask to open on first paint via
  //   [data-open-on-load] (e.g. a rejected-save echo that must resurface the
  //   values the operator typed). Open it modally once the DOM is ready.
  function openFlaggedModals() {
    document.querySelectorAll("dialog[data-modal][data-open-on-load]").forEach(function (d) {
      if (typeof d.showModal === "function" && !d.open) d.showModal();
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", openFlaggedModals);
  } else {
    openFlaggedModals();
  }
  // same htmx:afterSwap hook the toast/invalid-field/utc initialisers use, so a
  // swapped-in flagged modal also opens (the !d.open guard makes it idempotent).
  document.addEventListener("htmx:afterSwap", openFlaggedModals);

  // ── 10. Required-field validation on submit ────────────────────────────────
  //   A control marked [data-required] (the form macro emits it for required
  //   fields) must be non-empty when its form is submitted — Save, or a modal's
  //   own submit (Add backend). On submit, flag every VISIBLE empty required
  //   control with .is-invalid (reusing section 7's red outline), toast the
  //   count, focus the first, and block the submit. HIDDEN controls — a closed
  //   dialog, a collapsed optional block, a reveal-gated field — are skipped, so
  //   an unrelated Save is never blocked by a field that is not on screen. A
  //   submit fired from inside a modal validates only that modal's required
  //   fields; a page-level Save validates the whole form. Stale flags clear as
  //   soon as the operator types into the field again.
  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function emptyRequiredIn(scope) {
    var bad = [];
    scope.querySelectorAll("[data-required]").forEach(function (el) {
      if (el.disabled || !isVisible(el)) return;          // not in play → don't block
      if ((el.value || "").trim() === "") bad.push(el);
    });
    return bad;
  }

  function flagInvalid(el, on) {
    var anchor = el.closest("[data-field]") || el;         // wrapper if kit-macro field
    anchor.classList[on ? "add" : "remove"]("is-invalid");
  }

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;
      // a modal's own submit button scopes validation to that dialog; otherwise
      // the whole form (closed-modal fields self-exclude via the visibility test).
      var scope = (e.submitter && e.submitter.closest("[data-modal]")) || form;
      var bad = emptyRequiredIn(scope);
      if (!bad.length) return;
      e.preventDefault();
      bad.forEach(function (el) { flagInvalid(el, true); });
      spawnToast(
        bad.length === 1 ? "A required field is empty" : bad.length + " required fields are empty",
        "error"
      );
      bad[0].focus();
    },
    true  // capture: run before the form's native submission / any bubble handler
  );

  // drop a field's red outline the moment it stops being empty
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el && el.hasAttribute && el.hasAttribute("data-required") && (el.value || "").trim() !== "") {
      flagInvalid(el, false);
    }
  });

  // ── 11. Confirm dialog (programmatic, Promise-based) ──────────────────────
  //   kitConfirm(opts) → Promise<boolean>. The modern replacement for blocking
  //   window.confirm: a native <dialog> built on demand (mirrors spawnToast §6),
  //   reusing the kit modal shell (.kit-modal/.kit-modal-card) so it inherits the
  //   border, backdrop blur, and top-layer focus trap for free. Cancel/Confirm
  //   call dlg.close(value); the promise resolves on the dialog's own `close`
  //   event, so Esc and a backdrop click (closed by §9 with returnValue "") both
  //   resolve false — one code path for every dismissal. opts:
  //     {title, message, confirmLabel, cancelLabel, danger}
  //   App code:  window.kitConfirm({…}).then(function (ok) { if (ok) … });
  function kitConfirm(opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var dlg = document.createElement("dialog");
      dlg.className = "kit-modal kit-confirm";
      dlg.setAttribute("data-modal", "");          // §9 backdrop/Esc close applies
      dlg.setAttribute("role", "alertdialog");
      dlg.setAttribute("aria-label", o.title || "Confirm");

      // no-<dialog> safety net (showModal absent) — never hit in current browsers
      if (typeof dlg.showModal !== "function") {
        resolve(window.confirm(o.message || o.title || ""));
        return;
      }

      var card = document.createElement("div");
      card.className = "kit-modal-card";

      var head = document.createElement("div");
      head.className = "kit-modal-head";
      var titles = document.createElement("div");
      titles.className = "head-titles";
      var h2 = document.createElement("h2");
      h2.textContent = o.title || "Are you sure?";
      titles.appendChild(h2);
      head.appendChild(titles);
      card.appendChild(head);

      var body = document.createElement("div");
      body.className = "kit-modal-body";
      var msg = document.createElement("p");
      msg.textContent = o.message || "";
      body.appendChild(msg);
      card.appendChild(body);

      var actions = document.createElement("div");
      actions.className = "kit-confirm-actions";

      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "kit-confirm-cancel";
      cancel.textContent = o.cancelLabel || "Cancel";
      cancel.addEventListener("click", function () { dlg.close("cancel"); });

      var ok = document.createElement("button");
      ok.type = "button";
      ok.className = "kit-confirm-ok" + (o.danger ? " danger" : "");
      ok.textContent = o.confirmLabel || "Confirm";
      ok.addEventListener("click", function () { dlg.close("confirm"); });

      actions.appendChild(cancel);
      actions.appendChild(ok);
      card.appendChild(actions);
      dlg.appendChild(card);
      document.body.appendChild(dlg);

      // single resolve path: button close(value), Esc/backdrop close → "" → false
      dlg.addEventListener("close", function () {
        var confirmed = dlg.returnValue === "confirm";
        if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
        resolve(confirmed);
      });

      dlg.showModal();
      (o.danger ? cancel : ok).focus();            // pre-select the safe choice
    });
  }

  // ── 12. Filesystem picker → chip list (E152-S03) ──────────────────────────
  //   A kit-driven picker (folderPicker/filesPicker rendered with kit_driven=True,
  //   so its .kit-picker chrome carries [data-kit-picker]) appends the picked
  //   path(s) as non-editable chips into a picker_list. This is the list-sink half
  //   of DP's reference_browse.js, generalised: load the [data-browse-url] JSON
  //   listing, navigate (dirs drill in, files tick), and on Select clone the target
  //   list's [data-chip-template] into [data-chips] with value dedupe. An app's
  //   OWN sink=input pickers (no [data-kit-picker]) are left to the app driver — we
  //   never touch them. No new wire: chips post as list.<name>.item[] like any
  //   string_list. kit.js §9 opens the dialog; this only fills + delivers.
  function appendPickerChip(target, value) {
    var fs = document.querySelector('[data-list="' + target + '"]');
    if (!fs) return;
    var chips = fs.querySelector("[data-chips]");
    var tmpl = fs.querySelector("[data-chip-template]");
    if (!chips || !tmpl) return;
    var existing = chips.querySelectorAll('input[type="hidden"][name="list.' + target + '.item"]');
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].value === value) return;    // dedupe against rows already added
    }
    chips.insertAdjacentHTML("beforeend", tmpl.innerHTML);
    var row = chips.lastElementChild;
    var input = row.querySelector('input[type="hidden"]');
    if (input) input.value = value;               // hidden field carries the value to POST
    var label = row.querySelector("[data-picker-path]");
    if (label) label.textContent = value;         // visible static path
    var del = row.querySelector("[data-remove]");
    if (del) del.setAttribute("aria-label", "Remove " + value);  // value-specific for AT nav
  }

  function wirePicker(host) {
    var dlg = host.closest("dialog");
    if (!dlg) return;
    var crumbs = host.querySelector("[data-picker-crumbs]");
    var listEl = host.querySelector("[data-picker-list]");
    var emptyEl = host.querySelector("[data-picker-empty]");
    var selectBtn = host.querySelector("[data-picker-select]");
    var browseUrl = host.getAttribute("data-browse-url");
    var mode = host.getAttribute("data-picker-mode") === "file" ? "file" : "folder";
    var state = { target: "", path: "", checked: {} };
    if (!listEl || !selectBtn) return;

    // delegated: an Add button that targets THIS dialog (kit.js §9 also opens it)
    document.addEventListener("click", function (e) {
      var btn = e.target.closest('[data-picker-open][data-open-modal="' + dlg.id + '"]');
      if (!btn) return;
      state.target = btn.getAttribute("data-picker-target") || "";
      state.checked = {};
      selectBtn.textContent = mode === "file" ? "Select files" : "Select this folder";
      load("");
    });

    selectBtn.addEventListener("click", function () {
      // folder: the current dir ("." = root, never "" — a parser rejects empty)
      var picks = mode === "file" ? Object.keys(state.checked) : [state.path || "."];
      picks.forEach(function (p) { appendPickerChip(state.target, p); });
      if (typeof dlg.close === "function") dlg.close();
    });

    function load(path) {
      var url = browseUrl + "?path=" + encodeURIComponent(path) + "&mode=" + mode;
      fetch(url, { headers: { Accept: "application/json" } })
        .then(function (r) { if (!r.ok) throw new Error("browse"); return r.json(); })
        .then(function (data) { if (data.error) throw new Error(data.error); render(data); })
        .catch(function () {
          if (window.kitToast) window.kitToast("Could not browse that folder.", "error");
        });
    }

    function render(data) {
      state.path = data.path;
      state.checked = {};
      selectBtn.disabled = mode === "file";       // folder mode: always selectable
      renderCrumbs(data.path);
      listEl.textContent = "";
      if (data.parent !== null && data.parent !== undefined) listEl.appendChild(upRow(data.parent));
      data.entries.forEach(function (en) { listEl.appendChild(entryRow(en)); });
      if (emptyEl) emptyEl.hidden = data.entries.length > 0;
    }

    function renderCrumbs(path) {
      if (!crumbs) return;
      crumbs.textContent = "";
      crumbs.appendChild(crumb("project", ""));
      var acc = "";
      (path ? path.split("/") : []).forEach(function (seg) {
        acc = acc ? acc + "/" + seg : seg;
        crumbs.appendChild(document.createTextNode(" / "));
        crumbs.appendChild(crumb(seg, acc));
      });
    }

    function crumb(label, path) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "kit-picker-crumb";
      b.textContent = label;
      b.addEventListener("click", function () { load(path); });
      return b;
    }

    function upRow(parent) {
      var li = document.createElement("li");
      li.className = "kit-picker-row kit-picker-dir";
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "‹ ..";
      b.addEventListener("click", function () { load(parent); });
      li.appendChild(b);
      return li;
    }

    function entryRow(en) {
      var li = document.createElement("li");
      li.className = "kit-picker-row kit-picker-" + en.type;
      if (en.type === "dir") {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = "📁 " + en.name;
        b.addEventListener("click", function () { load(en.path); });
        li.appendChild(b);
      } else {
        var lab = document.createElement("label");
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.addEventListener("change", function () {
          if (cb.checked) state.checked[en.path] = true;
          else delete state.checked[en.path];
          selectBtn.disabled = Object.keys(state.checked).length === 0;
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(" 📄 " + en.name));
        li.appendChild(lab);
      }
      return li;
    }
  }

  document.querySelectorAll(".kit-picker[data-kit-picker]").forEach(wirePicker);

  // ── 13. Per-row format-select reveal (E152-S04) ───────────────────────────
  //   A collection row can carry a [data-format-select] (the kit cell kind
  //   "format-select") whose value reveals a scoped subset of that same row's cells:
  //   each grouped cell is [data-format-group="<value>"] and shows only when it
  //   matches the select. First paint is server-driven (the macro renders the
  //   matching group visible, the rest hidden — no flash-then-hide); this syncs on
  //   every change and, via §3's add-row hook, immediately on a freshly cloned row,
  //   so a chosen format never leaves a required field unseen behind a save ("No
  //   save-to-reveal. Ever." — DP CLAUDE.md). No wire change: every cell posts as
  //   an ordinary kmap/olist cell whether shown or hidden.
  function syncFormatSelect(sel) {
    var row = sel.closest("tr, .nmap-row");
    if (!row) return;
    row.querySelectorAll("[data-format-group]").forEach(function (g) {
      g.hidden = g.getAttribute("data-format-group") !== sel.value;
    });
  }
  function syncFormatRow(row) {
    if (!row || !row.querySelectorAll) return;
    row.querySelectorAll("[data-format-select]").forEach(syncFormatSelect);
  }
  document.querySelectorAll("[data-format-select]").forEach(syncFormatSelect);
  document.addEventListener("change", function (e) {
    var sel = e.target.closest("[data-format-select]");
    if (sel) syncFormatSelect(sel);
  });

  // ── 14. Theme toggle (dark/light) ──────────────────────────────────────────
  //   [data-action="toggle-theme"] (kit/_icon_btn.html, rendered once per page in
  //   kit/_header.html's page_head — the header's .actions slot always carries it)
  //   flips <html data-theme> between the hard default (DARK — attribute absent)
  //   and "light", persists the choice in localStorage under THEME_KEY, and keeps
  //   every such button's aria-pressed + title/aria-label in sync with reality.
  //   THEME_KEY must match the anti-flash inline <script> in kit/layouts/base.html
  //   <head> — that script runs synchronously before first paint and stamps
  //   data-theme itself, so by the time this (deferred) script runs the attribute
  //   already reflects the stored choice. Every button still needs a sync pass on
  //   load regardless: the server always renders aria-pressed="true" (it has no
  //   way to see localStorage at render time), so a returning light-mode operator
  //   would otherwise see a sun icon claiming "dark is active" while the page is
  //   actually light. One delegated click handler (works on a button added at any
  //   time — htmx-swapped or not, same reasoning as every other data-action
  //   handler in this file); explicit re-sync on htmx:afterSwap because a
  //   swapped-in fragment can carry a fresh SSR-default button of its own.
  var THEME_KEY = "theme";

  function isDarkActive() {
    return document.documentElement.getAttribute("data-theme") !== "light";
  }

  function syncThemeButton(btn) {
    var dark = isDarkActive();
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    var label = dark ? "Switch to light theme" : "Switch to dark theme";
    btn.setAttribute("title", label);
    btn.setAttribute("aria-label", label);
  }

  function syncThemeButtons(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-action="toggle-theme"]').forEach(syncThemeButton);
  }

  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      try { localStorage.setItem(THEME_KEY, "light"); } catch (e) { /* private mode etc — still applies for this load */ }
    } else {
      // dark is the hard default — keep the attribute ABSENT, not "dark", so a
      // page with no stored choice at all renders byte-identically to before
      // this feature existed (see base.html's anti-flash script).
      document.documentElement.removeAttribute("data-theme");
      try { localStorage.removeItem(THEME_KEY); } catch (e) { /* private mode etc */ }
    }
    syncThemeButtons(document);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest('[data-action="toggle-theme"]');
    if (!btn) return;
    e.preventDefault();
    applyTheme(isDarkActive() ? "light" : "dark");
  });

  syncThemeButtons(document);   // correct the SSR-default aria-pressed/label on load
  document.addEventListener("htmx:afterSwap", function (e) {
    if (e.detail && e.detail.target) syncThemeButtons(e.detail.target);
  });

  // Supported programmatic surface for app scripts — the IIFE keeps everything
  // else private. kitToast mirrors §6 so pages stop hand-rolling toast nodes.
  window.kitConfirm = kitConfirm;
  window.kitToast = spawnToast;

})();

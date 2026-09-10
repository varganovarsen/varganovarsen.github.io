// Dev-only annotation layer: point at an element, type what is wrong with it,
// and the note lands in REVIEW.md with a selector that identifies it later.
// Shift+click collects several elements into one note.
// Loaded only by `astro dev` (see src/plugins/review-notes.mjs).

const ENDPOINT = "/__review-note";

let armed = false;
let hovered = null;
let saved = 0;
/** Elements gathered with Shift+click, all going into the next note. */
const picked = [];

// --- chrome ---------------------------------------------------------------

const style = document.createElement("style");
style.textContent = `
  /* Our chrome lives in the top layer — popovers, and a dialog for the form —
     so undo the UA styling that comes with that and keep the rules below in
     charge. */
  #rn-bar, #rn-halo, #rn-tag, #rn-form, .rn-pick {
    inset: auto; width: auto; height: auto;
    max-width: none; max-height: none; margin: 0; padding: 0;
    border: 0; background: none; color: inherit; overflow: visible;
  }
  /* The form is modal, but nothing behind it should dim. */
  #rn-form::backdrop { background: transparent; }
  #rn-bar {
    position: fixed; left: 12px; bottom: 12px; z-index: 2147483646;
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border-radius: 999px;
    border: 1px solid #5c606d; background: #191c24; color: #e7e7ea;
    font: 13px/1.3 system-ui, sans-serif; cursor: pointer;
    box-shadow: 0 6px 20px rgba(0,0,0,.5);
  }
  #rn-bar[data-armed="true"] { border-color: #f2b64c; color: #f2b64c; }
  #rn-bar kbd {
    font: inherit; opacity: .6; border: 1px solid currentColor;
    border-radius: 4px; padding: 0 4px;
  }
  #rn-halo, .rn-pick {
    position: fixed; z-index: 2147483645; pointer-events: none;
    border-radius: 4px;
  }
  #rn-halo {
    border: 2px solid #f2b64c; background: rgba(242,182,76,.12);
  }
  .rn-pick {
    border: 2px solid #7dd3a8; background: rgba(125,211,168,.14);
  }
  .rn-pick::after {
    content: attr(data-index);
    position: absolute; top: -10px; left: -10px;
    width: 20px; height: 20px; border-radius: 50%;
    background: #7dd3a8; color: #14161c;
    font: 600 12px/20px system-ui, sans-serif; text-align: center;
  }
  #rn-tag {
    position: fixed; z-index: 2147483645; pointer-events: none;
    padding: 2px 6px; border-radius: 4px; background: #f2b64c; color: #14161c;
    font: 11px/1.4 ui-monospace, monospace; max-width: 60vw;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #rn-form {
    position: fixed; z-index: 2147483647; width: min(380px, 90vw);
    padding: 10px; border-radius: 10px;
    border: 1px solid #f2b64c; background: #14161c;
    box-shadow: 0 10px 30px rgba(0,0,0,.6);
  }
  #rn-form textarea {
    width: 100%; height: 80px; resize: vertical; box-sizing: border-box;
    border: 1px solid #2f333d; border-radius: 6px;
    background: #0a0b0e; color: #e7e7ea; padding: 8px;
    font: 13px/1.45 system-ui, sans-serif;
  }
  #rn-form textarea:focus { outline: 2px solid #f2b64c; outline-offset: 1px; }
  #rn-hint {
    margin-top: 6px; color: #9a9ba5;
    font: 11px/1.4 system-ui, sans-serif;
  }
  #rn-target {
    margin-bottom: 6px; max-height: 76px; overflow-y: auto;
    color: #f2b64c; font: 11px/1.5 ui-monospace, monospace;
  }
  #rn-target div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
document.head.append(style);

const bar = el("div", { id: "rn-bar", title: "Alt+A", popover: "manual" });
const halo = el("div", { id: "rn-halo", popover: "manual" });
const tag = el("div", { id: "rn-tag", popover: "manual" });
// A modal dialog inerts everything outside itself — top-layer popovers included —
// so the note form has to be a modal dialog of its own to stay typeable while the
// site's drawer or lightbox is open. Opened last, it is the topmost one and wins.
const form = el("dialog", { id: "rn-form" });
const targetLine = el("div", { id: "rn-target" });
const input = el("textarea", { placeholder: "Что не так с этим элементом?" });
const hint = el("div", { id: "rn-hint" });
hint.textContent =
  "Shift+клик — добавить ещё элемент · Enter — сохранить · Esc — отмена";
form.append(targetLine, input, hint);
document.body.append(bar, halo, tag, form);
show(bar);

function el(tagName, props = {}) {
  return Object.assign(document.createElement(tagName), props);
}

// --- top layer ------------------------------------------------------------

// The site opens its drawer and its lightbox with `showModal()`, which paints
// them in the top layer and marks the rest of the document inert — an ordinary
// overlay would be hidden behind them. The read-only chrome is popovers (same
// top layer, painted above); the form, which has to be clicked into, is a modal
// dialog — see where it is created.

function show(node) {
  if (!node.matches(":popover-open")) node.showPopover();
}

function hide(node) {
  if (node.matches(":popover-open")) node.hidePopover();
}

// A dialog opened after us lands on top of us; re-showing climbs back over it.
// Not while the form is open, though — the form is a dialog too, and raising the
// outlines over the note being written is exactly what we do not want.
function raise() {
  if (form.open) return;
  for (const node of [bar, ...document.querySelectorAll(".rn-pick"), halo, tag]) {
    if (node.matches(":popover-open")) {
      node.hidePopover();
      node.showPopover();
    }
  }
}

new MutationObserver(raise).observe(document.documentElement, {
  subtree: true,
  attributeFilter: ["open"],
});

function paintBar() {
  bar.dataset.armed = String(armed);
  bar.innerHTML = "";
  const label = !armed
    ? "Разметка выключена"
    : picked.length
      ? `Выбрано: ${picked.length} · клик — написать замечание`
      : "Разметка: наведи и кликни";
  bar.append(document.createTextNode(label), el("kbd", { textContent: "Alt+A" }));
  if (saved) bar.append(el("span", { textContent: `· ${saved}` }));
}
paintBar();

// --- selecting ------------------------------------------------------------

bar.addEventListener("click", () => setArmed(!armed));

addEventListener("keydown", (event) => {
  if (event.altKey && event.code === "KeyA") {
    event.preventDefault();
    setArmed(!armed);
  } else if (event.key === "Escape" && armed) {
    if (form.open) {
      event.preventDefault();
      event.stopPropagation();
      closeForm();
    } else if (picked.length) {
      event.preventDefault();
      event.stopPropagation();
      clearPicked();
    }
  }
});

function setArmed(on) {
  armed = on;
  if (!on) {
    hovered = null;
    hide(halo);
    hide(tag);
    closeForm();
    clearPicked();
  }
  paintBar();
}

addEventListener(
  "mousemove",
  (event) => {
    if (!armed || form.open) return;
    const node = document.elementFromPoint(event.clientX, event.clientY);
    if (!node || node === hovered || ours(node)) return;
    hovered = node;
    frame(node);
  },
  true
);

function frame(node) {
  const box = node.getBoundingClientRect();
  show(halo);
  Object.assign(halo.style, {
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
  tag.textContent = selectorFor(node);
  show(tag);
  // Above the element, unless that would run off the top of the screen.
  tag.style.left = `${Math.max(4, box.left)}px`;
  tag.style.top = box.top > 22 ? `${box.top - 20}px` : `${box.bottom + 4}px`;
}

// Capture phase, so the note is taken instead of the site's own click handler
// opening a drawer or a lightbox.
addEventListener(
  "click",
  (event) => {
    if (!armed || ours(event.target)) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.shiftKey) {
      togglePicked(event.target);
      return;
    }
    openForm(event.target, event.clientX, event.clientY);
  },
  true
);

// Shift+click would otherwise extend the text selection under the overlay.
addEventListener("mousedown", (event) => {
  if (armed && event.shiftKey && !ours(event.target)) event.preventDefault();
}, true);

function ours(node) {
  return Boolean(node.closest?.("#rn-bar, #rn-form"));
}

// --- multi-select ---------------------------------------------------------

function togglePicked(node) {
  const at = picked.indexOf(node);
  if (at === -1) picked.push(node);
  else picked.splice(at, 1);
  paintPicked();
  paintBar();
}

function clearPicked() {
  picked.length = 0;
  paintPicked();
  paintBar();
}

// One outline per picked element, redrawn whenever the page moves under them.
function paintPicked() {
  document.querySelectorAll(".rn-pick").forEach((box) => box.remove());
  picked.forEach((node, index) => {
    const box = node.getBoundingClientRect();
    const marker = el("div", { className: "rn-pick", popover: "manual" });
    marker.dataset.index = String(index + 1);
    Object.assign(marker.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
    document.body.append(marker);
    show(marker);
  });
}

addEventListener("scroll", () => picked.length && paintPicked(), true);
addEventListener("resize", () => picked.length && paintPicked());

// --- writing the note -----------------------------------------------------

/** Every element the open form is about: the picked ones plus the clicked one. */
let subjects = [];

function openForm(node, x, y) {
  subjects = picked.includes(node) ? [...picked] : [...picked, node];
  targetLine.replaceChildren(
    ...subjects.map((subject, index) =>
      el("div", {
        textContent:
          (subjects.length > 1 ? `${index + 1}. ` : "") + selectorFor(subject),
      })
    )
  );
  input.value = "";
  form.showModal();
  form.style.left = `${Math.min(x, innerWidth - form.offsetWidth - 12)}px`;
  form.style.top = `${Math.min(y + 12, innerHeight - form.offsetHeight - 12)}px`;
  input.focus();
}

function closeForm() {
  if (form.open) form.close();
  subjects = [];
}

// Escape reaches the form as `cancel`, since it is the topmost modal.
form.addEventListener("cancel", () => {
  subjects = [];
});

// Clicking away from the form — its own backdrop — drops the note.
form.addEventListener("click", (event) => {
  if (event.target === form) closeForm();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

async function send() {
  const text = input.value.trim();
  if (!text || !subjects.length) return closeForm();

  const note = {
    text,
    targets: subjects.map((subject) => ({
      selector: selectorFor(subject),
      label: (subject.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    })),
    page: location.pathname + location.search,
    title: document.title,
    viewport: `${innerWidth}×${innerHeight}`,
  };
  closeForm();
  clearPicked();

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(note),
    });
    if (!response.ok) throw new Error(String(response.status));
    saved += 1;
    paintBar();
    flash("Записано в REVIEW.md");
  } catch (error) {
    flash(`Не сохранилось: ${error.message}`, true);
  }
}

let flashTimer;
function flash(message, bad = false) {
  bar.dataset.armed = String(armed);
  bar.innerHTML = "";
  bar.append(document.createTextNode(bad ? `⚠ ${message}` : `✓ ${message}`));
  clearTimeout(flashTimer);
  flashTimer = setTimeout(paintBar, 1800);
}

// --- selectors ------------------------------------------------------------

// Short, human-readable path. Not guaranteed unique, but it is meant to be read
// by a person, and the surrounding text in the note pins down which one it is.
function selectorFor(node) {
  const parts = [];
  for (let cur = node; cur && cur !== document.body && parts.length < 4; cur = cur.parentElement) {
    if (cur.id) {
      parts.unshift(`#${cur.id}`);
      break;
    }
    let part = cur.localName;
    const cls = [...cur.classList].find((name) => !name.startsWith("astro-"));
    if (cls) part += `.${cls}`;
    const twins = [...(cur.parentElement?.children ?? [])].filter(
      (sibling) => sibling.localName === cur.localName
    );
    if (twins.length > 1) part += `:nth-of-type(${twins.indexOf(cur) + 1})`;
    parts.unshift(part);
  }
  return parts.join(" > ");
}

// Dev-only annotation layer: point at an element, type what is wrong with it,
// and the note lands in REVIEW.md with a selector that identifies it later.
// Loaded only by `astro dev` (see src/plugins/review-notes.mjs).

const ENDPOINT = "/__review-note";

let armed = false;
let hovered = null;
let saved = 0;

// --- chrome ---------------------------------------------------------------

const style = document.createElement("style");
style.textContent = `
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
  #rn-halo {
    position: fixed; z-index: 2147483645; pointer-events: none;
    border: 2px solid #f2b64c; border-radius: 4px;
    background: rgba(242,182,76,.12); display: none;
  }
  #rn-tag {
    position: fixed; z-index: 2147483645; pointer-events: none; display: none;
    padding: 2px 6px; border-radius: 4px; background: #f2b64c; color: #14161c;
    font: 11px/1.4 ui-monospace, monospace; max-width: 60vw;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #rn-form {
    position: fixed; z-index: 2147483647; display: none; width: min(360px, 90vw);
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
    margin-bottom: 6px; color: #f2b64c;
    font: 11px/1.4 ui-monospace, monospace;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
`;
document.head.append(style);

const bar = el("div", { id: "rn-bar", title: "Alt+A" });
const halo = el("div", { id: "rn-halo" });
const tag = el("div", { id: "rn-tag" });
const form = el("div", { id: "rn-form" });
const targetLine = el("div", { id: "rn-target" });
const input = el("textarea", { placeholder: "Что не так с этим элементом?" });
const hint = el("div", { id: "rn-hint" });
hint.textContent = "Enter — сохранить · Shift+Enter — перенос строки · Esc — отмена";
form.append(targetLine, input, hint);
document.body.append(bar, halo, tag, form);

function el(tagName, props = {}) {
  return Object.assign(document.createElement(tagName), props);
}

function paintBar() {
  bar.dataset.armed = String(armed);
  bar.innerHTML = "";
  bar.append(
    document.createTextNode(
      armed ? "Разметка: наведи и кликни" : "Разметка выключена"
    ),
    el("kbd", { textContent: "Alt+A" })
  );
  if (saved) bar.append(el("span", { textContent: `· ${saved}` }));
}
paintBar();

// --- selecting ------------------------------------------------------------

bar.addEventListener("click", () => setArmed(!armed));

addEventListener("keydown", (event) => {
  if (event.altKey && event.code === "KeyA") {
    event.preventDefault();
    setArmed(!armed);
  } else if (event.key === "Escape" && form.style.display === "block") {
    event.preventDefault();
    event.stopPropagation();
    closeForm();
  }
});

function setArmed(on) {
  armed = on;
  if (!on) {
    hovered = null;
    halo.style.display = tag.style.display = "none";
    closeForm();
  }
  paintBar();
}

addEventListener(
  "mousemove",
  (event) => {
    if (!armed || form.style.display === "block") return;
    const node = document.elementFromPoint(event.clientX, event.clientY);
    if (!node || node === hovered || ours(node)) return;
    hovered = node;
    frame(node);
  },
  true
);

function frame(node) {
  const box = node.getBoundingClientRect();
  Object.assign(halo.style, {
    display: "block",
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  });
  tag.textContent = selectorFor(node);
  tag.style.display = "block";
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
    openForm(event.target, event.clientX, event.clientY);
  },
  true
);

function ours(node) {
  return Boolean(node.closest?.("#rn-bar, #rn-form"));
}

// --- writing the note -----------------------------------------------------

let subject = null;

function openForm(node, x, y) {
  subject = node;
  targetLine.textContent = selectorFor(node);
  input.value = "";
  form.style.display = "block";
  form.style.left = `${Math.min(x, innerWidth - form.offsetWidth - 12)}px`;
  form.style.top = `${Math.min(y + 12, innerHeight - form.offsetHeight - 12)}px`;
  input.focus();
}

function closeForm() {
  form.style.display = "none";
  subject = null;
}

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

async function send() {
  const text = input.value.trim();
  if (!text || !subject) return closeForm();

  const note = {
    text,
    selector: selectorFor(subject),
    label: (subject.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    page: location.pathname + location.search,
    title: document.title,
    viewport: `${innerWidth}×${innerHeight}`,
  };
  closeForm();

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

// Link syntax that survives the Keystatic editor. On save it escapes brackets
// and turns pasted addresses into links, so both forms are read from the text
// after markdown has been parsed, never from the raw file:
//
//   {Goops|https://arsvarg.itch.io/goops}
//     a chip, anywhere in a sentence
//   |Intersectio|https://store.steampowered.com/app/4240840/|Геймдизайнер, программист|
//     a panel on a line of its own; the third cell (the role) is optional
//   https://arsvarg.itch.io/goops
//     a bare URL becomes a chip showing the address
//
// A paragraph of nothing but chips becomes a row; consecutive panels share a
// block. Runs after remark-media, which leaves these paragraphs alone.

import { STEAM_MARK } from "./remark-media.mjs";

const EXTERNAL = /^https?:\/\//i;
const STEAM = /^https?:\/\/store\.steampowered\.com\//i;

// Stands in for anything that is not text (emphasis, code, a line break), so
// the syntax never reaches across it.
const OPAQUE = "\uE000";
const CHIP = /\{([^{}|]+)\|([^{}]+)\}/g;
const PANEL = /^\s*\|([^|]+)\|([^|]+)\|(?:([^|]*)\|)?\s*$/;
// The editor may leave the address wrapped as [url](url); take the first one.
const ADDRESS = /https?:\/\/[^\s[\]()<>{}|]+|\/[^\s[\]()<>{}|]*/;

const ARROW =
  '<svg class="link-chip-arrow" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">' +
  '<path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.6" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Chip nodes made here, so a paragraph can be recognised as chips only.
const chipNodes = new WeakSet();

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textOf(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function addressIn(value) {
  return value.match(ADDRESS)?.[0] ?? null;
}

// Only links leaving the site open a new tab.
function hrefAttrs(url) {
  return (
    `href="${escapeHtml(url)}"` + (EXTERNAL.test(url) ? ` target="_blank" rel="noopener"` : "")
  );
}

// --- Chips ---

function chipNode(url, label) {
  let body;
  if (label) {
    body = `<span class="link-chip-label">${escapeHtml(label)}</span>`;
  } else {
    let host = url;
    let path = "";
    try {
      const parsed = new URL(url);
      host = parsed.hostname.replace(/^www\./, "");
      // The query string is tracking noise more often than not (?usp=drive_link).
      path = parsed.pathname.replace(/\/$/, "");
    } catch {
      // A site-relative path: show it whole.
    }
    body =
      `<span class="link-chip-host">${escapeHtml(host)}</span>` +
      (path ? `<span class="link-chip-path">${escapeHtml(path)}</span>` : "");
  }

  const node = {
    type: "html",
    value: `<a class="link-chip" ${hrefAttrs(url)}>${body}${EXTERNAL.test(url) ? ARROW : ""}</a>`,
  };
  chipNodes.add(node);
  return node;
}

// The WYSIWYG editor writes a pasted URL as [url](url); the text may also drop
// the scheme or the trailing slash and still be the same address.
function bareness(value) {
  return value.trim().replace(EXTERNAL, "").replace(/\/$/, "");
}

function isBare(node) {
  return (
    node.type === "link" &&
    EXTERNAL.test(node.url) &&
    bareness(textOf(node)) === bareness(node.url)
  );
}

// {label|url} may be split over several nodes: text, the auto-linked address,
// text again. Lay the children out as one string, find the chips in it, then
// rebuild the children around them, cutting text nodes where a chip begins or ends.
function replaceBraces(parent) {
  let flat = "";
  const spans = [];
  for (const child of parent.children) {
    const start = flat.length;
    flat += child.type === "text" ? child.value : child.type === "link" ? child.url : OPAQUE;
    spans.push({ child, start, end: flat.length });
  }

  const matches = [...flat.matchAll(CHIP)]
    .map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      label: match[1].trim(),
      url: addressIn(match[2]),
    }))
    .filter((match) => match.label && match.url);
  if (!matches.length) return;

  const children = [];
  const keep = (from, to) => {
    for (const { child, start, end } of spans) {
      if (end <= from || start >= to) continue;
      if (child.type === "text") {
        const value = child.value.slice(Math.max(from, start) - start, Math.min(to, end) - start);
        if (value) children.push({ type: "text", value });
      } else if (start >= from && end <= to) {
        children.push(child);
      }
    }
  };

  let cursor = 0;
  for (const match of matches) {
    keep(cursor, match.start);
    children.push(chipNode(match.url, match.label));
    cursor = match.end;
  }
  keep(cursor, flat.length);
  parent.children = children;
}

function replaceChips(node) {
  if (!node.children || node.type === "link") return;
  replaceBraces(node);
  node.children = node.children.map((child) => {
    if (isBare(child)) return chipNode(child.url, "");
    replaceChips(child);
    return child;
  });
}

function chipRow(node) {
  if (node.type !== "paragraph") return null;
  const parts = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === "") && child.type !== "break"
  );
  return parts.length && parts.every((child) => chipNodes.has(child)) ? parts : null;
}

// --- Panels ---

function panelOf(node) {
  if (node.type !== "paragraph") return null;
  const flat = node.children
    .map((child) => (child.type === "text" ? child.value : child.type === "link" ? child.url : OPAQUE))
    .join("");
  const match = flat.match(PANEL);
  const url = match && addressIn(match[2]);
  if (!url || !match[1].trim()) return null;
  return { label: match[1].trim(), url, role: (match[3] ?? "").trim() };
}

// Same markup as the Steam bar remark-media builds, so it shares its styles.
function panelHtml({ label, url, role }) {
  const mark = STEAM.test(url) ? STEAM_MARK : "";
  return (
    `<div class="release${role ? "" : " release-solo"}">` +
    `<a class="steam-link" ${hrefAttrs(url)}>${mark}<span>${escapeHtml(label)}</span></a>` +
    (role ? `<p class="release-role">${escapeHtml(role)}</p>` : "") +
    `</div>`
  );
}

export default function remarkLinks() {
  return (tree) => {
    const out = [];
    let group = null;

    // Chips and panels that follow one another collect into one block.
    const add = (kind, html) => {
      if (group?.kind !== kind) {
        group = { kind, items: [], node: { type: "html", value: "" } };
        out.push(group.node);
      }
      group.items.push(html);
      const wrapper = kind === "panel" ? "steam-embeds" : "link-chips";
      group.node.value = `<div class="${wrapper}">${group.items.join("")}</div>`;
    };

    for (const node of tree.children) {
      const panel = panelOf(node);
      if (panel) {
        add("panel", panelHtml(panel));
        continue;
      }

      replaceChips(node);
      const chips = chipRow(node);
      if (chips) {
        for (const chip of chips) add("chips", chip.value);
        continue;
      }

      group = null;
      out.push(node);
    }

    tree.children = out;
  };
}

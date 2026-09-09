// Turns plain markdown into media tiles:
//   ![caption](/path/clip.mp4)      -> looping muted video
//   ![caption](/path/shot.png)      -> image tile
//   https://youtu.be/<id>           -> YouTube tile, iframe loaded on click
//   https://store.steampowered.com/app/<id>/ -> Steam card
// Several of them in one paragraph (no blank line between) render as a row.
// Markup matches what Base.astro styles and what its lightbox script expects.

import fs from "node:fs";
import path from "node:path";

const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const YOUTUBE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/;
const STEAM = /^https?:\/\/store\.steampowered\.com\/app\/(\d+)/;

const TYPE_LABEL = { image: "Скриншот", video: "Видео", youtube: "Видео на YouTube" };

// A video tile shows its poster before playback starts. Pick up an image sitting
// next to the file, e.g. clip.mp4 -> clip.jpg.
function findPoster(src) {
  if (!src.startsWith("/")) return null;
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const candidate = src.replace(VIDEO, ext);
    if (fs.existsSync(path.join("public", candidate))) return candidate;
  }
  // Otherwise fall back to the project's cover image.
  const cover = `${path.posix.dirname(src)}/cover.jpg`;
  return fs.existsSync(path.join("public", cover)) ? cover : null;
}

function escapeAttr(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textOf(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function fromUrl(url, caption) {
  if (VIDEO.test(url)) return { type: "video", src: url, caption };

  const youtubeId = url.match(YOUTUBE)?.[1];
  if (youtubeId) return { type: "youtube", id: youtubeId, caption };

  const steamId = url.match(STEAM)?.[1];
  if (steamId) return { type: "steam", id: steamId, url, caption };

  return null;
}

function asMedia(node) {
  if (node.type === "image") {
    const caption = node.alt || node.title || "";
    return fromUrl(node.url, caption) ?? { type: "image", src: node.url, caption };
  }

  if (node.type === "link") {
    // An image wrapped in a link to itself (Notion export style) is just the image.
    // A link pointing somewhere else keeps its target, so leave the paragraph alone.
    if (node.children?.length === 1 && node.children[0].type === "image") {
      const image = node.children[0];
      return image.url === node.url ? asMedia(image) : null;
    }

    // Link text that repeats the URL carries no caption.
    const label = textOf(node).trim();
    return fromUrl(node.url, label === node.url ? "" : label);
  }

  // A bare URL typed as plain text — the WYSIWYG editor produces these.
  if (node.type === "text") {
    const value = node.value.trim();
    // Anything with whitespace is prose, or several URLs we would silently drop.
    if (!value || /\s/.test(value)) return null;
    return fromUrl(value, "");
  }

  return null;
}

function tile(item) {
  const caption = item.caption ? `<figcaption>${escapeAttr(item.caption)}</figcaption>` : "";
  const badge = item.type === "image" ? "" : `<span class="media-badge">▶</span>`;
  const label = item.caption || TYPE_LABEL[item.type];

  let inner;
  if (item.type === "video") {
    // Playback starts when the tile scrolls into view (see Base.astro); the poster
    // keeps the tile from being a black rectangle until then.
    const poster = findPoster(item.src);
    inner =
      `<video src="${escapeAttr(item.src)}"${poster ? ` poster="${escapeAttr(poster)}"` : ""}` +
      ` muted loop playsinline preload="metadata"></video>`;
  } else if (item.type === "youtube") {
    inner =
      `<img src="https://i.ytimg.com/vi/${escapeAttr(item.id)}/maxresdefault.jpg"` +
      ` data-fallback="https://i.ytimg.com/vi/${escapeAttr(item.id)}/hqdefault.jpg"` +
      ` alt="${escapeAttr(label)}" width="1280" height="720" loading="lazy">`;
  } else {
    inner = `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(label)}" loading="lazy">`;
  }

  const data =
    item.type === "youtube"
      ? `data-type="youtube" data-id="${escapeAttr(item.id)}"`
      : `data-type="${item.type}" data-src="${escapeAttr(item.src)}"`;

  return (
    `<figure class="media-item">` +
    `<button class="media-thumb" type="button" ${data} aria-label="${escapeAttr(label)}">` +
    `${inner}${badge}</button>${caption}</figure>`
  );
}

// Valve's own store widget. Guessing the header image URL no longer works —
// the current one carries a content hash that only the store API knows — and
// the widget also brings the price and a working store button.
function steamCard(item) {
  const title = escapeAttr(item.caption || "Страница игры");
  return (
    `<iframe class="steam-widget" src="https://store.steampowered.com/widget/${escapeAttr(item.id)}/"` +
    ` title="${title} в Steam" width="646" height="190" frameborder="0" loading="lazy"></iframe>`
  );
}

// Enough of markdown's inline nodes to carry a caption over into HTML.
function inlineHtml(nodes = []) {
  return nodes
    .map((node) => {
      switch (node.type) {
        case "text":
          return escapeAttr(node.value);
        case "strong":
          return `<strong>${inlineHtml(node.children)}</strong>`;
        case "emphasis":
          return `<em>${inlineHtml(node.children)}</em>`;
        case "inlineCode":
          return `<code>${escapeAttr(node.value)}</code>`;
        case "link": {
          const external = /^https?:/.test(node.url);
          return (
            `<a href="${escapeAttr(node.url)}"` +
            (external ? ` target="_blank" rel="noopener"` : "") +
            `>${inlineHtml(node.children)}</a>`
          );
        }
        case "break":
          return " ";
        default:
          return escapeAttr(textOf(node));
      }
    })
    .join("");
}

function mediaOf(node) {
  if (node.type !== "paragraph") return null;

  const meaningful = node.children.filter(
    (child) => !(child.type === "text" && child.value.trim() === "") && child.type !== "break"
  );

  const items = meaningful.map(asMedia);
  // Only convert paragraphs that are nothing but media, so prose is untouched.
  if (items.length === 0 || items.some((item) => item === null)) return null;
  return items;
}

export default function remarkMedia() {
  return (tree) => {
    const out = [];

    for (let index = 0; index < tree.children.length; index += 1) {
      const node = tree.children[index];
      const items = mediaOf(node);
      if (!items) {
        out.push(node);
        continue;
      }

      const steam = items.filter((item) => item.type === "steam");
      const tiles = items.filter((item) => item.type !== "steam");

      // A paragraph of prose right under a store link is what the release is to
      // us — the role on it — so it goes inside the card instead of floating
      // below it.
      let role = "";
      const next = tree.children[index + 1];
      if (steam.length && !tiles.length && next?.type === "paragraph" && !mediaOf(next)) {
        role = `<p class="release-role"><span>Моя роль:</span> ${inlineHtml(next.children)}</p>`;
        index += 1;
      }

      const html =
        (steam.length
          ? `<div class="steam-embeds">${steam
              .map((item) => `<div class="release">${steamCard(item)}${role}</div>`)
              .join("")}</div>`
          : "") +
        (tiles.length ? `<div class="media">${tiles.map(tile).join("")}</div>` : "");

      out.push({ type: "html", value: html });
    }

    tree.children = out;
  };
}

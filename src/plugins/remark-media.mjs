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

// A slim bar: the Steam mark and the game's name, both linking to the store.
// The store's own widget is an iframe whose document cannot be styled from
// here, which is why this is ours.
const STEAM_MARK =
  '<svg class="steam-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
  '<path fill="currentColor" d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 ' +
  '1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 ' +
  '4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 ' +
  '3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 ' +
  '11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 ' +
  '2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c' +
  '.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015' +
  '-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0' +
  '-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265' +
  '-1.014-2.265-2.265z"/></svg>';

function steamCard(item) {
  const name = escapeAttr(item.caption || "Страница в Steam");
  return (
    `<a class="steam-link" href="${escapeAttr(item.url)}" target="_blank" rel="noopener">` +
    `${STEAM_MARK}<span>${name}</span></a>`
  );
}

// Enough of markdown's inline nodes to carry the role line over into HTML.
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

      // The paragraph right after a store link is the role on that game, so it
      // goes into the same bar, behind a divider. A link to a project page in
      // that paragraph is lifted out: the whole half becomes that link, which
      // reads better than the words "Подробнее" sitting inside the text.
      let role = "";
      const next = tree.children[index + 1];
      if (steam.length && !tiles.length && next?.type === "paragraph" && !mediaOf(next)) {
        const project = next.children.find(
          (child) => child.type === "link" && child.url.startsWith("/projects/")
        );
        const rest = next.children.filter((child) => child !== project);
        const text = inlineHtml(rest).trim().replace(/[.\s]+$/, "");

        role = project
          ? `<a class="release-role" href="${escapeAttr(project.url)}">${text}</a>`
          : `<p class="release-role">${text}</p>`;
        index += 1;
      }

      const html =
        (steam.length
          ? `<div class="steam-embeds">${steam
              .map((item) => `<div class="release">${steamCard(item)}${role}</div>`)
              .join("")}</div>`
          : "") +
        // Tiles written in one paragraph share a row: as many columns as there
        // are tiles, four at most, so a long row does not shrink to stamps.
        (tiles.length
          ? `<div class="media" style="--cols:${Math.min(tiles.length, 4)}">` +
            `${tiles.map(tile).join("")}</div>`
          : "");

      out.push({ type: "html", value: html });
    }

    tree.children = out;
  };
}

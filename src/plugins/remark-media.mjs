// Turns plain markdown into media tiles:
//   ![caption](/path/clip.mp4)      -> looping muted video
//   ![caption](/path/shot.png)      -> image tile
//   https://youtu.be/<id>           -> YouTube tile, iframe loaded on click
// Several of them in one paragraph (no blank line between) render as a row.
// Markup matches what Base.astro styles and what its lightbox script expects.

const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const YOUTUBE = /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/;
const STEAM = /^https?:\/\/store\.steampowered\.com\/app\/(\d+)/;

function escapeAttr(value = "") {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function textOf(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function asMedia(node) {
  // A bare image, or an image wrapped in a link to itself (Notion export style).
  if (node.type === "link" && node.children?.length === 1 && node.children[0].type === "image") {
    node = node.children[0];
  }

  if (node.type === "image") {
    const caption = node.alt || node.title || "";
    return VIDEO.test(node.url)
      ? { type: "video", src: node.url, caption }
      : { type: "image", src: node.url, caption };
  }

  // A link, or a bare URL typed as plain text — the WYSIWYG editor produces both.
  const url = node.type === "link" ? node.url : node.type === "text" ? node.value.trim() : null;
  if (!url) return null;

  // Link text that is just the URL again carries no caption.
  const label = node.type === "link" ? textOf(node).trim() : "";
  const caption = label === url ? "" : label;

  if (VIDEO.test(url)) return { type: "video", src: url, caption };

  const youtubeId = url.match(YOUTUBE)?.[1];
  if (youtubeId) return { type: "youtube", id: youtubeId, caption };

  const steamId = url.match(STEAM)?.[1];
  if (steamId) return { type: "steam", id: steamId, url, caption };

  return null;
}

function steamCard(item) {
  return (
    `<a class="steam-card" href="${escapeAttr(item.url)}" rel="noopener">` +
    `<img src="https://cdn.cloudflare.steamstatic.com/steam/apps/${escapeAttr(item.id)}/header.jpg"` +
    ` alt="${escapeAttr(item.caption)}" loading="lazy">` +
    `<span class="steam-body">` +
    `<span class="steam-title">${escapeAttr(item.caption || "Страница игры")}</span>` +
    `<span class="steam-meta">Открыть в Steam</span>` +
    `</span></a>`
  );
}

function tile(item) {
  const caption = item.caption
    ? `<figcaption>${escapeAttr(item.caption)}</figcaption>`
    : "";
  const badge = item.type === "image" ? "" : `<span class="media-badge">▶</span>`;

  let inner;
  if (item.type === "video") {
    inner = `<video src="${escapeAttr(item.src)}" autoplay muted loop playsinline preload="metadata"></video>`;
  } else if (item.type === "youtube") {
    inner =
      `<img src="https://i.ytimg.com/vi/${escapeAttr(item.id)}/maxresdefault.jpg"` +
      ` data-fallback="https://i.ytimg.com/vi/${escapeAttr(item.id)}/hqdefault.jpg"` +
      ` alt="${escapeAttr(item.caption)}" loading="lazy">`;
  } else {
    inner = `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.caption)}" loading="lazy">`;
  }

  const data =
    item.type === "youtube"
      ? `data-type="youtube" data-id="${escapeAttr(item.id)}"`
      : `data-type="${item.type}" data-src="${escapeAttr(item.src)}"`;

  return (
    `<figure class="media-item">` +
    `<button class="media-thumb" type="button" ${data} aria-label="${escapeAttr(item.caption || "Открыть")}">` +
    `${inner}${badge}</button>${caption}</figure>`
  );
}

export default function remarkMedia() {
  return (tree) => {
    tree.children = tree.children.map((node) => {
      if (node.type !== "paragraph") return node;

      const meaningful = node.children.filter(
        (child) => !(child.type === "text" && child.value.trim() === "") && child.type !== "break"
      );

      const items = meaningful.map(asMedia);
      // Only convert paragraphs that are nothing but media, so prose is untouched.
      if (items.length === 0 || items.some((item) => item === null)) return node;

      const steam = items.filter((item) => item.type === "steam");
      const tiles = items.filter((item) => item.type !== "steam");

      const html =
        (steam.length ? `<div class="steam-embeds">${steam.map(steamCard).join("")}</div>` : "") +
        (tiles.length ? `<div class="media">${tiles.map(tile).join("")}</div>` : "");

      return { type: "html", value: html };
    });
  };
}

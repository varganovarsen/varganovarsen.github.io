// A plain paragraph of items separated by " · " becomes a row of chips:
//   Unity (6 лет, C#) · Godot · Git · Shader Graph
// Only paragraphs that are nothing but text qualify, so lines with links
// (the contact card, the footer) keep reading as sentences.

const SEPARATOR = " · ";
const MIN_ITEMS = 3;

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function remarkChips() {
  return (tree) => {
    tree.children = tree.children.map((node) => {
      if (node.type !== "paragraph") return node;
      if (node.children.length !== 1 || node.children[0].type !== "text") return node;

      const items = node.children[0].value
        .split(SEPARATOR)
        .map((item) => item.trim())
        .filter(Boolean);
      if (items.length < MIN_ITEMS) return node;

      const chips = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      return { type: "html", value: `<ul class="chips">${chips}</ul>` };
    });
  };
}

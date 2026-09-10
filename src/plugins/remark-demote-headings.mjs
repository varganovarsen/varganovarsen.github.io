// Project markdown is authored with `#` for its sections, but the page template
// already owns the h1. Shift those down one level so each page has exactly one h1
// and a valid outline. Home markdown already starts at `##` and is left alone,
// in every locale (src/content/home/, src/content/en/home/).
const HOME = /\/content\/(?:[a-z]{2}\/)?home\//;

export default function remarkDemoteHeadings() {
  return (tree, file) => {
    const path = (file?.path ?? "").replace(/\\/g, "/");
    if (HOME.test(path)) return;

    visit(tree);
  };

  function visit(node) {
    for (const child of node.children ?? []) {
      if (child.type === "heading" && child.depth < 6) child.depth += 1;
      visit(child);
    }
  }
}

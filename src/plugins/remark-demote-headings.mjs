// Project and home markdown is authored with `#` for its sections, but the page
// template already owns the h1. Shift every heading down one level so each page
// has exactly one h1 and a valid outline.
export default function remarkDemoteHeadings() {
  return (tree) => {
    for (const node of tree.children) {
      if (node.type === "heading" && node.depth < 6) node.depth += 1;
    }
  };
}

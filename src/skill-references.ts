import { fromMarkdown } from "mdast-util-from-markdown";
export const REFERENCE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function referenceId(url: string) {
  const match = /^skill:\/\/([0-9a-f-]+)$/i.exec(url);
  return match && REFERENCE_ID.test(match[1]!) ? match[1]!.toLowerCase() : null;
}
export function skillReferenceMarkdown(label: string, id: string) {
  if (!REFERENCE_ID.test(id)) throw new Error("Invalid skill reference ID");
  return `[${label.replace(/[\\\[\]]/g, "\\$&").replace(/[\r\n]/g, " ")}](skill://${id})`;
}
export function extractSkillReferences(markdown: string): string[] {
  const tree = fromMarkdown(markdown),
    definitions = new Map<string, string>(),
    ids = new Set<string>();
  function walk(node: any, visit: (node: any) => void) {
    visit(node);
    for (const child of node.children ?? []) walk(child, visit);
  }
  walk(tree, (node) => {
    if (node.type === "definition") definitions.set(node.identifier, node.url);
  });
  walk(tree, (node) => {
    const url =
      node.type === "link"
        ? node.url
        : node.type === "linkReference"
          ? definitions.get(node.identifier)
          : undefined;
    if (url) {
      const id = referenceId(url);
      if (id) ids.add(id);
    }
  });
  return [...ids];
}

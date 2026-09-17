export type BundleNode = {
  id: string;
  kind: "skill" | "bundle";
  members: string[];
  archived: boolean;
  disabled?: boolean;
};

/** Preorder gives stable, reusable composition. A leaf shared by two branches appears once. */
export function expandBundles(
  nodes: BundleNode[],
  roots: string[],
  strict = false,
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>(),
    active = new Set<string>(),
    result: string[] = [];
  function visit(id: string, path: string[]) {
    if (active.has(id)) {
      if (strict) throw new Error("Bundle cycle: " + [...path, id].join(" → "));
      return;
    }
    if (seen.has(id)) return;
    const node = byId.get(id);
    if (!node || (path.length > 0 && node.archived)) {
      if (strict)
        throw new Error("Bundle member is missing or archived: " + id);
      return;
    }
    // Disabled bundles suspend their inherited grants. Validate their full graph
    // on writes so re-enabling cannot reveal a previously hidden cycle.
    if (node.disabled && !strict) return;
    if (path.length > 64) throw new Error("Bundle nesting exceeds 64 levels");
    seen.add(id);
    active.add(id);
    result.push(id);
    if (node.kind === "bundle")
      for (const child of node.members) visit(child, [...path, id]);
    active.delete(id);
  }
  for (const id of roots) visit(id, []);
  return result;
}

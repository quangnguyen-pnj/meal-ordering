import { MAX_ORG_LEVEL, type OrgLevel } from '../enums';

/**
 * BR-61: DMP org nodes become a tree of up to 6 levels. Each node keeps the DMP level name; the
 * level number is the node's depth from its root.
 *
 * TODO(BR-61): assumption A14 (DMP hierarchy levels map onto BRQ's 6 levels by depth) still needs
 * the DMP team's confirmation (docs/open-questions.md). Only this function changes if it doesn't.
 */
export function mapDmpLevel(depth: number): OrgLevel | null {
  return Number.isInteger(depth) && depth >= 1 && depth <= MAX_ORG_LEVEL
    ? (depth as OrgLevel)
    : null;
}

export interface DmpTreeNodeInput {
  code: string;
  name: string;
  parentCode: string | null;
  levelName: string;
  costCenterCode: string | null;
}

export interface DmpTreeNode extends DmpTreeNodeInput {
  level: OrgLevel;
}

export type DmpTreeError =
  | { code: 'DUPLICATE_CODE'; nodeCode: string }
  | { code: 'UNKNOWN_PARENT'; nodeCode: string; parentCode: string }
  | { code: 'CYCLE'; nodeCode: string }
  | { code: 'TOO_DEEP'; nodeCode: string; depth: number };

/**
 * Validates a DMP org tree and orders it parents first. Any error rejects the whole tree, so a
 * broken sync never half-writes the org structure (plan section 5: data is written only when the
 * whole run succeeds).
 */
export function buildDmpTree(
  input: readonly DmpTreeNodeInput[],
): { ok: true; nodes: DmpTreeNode[] } | { ok: false; errors: DmpTreeError[] } {
  const errors: DmpTreeError[] = [];
  const byCode = new Map<string, DmpTreeNodeInput>();
  for (const node of input) {
    if (byCode.has(node.code)) errors.push({ code: 'DUPLICATE_CODE', nodeCode: node.code });
    else byCode.set(node.code, node);
  }
  for (const node of byCode.values()) {
    if (node.parentCode !== null && !byCode.has(node.parentCode)) {
      errors.push({ code: 'UNKNOWN_PARENT', nodeCode: node.code, parentCode: node.parentCode });
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const depthOf = new Map<string, number>();
  const resolveDepth = (code: string): number | null => {
    const known = depthOf.get(code);
    if (known !== undefined) return known;
    const chain: string[] = [];
    const onChain = new Set<string>();
    let current: string | null = code;
    let base = 0;
    while (current !== null) {
      const cached = depthOf.get(current);
      if (cached !== undefined) {
        base = cached;
        break;
      }
      if (onChain.has(current)) return null;
      onChain.add(current);
      chain.push(current);
      current = byCode.get(current)?.parentCode ?? null;
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      base += 1;
      depthOf.set(chain[i] as string, base);
    }
    return depthOf.get(code) ?? null;
  };

  const nodes: DmpTreeNode[] = [];
  for (const node of byCode.values()) {
    const depth = resolveDepth(node.code);
    if (depth === null) {
      errors.push({ code: 'CYCLE', nodeCode: node.code });
      continue;
    }
    const level = mapDmpLevel(depth);
    if (level === null) {
      errors.push({ code: 'TOO_DEEP', nodeCode: node.code, depth });
      continue;
    }
    nodes.push({ ...node, level });
  }
  if (errors.length > 0) return { ok: false, errors };
  nodes.sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
  return { ok: true, nodes };
}

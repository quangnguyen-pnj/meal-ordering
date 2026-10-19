/**
 * Org-tree mapping resolution (BR-60, BR-62, BR-63).
 *
 * - BR-62: a node without a floor / canteen / cost center inherits it from the nearest ancestor
 *   that has one.
 * - BR-60: an employee belongs to the nearest meal-unit node at or above their own node.
 * - BR-63: floor and canteen come from the employee's meal unit; a meal unit that resolves no
 *   floor or no canteen is invalid. Cost center is resolved per employee: override, else the
 *   inherited mapping, else the value supplied by DMP.
 */

export interface OrgNode {
  id: string;
  parentId: string | null;
  isMealUnit: boolean;
  floorId: string | null;
  canteenId: string | null;
  costCenterId: string | null;
}

export type OrgNodeIndex = ReadonlyMap<string, OrgNode>;
export type MappingField = 'floorId' | 'canteenId' | 'costCenterId';

export function indexOrgNodes(nodes: Iterable<OrgNode>): Map<string, OrgNode> {
  const index = new Map<string, OrgNode>();
  for (const node of nodes) index.set(node.id, node);
  return index;
}

/** Yields the node itself, then its parent, grandparent... up to the root. */
export function* nodeAndAncestors(nodeId: string, index: OrgNodeIndex): Generator<OrgNode> {
  const seen = new Set<string>();
  let currentId: string | null = nodeId;
  while (currentId !== null) {
    if (seen.has(currentId)) throw new Error(`Org tree cycle detected at node "${currentId}"`);
    seen.add(currentId);
    const node = index.get(currentId);
    if (!node) throw new Error(`Unknown org node "${currentId}"`);
    yield node;
    currentId = node.parentId;
  }
}

export interface ResolvedMapping {
  /** The effective id, or null when neither the node nor any ancestor has one. */
  value: string | null;
  /** Node that supplies the value (the node itself when not inherited). */
  sourceNodeId: string | null;
  inherited: boolean;
}

/** BR-62: nearest ancestor (including the node itself) that has a value wins. */
export function resolveMapping(
  nodeId: string,
  field: MappingField,
  index: OrgNodeIndex,
): ResolvedMapping {
  for (const node of nodeAndAncestors(nodeId, index)) {
    const value = node[field];
    if (value !== null) {
      return { value, sourceNodeId: node.id, inherited: node.id !== nodeId };
    }
  }
  return { value: null, sourceNodeId: null, inherited: false };
}

export interface NodeMapping {
  floor: ResolvedMapping;
  canteen: ResolvedMapping;
  costCenter: ResolvedMapping;
}

export function resolveNodeMapping(nodeId: string, index: OrgNodeIndex): NodeMapping {
  return {
    floor: resolveMapping(nodeId, 'floorId', index),
    canteen: resolveMapping(nodeId, 'canteenId', index),
    costCenter: resolveMapping(nodeId, 'costCenterId', index),
  };
}

/** BR-60: nearest node at or above `nodeId` flagged as a meal unit, or null. */
export function resolveMealUnitId(nodeId: string, index: OrgNodeIndex): string | null {
  for (const node of nodeAndAncestors(nodeId, index)) {
    if (node.isMealUnit) return node.id;
  }
  return null;
}

export type MealUnitMapping =
  | { valid: true; floorId: string; canteenId: string }
  | { valid: false; missing: Array<'floor' | 'canteen'> };

/** BR-63: a meal unit is valid only when both a floor and a canteen resolve for it. */
export function resolveMealUnitMapping(mealUnitId: string, index: OrgNodeIndex): MealUnitMapping {
  const { floor, canteen } = resolveNodeMapping(mealUnitId, index);
  if (floor.value !== null && canteen.value !== null) {
    return { valid: true, floorId: floor.value, canteenId: canteen.value };
  }
  const missing: Array<'floor' | 'canteen'> = [];
  if (floor.value === null) missing.push('floor');
  if (canteen.value === null) missing.push('canteen');
  return { valid: false, missing };
}

export type CostCenterResolutionSource = 'OVERRIDE' | 'MAPPING' | 'DMP';

export interface ResolvedCostCenter {
  costCenterId: string | null;
  source: CostCenterResolutionSource | null;
}

/**
 * BR-63 / BR-62: cost center is resolved per employee.
 * Order: employee-level override, then the inherited org mapping (an admin mapping overrides
 * what DMP supplies), then the cost center DMP supplied for the employee as the default.
 */
export function resolveEmployeeCostCenter(args: {
  orgUnitId: string;
  overrideCostCenterId: string | null;
  dmpCostCenterId?: string | null;
  index: OrgNodeIndex;
}): ResolvedCostCenter {
  if (args.overrideCostCenterId !== null) {
    return { costCenterId: args.overrideCostCenterId, source: 'OVERRIDE' };
  }
  const inherited = resolveMapping(args.orgUnitId, 'costCenterId', args.index);
  if (inherited.value !== null) return { costCenterId: inherited.value, source: 'MAPPING' };
  if (args.dmpCostCenterId) return { costCenterId: args.dmpCostCenterId, source: 'DMP' };
  return { costCenterId: null, source: null };
}

export type MealAssignmentStatus = 'OK' | 'NO_MEAL_UNIT' | 'INVALID_MEAL_UNIT';

export interface EmployeeMealAssignment {
  /** Nearest flagged node (BR-60), even when it turns out invalid; null when none exists. */
  mealUnitId: string | null;
  status: MealAssignmentStatus;
  /** Which of floor/canteen the meal unit could not resolve (INVALID_MEAL_UNIT only). */
  missing: Array<'floor' | 'canteen'>;
  floorId: string | null;
  canteenId: string | null;
  costCenterId: string | null;
  costCenterSource: CostCenterResolutionSource | null;
  /** BR-60 / BR-63: employees on the "unassigned" list cannot register. */
  canRegister: boolean;
  /** BR-63: employees without a cost center can still register and appear on a separate list. */
  missingCostCenter: boolean;
}

export function resolveEmployeeMealAssignment(args: {
  orgUnitId: string;
  costCenterOverrideId: string | null;
  dmpCostCenterId?: string | null;
  index: OrgNodeIndex;
}): EmployeeMealAssignment {
  const { index } = args;
  const cost = resolveEmployeeCostCenter({
    orgUnitId: args.orgUnitId,
    overrideCostCenterId: args.costCenterOverrideId,
    dmpCostCenterId: args.dmpCostCenterId ?? null,
    index,
  });
  const base = {
    costCenterId: cost.costCenterId,
    costCenterSource: cost.source,
    missingCostCenter: cost.costCenterId === null,
  };

  const mealUnitId = resolveMealUnitId(args.orgUnitId, index);
  if (mealUnitId === null) {
    return {
      ...base,
      mealUnitId: null,
      status: 'NO_MEAL_UNIT',
      missing: [],
      floorId: null,
      canteenId: null,
      canRegister: false,
    };
  }

  const mapping = resolveMealUnitMapping(mealUnitId, index);
  if (!mapping.valid) {
    return {
      ...base,
      mealUnitId,
      status: 'INVALID_MEAL_UNIT',
      missing: mapping.missing,
      floorId: null,
      canteenId: null,
      canRegister: false,
    };
  }
  return {
    ...base,
    mealUnitId,
    status: 'OK',
    missing: [],
    floorId: mapping.floorId,
    canteenId: mapping.canteenId,
    canRegister: true,
  };
}

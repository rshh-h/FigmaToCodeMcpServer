export function collectVariableIds(
  node: Record<string, unknown> | null | undefined,
  variableIds = new Set<string>(),
): Set<string> {
  if (!node || typeof node !== "object") {
    return variableIds;
  }

  const addVariableId = (candidate: unknown) => {
    if (
      candidate &&
      typeof candidate === "object" &&
      typeof (candidate as { id?: unknown }).id === "string" &&
      (candidate as { id: string }).id.length > 0
    ) {
      variableIds.add((candidate as { id: string }).id);
    }
  };

  const visitBoundVariables = (value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visitBoundVariables(item);
      }
      return;
    }

    if ("id" in value) {
      addVariableId(value);
    }

    for (const nestedValue of Object.values(value)) {
      visitBoundVariables(nestedValue);
    }
  };

  if ("boundVariables" in node) {
    visitBoundVariables(node.boundVariables);
  }

  if (Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill && typeof fill === "object" && "boundVariables" in fill) {
        visitBoundVariables((fill as { boundVariables?: unknown }).boundVariables);
      }
    }
  }

  if (Array.isArray(node.strokes)) {
    for (const stroke of node.strokes) {
      if (stroke && typeof stroke === "object" && "boundVariables" in stroke) {
        visitBoundVariables(
          (stroke as { boundVariables?: unknown }).boundVariables,
        );
      }
    }
  }

  if (Array.isArray(node.effects)) {
    for (const effect of node.effects) {
      if (effect && typeof effect === "object" && "boundVariables" in effect) {
        visitBoundVariables(
          (effect as { boundVariables?: unknown }).boundVariables,
        );
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectVariableIds(
        child as Record<string, unknown> | null | undefined,
        variableIds,
      );
    }
  }

  return variableIds;
}

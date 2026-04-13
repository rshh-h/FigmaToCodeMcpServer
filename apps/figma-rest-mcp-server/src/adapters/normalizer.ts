import type {
  AssetSupportRequirements,
  FigmaNodeLike,
  NormalizedNode,
  NormalizedTextSegment,
  NormalizedTree,
  SourceSnapshot,
  VariableBinding,
} from "../core/contracts.js";
import type { Normalizer } from "../core/interfaces.js";
import type { RequestContext } from "../application/requestContext.js";

function toBoundingBox(node: FigmaNodeLike): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (node.absoluteBoundingBox) {
    return node.absoluteBoundingBox;
  }

  return {
    x:
      Array.isArray(node.relativeTransform) &&
      Array.isArray(node.relativeTransform[0]) &&
      typeof node.relativeTransform[0][2] === "number"
        ? node.relativeTransform[0][2]
        : 0,
    y:
      Array.isArray(node.relativeTransform) &&
      Array.isArray(node.relativeTransform[1]) &&
      typeof node.relativeTransform[1][2] === "number"
        ? node.relativeTransform[1][2]
        : 0,
    width: typeof node.size?.x === "number" ? node.size.x : 0,
    height: typeof node.size?.y === "number" ? node.size.y : 0,
  };
}

function toRelativeBox(
  node: FigmaNodeLike,
  parentCanvasBox:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined,
): {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  canvasBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
} {
  const rawBox = toBoundingBox(node);
  const hasAbsoluteBox = Boolean(node.absoluteBoundingBox);
  const canvasBox = hasAbsoluteBox
    ? rawBox
    : {
        ...rawBox,
        x: (parentCanvasBox?.x ?? 0) + rawBox.x,
        y: (parentCanvasBox?.y ?? 0) + rawBox.y,
      };

  if (!parentCanvasBox) {
    return {
      box: rawBox,
      canvasBox,
    };
  }

  return {
    box: {
      ...rawBox,
      x: canvasBox.x - parentCanvasBox.x,
      y: canvasBox.y - parentCanvasBox.y,
    },
    canvasBox,
  };
}

interface VariableInfo {
  name?: string;
  modeId?: string;
  modeName?: string;
  value?: unknown;
  resolvedType?: string;
}

function collectVariableCollections(
  variablesRaw: unknown,
  output = new Map<string, Map<string, string>>(),
  seen = new WeakSet<object>(),
): Map<string, Map<string, string>> {
  if (!variablesRaw || typeof variablesRaw !== "object") {
    return output;
  }

  if (seen.has(variablesRaw)) {
    return output;
  }
  seen.add(variablesRaw);

  if ("id" in variablesRaw && "modes" in variablesRaw) {
    const candidate = variablesRaw as { id?: unknown; modes?: unknown };
    if (typeof candidate.id === "string" && Array.isArray(candidate.modes)) {
      const modes = new Map<string, string>();
      for (const mode of candidate.modes) {
        if (!mode || typeof mode !== "object") {
          continue;
        }
        const rawMode = mode as { modeId?: unknown; id?: unknown; name?: unknown };
        const modeId =
          typeof rawMode.modeId === "string"
            ? rawMode.modeId
            : typeof rawMode.id === "string"
              ? rawMode.id
              : undefined;
        if (modeId && typeof rawMode.name === "string") {
          modes.set(modeId, rawMode.name);
        }
      }
      output.set(candidate.id, modes);
    }
  }

  if (Array.isArray(variablesRaw)) {
    for (const item of variablesRaw) {
      collectVariableCollections(item, output, seen);
    }
    return output;
  }

  for (const value of Object.values(variablesRaw)) {
    collectVariableCollections(value, output, seen);
  }

  return output;
}

function collectVariableInfo(
  variablesRaw: unknown,
  collections: Map<string, Map<string, string>>,
  output = new Map<string, VariableInfo>(),
  seen = new WeakSet<object>(),
): Map<string, VariableInfo> {
  if (!variablesRaw || typeof variablesRaw !== "object") {
    return output;
  }

  if (seen.has(variablesRaw)) {
    return output;
  }
  seen.add(variablesRaw);

  if ("id" in variablesRaw && "name" in variablesRaw) {
    const candidate = variablesRaw as {
      id?: unknown;
      name?: unknown;
      valuesByMode?: unknown;
      variableCollectionId?: unknown;
      resolvedType?: unknown;
    };
    if (typeof candidate.id === "string" && typeof candidate.name === "string") {
      const valuesByMode =
        candidate.valuesByMode && typeof candidate.valuesByMode === "object"
          ? (candidate.valuesByMode as Record<string, unknown>)
          : {};
      const modeId = Object.keys(valuesByMode)[0];
      const collectionId =
        typeof candidate.variableCollectionId === "string"
          ? candidate.variableCollectionId
          : undefined;
      output.set(candidate.id, {
        name: candidate.name,
        modeId,
        modeName: modeId && collectionId ? collections.get(collectionId)?.get(modeId) : undefined,
        value: modeId ? valuesByMode[modeId] : undefined,
        resolvedType:
          typeof candidate.resolvedType === "string"
            ? candidate.resolvedType
            : undefined,
      });
    }
  }

  if (Array.isArray(variablesRaw)) {
    for (const item of variablesRaw) {
      collectVariableInfo(item, collections, output, seen);
    }
    return output;
  }

  for (const value of Object.values(variablesRaw)) {
    collectVariableInfo(value, collections, output, seen);
  }

  return output;
}

function collectVariableBindings(
  node: FigmaNodeLike,
  variableInfo: Map<string, VariableInfo>,
  hasVariableSupport: boolean,
): VariableBinding[] {
  const boundVariables = node.boundVariables;
  if (!boundVariables || typeof boundVariables !== "object") {
    return [];
  }

  const result: VariableBinding[] = [];
  for (const [field, value] of Object.entries(boundVariables)) {
    if (!value) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const variableId = typeof item === "object" && item && "id" in item ? String(item.id) : undefined;
        if (variableId) {
          const info = variableInfo.get(variableId);
          const resolvedName =
            (typeof item === "object" && item && "name" in item ? String(item.name) : undefined) ??
            info?.name;
          result.push({
            field,
            variableId,
            variableName: resolvedName,
            variableModeId: info?.modeId,
            variableModeName: info?.modeName,
            variableValue: info?.value,
            resolvedType: info?.resolvedType,
            resolutionStatus: resolvedName
              ? "resolved"
              : hasVariableSupport
                ? "id-only"
                : "unavailable",
          });
        }
      }
      continue;
    }

    if (typeof value === "object" && value && "id" in value) {
      const variableId = String(value.id);
      const info = variableInfo.get(variableId);
      const resolvedName =
        ("name" in value ? String(value.name) : undefined) ?? info?.name;
      result.push({
        field,
        variableId,
        variableName: resolvedName,
        variableModeId: info?.modeId,
        variableModeName: info?.modeName,
        variableValue: info?.value,
        resolvedType: info?.resolvedType,
        resolutionStatus: resolvedName
          ? "resolved"
          : hasVariableSupport
            ? "id-only"
            : "unavailable",
      });
    }
  }

  return result;
}

function collectTextSegments(node: FigmaNodeLike, context: RequestContext): NormalizedTextSegment[] {
  const characters = typeof node.characters === "string" ? node.characters : "";
  if (!characters) {
    return [];
  }

  const overrides = Array.isArray(node.characterStyleOverrides)
    ? node.characterStyleOverrides
    : [];
  const styles =
    node.styleOverrideTable && typeof node.styleOverrideTable === "object"
      ? node.styleOverrideTable
      : {};

  if (overrides.length === characters.length && overrides.some((value) => value !== overrides[0])) {
    const segments: NormalizedTextSegment[] = [];
    let start = 0;
    let currentStyle = overrides[0];

    for (let index = 1; index <= overrides.length; index += 1) {
      if (index === overrides.length || overrides[index] !== currentStyle) {
        segments.push({
          text: characters.slice(start, index),
          start,
          end: index,
          style:
            typeof styles === "object" && styles
              ? ((styles as Record<string, Record<string, unknown>>)[String(currentStyle)] ?? node.style ?? {})
              : (node.style ?? {}),
        });
        start = index;
        currentStyle = overrides[index];
      }
    }

    return segments;
  }

  context.warningCollector.addDegradation({
    feature: "textSegmentation",
    stage: "normalize",
    reason: "text_segmentation_partial",
    affectsCorrectness: false,
    affectsFidelity: true,
  });
  context.warningCollector.addDecision(
    "textSegmentation",
    true,
    true,
    "partial",
    "normalize",
    "REST text data does not expose plugin-equivalent text segmentation for this node.",
  );

  return [
    {
      text: characters,
      start: 0,
      end: characters.length,
      style: node.style ?? {},
    },
  ];
}

function createAssetRequirements(
  hasImage: boolean,
  hasVector: boolean,
  hasVariables: boolean,
): AssetSupportRequirements {
  return {
    images: hasImage,
    vectors: hasVector,
    variables: hasVariables,
  };
}

interface StructuralNode {
  raw: FigmaNodeLike;
  children: StructuralNode[];
}

interface GeometryNode {
  raw: FigmaNodeLike;
  children: GeometryNode[];
  name: string;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cumulativeRotation: number;
  relativePositioning: "relative" | "absolute";
  layout: Record<string, unknown>;
  style: Record<string, unknown>;
}

interface TextPassNode extends Omit<GeometryNode, "children"> {
  children: TextPassNode[];
  text?: string;
  textSegments: NormalizedTextSegment[];
}

interface VariablePassNode extends Omit<TextPassNode, "children"> {
  children: VariablePassNode[];
  variableBindings: VariableBinding[];
}

interface AssetPassNode extends Omit<VariablePassNode, "children"> {
  children: AssetPassNode[];
  imageHints: Array<{
    imageRef: string;
    path: string;
  }>;
  vectorHints: Array<{
    nodeId: string;
    preferredFormat: "svg";
    required: boolean;
  }>;
  assetSupportRequirements: AssetSupportRequirements;
}

function runStructuralPass(node: FigmaNodeLike): StructuralNode | undefined {
  if (node.visible === false) {
    return undefined;
  }

  return {
    raw: node,
    children: Array.isArray(node.children)
      ? node.children
          .map((child) => runStructuralPass(child))
          .filter((child): child is StructuralNode => Boolean(child))
      : [],
  };
}

function runGeometryPass(
  node: StructuralNode,
  parentRotation: number,
  parentCanvasBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
): GeometryNode {
  const raw = node.raw as Record<string, unknown>;
  const geometry = toRelativeBox(node.raw, parentCanvasBox);
  return {
    raw: node.raw,
    children: node.children.map((child) =>
      runGeometryPass(
        child,
        parentRotation + Number(node.raw.rotation ?? 0),
        geometry.canvasBox,
      )),
    name: node.raw.name ?? node.raw.id,
    box: geometry.box,
    cumulativeRotation: parentRotation + Number(node.raw.rotation ?? 0),
    relativePositioning:
      node.raw.layoutPositioning === "ABSOLUTE" ? "absolute" : "relative",
    layout: {
      layoutPositioning: node.raw.layoutPositioning ?? "AUTO",
      layoutMode: raw.layoutMode ?? "NONE",
      itemSpacing: raw.itemSpacing,
      layoutWrap: raw.layoutWrap,
      paddingLeft: raw.paddingLeft,
      paddingRight: raw.paddingRight,
      paddingTop: raw.paddingTop,
      paddingBottom: raw.paddingBottom,
      primaryAxisAlignItems: raw.primaryAxisAlignItems,
      counterAxisAlignItems: raw.counterAxisAlignItems,
      primaryAxisSizingMode: raw.primaryAxisSizingMode,
      counterAxisSizingMode: raw.counterAxisSizingMode,
      clipsContent: raw.clipsContent,
    },
    style: {
      ...(node.raw.style ?? {}),
      fills: raw.fills,
      strokes: raw.strokes,
      effects: raw.effects,
      opacity: raw.opacity,
      cornerRadius: raw.cornerRadius,
      rectangleCornerRadii: raw.rectangleCornerRadii,
      strokeWeight: raw.strokeWeight,
      strokeAlign: raw.strokeAlign,
      blendMode: raw.blendMode,
      fontName: raw.fontName,
      fontSize: raw.fontSize ?? (node.raw.style as Record<string, unknown> | undefined)?.fontSize,
      fontWeight:
        raw.fontWeight ?? (node.raw.style as Record<string, unknown> | undefined)?.fontWeight,
      lineHeightPx:
        raw.lineHeightPx ??
        (node.raw.style as Record<string, unknown> | undefined)?.lineHeightPx,
      letterSpacing:
        raw.letterSpacing ??
        (node.raw.style as Record<string, unknown> | undefined)?.letterSpacing,
      textAlignHorizontal:
        raw.textAlignHorizontal ??
        (node.raw.style as Record<string, unknown> | undefined)?.textAlignHorizontal,
      textAlignVertical:
        raw.textAlignVertical ??
        (node.raw.style as Record<string, unknown> | undefined)?.textAlignVertical,
    },
  };
}

function runTextPass(node: GeometryNode, context: RequestContext): TextPassNode {
  return {
    ...node,
    children: node.children.map((child) => runTextPass(child, context)),
    text: typeof node.raw.characters === "string" ? node.raw.characters : undefined,
    textSegments: collectTextSegments(node.raw, context),
  };
}

function runVariablePass(
  node: TextPassNode,
  variableInfo: Map<string, VariableInfo>,
  hasVariableSupport: boolean,
  context: RequestContext,
): VariablePassNode {
  const variableBindings = collectVariableBindings(
    node.raw,
    variableInfo,
    hasVariableSupport,
  );

  if (variableBindings.some((binding) => binding.resolutionStatus !== "resolved")) {
    const reason = hasVariableSupport
      ? "color_variable_resolution_partial"
      : "color_variable_support_unavailable";
    context.warningCollector.addDegradation({
      feature: "colorVariables",
      stage: "normalize",
      reason,
      affectsCorrectness: false,
      affectsFidelity: true,
    });
    context.warningCollector.addDecision(
      "colorVariables",
      true,
      hasVariableSupport,
      context.requestCapabilitySnapshot.features.colorVariables,
      "normalize",
      hasVariableSupport
        ? "Color variable names could not be fully resolved from REST metadata."
        : "Color variable support is unavailable for this request.",
    );
  }

  return {
    ...node,
    children: node.children.map((child) =>
      runVariablePass(child, variableInfo, hasVariableSupport, context)),
    variableBindings,
  };
}

function runAssetHintPass(
  node: VariablePassNode,
  snapshot: SourceSnapshot,
): AssetPassNode {
  const imageHints = snapshot.imageRefs
    .filter((imageRef) =>
      Array.isArray(node.raw.fills)
        ? node.raw.fills.some((fill) => fill && fill.imageRef === imageRef)
        : false,
    )
    .map((imageRef) => ({
      imageRef,
      path: node.raw.id,
    }));

  const vectorHints = snapshot.vectorCandidates
    .filter((candidate) => candidate.id === node.raw.id)
    .map((candidate) => ({
      nodeId: candidate.id,
      preferredFormat: "svg" as const,
      required: true,
    }));

  return {
    ...node,
    children: node.children.map((child) => runAssetHintPass(child, snapshot)),
    imageHints,
    vectorHints,
    assetSupportRequirements: createAssetRequirements(
      imageHints.length > 0,
      vectorHints.length > 0,
      node.variableBindings.length > 0,
    ),
  };
}

function runNamingPass(
  node: AssetPassNode,
  counters: Map<string, number>,
): NormalizedNode {
  const count = counters.get(node.name) ?? 0;
  counters.set(node.name, count + 1);

  return {
    id: node.raw.id,
    name: node.name,
    uniqueName: count === 0 ? node.name : `${node.name}_${count}`,
    type: node.raw.type,
    visible: true,
    width: node.box.width,
    height: node.box.height,
    x: node.box.x,
    y: node.box.y,
    cumulativeRotation: node.cumulativeRotation,
    relativePositioning: node.relativePositioning,
    layout: node.layout,
    style: node.style,
    text: node.text,
    textSegments: node.textSegments,
    variableBindings: node.variableBindings,
    imageHints: node.imageHints,
    vectorHints: node.vectorHints,
    assetSupportRequirements: node.assetSupportRequirements,
    children: node.children.map((child) => runNamingPass(child, counters)),
    rawNodeId: node.raw.id,
  };
}

export class NormalizationAdapter implements Normalizer {
  async normalize(snapshot: SourceSnapshot, context: RequestContext): Promise<NormalizedTree> {
    const counters = new Map<string, number>();
    const variableCollections = collectVariableCollections(snapshot.variablesRaw);
    const variableInfo = collectVariableInfo(snapshot.variablesRaw, variableCollections);
    const hasVariableSupport =
      context.requestCapabilitySnapshot.features.colorVariables !== "none";
    const roots = snapshot.sourceNodes
      .map((entry) => runStructuralPass(entry.document))
      .filter((node): node is StructuralNode => Boolean(node))
      .map((node) => runGeometryPass(node, 0))
      .map((node) => runTextPass(node, context))
      .map((node) => runVariablePass(node, variableInfo, hasVariableSupport, context))
      .map((node) => runAssetHintPass(node, snapshot))
      .map((node) => runNamingPass(node, counters));

    return {
      fileKey: snapshot.fileKey,
      rootNodeIds: snapshot.targetNodeIds,
      roots,
    };
  }
}

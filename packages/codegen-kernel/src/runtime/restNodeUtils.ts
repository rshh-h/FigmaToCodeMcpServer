function cloneJson<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function normalizeOpenTypeFeatures(
  opentypeFlags: Record<string, unknown> = {},
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(opentypeFlags)) {
    result[key] = value === 1;
  }

  return result;
}

export function normalizeLetterSpacing(letterSpacing = 0): LetterSpacing {
  return {
    unit: "PIXELS",
    value: typeof letterSpacing === "number" ? letterSpacing : 0,
  };
}

export function normalizeLineHeight(
  style: Record<string, unknown> = {},
  fontSize = 0,
): LineHeight {
  const lineHeightUnit = style.lineHeightUnit;
  const percentLineHeight =
    typeof style.lineHeightPercentFontSize === "number"
      ? style.lineHeightPercentFontSize
      : typeof style.lineHeightPercent === "number"
        ? style.lineHeightPercent
        : 100;

  if (!lineHeightUnit) {
    return { unit: "AUTO", value: fontSize || 0 };
  }

  if (lineHeightUnit === "PIXELS") {
    return {
      unit: "PIXELS",
      value:
        typeof style.lineHeightPx === "number"
          ? style.lineHeightPx
          : fontSize || 0,
    };
  }

  if (lineHeightUnit === "INTRINSIC_%") {
    if (typeof style.lineHeightPx === "number") {
      return {
        unit: "PIXELS",
        value: style.lineHeightPx,
      };
    }

    return {
      unit: "PERCENT",
      value: percentLineHeight,
    };
  }

  if (lineHeightUnit === "FONT_SIZE_%") {
    return {
      unit: "PERCENT",
      value: percentLineHeight,
    };
  }

  return { unit: "AUTO", value: fontSize || 0 };
}

function getTextStyleOverrideKey(
  node: Record<string, unknown>,
  characterIndex: number,
): number {
  const overrides = Array.isArray(node.characterStyleOverrides)
    ? node.characterStyleOverrides
    : [];
  return characterIndex < overrides.length ? (overrides[characterIndex] as number) ?? 0 : 0;
}

function getLineIndexForCharacter(characters: string, characterIndex: number) {
  let lineIndex = 0;

  for (let i = 0; i < characterIndex; i += 1) {
    if (characters[i] === "\n") {
      lineIndex += 1;
    }
  }

  return lineIndex;
}

function getListOptions(node: Record<string, unknown>, startIndex: number) {
  const characters = typeof node.characters === "string" ? node.characters : "";
  const lineIndex = getLineIndexForCharacter(characters, startIndex);
  const type = Array.isArray(node.lineTypes) ? node.lineTypes[lineIndex] : "NONE";

  if (!type || type === "NONE") {
    return undefined;
  }

  return { type } as TextListOptions;
}

function getIndentation(node: Record<string, unknown>, startIndex: number) {
  const characters = typeof node.characters === "string" ? node.characters : "";
  const lineIndex = getLineIndexForCharacter(characters, startIndex);
  if (!Array.isArray(node.lineIndentations)) {
    return 0;
  }
  return (node.lineIndentations[lineIndex] as number) ?? 0;
}

function resolveEffectiveTypeStyle(
  node: Record<string, unknown>,
  overrideKey: number,
): Record<string, unknown> {
  const baseStyle = cloneJson((node.style as Record<string, unknown> | undefined) ?? {});
  const styleOverrideTable =
    (node.styleOverrideTable as Record<string, Record<string, unknown>> | undefined) ??
    {};
  const overrideStyle =
    overrideKey !== 0 ? cloneJson(styleOverrideTable[String(overrideKey)] ?? {}) : {};
  const mergedStyle = { ...baseStyle, ...overrideStyle };

  if (!Array.isArray(mergedStyle.fills) || mergedStyle.fills.length === 0) {
    mergedStyle.fills = cloneJson((node.fills as Paint[] | undefined) ?? []);
  }

  return mergedStyle;
}

function normalizedSegmentShape(
  node: Record<string, unknown>,
  start: number,
  end: number,
  effectiveStyle: Record<string, unknown>,
): StyledTextSegmentSubset {
  const characters = typeof node.characters === "string" ? node.characters : "";
  const nodeStyle =
    (node.style as Record<string, unknown> | undefined) ?? {};
  const styles = (node.styles as Record<string, string> | undefined) ?? {};

  const fontSize =
    typeof effectiveStyle.fontSize === "number"
      ? effectiveStyle.fontSize
      : typeof nodeStyle.fontSize === "number"
        ? nodeStyle.fontSize
        : 0;

  return {
    start,
    end,
    characters: characters.slice(start, end),
    fontName: {
      family: (effectiveStyle.fontFamily as string | undefined) ?? "",
      style: (effectiveStyle.fontStyle as string | undefined) ?? "",
    },
    fills: cloneJson((effectiveStyle.fills as Paint[] | undefined) ?? []),
    fontSize,
    fontWeight:
      typeof effectiveStyle.fontWeight === "number"
        ? effectiveStyle.fontWeight
        : 400,
    hyperlink: effectiveStyle.hyperlink as HyperlinkTarget | null | undefined,
    indentation: getIndentation(node, start),
    letterSpacing: normalizeLetterSpacing(
      typeof effectiveStyle.letterSpacing === "number"
        ? effectiveStyle.letterSpacing
        : 0,
    ),
    lineHeight: normalizeLineHeight(effectiveStyle, fontSize),
    listOptions: getListOptions(node, start),
    textCase: (effectiveStyle.textCase as TextCase | undefined) ?? "ORIGINAL",
    textDecoration:
      (effectiveStyle.textDecoration as TextDecoration | undefined) ?? "NONE",
    textStyleId: styles.text,
    fillStyleId: styles.fill,
    openTypeFeatures: normalizeOpenTypeFeatures(
      (effectiveStyle.opentypeFlags as Record<string, unknown> | undefined) ?? {},
    ),
  };
}

export function deriveTextSegmentsFromRestNode(
  node: Record<string, unknown> | undefined,
): StyledTextSegmentSubset[] {
  if (!node || node.type !== "TEXT" || typeof node.characters !== "string") {
    return [];
  }

  const segments: StyledTextSegmentSubset[] = [];
  const { characters } = node;

  if (characters.length === 0) {
    return segments;
  }

  let segmentStart = 0;
  let previousOverrideKey = getTextStyleOverrideKey(node, 0);
  let previousStyle = resolveEffectiveTypeStyle(node, previousOverrideKey);
  let previousSignature = JSON.stringify(previousStyle);

  for (let index = 1; index <= characters.length; index += 1) {
    const isBoundary = index === characters.length;

    if (!isBoundary) {
      const overrideKey = getTextStyleOverrideKey(node, index);
      const style = resolveEffectiveTypeStyle(node, overrideKey);
      const signature = JSON.stringify(style);

      if (signature === previousSignature) {
        continue;
      }
    }

    segments.push(
      normalizedSegmentShape(node, segmentStart, index, previousStyle),
    );

    if (!isBoundary) {
      segmentStart = index;
      previousOverrideKey = getTextStyleOverrideKey(node, index);
      previousStyle = resolveEffectiveTypeStyle(node, previousOverrideKey);
      previousSignature = JSON.stringify(previousStyle);
    }
  }

  return segments;
}

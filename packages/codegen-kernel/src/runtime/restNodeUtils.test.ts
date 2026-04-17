import { describe, expect, it } from "vitest";
import { tailwindMain } from "../tailwind/tailwindMain";
import { PluginSettings } from "../pluginTypes";
import { deriveTextSegmentsFromRestNode, normalizeLineHeight } from "./restNodeUtils";

const createSettings = (): PluginSettings =>
  ({
    framework: "Tailwind",
    showLayerNames: false,
    embedImages: true,
    embedVectors: true,
    useColorVariables: false,
    htmlGenerationMode: "jsx",
    tailwindGenerationMode: "jsx",
    roundTailwindValues: false,
    roundTailwindColors: true,
    baseFontSize: 16,
    useTailwind4: false,
    thresholdPercent: 0.5,
    baseFontFamily: "sans",
    fontFamilyCustomConfig: {},
    flutterGenerationMode: "snippet",
    swiftUIGenerationMode: "snippet",
    composeGenerationMode: "snippet",
    useOldPluginVersion2025: false,
    responsiveRoot: false,
  }) as PluginSettings;

describe("restNodeUtils", () => {
  it("uses pixel line height for INTRINSIC_% text styles when lineHeightPx is present", () => {
    expect(
      normalizeLineHeight(
        {
          lineHeightUnit: "INTRINSIC_%",
          lineHeightPercent: 100,
          lineHeightPx: 21,
        },
        15,
      ),
    ).toEqual({
      unit: "PIXELS",
      value: 21,
    });
  });

  it("preserves intrinsic pixel line height from REST text nodes in Tailwind output", async () => {
    const rawNode = {
      id: "text",
      type: "TEXT",
      characters: "高级设置",
      fills: [
        {
          blendMode: "NORMAL",
          type: "SOLID",
          color: {
            r: 0.08627451211214066,
            g: 0.0941176488995552,
            b: 0.13725490868091583,
            a: 1,
          },
        },
      ],
      style: {
        fontFamily: "PingFang SC",
        fontStyle: "Medium",
        fontWeight: 500,
        fontSize: 15,
        textAlignHorizontal: "LEFT",
        textAlignVertical: "CENTER",
        letterSpacing: 0,
        lineHeightPx: 21,
        lineHeightPercent: 100,
        lineHeightUnit: "INTRINSIC_%",
      },
      styles: {
        fill: "3:1564",
      },
      characterStyleOverrides: [],
      styleOverrideTable: {},
      lineTypes: ["NONE"],
      lineIndentations: [0],
    } as const;

    const styledTextSegments = deriveTextSegmentsFromRestNode(rawNode as any);
    expect(styledTextSegments[0]?.lineHeight).toEqual({
      unit: "PIXELS",
      value: 21,
    });

    const node = {
      id: "text",
      name: "Title",
      type: "TEXT",
      width: 271,
      height: 21,
      x: 48,
      y: 15,
      visible: true,
      fills: rawNode.fills,
      strokes: [],
      effects: [],
      textAutoResize: "HEIGHT",
      textAlignHorizontal: "LEFT",
      textAlignVertical: "CENTER",
      styledTextSegments,
      characters: rawNode.characters,
      parent: {
        id: "parent",
        name: "Parent",
        type: "FRAME",
        layoutMode: "NONE",
        absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 52 },
      },
    } as any as SceneNode;

    const code = await tailwindMain([node], createSettings());

    expect(code).toContain("leading-[21px]");
    expect(code).not.toContain("leading-4");
  });
});

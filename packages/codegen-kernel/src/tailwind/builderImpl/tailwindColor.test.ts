import { describe, expect, it } from "vitest";
import { tailwindMain } from "../tailwindMain.js";
import {
  tailwindBackgroundFromFills,
  tailwindBackgroundLayerClassesFromFills,
} from "./tailwindColor.js";

describe("tailwindBackgroundLayerClassesFromFills", () => {
  it("returns one Tailwind background class per visible fill when rounding is enabled", async () => {
    await tailwindMain([], {
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
    } as any);

    const fills = [
      {
        blendMode: "NORMAL",
        type: "SOLID",
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
      {
        opacity: 0.05,
        blendMode: "NORMAL",
        type: "SOLID",
        color: {
          r: 0.08627451211214066,
          g: 0.0941176488995552,
          b: 0.13725490868091583,
          a: 1,
        },
      },
    ] as const;

    expect(tailwindBackgroundLayerClassesFromFills(fills as any)).toEqual([
      "bg-white",
      "bg-gray-900/5",
    ]);
  });

  it("preserves the exact Figma color when rounding is disabled", async () => {
    await tailwindMain([], {
      framework: "Tailwind",
      showLayerNames: false,
      embedImages: true,
      embedVectors: true,
      useColorVariables: false,
      htmlGenerationMode: "jsx",
      tailwindGenerationMode: "jsx",
      roundTailwindValues: false,
      roundTailwindColors: false,
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
    } as any);

    const fills = [
      {
        blendMode: "NORMAL",
        type: "SOLID",
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
      {
        opacity: 0.05,
        blendMode: "NORMAL",
        type: "SOLID",
        color: {
          r: 0.08627451211214066,
          g: 0.0941176488995552,
          b: 0.13725490868091583,
          a: 1,
        },
      },
    ] as const;

    expect(tailwindBackgroundLayerClassesFromFills(fills as any)).toEqual([
      "bg-white",
      "bg-[#161823]/5",
    ]);
  });

  it("returns the single background utility through the existing path", async () => {
    await tailwindMain([], {
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
    } as any);

    const fills = [
      {
        blendMode: "NORMAL",
        type: "SOLID",
        color: { r: 1, g: 1, b: 1, a: 1 },
      },
    ] as const;

    expect(tailwindBackgroundLayerClassesFromFills(fills as any)).toEqual([
      "bg-white",
    ]);
    expect(tailwindBackgroundFromFills(fills as any)).toBe("bg-white");
  });
});

import { rgbTo6hex } from "../color.js";
import {
  swiftuiColor,
  swiftuiGradient,
} from "../../swiftui/builderImpl/swiftuiColor.js";
import {
  tailwindColor,
  tailwindGradient,
} from "../../tailwind/builderImpl/tailwindColor.js";
import {
  flutterColor,
  flutterGradient,
} from "../../flutter/builderImpl/flutterColor.js";
import {
  htmlColorFromFill,
  htmlGradientFromFills,
} from "../../html/builderImpl/htmlColor.js";
import { calculateContrastRatio } from "./commonUI.js";
import {
  LinearGradientConversion,
  SolidColorConversion,
  Framework,
} from "../../pluginTypes.js";
import { GradientPaint } from "../../api_types.js";
import { figma } from "../../runtime/figma.js";
import { processColorVariables } from "../../altNodes/jsonNodeConversion.js";

type GradientPaintWithHandles = GradientPaint & {
  gradientTransform: Transform;
};

export const retrieveGenericSolidUIColors = async (
  framework: Framework,
  includeVariables: boolean = true,
): Promise<Array<SolidColorConversion>> => {
  const selectionColors = figma.getSelectionColors();
  if (!selectionColors || selectionColors.paints.length === 0) return [];

  const colors: Array<SolidColorConversion> = [];

  // Process all paints in parallel to handle variables
  await Promise.all(
    selectionColors.paints.map(async (d) => {
      const paint = { ...d } as Paint;
      if (includeVariables) {
        await processColorVariables(paint as any);
      }

      const fill = await convertSolidColor(paint, framework);
      if (fill) {
        const exists = colors.find(
          (col) => col.exportValue === fill.exportValue,
        );
        if (!exists) {
          colors.push(fill);
        }
      }
    }),
  );

  return colors.sort((a, b) => a.hex.localeCompare(b.hex));
};

const convertSolidColor = async (
  fill: Paint,
  framework: Framework,
): Promise<SolidColorConversion | null> => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 1, g: 1, b: 1 };

  if (fill.type !== "SOLID") return null;

  const opacity = fill.opacity ?? 1.0;
  const output = {
    hex: rgbTo6hex(fill.color).toUpperCase(),
    colorName: "",
    exportValue: "",
    contrastBlack: calculateContrastRatio(fill.color, black),
    contrastWhite: calculateContrastRatio(fill.color, white),
  };

  if (framework === "Flutter") {
    output.exportValue = flutterColor(fill.color, opacity);
  } else if (framework === "HTML") {
    output.exportValue = htmlColorFromFill(fill as any);
  } else if (framework === "Tailwind") {
    // Pass true to use CSS variable syntax for variables
    output.exportValue = tailwindColor(fill as any, true).exportValue;
  } else if (framework === "SwiftUI") {
    output.exportValue = swiftuiColor(fill.color, opacity);
  }

  return output;
};

export const retrieveGenericLinearGradients = async (
  framework: Framework,
  includeVariables: boolean = true,
): Promise<Array<LinearGradientConversion>> => {
  const selectionColors = figma.getSelectionColors();
  const colorStr: Array<LinearGradientConversion> = [];

  if (!selectionColors || selectionColors.paints.length === 0) return [];

  // Process all gradient paints
  await Promise.all(
    selectionColors.paints.map(async (paint) => {
      if (paint.type === "GRADIENT_LINEAR") {
        try {
          const fill = { ...paint } as GradientPaintWithHandles;
          const t = fill.gradientTransform;
          if (
            !Array.isArray(t) ||
            t.length < 2 ||
            !Array.isArray(t[0]) ||
            !Array.isArray(t[1]) ||
            t[0].length < 3 ||
            t[1].length < 3
          ) {
            return;
          }
          fill.gradientHandlePositions = [
            { x: t[0][2], y: t[1][2] }, // Start: (e, f)
            { x: t[0][0] + t[0][2], y: t[1][0] + t[1][2] }, // End: (a + e, b + f)
          ];

          // Process gradient stops for variables
          if (includeVariables && fill.gradientStops) {
            for (const stop of fill.gradientStops) {
              if (stop.boundVariables?.color) {
                try {
                  const variableId = stop.boundVariables.color.id;
                  const variable = figma.variables.getVariableById(variableId);
                  if (variable) {
                    (stop as any).variableColorName = variable.name
                      .replace(/\s+/g, "-")
                      .toLowerCase();
                  }
                } catch (e) {
                  console.error(
                    "Error retrieving variable for gradient stop:",
                    e,
                  );
                }
              }
            }
          }

          let exportValue = "";
          switch (framework) {
            case "Flutter":
              exportValue = flutterGradient(fill);
              break;
            case "HTML":
              exportValue = htmlGradientFromFills(fill);
              break;
            case "Tailwind":
              exportValue = tailwindGradient(fill);
              break;
            case "SwiftUI":
              exportValue = swiftuiGradient(fill);
              break;
          }
          colorStr.push({
            cssPreview: htmlGradientFromFills(fill),
            exportValue,
          });
        } catch (error) {
          console.warn("Skipping unsupported gradient paint in REST adapter:", error);
        }
      }
    }),
  );

  return colorStr;
};

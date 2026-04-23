import { PluginSettings } from "../../pluginTypes.js";
import { composeMain } from "../../compose/composeMain.js";
import { flutterMain } from "../../flutter/flutterMain.js";
import { htmlMain } from "../../html/htmlMain.js";
import { swiftuiMain } from "../../swiftui/swiftuiMain.js";
import { tailwindMain } from "../../tailwind/tailwindMain.js";

export const convertToCode = async (
  nodes: SceneNode[],
  settings: PluginSettings,
) => {
  switch (settings.framework) {
    case "Tailwind":
      return await tailwindMain(nodes, settings);
    case "Flutter":
      return await flutterMain(nodes, settings);
    case "SwiftUI":
      return await swiftuiMain(nodes, settings);
    case "Compose":
      return composeMain(nodes, settings);
    case "HTML":
    default:
      return (await htmlMain(nodes, settings)).html;
  }
};

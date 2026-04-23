import {
  retrieveGenericLinearGradients,
  retrieveGenericSolidUIColors,
} from "./common/retrieveUI/retrieveColors.js";
import {
  addWarning,
  clearWarnings,
  warnings,
} from "./common/commonConversionWarnings.js";
import { postConversionComplete, postEmptyMessage } from "./messaging.js";
import { PluginSettings } from "./pluginTypes.js";
import { figma } from "./runtime/figma.js";
import { convertToCode } from "./common/retrieveUI/convertToCode.js";
import { generateHTMLPreview } from "./html/htmlMain.js";
import { oldConvertNodesToAltNodes } from "./altNodes/oldAltConversion.js";
import {
  getNodeByIdAsyncCalls,
  getNodeByIdAsyncTime,
  getStyledTextSegmentsCalls,
  getStyledTextSegmentsTime,
  nodesToJSON,
  processColorVariablesCalls,
  processColorVariablesTime,
  resetPerformanceCounters,
} from "./altNodes/jsonNodeConversion.js";

export const run = async (settings: PluginSettings) => {
  resetPerformanceCounters();
  clearWarnings();

  const { framework, useOldPluginVersion2025 } = settings;
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    postEmptyMessage();
    return;
  }

  // Timing with Date.now() instead of console.time
  const nodeToJSONStart = Date.now();

  let convertedSelection: any;
  if (useOldPluginVersion2025) {
    convertedSelection = oldConvertNodesToAltNodes(selection, null);
  } else {
    convertedSelection = await nodesToJSON(selection, settings);
  }

  // ignore when nothing was selected
  // If the selection was empty, the converted selection will also be empty.
  if (convertedSelection.length === 0) {
    postEmptyMessage();
    return;
  }

  const convertToCodeStart = Date.now();
  const code = await convertToCode(convertedSelection, settings);

  const generatePreviewStart = Date.now();
  const htmlPreview = await generateHTMLPreview(convertedSelection, settings);

  const colorPanelStart = Date.now();
  const colors = await retrieveGenericSolidUIColors(
    framework,
    settings.useColorVariables,
  );
  const gradients = await retrieveGenericLinearGradients(
    framework,
    settings.useColorVariables,
  );

  postConversionComplete({
    code,
    htmlPreview,
    colors,
    gradients,
    settings,
    warnings: [...warnings],
  });
};

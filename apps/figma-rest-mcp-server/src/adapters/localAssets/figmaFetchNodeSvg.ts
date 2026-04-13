import { fetchNodeSvgForTarget } from "./figmaWorkflow.js";

export async function runFigmaFetchNodeSvg(
  options: Parameters<typeof fetchNodeSvgForTarget>[0],
) {
  return await fetchNodeSvgForTarget(options);
}

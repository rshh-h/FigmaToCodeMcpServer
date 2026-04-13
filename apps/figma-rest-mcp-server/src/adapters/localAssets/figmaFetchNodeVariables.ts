import { fetchNodeVariablesForTarget } from "./figmaWorkflow.js";

export async function runFigmaFetchNodeVariables(
  options: Parameters<typeof fetchNodeVariablesForTarget>[0],
) {
  return await fetchNodeVariablesForTarget(options);
}

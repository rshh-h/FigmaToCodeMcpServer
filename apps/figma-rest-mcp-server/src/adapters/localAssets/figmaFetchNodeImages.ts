import { fetchNodeImagesForTarget } from "./figmaWorkflow.js";

export async function runFigmaFetchNodeImages(
  options: Parameters<typeof fetchNodeImagesForTarget>[0],
) {
  return await fetchNodeImagesForTarget(options);
}

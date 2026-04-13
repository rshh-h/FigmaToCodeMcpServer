import { createApplication } from "../src/application/factory.js";
import type { ConvertRequest, Framework } from "../src/core/contracts.js";

const framework = readFramework(process.env.FIGMA_VERIFY_FRAMEWORK);
const fileUrl = process.env.FIGMA_FILE_URL;

if (!process.env.FIGMA_ACCESS_TOKEN) {
  fail("FIGMA_ACCESS_TOKEN is required.");
} else if (!fileUrl) {
  fail("Set FIGMA_FILE_URL for the sample node.");
} else {
  const app = createApplication(process.env);
  await app.startup();

  const capabilities = await app.capabilitiesUseCase.execute({ framework });
  console.log(
    JSON.stringify(
      {
        check: "capabilities",
        framework,
        features: capabilities.features,
        limits: capabilities.limits,
      },
      null,
      2,
    ),
  );

  const requests: ConvertRequest[] = [
    {
      source: { url: fileUrl },
      workspaceRoot: process.cwd(),
      framework,
      returnPreview: true,
      includeDiagnostics: true,
    },
  ];

  for (const request of requests) {
    const response = await app.convertUseCase.execute(request);
    if (!response.code || !response.diagnostics?.sourceNodeIds?.length) {
      throw new Error("Convert response did not include code and source diagnostics.");
    }

    console.log(
      JSON.stringify(
        {
          check: "convert",
          source: Object.keys(request.source),
          framework: response.framework,
          codeLength: response.code.length,
          warningCount: response.warnings.length,
          preview: Boolean(response.preview),
          diagnostics: {
            sourceFileKey: response.diagnostics.sourceFileKey,
            sourceNodeIds: response.diagnostics.sourceNodeIds,
            decisions: response.diagnostics.decisions,
          },
        },
        null,
        2,
      ),
    );
  }
}

function readFramework(value: string | undefined): Framework {
  const fallback: Framework = "HTML";
  if (
    value === "HTML" ||
    value === "Tailwind" ||
    value === "Flutter" ||
    value === "SwiftUI" ||
    value === "Compose"
  ) {
    return value;
  }
  return fallback;
}

function fail(message: string): never {
  console.error(
    [
      message,
      "Example:",
      "  FIGMA_ACCESS_TOKEN=... FIGMA_FILE_URL='https://www.figma.com/design/3JlJhGRKW81I8RTH1Lernb/D2C-test-case?node-id=1-1427&t=mIXdjMtAnUvQcgH6-4' pnpm --filter figma-to-code-mcp-server verify:real",
    ].join("\n"),
  );
  process.exit(2);
}

import { describe, expect, it } from "vitest";
import { FigmaLinkParserAdapter } from "../../src/adapters/sourceResolver.js";
import { ServiceError } from "../../src/core/errors.js";

describe("FigmaLinkParserAdapter", () => {
  const resolver = new FigmaLinkParserAdapter();
  const validUrl =
    "https://www.figma.com/design/ANONFILEKEY1234567890AB/anonymized-case?node-id=1-1427&t=fixture-token";

  it("parses a single-node figma url into a single target", () => {
    const resolved = resolver.resolve({
      url: validUrl,
    });

    expect(resolved.fileKey).toBe("ANONFILEKEY1234567890AB");
    expect(resolved.nodeIds).toEqual(["1:1427"]);
    expect(resolved.sourceKind).toBe("url");
  });

  it("parses a legacy file url path", () => {
    const resolved = resolver.resolve({
      url: "https://www.figma.com/file/FILE123/Demo?node-id=1-2",
    });

    expect(resolved.fileKey).toBe("FILE123");
    expect(resolved.nodeIds).toEqual(["1:2"]);
  });

  it("throws when url does not contain node-id", () => {
    expect(() =>
      resolver.resolve({
        url: "https://www.figma.com/design/FILE123/Demo",
      }),
    ).toThrow(ServiceError);
  });

  it("throws when url does not contain a file key", () => {
    expect(() =>
      resolver.resolve({
        url: "https://www.figma.com/proto/Demo?node-id=1-2",
      }),
    ).toThrow(ServiceError);
  });
});

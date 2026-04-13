import { describe, expect, it, vi } from "vitest";
import { fetchSvgSignedUrls } from "../../src/adapters/vectorSvgExport.js";

describe("fetchSvgSignedUrls", () => {
  it("batches svg export URL requests", async () => {
    const getJson = vi
      .fn()
      .mockResolvedValueOnce({
        images: {
          "1:1": "https://signed.example.com/1.svg",
          "1:2": "https://signed.example.com/2.svg",
        },
      })
      .mockResolvedValueOnce({
        images: {
          "1:3": "https://signed.example.com/3.svg",
        },
      });

    const result = await fetchSvgSignedUrls({
      fileKey: "FILE",
      ids: ["1:1", "1:2", "1:3"],
      token: "token",
      httpClient: { getJson } as any,
      batchSize: 2,
    });

    expect(result).toEqual({
      "1:1": "https://signed.example.com/1.svg",
      "1:2": "https://signed.example.com/2.svg",
      "1:3": "https://signed.example.com/3.svg",
    });
    expect(getJson).toHaveBeenCalledTimes(2);
    expect(getJson).toHaveBeenNthCalledWith(1, {
      path: "/v1/images/FILE",
      headers: {
        "X-Figma-Token": "token",
      },
      query: {
        ids: "1:1,1:2",
        format: "svg",
      },
    });
    expect(getJson).toHaveBeenNthCalledWith(2, {
      path: "/v1/images/FILE",
      headers: {
        "X-Figma-Token": "token",
      },
      query: {
        ids: "1:3",
        format: "svg",
      },
    });
  });
});

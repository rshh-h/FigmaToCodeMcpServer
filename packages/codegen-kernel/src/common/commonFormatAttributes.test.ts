import { describe, expect, it } from "vitest";
import {
  formatDataAttribute,
  formatTwigAttribute,
  sanitizeAttributeName,
} from "./commonFormatAttributes";

describe("commonFormatAttributes", () => {
  it("sanitizes component property names into safe attribute names", () => {
    expect(sanitizeAttributeName("icon 20*20")).toBe("icon-20x20");
    expect(sanitizeAttributeName("Action 3#14765:0")).toBe("action-3-14765-0");
    expect(sanitizeAttributeName("尺寸=16, 形状=outlined")).toBe(
      "尺寸-16-形状-outlined",
    );
  });

  it("formats safe data attributes", () => {
    expect(formatDataAttribute("icon 20*20", "搜索")).toBe(
      ' data-icon-20x20="搜索"',
    );
  });

  it("drops empty or invalid twig attribute names", () => {
    expect(formatTwigAttribute("...", "x")).toBe("");
    expect(formatTwigAttribute("icon 20*20", "搜索")).toBe(
      ' icon-20x20="搜索"',
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  getAutoLayoutMainAxisSizing,
  shouldPreventAutoLayoutFlexShrink,
} from "./autoLayoutFlexChild.js";

describe("autoLayoutFlexChild", () => {
  it("prevents shrink for fixed-size children on the parent's main axis", () => {
    const node = {
      parent: {
        layoutMode: "VERTICAL",
      },
      layoutSizingVertical: "FIXED",
    } as SceneNode;

    expect(getAutoLayoutMainAxisSizing(node)).toBe("FIXED");
    expect(shouldPreventAutoLayoutFlexShrink(node)).toBe(true);
  });

  it("prevents shrink for hug-size children on the parent's main axis", () => {
    const node = {
      parent: {
        layoutMode: "HORIZONTAL",
      },
      layoutSizingHorizontal: "HUG",
    } as SceneNode;

    expect(getAutoLayoutMainAxisSizing(node)).toBe("HUG");
    expect(shouldPreventAutoLayoutFlexShrink(node)).toBe(true);
  });

  it("keeps fill children shrinkable on the parent's main axis", () => {
    const node = {
      parent: {
        layoutMode: "VERTICAL",
      },
      layoutSizingVertical: "FILL",
    } as SceneNode;

    expect(getAutoLayoutMainAxisSizing(node)).toBe("FILL");
    expect(shouldPreventAutoLayoutFlexShrink(node)).toBe(false);
  });

  it("ignores absolute-positioned children inside auto layout", () => {
    const node = {
      parent: {
        layoutMode: "VERTICAL",
      },
      layoutPositioning: "ABSOLUTE",
      layoutSizingVertical: "FIXED",
    } as SceneNode;

    expect(getAutoLayoutMainAxisSizing(node)).toBeNull();
    expect(shouldPreventAutoLayoutFlexShrink(node)).toBe(false);
  });
});

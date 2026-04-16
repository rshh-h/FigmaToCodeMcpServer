import { describe, expect, it } from "vitest";
import { buildMaskRenderPlan } from "./maskNodes";

const absoluteParent = {
  type: "FRAME",
  layoutMode: "NONE",
} as SceneNode;

describe("maskNodes", () => {
  it("groups simple structural mask nodes with subsequent siblings", () => {
    const maskNode = {
      id: "mask",
      name: "Mask",
      type: "RECTANGLE",
      isMask: true,
      maskType: "ALPHA",
    } as SceneNode;
    const maskedNode = {
      id: "content",
      name: "Content",
      type: "RECTANGLE",
      parent: absoluteParent,
    } as SceneNode;

    const plan = buildMaskRenderPlan([maskNode, maskedNode]);

    expect(plan).toEqual([
      {
        kind: "mask-group",
        maskNode,
        maskedNodes: [maskedNode],
      },
    ]);
  });

  it("warns for luminance masks", () => {
    const maskNode = {
      id: "mask",
      name: "Luminance Mask",
      type: "RECTANGLE",
      isMask: true,
      maskType: "LUMINANCE",
    } as SceneNode;
    const maskedNode = {
      id: "content",
      name: "Content",
      type: "RECTANGLE",
      parent: absoluteParent,
    } as SceneNode;

    const plan = buildMaskRenderPlan([maskNode, maskedNode]);

    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({
      kind: "node",
      node: maskNode,
    });
    expect((plan[0] as { warning?: string }).warning).toContain(
      'unsupported maskType "LUMINANCE"',
    );
  });

  it("warns when masked siblings are not absolutely positioned", () => {
    const maskNode = {
      id: "mask",
      name: "Mask",
      type: "RECTANGLE",
      isMask: true,
      maskType: "ALPHA",
    } as SceneNode;
    const maskedNode = {
      id: "content",
      name: "Content",
      type: "RECTANGLE",
      parent: {
        type: "FRAME",
        layoutMode: "VERTICAL",
      },
    } as SceneNode;

    const plan = buildMaskRenderPlan([maskNode, maskedNode]);

    expect(plan).toHaveLength(2);
    expect((plan[0] as { warning?: string }).warning).toContain(
      "not absolutely positioned",
    );
  });
});

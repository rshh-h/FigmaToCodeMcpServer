import { describe, expect, it } from "vitest";
import { buildMaskRenderPlan } from "./maskNodes.js";
import { annotateRenderSemantics } from "./renderSemantics.js";

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

  it("skips luminance masks instead of rendering their fill", () => {
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
      kind: "skip",
    });
    expect((plan[0] as { warning?: string }).warning).toContain(
      'unsupported maskType "LUMINANCE"',
    );
    expect(plan[1]).toEqual({ kind: "node", node: maskedNode });
  });

  it("routes vector masks through the structural mask path with an approximation warning", () => {
    const maskNode = {
      id: "mask",
      name: "Vector Mask",
      type: "VECTOR",
      isMask: true,
      maskType: "ALPHA",
      width: 47,
      height: 47,
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
        warning:
          'Mask node "Vector Mask" (mask) is a VECTOR mask and is being approximated with rectangular overflow clipping.',
      },
    ]);
  });

  it("skips masks whose siblings are not absolutely positioned instead of rendering the mask fill", () => {
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
    expect(plan[0]).toMatchObject({ kind: "skip" });
    expect((plan[0] as { warning?: string }).warning).toContain(
      "not absolutely positioned",
    );
    expect(plan[1]).toEqual({ kind: "node", node: maskedNode });
  });

  it("stops masking at the next mask boundary and supports multiple mask groups", () => {
    const firstMask = {
      id: "mask-1",
      name: "Mask 1",
      type: "RECTANGLE",
      isMask: true,
      maskType: "ALPHA",
    } as SceneNode;
    const firstContent = {
      id: "content-1",
      name: "Content 1",
      type: "RECTANGLE",
      parent: absoluteParent,
    } as SceneNode;
    const secondMask = {
      id: "mask-2",
      name: "Mask 2",
      type: "RECTANGLE",
      isMask: true,
      maskType: "ALPHA",
    } as SceneNode;
    const secondContent = {
      id: "content-2",
      name: "Content 2",
      type: "RECTANGLE",
      parent: absoluteParent,
    } as SceneNode;

    const plan = buildMaskRenderPlan([
      firstMask,
      firstContent,
      secondMask,
      secondContent,
    ]);

    expect(plan).toEqual([
      {
        kind: "mask-group",
        maskNode: firstMask,
        maskedNodes: [firstContent],
      },
      {
        kind: "mask-group",
        maskNode: secondMask,
        maskedNodes: [secondContent],
      },
    ]);
  });

  it("treats semantic mask boundaries as the end of the current mask scope", () => {
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
    const boundaryGroup = {
      id: "boundary",
      name: "Boundary",
      type: "GROUP",
      width: 10,
      height: 10,
      children: [
        {
          id: "nested-mask",
          name: "Nested mask",
          type: "RECTANGLE",
          isMask: true,
        },
      ],
    } as any as SceneNode;

    annotateRenderSemantics([boundaryGroup]);

    const plan = buildMaskRenderPlan([maskNode, maskedNode, boundaryGroup]);

    expect(plan).toEqual([
      {
        kind: "mask-group",
        maskNode,
        maskedNodes: [maskedNode],
      },
      {
        kind: "node",
        node: boundaryGroup,
      },
    ]);
  });

  it("skips a mask with no subsequent siblings instead of rendering its fill", () => {
    const maskNode = {
      id: "mask",
      name: "Subtract",
      type: "VECTOR",
      isMask: true,
      maskType: "ALPHA",
      fills: [{ type: "SOLID", color: { r: 0.58, g: 0, b: 0, a: 1 } }],
    } as unknown as SceneNode;

    const plan = buildMaskRenderPlan([maskNode]);

    expect(plan).toEqual([
      {
        kind: "skip",
        warning: expect.stringContaining("no subsequent siblings to mask"),
      },
    ]);
  });
});

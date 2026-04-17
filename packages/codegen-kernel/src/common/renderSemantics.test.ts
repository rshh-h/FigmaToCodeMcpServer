import { describe, expect, it } from "vitest";
import {
  analyzeRenderSemantics,
  annotateRenderSemantics,
  hasExplicitVisualStyle,
  hasMeaningfulRelativeLayout,
} from "./renderSemantics";
import { tailwindMain } from "../tailwind/tailwindMain";
import { htmlMain } from "../html/htmlMain";
import { PluginSettings } from "../pluginTypes";

const createSettings = (framework: "Tailwind" | "HTML"): PluginSettings =>
  ({
    framework,
    showLayerNames: false,
    embedImages: true,
    embedVectors: true,
    useColorVariables: false,
    htmlGenerationMode: "jsx",
    tailwindGenerationMode: "jsx",
    roundTailwindValues: false,
    roundTailwindColors: true,
    baseFontSize: 16,
    useTailwind4: false,
    thresholdPercent: 0.5,
    baseFontFamily: "sans",
    fontFamilyCustomConfig: {},
    flutterGenerationMode: "snippet",
    swiftUIGenerationMode: "snippet",
    composeGenerationMode: "snippet",
    useOldPluginVersion2025: false,
    responsiveRoot: false,
  }) as PluginSettings;

const createRectangle = (
  id: string,
  x: number,
  y: number,
): SceneNode =>
  ({
    id,
    name: id,
    type: "RECTANGLE",
    width: 10,
    height: 10,
    x,
    y,
    visible: true,
    fills: [],
    strokes: [],
    effects: [],
  }) as any as SceneNode;

const createDividerNode = (): SceneNode => {
  const parent = {
    id: "parent",
    name: "Parent",
    type: "FRAME",
    layoutMode: "VERTICAL",
  } as any as SceneNode;

  return {
    id: "divider",
    name: "Divider",
    type: "FRAME",
    width: 342,
    height: 0.5,
    visible: true,
    parent,
    children: [],
    fills: [
      {
        type: "SOLID",
        blendMode: "NORMAL",
        color: {
          r: 0.08627451211214066,
          g: 0.0941176488995552,
          b: 0.13725490868091583,
        },
        opacity: 0.11999999731779099,
      },
    ],
    strokes: [],
    effects: [],
    layoutMode: "HORIZONTAL",
    paddingLeft: 16,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    itemSpacing: 10,
    layoutSizingHorizontal: "FILL",
    layoutSizingVertical: "FIXED",
  } as any as SceneNode;
};

describe("renderSemantics", () => {
  it("preserves groups that organize multiple children by local offsets", () => {
    const group = {
      id: "social-tags",
      name: "Social tags",
      type: "GROUP",
      width: 177,
      height: 18,
      children: [
        { id: "a", name: "A", type: "INSTANCE", x: 0, y: 0, visible: true },
        { id: "b", name: "B", type: "INSTANCE", x: 39, y: 0, visible: true },
        { id: "c", name: "C", type: "INSTANCE", x: 103, y: 0, visible: true },
      ],
    } as any as SceneNode;
    const parent = {
      id: "parent",
      name: "Parent",
      type: "FRAME",
      layoutMode: "VERTICAL",
    } as any as SceneNode;

    expect(hasMeaningfulRelativeLayout(group)).toBe(true);

    const semantics = analyzeRenderSemantics(group, parent);
    expect(semantics.preserveWrapper).toBe(true);
    expect(semantics.establishesLocalCoordinates).toBe(true);
    expect(semantics.preserveWrapperReasons).toContain("local-coordinate-root");
    expect(semantics.preserveWrapperReasons).toContain("flow-item");
    expect(semantics.flattenStrategy).toBe("forbid");
  });

  it("preserves mask boundaries", () => {
    const group = {
      id: "mask-group",
      name: "Mask group",
      type: "GROUP",
      children: [
        { id: "mask", name: "Mask", type: "RECTANGLE", isMask: true },
        { id: "content", name: "Content", type: "RECTANGLE" },
      ],
    } as any as SceneNode;

    const semantics = analyzeRenderSemantics(group, null);
    expect(semantics.isMaskBoundary).toBe(true);
    expect(semantics.preserveWrapper).toBe(true);
    expect(semantics.flattenStrategy).toBe("forbid");
    expect(semantics.mergeStrategy).toBe("forbid");
  });

  it("treats opacity as a visual wrapper reason", () => {
    const group = {
      id: "visual-group",
      name: "Visual group",
      type: "GROUP",
      opacity: 0.5,
      children: [{ id: "child", name: "Child", type: "RECTANGLE" }],
    } as any as SceneNode;

    expect(hasExplicitVisualStyle(group)).toBe(true);
    expect(analyzeRenderSemantics(group, null).preserveWrapper).toBe(true);
  });

  it("annotates descendants recursively", () => {
    const root = {
      id: "root",
      name: "Root",
      type: "FRAME",
      children: [
        {
          id: "group",
          name: "Group",
          type: "GROUP",
          width: 20,
          height: 10,
          children: [
            { id: "a", name: "A", type: "RECTANGLE", x: 0, y: 0 },
            { id: "b", name: "B", type: "RECTANGLE", x: 10, y: 0 },
          ],
        },
      ],
    } as any as SceneNode;

    annotateRenderSemantics([root]);

    expect((root as any).renderSemantics).toBeDefined();
    expect(((root as any).children[0] as any).renderSemantics.preserveWrapper).toBe(true);
  });

  it("renders a structural wrapper for local-coordinate groups in Tailwind", async () => {
    const childA = createRectangle("a", 0, 0);
    const childB = createRectangle("b", 10, 0);
    const group = {
      id: "group",
      name: "Group",
      type: "GROUP",
      width: 20,
      height: 10,
      x: 0,
      y: 0,
      visible: true,
      children: [childA, childB],
    } as any as GroupNode;
    (childA as any).parent = group;
    (childB as any).parent = group;

    const code = await tailwindMain([group], createSettings("Tailwind"));
    expect(code).toContain('className="w-5 h-2.5 relative"');
  });

  it("renders a structural wrapper for local-coordinate groups in HTML/JSX", async () => {
    const childA = createRectangle("a", 0, 0);
    const childB = createRectangle("b", 10, 0);
    const group = {
      id: "group",
      name: "Group",
      type: "GROUP",
      width: 20,
      height: 10,
      x: 0,
      y: 0,
      visible: true,
      children: [childA, childB],
    } as any as GroupNode;
    (childA as any).parent = group;
    (childB as any).parent = group;

    const output = await htmlMain([group], createSettings("HTML"));
    expect(output.html).toContain("width: 20");
    expect(output.html).toContain("height: 10");
    expect(output.html).toContain("position: 'relative'");
  });

  it("renders sized structural mask wrappers in Tailwind", async () => {
    const mask = {
      id: "mask",
      name: "Mask",
      type: "RECTANGLE",
      width: 172,
      height: 228,
      x: 12,
      y: 135,
      visible: true,
      isMask: true,
      maskType: "ALPHA",
      fills: [],
      strokes: [],
      effects: [],
    } as any as SceneNode;
    const content = {
      id: "content",
      name: "Content",
      type: "RECTANGLE",
      width: 404,
      height: 228,
      x: -116,
      y: 135,
      visible: true,
      fills: [],
      strokes: [],
      effects: [],
      parent: {
        id: "parent",
        name: "Parent",
        type: "FRAME",
        layoutMode: "NONE",
        absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
      },
    } as any as SceneNode;
    (mask as any).parent = (content as any).parent;

    const code = await tailwindMain([mask, content], createSettings("Tailwind"));
    expect(code).toContain('className="w-[172px] h-[228px] left-[12px] top-[135px] absolute overflow-hidden"');
    expect(code).toContain('className="absolute left-[-12px] top-[-135px] w-[172px] h-[228px]"');
  });

  it("renders sized structural mask wrappers in HTML/JSX", async () => {
    const parent = {
      id: "parent",
      name: "Parent",
      type: "FRAME",
      layoutMode: "NONE",
      absoluteBoundingBox: { x: 0, y: 0, width: 375, height: 812 },
    } as any as SceneNode;
    const mask = {
      id: "mask",
      name: "Mask",
      type: "RECTANGLE",
      width: 172,
      height: 228,
      x: 12,
      y: 135,
      visible: true,
      isMask: true,
      maskType: "ALPHA",
      fills: [],
      strokes: [],
      effects: [],
      parent,
    } as any as SceneNode;
    const content = {
      id: "content",
      name: "Content",
      type: "RECTANGLE",
      width: 404,
      height: 228,
      x: -116,
      y: 135,
      visible: true,
      fills: [],
      strokes: [],
      effects: [],
      parent,
    } as any as SceneNode;

    const output = await htmlMain([mask, content], createSettings("HTML"));
    expect(output.html).toContain("position: 'absolute'");
    expect(output.html).toContain("width: 172");
    expect(output.html).toContain("height: 228");
  });

  it("does not emit padding for empty auto-layout divider frames in Tailwind", async () => {
    const code = await tailwindMain([createDividerNode()], createSettings("Tailwind"));

    expect(code).toContain("self-stretch");
    expect(code).toContain("h-[0.50px]");
    expect(code).toContain("bg-gray-900/10");
    expect(code).not.toContain("pl-4");
    expect(code).not.toContain("pr-2.5");
    expect(code).not.toContain("py-2.5");
  });

  it("does not emit padding styles for empty auto-layout divider frames in HTML/JSX", async () => {
    const output = await htmlMain([createDividerNode()], createSettings("HTML"));

    expect(output.html).toContain("height: 0.5");
    expect(output.html).not.toContain("paddingLeft");
    expect(output.html).not.toContain("paddingRight");
    expect(output.html).not.toContain("paddingTop");
    expect(output.html).not.toContain("paddingBottom");
  });

  it("forbids merge for local-coordinate groups with non-primitive direct children", () => {
    const group = {
      id: "cards",
      name: "Cards",
      type: "GROUP",
      width: 48,
      height: 16,
      children: [
        {
          id: "left",
          name: "Left",
          type: "GROUP",
          x: 0,
          y: 0,
          visible: true,
          children: [{ id: "left-shape", name: "Shape", type: "RECTANGLE", x: 0, y: 0 }],
        },
        {
          id: "right",
          name: "Right",
          type: "GROUP",
          x: 24,
          y: 0,
          visible: true,
          children: [{ id: "right-shape", name: "Shape", type: "RECTANGLE", x: 0, y: 0 }],
        },
      ],
    } as any as SceneNode;

    const semantics = analyzeRenderSemantics(group, null);
    expect(semantics.flattenStrategy).toBe("forbid");
    expect(semantics.mergeStrategy).toBe("forbid");
  });

  it("allows merge for primitive-only icon groups", () => {
    const group = {
      id: "icon",
      name: "Icon",
      type: "GROUP",
      width: 16,
      height: 16,
      children: [
        { id: "v1", name: "V1", type: "VECTOR", x: 0, y: 0, visible: true },
        { id: "v2", name: "V2", type: "VECTOR", x: 0, y: 0, visible: true },
      ],
    } as any as SceneNode;

    const semantics = analyzeRenderSemantics(group, null);
    expect(semantics.mergeStrategy).toBe("allow");
  });
});

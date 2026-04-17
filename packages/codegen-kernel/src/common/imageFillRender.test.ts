import { describe, expect, it } from "vitest";
import { getImageFillRenderPlan } from "./imageFillRender";
import {
  isCircularImageFillVectorNode,
  isCircularVectorPath,
} from "./vectorShape";
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

const createImageNode = (scaleMode: "FILL" | "FIT" | "STRETCH" | "TILE") =>
  ({
    id: `node-${scaleMode}`,
    name: `Node ${scaleMode}`,
    type: "RECTANGLE",
    width: 404,
    height: 228,
    x: -116,
    y: 0,
    visible: true,
    fills: [
      {
        type: "IMAGE",
        scaleMode,
        imageRef: `image-${scaleMode}`,
      },
    ],
    strokes: [],
    effects: [],
    parent: {
      id: `parent-${scaleMode}`,
      name: `Parent ${scaleMode}`,
      type: "FRAME",
      layoutMode: "NONE",
    },
    localImagePath: `/tmp/${scaleMode.toLowerCase()}.png`,
  }) as any as SceneNode;

const circlePath =
  "M24 48C37.2548 48 48 37.2548 48 24C48 10.7452 37.2548 0 24 0C10.7452 0 0 10.7452 0 24C0 37.2548 10.7452 48 24 48Z";

const createCircularVectorImageNode = (strokeVisible: boolean) =>
  ({
    id: `vector-${strokeVisible ? "visible" : "hidden"}`,
    name: "Oval",
    type: "VECTOR",
    width: 48,
    height: 48,
    x: 0,
    y: 0,
    visible: true,
    fills: [
      {
        type: "IMAGE",
        scaleMode: "FILL",
        imageRef: "avatar",
      },
    ],
    fillGeometry: [
      {
        path: circlePath,
        windingRule: "NONZERO",
      },
    ],
    strokes: strokeVisible
      ? [
          {
            type: "SOLID",
            opacity: 0.12,
            color: {
              r: 0.08627451211214066,
              g: 0.0941176488995552,
              b: 0.13725490868091583,
              a: 1,
            },
          },
        ]
      : [
          {
            type: "SOLID",
            visible: false,
            color: {
              r: 1,
              g: 1,
              b: 1,
              a: 1,
            },
          },
        ],
    strokeWeight: strokeVisible ? 0.5 : 3,
    strokeAlign: strokeVisible ? "INSIDE" : "OUTSIDE",
    effects: [],
    parent: {
      id: `parent-vector-${strokeVisible ? "visible" : "hidden"}`,
      name: "Parent",
      type: "FRAME",
      layoutMode: "NONE",
    },
    localImagePath: "/tmp/avatar.png",
  }) as any as SceneNode;

const createRectangleVectorImageNode = () =>
  ({
    ...createCircularVectorImageNode(false),
    id: "vector-rectangle",
    width: 48,
    height: 48,
    fillGeometry: [
      {
        path: "M0 0C16 0 32 0 48 0C48 16 48 32 48 48C32 48 16 48 0 48C0 32 0 16 0 0Z",
        windingRule: "NONZERO",
      },
    ],
  }) as any as SceneNode;

describe("imageFillRender", () => {
  it("maps FILL to an img cover plan", () => {
    expect(
      getImageFillRenderPlan(
        {
          type: "IMAGE",
          scaleMode: "FILL",
          imageRef: "hero",
        } as any,
        false,
      ),
    ).toEqual({
      renderMode: "img",
      disableMaxWidth: true,
      objectFit: "cover",
      objectPosition: "center",
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    });
  });

  it("maps FIT to contain", () => {
    expect(
      getImageFillRenderPlan(
        {
          type: "IMAGE",
          scaleMode: "FIT",
          imageRef: "hero",
        } as any,
        false,
      ).objectFit,
    ).toBe("contain");
  });

  it("maps STRETCH to fill", () => {
    expect(
      getImageFillRenderPlan(
        {
          type: "IMAGE",
          scaleMode: "STRETCH",
          imageRef: "hero",
        } as any,
        false,
      ),
    ).toMatchObject({
      renderMode: "img",
      objectFit: "fill",
      backgroundSize: "100% 100%",
    });
  });

  it("forces TILE to background rendering", () => {
    expect(
      getImageFillRenderPlan(
        {
          type: "IMAGE",
          scaleMode: "TILE",
          imageRef: "hero",
        } as any,
        false,
      ),
    ).toEqual({
      renderMode: "background",
      disableMaxWidth: false,
      backgroundSize: "auto",
      backgroundPosition: "0 0",
      backgroundRepeat: "repeat",
    });
  });

  it("renders FILL image nodes with img sizing guards in Tailwind", async () => {
    const code = await tailwindMain(
      [createImageNode("FILL")],
      createSettings("Tailwind"),
    );

    expect(code).toContain("max-w-none");
    expect(code).toContain("object-cover");
    expect(code).toContain("object-center");
    expect(code).toContain('w-[404px] h-[228px] left-[-116px] top-0 absolute');
  });

  it("renders FIT image nodes with object contain in HTML/JSX", async () => {
    const output = await htmlMain(
      [createImageNode("FIT")],
      createSettings("HTML"),
    );

    expect(output.html).toContain("objectFit: 'contain'");
    expect(output.html).toContain("objectPosition: 'center'");
    expect(output.html).toContain("maxWidth: 'none'");
  });

  it("renders TILE image nodes as background layers", async () => {
    const code = await tailwindMain(
      [createImageNode("TILE")],
      createSettings("Tailwind"),
    );

    expect(code).toContain("bg-repeat");
    expect(code).toContain("backgroundImage");
    expect(code).not.toContain("<img");
  });

  it("detects circular vector image fills", () => {
    const node = createCircularVectorImageNode(false);

    expect(isCircularVectorPath(node)).toBe(true);
    expect(isCircularImageFillVectorNode(node)).toBe(true);
    expect(isCircularVectorPath(createRectangleVectorImageNode())).toBe(false);
  });

  it("renders circular vector image fills as rounded img in Tailwind without invisible outline", async () => {
    const code = await tailwindMain(
      [createCircularVectorImageNode(false)],
      createSettings("Tailwind"),
    );

    expect(code).toContain("<img");
    expect(code).toContain("rounded-full");
    expect(code).toContain("object-cover");
    expect(code).not.toContain("outline");
    expect(code).not.toContain("border-");
  });

  it("renders circular vector image fills with visible inside stroke as rounded border in Tailwind", async () => {
    const code = await tailwindMain(
      [createCircularVectorImageNode(true)],
      createSettings("Tailwind"),
    );

    expect(code).toContain("<img");
    expect(code).toContain("rounded-full");
    expect(code).toContain("border-[0.50px]");
    expect(code).not.toContain("outline");
  });

  it("renders circular vector image fills as rounded img in HTML/JSX", async () => {
    const output = await htmlMain(
      [createCircularVectorImageNode(false)],
      createSettings("HTML"),
    );

    expect(output.html).toContain("borderRadius: 9999");
    expect(output.html).toContain("objectFit: 'cover'");
    expect(output.html).not.toContain("outline:");
  });
});

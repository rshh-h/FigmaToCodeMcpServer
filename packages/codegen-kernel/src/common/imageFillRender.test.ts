import { describe, expect, it } from "vitest";
import { getImageFillRenderPlan } from "./imageFillRender";
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
});

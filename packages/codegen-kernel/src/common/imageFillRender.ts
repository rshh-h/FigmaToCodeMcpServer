import type { ImagePaint } from "../api_types.js";

export type ImageFillRenderPlan = {
  renderMode: "img" | "background";
  disableMaxWidth: boolean;
  objectFit?: "cover" | "contain" | "fill";
  objectPosition?: "center";
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: "repeat" | "no-repeat";
};

export const getImageFillRenderPlan = (
  fill: ImagePaint,
  hasChildren: boolean,
): ImageFillRenderPlan => {
  const renderMode =
    hasChildren || fill.scaleMode === "TILE" ? "background" : "img";

  switch (fill.scaleMode) {
    case "FIT":
      return {
        renderMode,
        disableMaxWidth: renderMode === "img",
        objectFit: "contain",
        objectPosition: "center",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    case "STRETCH":
      return {
        renderMode,
        disableMaxWidth: renderMode === "img",
        objectFit: "fill",
        backgroundSize: "100% 100%",
        backgroundPosition: "0 0",
        backgroundRepeat: "no-repeat",
      };
    case "TILE":
      return {
        renderMode: "background",
        disableMaxWidth: false,
        backgroundSize: "auto",
        backgroundPosition: "0 0",
        backgroundRepeat: "repeat",
      };
    case "FILL":
    default:
      return {
        renderMode,
        disableMaxWidth: renderMode === "img",
        objectFit: "cover",
        objectPosition: "center",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
  }
};

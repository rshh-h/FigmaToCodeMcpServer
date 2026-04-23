export type PaintLike =
  | {
      type: "SOLID";
      visible?: boolean;
      opacity?: number;
      color: { r: number; g: number; b: number; a?: number };
      boundVariables?: Record<string, unknown>;
    }
  | {
      type: "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND";
      visible?: boolean;
      opacity?: number;
      gradientStops: Array<Record<string, unknown>>;
      gradientHandlePositions?: Array<{ x: number; y: number }>;
      gradientTransform?: unknown;
      boundVariables?: Record<string, unknown>;
    }
  | {
      type: "IMAGE";
      visible?: boolean;
      opacity?: number;
      imageRef: string;
      scaleMode?: string;
      boundVariables?: Record<string, unknown>;
    }
  | {
      type: string;
      visible?: boolean;
      opacity?: number;
      [key: string]: unknown;
    };

/**
 * Retrieve the first visible color that is being used by the layer, in case there are more than one.
 */
export function retrieveTopFill<T>(
  fills: ReadonlyArray<T>,
): T | undefined;
export function retrieveTopFill(
  fills: ReadonlyArray<unknown> | undefined | unknown,
): unknown | undefined;
export function retrieveTopFill(
  fills: ReadonlyArray<unknown> | undefined | unknown,
): unknown | undefined {
  if (fills && Array.isArray(fills) && fills.length > 0) {
    // on Figma, the top layer is always at the last position
    // reverse, then try to find the first layer that is visible, if any.
    return [...fills].reverse().find((d) => {
      if (!d || typeof d !== "object") {
        return false;
      }
      return (d as { visible?: boolean }).visible !== false;
    });
  }

  return undefined;
};

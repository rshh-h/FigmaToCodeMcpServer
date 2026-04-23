import type { PaintLike } from "./common/retrieveFill.js";

export type AltNode = {
  [key: string]: unknown;
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  rotation?: number;
  children?: AltNode[];
  parent?: AltNode | null;
  style?: Record<string, unknown>;
  opacity?: number;
  textAutoResize?: string;
  layoutMode?: string;
  layoutGrow?: number;
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  fills?: readonly PaintLike[];
  strokes?: readonly PaintLike[];
  effects?: readonly unknown[];
  styledTextSegments?: Array<
    Pick<StyledTextSegment, any | "characters" | "start" | "end">
  >;
  cumulativeRotation?: number;
  uniqueName?: string;
  canBeFlattened?: boolean;
  isRelative?: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
};

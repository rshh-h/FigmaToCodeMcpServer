import { commonStroke } from "../../common/commonStroke.js";
import { getStrokeAlign } from "../flutterContainer.js";
import {
  generateWidgetCode,
  skipDefaultProperty,
} from "./../../common/numToAutoFixed.js";
import { flutterColorFromFills } from "./flutterColor.js";

export const flutterBorder = (node: SceneNode): string => {
  if (!("strokes" in node)) {
    return "";
  }

  const stroke = commonStroke(node);
  if (!stroke) {
    return "";
  }

  const color = skipDefaultProperty(
    flutterColorFromFills(node, "strokes"),
    "Colors.black",
  );

  const strokeAlign = skipDefaultProperty(
    getStrokeAlign(node, 2),
    "BorderSide.strokeAlignInside",
  );

  if ("all" in stroke) {
    if (stroke.all === 0) {
      return "";
    }

    return generateWidgetCode("Border.all", {
      width: stroke.all,
      strokeAlign: strokeAlign,
      color: color,
    });
  } else {
    return generateWidgetCode("Border.only", {
      left: generateBorderSideCode(stroke.left, strokeAlign, color),
      top: generateBorderSideCode(stroke.top, strokeAlign, color),
      right: generateBorderSideCode(stroke.right, strokeAlign, color),
      bottom: generateBorderSideCode(stroke.bottom, strokeAlign, color),
    });
  }
};

const generateBorderSideCode = (
  width: number,
  strokeAlign: string,
  color: string,
): string => {
  return generateWidgetCode("BorderSide", {
    width: skipDefaultProperty(width, 0),
    strokeAlign: strokeAlign,
    color: color,
  });
};

import {
  generateWidgetCode,
  numberToFixedString,
} from "../../common/numToAutoFixed.js";

type RotatableNode = {
  rotation?: number;
  cumulativeRotation?: number;
};

/**
 * https://api.flutter.dev/flutter/widgets/Opacity-class.html
 */
export const flutterOpacity = (
  node: MinimalBlendMixin,
  child: string,
): string => {
  if (node.opacity !== undefined && node.opacity !== 1 && child !== "") {
    return generateWidgetCode("Opacity", {
      opacity: numberToFixedString(node.opacity),
      child: child,
    });
  }
  return child;
};

/**
 * https://api.flutter.dev/flutter/widgets/Visibility-class.html
 */
export const flutterVisibility = (node: SceneNode, child: string): string => {
  // [when testing] node.visible can be undefined

  if (node.visible !== undefined && !node.visible && child !== "") {
    return generateWidgetCode("Visibility", {
      visible: `${node.visible}`,
      child: child,
    });
  }
  return child;
};

/**
 * https://api.flutter.dev/flutter/widgets/Transform-class.html
 * that's how you convert angles to clockwise radians: angle * -pi/180
 */
export const flutterRotation = (node: RotatableNode, child: string): string => {
  if (
    node.rotation !== undefined &&
    child !== "" &&
    Math.round(node.rotation) !== 0
  ) {
    const matrix = generateRotationMatrix(node);
    if (matrix) {
      return generateWidgetCode("Transform", {
        transform: matrix,
        child: child,
      });
    }
  }
  return child;
};

/**
 * Generates a rotation matrix string for Flutter transforms
 */
export const generateRotationMatrix = (node: RotatableNode): string => {
  const rotation = (node.rotation || 0) + (node.cumulativeRotation || 0);

  if (Math.round(rotation) === 0) {
    return "";
  }

  return `Matrix4.identity()..translate(0.0, 0.0)..rotateZ(${numberToFixedString(
    rotation * (-Math.PI / 180),
  )})`;
};

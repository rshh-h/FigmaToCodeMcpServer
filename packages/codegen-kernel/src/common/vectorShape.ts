import { retrieveTopFill } from "./retrieveFill.js";

type Point = {
  x: number;
  y: number;
};

const approxEqual = (a: number, b: number, tolerance: number): boolean =>
  Math.abs(a - b) <= tolerance;

const parseCircleLikePathEndpoints = (path: string): Point[] | null => {
  const commands = (path.match(/[a-zA-Z]/g) ?? []).map((command) =>
    command.toUpperCase(),
  );
  if (
    commands.length !== 6 ||
    commands[0] !== "M" ||
    commands.slice(1, 5).some((command) => command !== "C") ||
    commands[5] !== "Z"
  ) {
    return null;
  }

  const numbers = (path.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  if (
    numbers.length !== 26 ||
    numbers.some((value) => Number.isNaN(value))
  ) {
    return null;
  }

  const points: Point[] = [{ x: numbers[0], y: numbers[1] }];
  for (let i = 2; i < numbers.length; i += 6) {
    points.push({ x: numbers[i + 4], y: numbers[i + 5] });
  }

  return points;
};

const getClosedUniquePoints = (points: Point[], tolerance: number): Point[] => {
  if (points.length === 0) {
    return [];
  }

  const uniquePoints = [...points];
  const first = uniquePoints[0];
  const last = uniquePoints[uniquePoints.length - 1];
  if (
    first &&
    last &&
    approxEqual(first.x, last.x, tolerance) &&
    approxEqual(first.y, last.y, tolerance)
  ) {
    uniquePoints.pop();
  }

  return uniquePoints;
};

export const isCircularVectorPath = (node: SceneNode): boolean => {
  if (
    node.type !== "VECTOR" ||
    !("fillGeometry" in node) ||
    !Array.isArray(node.fillGeometry) ||
    node.fillGeometry.length !== 1 ||
    node.width <= 0 ||
    node.height <= 0
  ) {
    return false;
  }

  const rawPath = node.fillGeometry[0]?.path;
  if (!rawPath) {
    return false;
  }

  const tolerance = Math.max(0.5, Math.max(node.width, node.height) * 0.02);
  const parsedPoints = parseCircleLikePathEndpoints(rawPath);
  if (!parsedPoints) {
    return false;
  }

  const points = getClosedUniquePoints(parsedPoints, tolerance);
  if (points.length !== 4) {
    return false;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  if (
    !approxEqual(width, height, tolerance) ||
    !approxEqual(width, node.width, tolerance) ||
    !approxEqual(height, node.height, tolerance)
  ) {
    return false;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const hasTop = points.some(
    (point) =>
      approxEqual(point.x, centerX, tolerance) &&
      approxEqual(point.y, minY, tolerance),
  );
  const hasRight = points.some(
    (point) =>
      approxEqual(point.x, maxX, tolerance) &&
      approxEqual(point.y, centerY, tolerance),
  );
  const hasBottom = points.some(
    (point) =>
      approxEqual(point.x, centerX, tolerance) &&
      approxEqual(point.y, maxY, tolerance),
  );
  const hasLeft = points.some(
    (point) =>
      approxEqual(point.x, minX, tolerance) &&
      approxEqual(point.y, centerY, tolerance),
  );

  return hasTop && hasRight && hasBottom && hasLeft;
};

export const isCircularImageFillVectorNode = (node: SceneNode): boolean =>
  node.type === "VECTOR" &&
  "fills" in node &&
  Array.isArray(node.fills) &&
  (retrieveTopFill(node.fills) as { type?: string } | undefined)?.type === "IMAGE" &&
  isCircularVectorPath(node);

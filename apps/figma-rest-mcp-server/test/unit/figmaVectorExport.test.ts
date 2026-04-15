import { describe, expect, it } from "vitest";
import { collectVectorExportRoots } from "../../src/adapters/localAssets/figmaVectorExport.js";

describe("figmaVectorExport", () => {
  it("keeps separately positioned action children as independent roots", () => {
    const roots = collectVectorExportRoots({
      id: "actions",
      name: "Actions",
      type: "FRAME",
      absoluteBoundingBox: {
        x: 816,
        y: 640,
        width: 104,
        height: 32,
      },
      children: [
        {
          id: "action-1",
          name: "Cell_Action",
          type: "INSTANCE",
          absoluteBoundingBox: {
            x: 816,
            y: 640,
            width: 32,
            height: 32,
          },
          children: [
            {
              id: "action-1-icon",
              name: "Icon",
              type: "BOOLEAN_OPERATION",
              fillGeometry: [{ path: "M0 0Z" }],
            },
          ],
        },
        {
          id: "action-2",
          name: "Cell_Action",
          type: "INSTANCE",
          absoluteBoundingBox: {
            x: 856,
            y: 640,
            width: 32,
            height: 32,
          },
          children: [
            {
              id: "action-2-icon",
              name: "Icon",
              type: "BOOLEAN_OPERATION",
              fillGeometry: [{ path: "M0 0Z" }],
            },
          ],
        },
        {
          id: "action-3",
          name: "Cell_Action",
          type: "INSTANCE",
          absoluteBoundingBox: {
            x: 896,
            y: 640,
            width: 24,
            height: 32,
          },
          children: [
            {
              id: "action-3-icon",
              name: "Icon",
              type: "BOOLEAN_OPERATION",
              fillGeometry: [{ path: "M0 0Z" }],
            },
          ],
        },
      ],
    });

    expect(roots.map((node) => node.id)).toEqual([
      "action-1",
      "action-2",
      "action-3",
    ]);
  });

  it("keeps an overlapping background-and-icon composition as one root", () => {
    const roots = collectVectorExportRoots({
      id: "search-chip",
      name: "Search chip",
      type: "GROUP",
      absoluteBoundingBox: {
        x: 301,
        y: 60,
        width: 32,
        height: 32,
      },
      children: [
        {
          id: "bg",
          name: "灰底色",
          type: "VECTOR",
          absoluteBoundingBox: {
            x: 301,
            y: 60,
            width: 32,
            height: 32,
          },
          fillGeometry: [{ path: "M0 0Z" }],
        },
        {
          id: "icon",
          name: "title bar icon",
          type: "GROUP",
          absoluteBoundingBox: {
            x: 307,
            y: 66,
            width: 20,
            height: 20,
          },
          children: [
            {
              id: "icon-stroke",
              name: "Oval 9",
              type: "VECTOR",
              absoluteBoundingBox: {
                x: 310,
                y: 69,
                width: 11.25,
                height: 11.25,
              },
              strokeGeometry: [{ path: "M0 0Z" }],
            },
            {
              id: "icon-handle",
              name: "Line 3",
              type: "VECTOR",
              absoluteBoundingBox: {
                x: 319.94,
                y: 78.94,
                width: 4.13,
                height: 4.13,
              },
              strokeGeometry: [{ path: "M0 0Z" }],
            },
          ],
        },
      ],
    });

    expect(roots.map((node) => node.id)).toEqual(["search-chip"]);
  });

  it("ignores empty placeholder children when grouping a single icon composition", () => {
    const roots = collectVectorExportRoots({
      id: "search-instance",
      name: "头图组件",
      type: "INSTANCE",
      absoluteBoundingBox: {
        x: 301,
        y: 60,
        width: 32,
        height: 32,
      },
      children: [
        {
          id: "bg",
          name: "灰底色",
          type: "VECTOR",
          absoluteBoundingBox: {
            x: 301,
            y: 60,
            width: 32,
            height: 32,
          },
          fillGeometry: [{ path: "M0 0Z" }],
        },
        {
          id: "icon-instance",
          name: "title bar icon",
          type: "INSTANCE",
          absoluteBoundingBox: {
            x: 307,
            y: 66,
            width: 20,
            height: 20,
          },
          children: [
            {
              id: "placeholder",
              name: "Rectangle 50918",
              type: "RECTANGLE",
              absoluteBoundingBox: {
                x: 307,
                y: 66,
                width: 20,
                height: 20,
              },
              fills: [],
              strokes: [],
              fillGeometry: [],
              strokeGeometry: [],
            },
            {
              id: "icon-group",
              name: "Group 1312318440",
              type: "GROUP",
              absoluteBoundingBox: {
                x: 310,
                y: 69,
                width: 14.06,
                height: 14.06,
              },
              children: [
                {
                  id: "icon-stroke",
                  name: "Oval 9",
                  type: "VECTOR",
                  absoluteBoundingBox: {
                    x: 310,
                    y: 69,
                    width: 11.25,
                    height: 11.25,
                  },
                  strokeGeometry: [{ path: "M0 0Z" }],
                },
                {
                  id: "icon-handle",
                  name: "Line 3",
                  type: "VECTOR",
                  absoluteBoundingBox: {
                    x: 319.94,
                    y: 78.94,
                    width: 4.13,
                    height: 4.13,
                  },
                  strokeGeometry: [{ path: "M0 0Z" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(roots.map((node) => node.id)).toEqual(["search-instance"]);
  });
});

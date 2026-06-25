import { describe, expect, it } from "vitest";
import { parseFontStyle } from "./fontStyleParser.js";

describe("parseFontStyle", () => {
  it("maps Heavy to the black weight keyword", () => {
    expect(parseFontStyle("Heavy")).toEqual({
      weightKeyword: "black",
      isItalic: false,
    });
  });

  it("maps Bold to the bold weight keyword", () => {
    expect(parseFontStyle("Bold")).toEqual({
      weightKeyword: "bold",
      isItalic: false,
    });
  });

  it("maps SemiBold to the semibold weight keyword", () => {
    expect(parseFontStyle("SemiBold")).toEqual({
      weightKeyword: "semibold",
      isItalic: false,
    });
  });

  it("maps ExtraLight to the extralight weight keyword", () => {
    expect(parseFontStyle("ExtraLight")).toEqual({
      weightKeyword: "extralight",
      isItalic: false,
    });
  });

  it("maps Medium to the medium weight keyword", () => {
    expect(parseFontStyle("Medium")).toEqual({
      weightKeyword: "medium",
      isItalic: false,
    });
  });

  it("returns null keyword for Regular so the caller falls back to fontWeight", () => {
    expect(parseFontStyle("Regular")).toEqual({
      weightKeyword: null,
      isItalic: false,
    });
  });

  it("returns null keyword for Normal", () => {
    expect(parseFontStyle("Normal")).toEqual({
      weightKeyword: null,
      isItalic: false,
    });
  });

  it("extracts italic from Bold Italic", () => {
    expect(parseFontStyle("Bold Italic")).toEqual({
      weightKeyword: "bold",
      isItalic: true,
    });
  });

  it("extracts italic from Heavy Italic", () => {
    expect(parseFontStyle("Heavy Italic")).toEqual({
      weightKeyword: "black",
      isItalic: true,
    });
  });

  it("returns italic with null keyword for plain Italic", () => {
    expect(parseFontStyle("Italic")).toEqual({
      weightKeyword: null,
      isItalic: true,
    });
  });

  it("returns null keyword for non-weight style names like Condensed", () => {
    expect(parseFontStyle("Condensed")).toEqual({
      weightKeyword: null,
      isItalic: false,
    });
  });

  it("returns null keyword for empty string", () => {
    expect(parseFontStyle("")).toEqual({
      weightKeyword: null,
      isItalic: false,
    });
  });

  it("handles lowercase input", () => {
    expect(parseFontStyle("heavy")).toEqual({
      weightKeyword: "black",
      isItalic: false,
    });
  });

  it("handles space-separated compound styles like Extra Bold", () => {
    expect(parseFontStyle("Extra Bold")).toEqual({
      weightKeyword: "extrabold",
      isItalic: false,
    });
  });

  it("handles Semi Bold with space", () => {
    expect(parseFontStyle("Semi Bold")).toEqual({
      weightKeyword: "semibold",
      isItalic: false,
    });
  });
});

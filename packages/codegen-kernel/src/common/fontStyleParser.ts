/**
 * Parse a Figma font style string (e.g. "Heavy", "Bold Italic", "Regular")
 * into a normalized weight keyword and italic flag.
 *
 * Figma encodes the actual font face name in `fontStyle` / `fontName.style`.
 * For some fonts (especially CJK), the numeric `fontWeight` field defaults to
 * 400 even when the style is "Heavy" or "Bold".  The string returned here is
 * the authoritative source for the visual weight.
 */

export type ParsedFontStyle = {
  /** Lowercase, space-free weight keyword (e.g. "heavy", "semibold"), or null
   *  when the style is "Regular"/"Normal" or contains no recognised keyword. */
  weightKeyword: string | null;
  isItalic: boolean;
};

/**
 * Mapping from normalised style fragments to a canonical weight keyword.
 * Keys are lowercase, space-free strings that may appear after stripping
 * "italic" from the original style name.
 */
const STYLE_FRAGMENT_TO_KEYWORD: Record<string, string> = {
  thin: "thin",
  hairline: "thin",
  extralight: "extralight",
  ultralight: "extralight",
  light: "light",
  medium: "medium",
  semibold: "semibold",
  demibold: "semibold",
  bold: "bold",
  extrabold: "extrabold",
  ultrabold: "extrabold",
  black: "black",
  heavy: "black",
  ultra: "black",
};

/** Styles that indicate the default/normal weight — fall back to numeric fontWeight. */
const REGULAR_STYLES = new Set(["regular", "normal", ""]);

/**
 * Parse a Figma `fontStyle` / `fontName.style` string.
 *
 * The function first strips "italic" (case-insensitive) to detect the italic
 * flag, then normalises the remaining text by removing spaces and lowercasing.
 * If the result maps to a known weight keyword it is returned; otherwise
 * `null` is returned so the caller can fall back to the numeric `fontWeight`.
 *
 * Examples:
 *   "Heavy"           → { weightKeyword: "black", isItalic: false }
 *   "Bold Italic"     → { weightKeyword: "bold",   isItalic: true  }
 *   "SemiBold"        → { weightKeyword: "semibold", isItalic: false }
 *   "Regular"         → { weightKeyword: null,     isItalic: false }
 *   "Italic"          → { weightKeyword: null,     isItalic: true  }
 *   "Condensed"       → { weightKeyword: null,     isItalic: false }
 */
export function parseFontStyle(style: string): ParsedFontStyle {
  const lower = style.toLowerCase();
  const isItalic = /\bitalic\b/.test(lower);

  // Remove "italic" then strip spaces to get the weight fragment.
  const normalized = lower
    .replace(/\bitalic\b/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (REGULAR_STYLES.has(normalized)) {
    return { weightKeyword: null, isItalic };
  }

  const keyword = STYLE_FRAGMENT_TO_KEYWORD[normalized];
  if (keyword) {
    return { weightKeyword: keyword, isItalic };
  }

  // Unknown style name (e.g. "Condensed", "Display") — no weight keyword.
  return { weightKeyword: null, isItalic };
}

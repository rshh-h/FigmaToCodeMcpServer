import { lowercaseFirstLetter } from "./lowercaseFirstLetter";

export const getClassLabel = (isJSX: boolean = false) =>
  isJSX ? "className" : "class";

export const joinStyles = (styles: string[], isJSX: boolean) =>
  styles.map((s) => s.trim()).join(isJSX ? ", " : "; ");

export const formatStyleAttribute = (
  styles: string[],
  isJSX: boolean,
): string => {
  const trimmedStyles = joinStyles(styles, isJSX);

  if (trimmedStyles === "") return "";

  return ` style=${isJSX ? `{{${trimmedStyles}}}` : `"${trimmedStyles}"`}`;
};

export const sanitizeAttributeName = (label: string): string => {
  const normalized = lowercaseFirstLetter(label)
    .trim()
    .replace(/\*/g, "x")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized;
};

export const formatDataAttribute = (label: string, value?: string) => {
  const cleanLabel = sanitizeAttributeName(label);
  if (cleanLabel === "") {
    return "";
  }

  return ` data-${cleanLabel}${value === undefined ? `` : `="${value}"`}`;
};

export const formatTwigAttribute = (label: string, value?: string) => {
  const cleanLabel = sanitizeAttributeName(label);
  if (cleanLabel === "" || [".", "_"].includes(cleanLabel.charAt(0))) {
    return "";
  }

  return ` ${cleanLabel}${value === undefined ? `` : `="${value}"`}`;
};

export const formatClassAttribute = (
  classes: string[],
  isJSX: boolean,
): string =>
  classes.length === 0 ? "" : ` ${getClassLabel(isJSX)}="${classes.join(" ")}"`;

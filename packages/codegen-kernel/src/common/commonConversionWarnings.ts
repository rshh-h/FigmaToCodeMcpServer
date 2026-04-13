import { Warning } from "../pluginTypes";

export const warnings = new Set<Warning>();
export const addWarning = (warning: Warning) => {
  if (warnings.has(warning) === false) {
    console.warn(warning);
  }
  warnings.add(warning);
};
export const clearWarnings = () => warnings.clear();

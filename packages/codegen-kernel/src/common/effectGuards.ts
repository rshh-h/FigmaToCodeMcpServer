export const hasEffectRadius = (
  effect: Effect,
): effect is BlurEffect =>
  (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") &&
  typeof effect.radius === "number";

export const isLayerBlurEffect = (
  effect: Effect,
): effect is BlurEffect & { type: "LAYER_BLUR" } =>
  effect.type === "LAYER_BLUR" && hasEffectRadius(effect);

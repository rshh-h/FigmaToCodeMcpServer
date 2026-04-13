export type FigmaRuntime = Pick<
  PluginAPI,
  | "currentPage"
  | "getNodeByIdAsync"
  | "getSelectionColors"
  | "getImageByHash"
  | "variables"
  | "mixed"
> & {
  ui: {
    postMessage: (pluginMessage: unknown) => void;
  };
};

const runtimeNotReadyError = () =>
  new Error(
    "Figma runtime has not been initialized. Call setFigmaRuntime() first.",
  );

const defaultRuntime: FigmaRuntime = {
  currentPage: {
    selection: [],
  } as PluginAPI["currentPage"],
  async getNodeByIdAsync() {
    throw runtimeNotReadyError();
  },
  getSelectionColors() {
    return { paints: [] };
  },
  getImageByHash() {
    return {
      async getBytesAsync() {
        throw runtimeNotReadyError();
      },
    };
  },
  variables: {
    getVariableById() {
      return null;
    },
    async getVariableByIdAsync() {
      return null;
    },
  } as PluginAPI["variables"],
  mixed: Symbol.for("figma-runtime.uninitialized-mixed") as PluginAPI["mixed"],
  ui: {
    postMessage() {},
  },
};

let runtime: FigmaRuntime = defaultRuntime;

export const setFigmaRuntime = (nextRuntime: FigmaRuntime) => {
  runtime = nextRuntime;
};

export const clearFigmaRuntime = () => {
  runtime = defaultRuntime;
};

export const getFigmaRuntime = (): FigmaRuntime => runtime;

export const figma = new Proxy({} as PluginAPI, {
  get(_target, property) {
    return (getFigmaRuntime() as Record<PropertyKey, unknown>)[property];
  },
  set(_target, property, value) {
    (getFigmaRuntime() as Record<PropertyKey, unknown>)[property] = value;
    return true;
  },
}) as PluginAPI;

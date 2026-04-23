import type { ConversionMessage, Message, PluginSettings } from "../pluginTypes.js";
import { run } from "../code.js";
import {
  type FigmaRuntime,
  clearFigmaRuntime,
  setFigmaRuntime,
} from "./figma.js";
import { defaultPluginSettings } from "./defaultPluginSettings.js";
import {
  createSourceSnapshotPluginApiAdapter,
  type SnapshotPluginApiAdapter,
} from "./sourceSnapshotAdapter.js";
import type { KernelSourceSnapshot } from "../types.js";

type BackendMessage = Message;

type RunWithSourceSnapshotOptions = {
  snapshot: KernelSourceSnapshot;
  onMessage?: (message: BackendMessage) => void;
  settings?: Partial<PluginSettings>;
  suppressLogs?: boolean;
};

export type RunWithSourceSnapshotResult = {
  adapter: SnapshotPluginApiAdapter;
  messages: BackendMessage[];
  settings: PluginSettings;
  codeMessage: ConversionMessage | null;
};

const mergePluginSettings = (
  framework: PluginSettings["framework"],
  settings?: Partial<PluginSettings>,
): PluginSettings => ({
  ...defaultPluginSettings,
  framework,
  ...settings,
});

const isCodeMessage = (
  message: BackendMessage,
): message is ConversionMessage => message.type === "code";

export const getLastCodeMessage = (
  messages: readonly BackendMessage[],
): ConversionMessage | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (isCodeMessage(message)) {
      return message;
    }
  }

  return null;
};

const attachMessageBridge = (
  adapter: SnapshotPluginApiAdapter,
  messages: BackendMessage[],
  onMessage?: (message: BackendMessage) => void,
): FigmaRuntime => {
  const runtime = adapter as unknown as FigmaRuntime & {
    ui?: {
      postMessage: (pluginMessage: unknown) => void;
    };
  };

  runtime.ui = {
    postMessage(pluginMessage: unknown) {
      const message = pluginMessage as BackendMessage;
      messages.push(message);
      onMessage?.(message);
    },
  };

  return runtime;
};

const runWithOptionalSuppressedLogs = async <T>(
  suppressLogs: boolean | undefined,
  action: () => Promise<T>,
): Promise<T> => {
  if (!suppressLogs) {
    return action();
  }

  const originalLog = console.log;
  console.log = () => undefined;

  try {
    return await action();
  } finally {
    console.log = originalLog;
  }
};

export const runWithSourceSnapshot = async (
  options: RunWithSourceSnapshotOptions,
): Promise<RunWithSourceSnapshotResult> => {
  const framework =
    options.settings?.framework ?? defaultPluginSettings.framework;
  const settings = mergePluginSettings(framework, options.settings);
  const adapter = await createSourceSnapshotPluginApiAdapter({
    snapshot: options.snapshot,
  });
  const messages: BackendMessage[] = [];
  const runtime = attachMessageBridge(adapter, messages, options.onMessage);

  setFigmaRuntime(runtime);

  try {
    await runWithOptionalSuppressedLogs(options.suppressLogs, async () =>
      run(settings),
    );

    return {
      adapter,
      messages,
      settings,
      codeMessage: getLastCodeMessage(messages),
    };
  } finally {
    clearFigmaRuntime();
  }
};

export interface Logger {
  debug(message: string, details?: Record<string, unknown>): void;
  info(message: string, details?: Record<string, unknown>): void;
  warn(message: string, details?: Record<string, unknown>): void;
  error(message: string, details?: Record<string, unknown>): void;
}

function write(level: string, message: string, details?: Record<string, unknown>) {
  const payload = JSON.stringify({
    level,
    message,
    ...details,
    timestamp: new Date().toISOString(),
  });
  process.stderr.write(`${payload}\n`);
}

export const stderrLogger: Logger = {
  debug(message, details) {
    write("debug", message, details);
  },
  info(message, details) {
    write("info", message, details);
  },
  warn(message, details) {
    write("warn", message, details);
  },
  error(message, details) {
    write("error", message, details);
  },
};


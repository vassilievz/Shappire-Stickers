type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = (() => {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
})();

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel = isDev ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug(message, ...args) {
      if (shouldLog('debug')) console.debug(prefix, message, ...args);
    },
    info(message, ...args) {
      if (shouldLog('info')) console.info(prefix, message, ...args);
    },
    warn(message, ...args) {
      if (shouldLog('warn')) console.warn(prefix, message, ...args);
    },
    error(message, ...args) {
      if (shouldLog('error')) console.error(prefix, message, ...args);
    },
  };
}

import { logDirectoryOf } from "./util/common-directories.js";
import { appendFileSync, mkdirSync } from "node:fs";

export interface Logger {
  debug: (message: string) => void;
  // debugLazy: (getMessage: () => string) => Promise<void>;
  debugThrown: (error: unknown) => void;
}

const logDir = logDirectoryOf("custard");

function out(
  message: string,
  level: string,
  messagePrefix: string,
  logPath: string,
): void {
  const timestamp = new Date().toISOString();
  message = message.replace(/[\r\n\t]/g, (c) => {
    switch (c) {
      case "\r":
        return "\\r";
      case "\n":
        return "\\n";
      case "\t":
        return "\\t";
      default:
        throw new Error("Unreachable");
    }
  });

  const logLine = `${timestamp}\t${level}\t${messagePrefix}\t${message}\n`;
  appendFileSync(logPath, logLine);
}

export function getLogger(messagePrefix: string): Logger {
  if (!/[a-z/-]/.test(messagePrefix)) {
    throw new Error(`Invalid message prefix: ${messagePrefix}`);
  }

  const logPath = `${logDir}/log`;
  // eslint-disable-next-line eslint-plugin-no-ignore-returned-union/no-ignore-returned-union
  mkdirSync(logDir, { recursive: true });

  const debug = (message: string): void => {
    out(message, "DEBUG", messagePrefix, logPath);
  };
  const debugThrown = (e: unknown): void => {
    if (e instanceof Error) {
      debug(`Error: ${e.message}`);
      if (e.stack) {
        for (const line of e.stack.split("\n")) {
          debug(line);
        }
      }
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (e.cause) {
        debug("Caused by:");
        debugThrown(e.cause);
      }
      return;
    }
    debug(String(debug));
  };

  const noop = (_: unknown): void => {
    // do nothing
  };

  switch (process.env.CUSTARD_LOG_LEVEL) {
    case "debug": {
      return {
        debug,
        debugThrown,
      };
    }
    case "info":
    case undefined:
      return {
        debug: noop,
        debugThrown: noop,
      };
    default:
      throw new Error(
        `Unsupported log level: ${JSON.stringify(process.env.CUSTARD_LOG_LEVEL)}`,
      );
  }
}

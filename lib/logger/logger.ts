export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  meta?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
  };
}

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "authorization",
  "cookie",
  "database_url",
  "databaseurl",
  "db_password",
]);

/**
 * Redacts known sensitive patterns and keys from metadata and strings.
 */
export function sanitizeLogValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    // Redact database URLs containing credentials
    return val.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)/i, "$1[REDACTED]$3");
  }

  if (Array.isArray(val)) {
    return val.map(sanitizeLogValue);
  }

  if (typeof val === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        sanitizedObj[k] = "[REDACTED]";
      } else {
        sanitizedObj[k] = sanitizeLogValue(v);
      }
    }
    return sanitizedObj;
  }

  return val;
}

export class Logger {
  private service: string;

  constructor(service = "raptoros") {
    this.service = service;
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>,
    error?: unknown
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
    };

    if (meta && Object.keys(meta).length > 0) {
      entry.meta = sanitizeLogValue(meta) as Record<string, unknown>;
    }

    if (error) {
      if (error instanceof Error) {
        entry.error = {
          name: error.name,
          message: error.message,
          code: (error as { code?: string }).code,
        };
      } else {
        entry.error = {
          name: "UnknownError",
          message: String(error),
        };
      }
    }

    return entry;
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    const entry = this.formatEntry("info", message, meta);
    console.info(JSON.stringify(entry));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    const entry = this.formatEntry("warn", message, meta);
    console.warn(JSON.stringify(entry));
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const entry = this.formatEntry("error", message, meta, error);
    console.error(JSON.stringify(entry));
  }
}

export const logger = new Logger("raptoros");

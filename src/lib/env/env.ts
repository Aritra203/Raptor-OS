import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string({
      required_error: "DATABASE_URL environment variable is required",
    })
    .url("DATABASE_URL must be a valid URL")
    .refine(
      (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
      "DATABASE_URL must be a PostgreSQL connection string"
    ),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters long")
    .default("raptoros_offline_session_secret_at_least_32_chars_long"),
  AUTH_COOKIE_NAME: z.string().default("raptoros_session"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("RaptorOS"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("0.1.0"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Validates and returns the server-side environment variables.
 * Throws a formatted error if required variables are missing or invalid.
 */
export function validateServerEnv(env: Record<string, unknown> = process.env): ServerEnv {
  const isServer = typeof window === "undefined";
  if (!isServer) {
    throw new Error("Server environment variables cannot be accessed on the client.");
  }

  const result = serverSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment configuration:\n${errorDetails}\nCheck your .env or environment configuration.`
    );
  }

  return result.data;
}

/**
 * Validates client-accessible environment variables.
 */
export function validateClientEnv(env: Record<string, unknown> = process.env): ClientEnv {
  const result = clientSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid client environment configuration:\n${errorDetails}`
    );
  }

  return result.data;
}

// Lazy-validated server env getter for server runtimes
let cachedServerEnv: ServerEnv | null = null;
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = validateServerEnv();
  }
  return cachedServerEnv;
}

export const clientEnv = validateClientEnv({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
});

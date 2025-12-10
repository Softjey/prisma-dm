import path from "path";
import { existsSync } from "fs";

/**
 * Type guard to validate Prisma config structure from defineConfig
 */
function isValidPrismaConfig(config: unknown): config is {
  datasource: {
    url: string;
  };
} {
  if (!config || typeof config !== "object") {
    return false;
  }

  if (!("datasource" in config)) {
    return false;
  }

  const DATASOURCE = (config as { datasource?: unknown }).datasource;

  if (!DATASOURCE || typeof DATASOURCE !== "object") {
    return false;
  }

  if (!("url" in DATASOURCE)) {
    return false;
  }

  const URL = (DATASOURCE as { url?: unknown }).url;

  return typeof URL === "string";
}

/**
 * Reads prisma.config.ts file and returns the database URL (from datasource.url).
 * The file should be at the same level as package.json (process.cwd()).
 * 
 * For Prisma 7, the config file can use env("DATABASE_URL") which will be resolved to the value of process.env.DATABASE_URL during the import.
 * 
 * @returns The datasource URL string
 * @throws Error if datasource URL cannot be found or is invalid
 */
export async function readDatabaseUrlFromPrismaConfig(): Promise<string> {
  const CONFIG_PATH = path.join(process.cwd(), "prisma.config.ts");

  // Try to parse prisma.config.ts
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`prisma.config.ts (at ${CONFIG_PATH}) not found`);
  }

  let prismaConfig: unknown;

  try {
    prismaConfig = await import(CONFIG_PATH);
  } catch (importError) {
    throw new Error(`failed to import prisma.config.ts: ${importError}`);
  }

  let CONFIG: unknown;

  if (
    typeof prismaConfig === "object" && prismaConfig !== null &&
    "default" in prismaConfig && prismaConfig.default !== undefined
  ) {
    CONFIG = prismaConfig.default;
  } else {
    CONFIG = prismaConfig;
  }

  // Validates the config structure
  if (!isValidPrismaConfig(CONFIG)) {
    throw new Error(
      `invalid prisma.config.ts structure: expected defineConfig with datasource.url property`
    );
  }

  const DATASOURCE_URL = CONFIG.datasource.url;

  if (DATASOURCE_URL.length === 0) {
    throw new Error(`datasource.url cannot be empty in prisma.config.ts`);
  }

  // Validates the URL format
  try {
    new URL(DATASOURCE_URL);
  } catch {
    throw new Error(`invalid datasource.url format in prisma.config.ts: ${DATASOURCE_URL}`);
  }

  return DATASOURCE_URL;
}

import path from "path";
import { ConfigSchema } from "../config/config.type";
 
/**
 * Converts a SQLite URL from a Prisma schema to an absolute file path.
 */
export function prismaSqliteURLToFilePath(url: string, config: ConfigSchema): string {
  if (!url.startsWith("file:")) {
    throw new Error("Invalid SQLite URL format. Expected to start with 'file:'.");
  }
  const prismaPath = url.slice(5);

  // Relative paths are relative to the main schema file location.
  // We convert it to an absolute path, since the path relative
  // to the schema copied to the migrations folder would be different.
  if (path.isAbsolute(prismaPath)) {
    return prismaPath;
  } else {
    const schemaDirPath = path.dirname(config.mainPrismaSchema);
    const absolutePath = path.resolve(schemaDirPath, prismaPath);
    return absolutePath;
  }
}

import fs from "fs/promises";

async function createTempDir(path: string) {
  return fs.mkdir(path, { recursive: true }).catch((e) => {
    throw new Error(`Error creating temp dir: ${e.message}`);
  });
}

async function removeTempDir(path: string) {
  return fs.rm(path, { recursive: true }).catch((e) => {
    throw new Error(`Error removing temp dir: ${e.message}`);
  });
}

/**
 * Runs a function with a temporary directory available at the specified path.
 * The directory is created before running the function and removed afterwards,
 * even if the function throws an error.
 *
 * @param path - The path to the temporary directory.
 * @param fn - The async function to execute using the temporary directory.
 */
export async function withTempDir(path: string, fn: () => Promise<void> | void) {
  await createTempDir(path);
  try {
    await fn();
  } finally {
    await removeTempDir(path);
  }
}

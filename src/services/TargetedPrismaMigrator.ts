import path from "path";
import fs from "fs-extra";
import { Config } from "../config/config.type";
import { getConfig } from "../config/getConfig";
import { PrismaCLI } from "./PrismaCLI";
import { Logger } from "./Logger";

type MigrationDirFile<T extends string> = T | "migration_lock.toml";

export class TargetedPrismaMigrator<T extends string> {
  private readonly config: Config;

  constructor(private readonly logger: Logger) {
    this.config = getConfig();
  }

  private createTempDir() {
    return fs.mkdir(this.config.tempDir, { recursive: true }).catch((e) => {
      throw new Error(`Error creating temp dir: ${e.message}`);
    });
  }

  private removeTempDir() {
    return fs.rmdir(this.config.tempDir).catch((e) => {
      throw new Error(`Error removing temp dir: ${e.message}`);
    });
  }

  private async getMigrationFiles() {
    const files = await fs.readdir(this.config.migrationsDir).catch((e) => {
      throw new Error(`Error reading migrations files: ${e.message}`);
    });

    return files as MigrationDirFile<T>[];
  }

  private async moveFilesToTempDir(files: T[]) {
    for (const file of files) {
      const src = path.resolve(this.config.migrationsDir, file);
      const dest = path.resolve(this.config.tempDir, file);

      try {
        await fs.copy(src, dest);
        await fs.rm(src, { recursive: true, force: true });
      } catch (e) {
        throw new Error(`Error moving file ${file} to temp dir: ${e.message}`);
      }
    }
  }

  private async moveFilesBackToMigrationsDir(files: T[]) {
    for (const file of files) {
      const src = path.resolve(this.config.tempDir, file);
      const dest = path.resolve(this.config.migrationsDir, file);

      try {
        await fs.copy(src, dest);
        await fs.rm(src, { recursive: true, force: true });
      } catch (e) {
        throw new Error(
          `Error moving file ${file} back to migrations dir: ${e.message}`
        );
      }
    }
  }

  async migrateTo(targetMigration: T) {
    const migrationFiles = await this.getMigrationFiles();
    const indexOfTargetMigration = migrationFiles.indexOf(targetMigration);

    if (indexOfTargetMigration === -1) {
      throw new Error(`Migration ${targetMigration} not found`);
    }

    const filesToMove = migrationFiles.slice(
      indexOfTargetMigration + 1,
      -1
    ) as T[];

    this.logger.logMessage("Creating temp dir...");
    await this.createTempDir();

    this.logger.logMessage("Moving migrations files to temp dir...");
    await this.moveFilesToTempDir(filesToMove);

    try {
      PrismaCLI.migrateDeploy();

      this.logger.logMessage(
        `All migrations to ${targetMigration} have been applied successfully!`
      );
    } finally {
      this.logger.logMessage(
        "Moving migrations files back to migrations dir..."
      );
      await this.moveFilesBackToMigrationsDir(filesToMove);

      this.logger.logMessage("Removing temp dir...");
      await this.removeTempDir();
    }
  }
}

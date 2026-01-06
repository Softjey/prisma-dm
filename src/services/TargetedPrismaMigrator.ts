import path from "path";
import fs from "fs-extra";
import { ConfigT } from "../config/DEFAULT_CONFIG";
import { PrismaCLI } from "../utils/classes/PrismaCLI";
import { Logger } from "./Logger";
import { withTempDir } from "../utils/tempDir";

type MigrationDirFile<T extends string> = T | "migration_lock.toml";

export class TargetedPrismaMigrator<T extends string> {
  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigT,
  ) {}

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

  private async tempDirIsEmpty() {
    const files = await fs.readdir(this.config.tempDir).catch((e) => {
      throw new Error(`Error reading temp dir: ${e.message}`);
    });

    return files.length === 0;
  }

  private async moveFilesBackToMigrationsDir(files: T[]) {
    for (const file of files) {
      const src = path.resolve(this.config.tempDir, file);
      const dest = path.resolve(this.config.migrationsDir, file);

      try {
        await fs.copy(src, dest);
        await fs.rm(src, { recursive: true, force: true });
      } catch (e) {
        throw new Error(`Error moving file ${file} back to migrations dir: ${e.message}`);
      }
    }
  }

  async migrateTo(targetMigration: T) {
    const migrationFiles = await this.getMigrationFiles();
    const indexOfTargetMigration = migrationFiles.indexOf(targetMigration);

    if (indexOfTargetMigration === -1) {
      throw new Error(`Migration ${targetMigration} not found`);
    }

    const filesToMove = migrationFiles.slice(indexOfTargetMigration + 1, -1) as T[];

    await withTempDir(
      this.config.tempDir,
      async () => {
        this.logger.logVerbose("Moving migrations files to temp dir...");
        await this.moveFilesToTempDir(filesToMove);

        try {
          PrismaCLI.migrateDeploy({ schema: this.config.mainPrismaSchema });

          this.logger.logVerbose(
            `All migrations to ${targetMigration} have been applied successfully!`,
          );
        } finally {
          this.logger.logVerbose("Moving migrations files back to migrations dir...");
          await this.moveFilesBackToMigrationsDir(filesToMove);
        }
      },
      () => this.tempDirIsEmpty(),
    );
  }
}

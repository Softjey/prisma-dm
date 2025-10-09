import path from "path";
import fs from "fs-extra";
import { CONFIG_FILE_NAME } from "../config/CONFIG_FILE_NAME";
import { ConfigSchema } from "../config/config.type";
import { DEFAULT_CONFIG } from "../config/DEFAULT_CONFIG";
import { Validator } from "./Validator";
import { PrismaCLI } from "../utils/classes/PrismaCLI";
import { createTempSchema } from "../utils/tempMigrationSchema";
import { TargetedPrismaMigrator } from "./TargetedPrismaMigrator";
import { ScriptRunner } from "./ScriptRunner";
import { DataSourceConfig, DB } from "./DB";
import { Logger } from "./Logger";
import { MigrationModel } from "../types/MigrationModel";
import { withTempDir } from "../utils/tempDir";

export class CLI<T extends string> {
  constructor(
    private readonly migrator: TargetedPrismaMigrator<T>,
    private readonly scriptRunner: ScriptRunner,
    private readonly db: DB,
    private readonly validator: Validator,
    private readonly logger: Logger,
    private readonly config: ConfigSchema,
    private readonly dataSource: DataSourceConfig,
  ) {}

  private getMigrationPath(migrationName: T) {
    return path.resolve(this.config.migrationsDir, migrationName);
  }

  static init() {
    const configFilePath = path.join(process.cwd(), CONFIG_FILE_NAME);

    if (fs.existsSync(configFilePath)) {
      throw new Error("Config file already exists");
    }

    fs.writeFileSync(configFilePath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  generate() {
    const migrationsDirPath = path.join(process.cwd(), this.config.migrationsDir);
    const migrationsDir = fs.readdirSync(migrationsDirPath);

    for (const migrationName of migrationsDir) {
      if (this.validator.isMigrationWithPrismaSchema(migrationName)) {
        const migrationPath = path.join(migrationsDirPath, migrationName);
        const schemaPath = path.join(migrationPath, this.config.migrationSchemaFileName);
        let outputPath = `${this.config.outputDir}/${migrationName}`;

        // If the path is relative, it is relative to the schema file
        // inside the migration folder
        if (!(path.isAbsolute(outputPath))) {
          outputPath = path.join(path.dirname(schemaPath), outputPath);
        }

        this.logger.logInfo(`Generating types for migration: ${migrationName}`);

        withTempDir(this.config.tempDir, async () => {
          const tempSchemaPath = path.join(this.config.tempDir, "schema.prisma");
          createTempSchema(
            schemaPath,
            outputPath,
            this.dataSource,
            tempSchemaPath,
            this.config,
          )
          PrismaCLI.generate({ schema: tempSchemaPath });
        });
      }
    }
  }

  private getPrismaFilesFromDir(dirPath: string): string[] {
    let prismaFiles: string[] = [];
    const filesAndDirs = fs.readdirSync(dirPath);

    filesAndDirs.forEach((item) => {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        prismaFiles = prismaFiles.concat(this.getPrismaFilesFromDir(fullPath));
      } else if (stat.isFile() && item.endsWith(".prisma")) {
        prismaFiles.push(fullPath);
      }
    });

    return prismaFiles;
  }

  mergeSchema(rawSchemaFolderPath: string, outputPath: string) {
    const schemaFolderPath = path.join(process.cwd(), rawSchemaFolderPath);

    this.logger.logInfo("Merging schema files");
    const prismaFiles = this.getPrismaFilesFromDir(schemaFolderPath);
    let mergedSchema = "";

    prismaFiles.forEach((file) => {
      const fileContent = fs.readFileSync(file, "utf-8");
      mergedSchema += `//--- ${path.basename(file)} ---\n${fileContent}\n`;
    });

    fs.writeFileSync(outputPath, mergedSchema);
    this.logger.logInfo("Schema files merged");
  }

  async migrate({
    targetMigration,
    includeTargetMigration,
  }: {
    targetMigration?: T | undefined;
    includeTargetMigration: boolean;
  }) {
    if (targetMigration) {
      this.validator.validateMigrationName(targetMigration);
    }

    const migrationsDirPath = path.join(process.cwd(), this.config.migrationsDir);
    const rawMigrations = fs
      .readdirSync(migrationsDirPath)
      .filter((m) => this.validator.isMigration(m));
    const lastMigrationIndex = targetMigration
      ? rawMigrations.indexOf(targetMigration)
      : rawMigrations.length;

    const migrations = rawMigrations.slice(
      0,
      lastMigrationIndex + (includeTargetMigration ? 1 : 0),
    );
    const dataMigrations = migrations.filter((m) => this.validator.isMigrationWithPostScript(m));
    await this.db.connect();

    for (const migrationName of dataMigrations as T[]) {
      const prismaTableExists = await this.db.isPrismaMigrationsTableExists();
      let migration: MigrationModel | null = null;

      if (prismaTableExists) {
        migration = await this.db.getMigrationByName(migrationName);
      }

      const migrationAppliedCount = prismaTableExists ? (migration?.applied_steps_count ?? 0) : 0;

      await this.migrator.migrateTo(migrationName);
      const newMigration = await this.db.getMigrationByName(migrationName);
      const newMigrationAppliedCount = newMigration?.applied_steps_count ?? 0;

      if (migrationAppliedCount + 1 === newMigrationAppliedCount) {
        this.logger.logInfo(`Executing post-migrate script for migration: ${migrationName}`);
        this.scriptRunner.runPostScript(this.getMigrationPath(migrationName));
      }
    }

    if (dataMigrations.at(-1) !== migrations.at(-1)) {
      await this.migrator.migrateTo(migrations.at(-1) as T);
    }

    await this.db.disconnect();
  }

  runPostScript(migrationName: T) {
    this.validator.validateMigrationName(migrationName);

    if (!this.validator.isMigrationWithPostScript(migrationName)) {
      throw new Error(`Migration ${migrationName} does not have a post script`);
    }

    this.scriptRunner.runPostScript(this.getMigrationPath(migrationName));
  }
}

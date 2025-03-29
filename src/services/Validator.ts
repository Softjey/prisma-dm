import fs from "fs-extra";
import path from "path";
import { ConfigT } from "../config/DEFAULT_CONFIG";

export class Validator {
  constructor(private readonly config: ConfigT) {}

  isMigrationWithPrismaSchema(migrationName: string) {
    const migrationPath = path.join(this.config.migrationsDir, migrationName);
    const hasPrismaSchema = fs.existsSync(
      path.join(migrationPath, this.config.migrationSchemaFileName),
    );

    return this.isMigration(migrationName) && hasPrismaSchema;
  }

  isMigrationWithPostScript(migrationName: string) {
    const migrationPath = path.join(this.config.migrationsDir, migrationName);
    const files = fs.readdirSync(migrationPath);
    const hasPostScript = files.some((file) => /^post(\.[a-zA-Z0-9]+)?$/.test(file));

    return this.isMigration(migrationName) && hasPostScript;
  }

  isMigration(name: string) {
    const migrationsDirPath = path.join(process.cwd(), this.config.migrationsDir);
    const migrationsDir = fs.readdirSync(migrationsDirPath);

    return name !== "migration_lock.toml" && name !== ".DS_Store" && migrationsDir.includes(name);
  }

  validateMigrationName(name: string) {
    if (!this.isMigration(name)) {
      throw new Error(`Migration with name ${name} does not exist`);
    }
  }
}

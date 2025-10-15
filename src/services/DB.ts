import { MigrationModel } from "../types/MigrationModel";

import knex from "knex";
import { Knex } from "knex";
import { ConfigSchema } from "../config/config.type";
import { prismaSqliteURLToFilePath } from "../utils/prismaSqliteURLToFilePath";
import { SupportedDatasourceProvider } from "../utils/isSupportedDatasourceProvider";

export interface DataSourceConfig {
  provider: SupportedDatasourceProvider;
  url: string;
}

function createKnexConfig(dataSource: DataSourceConfig, config: ConfigSchema): Knex.Config {
  switch (dataSource.provider) {
    case "postgresql":
      return {
        client: "pg",
        connection: dataSource.url,
        pool: { min: 0, max: 10 }, // Recommended by the docs to lower min to 0
      };
    case "sqlite":
      const sqliteFilePath = prismaSqliteURLToFilePath(dataSource.url, config);
      return {
        client: "sqlite3",
        connection: {
          filename: sqliteFilePath,
        },
        useNullAsDefault: true,
      };
  }
}

export class DB {
  private readonly knexConfig: Knex.Config;
  private knex?: Knex;

  constructor(config: ConfigSchema, dataSource: DataSourceConfig) {
    this.knexConfig = createKnexConfig(dataSource, config);
  }

  async connect() {
    this.knex = knex(this.knexConfig);
  }

  async disconnect() {
    await this.knex.destroy();
  }

  async isPrismaMigrationsTableExists(): Promise<boolean> {
    if (!this.knex) {
      throw new Error("Database connection is not established. Call connect() first.");
    }

    return await this.knex.schema.hasTable("_prisma_migrations");
  }

  async getMigrationByName(name: string): Promise<MigrationModel | null> {
    if (!this.knex) {
      throw new Error("Database connection is not established. Call connect() first.");
    }

    const migration = this.knex<MigrationModel>("_prisma_migrations")
      .where({ migration_name: name })
      .first();
    return migration ?? null;
  }
}

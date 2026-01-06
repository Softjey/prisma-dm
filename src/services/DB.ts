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
    case "sqlserver":
      return {
        client: "mssql",
        connection: dataSource.url,
      };
    case "mysql":
      return {
        client: "mysql",
        connection: dataSource.url,
      };
    default:
      throw new Error(`Unsupported datasource provider: ${dataSource.provider}`);
  }
}

export class DB {
  private knex?: Knex;

  async connect(datasource: DataSourceConfig, config: ConfigSchema) {
    const knexConfig = createKnexConfig(datasource, config);
    this.knex = knex(knexConfig);
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

    const migration = await this.knex<MigrationModel>("_prisma_migrations")
      .where({ migration_name: name })
      .first();

    return migration ?? null;
  }
}

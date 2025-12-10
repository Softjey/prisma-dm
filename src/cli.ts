#!/usr/bin/env node

import { ConfigLoader } from "./config/ConfigLoader";
import { CLI } from "./services/CLI";
import { Logger } from "./services/Logger";
import { DB } from "./services/DB";
import { ScriptRunner } from "./services/ScriptRunner";
import { TargetedPrismaMigrator } from "./services/TargetedPrismaMigrator";
import { Validator } from "./services/Validator";
import { Command } from "commander";
import { readDataSourceConfig } from "./utils/readDataSourceConfig";
import packageJson from "../package.json";
import dotenv from "dotenv";

dotenv.config();

const program = new Command();

async function createCLI() {
  const { config } = new ConfigLoader();
  const dataSource = await readDataSourceConfig(config.mainPrismaSchema);

  const logger = new Logger(config);
  const db = new DB(config, dataSource);
  const validator = new Validator(config);
  const scriptRunner = new ScriptRunner(config);
  const migrator = new TargetedPrismaMigrator(logger, config);
  const cli = new CLI(migrator, scriptRunner, db, validator, logger, config);

  return cli;
}

program
  .name("prisma-dm")
  .description("CLI for Prisma data migrations")
  .version(packageJson.version);

program
  .command("init")
  .description("Generate configuration file")
  .action(() => {
    CLI.init();
  });

program
  .command("merge:schema")
  .description("Merge prisma schema folder to single schema file")
  .option("--schema <value>", "Path to schema folder", "prisma/schema")
  .option("--output <value>", "Path to output schema file", "prisma/schema.prisma")
  .action(async (options) => {
    const output = options.output as string;
    const schema = options.schema as string;

    (await createCLI()).mergeSchema(schema ?? "prisma/schema", output ?? "prisma/schema.prisma");
  });

program
  .command("generate")
  .description("Generate types for data migrations by prisma schemas")
  .action(async () => {
    (await createCLI()).generate();
  });

program
  .command("migrate")
  .description("Migrate to target migration with post scripts execution")
  .option("--to <value>", "Target migration")
  .option("--upto <value>", "Target migration = Run all migrations up to (and including) this one")
  .action(async (options) => {
    if (options.to && options.upto) {
      throw new Error('options "to" and "upto" can not be used together');
    }
    const toOption: string | undefined = options.to ?? options.upto;
    const targetMigration = toOption === "latest" ? undefined : toOption;

    (await createCLI()).migrate({
      targetMigration,
      includeTargetMigration: !options.to,
    });
  });

program
  .command("run:postscript")
  .description(
    "Run a specific data migration post script manually (particularly useful when a post script fails during migration, allowing you to reapply it after fixing the issue)",
  )
  .option("-m, --migration <value>", "Name of the migration")
  .action(async (options) => {
    if (!options.migration) {
      throw new Error('Option "--migration" is required to specify the migration name');
    }

    const migrationName = options.migration;

    (await createCLI()).runPostScript(migrationName);
  });

program.on("command:*", () => {
  console.error("Unknown command: %s", program.args.join(" "));
  program.help();
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}

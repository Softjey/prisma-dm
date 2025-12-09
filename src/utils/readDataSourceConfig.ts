import { readFileSync } from "fs";

import {
  parsePrismaSchema,
  readStringArgument,
  SchemaArgument,
} from "@loancrate/prisma-schema-parser";
import { DataSourceConfig } from "../services/DB";
import isSupportedDatasourceProvider, {
  SUPPORTED_DATASOURCE_PROVIDERS,
} from "./isSupportedDatasourceProvider";

/**
 * Reads a schema argument and resolves any env() function calls.
 * @param arg The schema argument to read.
 * @returns The resolved string value.
 */
function readArgumentWithEnv(arg: SchemaArgument): string {
  if (arg.kind === "literal") {
    if (typeof arg.value !== "string") {
      throw new Error("Expected a string literal for provider");
    }

    return arg.value;
  }

  if (arg.kind === "functionCall" && arg.path.value.join(".") === "env") {
    if (!arg.args || arg.args.length !== 1) {
      throw new Error("env() function must have exactly one argument.");
    }

    const envName = readStringArgument(arg.args[0]);
    const envValue = process.env[envName];

    if (!envValue) {
      throw new Error(`Environment variable ${envName} is not set.`);
    }

    return envValue;
  }

  throw new Error(
    "Only string literals and env() function calls are supported for provider.",
  );
}

/**
 * Reads the datasource configuration (provider) from a Prisma schema file.
 * @param schemaPath
 * @returns
 */
export function readDataSourceConfig(schemaPath: string): DataSourceConfig {
  const schemaContent = readFileSync(schemaPath, "utf-8");
  const schemaAst = parsePrismaSchema(schemaContent);

  const datasourceDeclaration = schemaAst.declarations.find((decl) => decl.kind === "datasource");

  const providerDeclaration =
    "members" in datasourceDeclaration
      ? datasourceDeclaration.members.find(
        (member) => "name" in member && member.name.value === "provider",
      )
      : null;

  if (!providerDeclaration) {
    throw new Error(
      "Datasource declaration must include a 'provider' configuration.",
    );
  }

  if (!("value" in providerDeclaration)) {
    throw new Error("'provider' must be configured with a value.");
  }

  const provider = readArgumentWithEnv(providerDeclaration.value);

  if (!isSupportedDatasourceProvider(provider)) {
    throw new Error(
      `Unsupported datasource provider: ${provider}. Supported providers are: ${SUPPORTED_DATASOURCE_PROVIDERS.join(", ")}`,
    );
  }

  const URL = process.env.DATABASE_URL;

  if (URL === undefined) {
    throw new Error('DATABASE_URL should be set.');
  }

  return { provider, url: URL };
}

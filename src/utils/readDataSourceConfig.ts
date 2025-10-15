import { readFileSync } from "fs";

import {
  parsePrismaSchema,
  readStringArgument,
  SchemaArgument,
} from "@loancrate/prisma-schema-parser";
import { DataSourceConfig } from "../services/DB";
import isSupportedDatasourceProvider from "./isSupportedDatasourceProvider";

/**
 * Reads a schema argument and resolves any env() function calls.
 * @param arg The schema argument to read.
 * @returns The resolved string value.
 */
function readArgumentWithEnv(arg: SchemaArgument): string {
  if (arg.kind === "literal") {
    if (typeof arg.value !== "string") {
      throw new Error("Expected a string literal for provider or url.");
    }

    return arg.value;
  }

  if (arg.kind === "functionCall" && arg.path.value.join(".") === "env") {
    if (!arg.args || arg.args.length !== 1) {
      throw new Error("env() function must have exactly one argument.");
    }

    const envName = readStringArgument(arg.args[0]);
    const envValue = process.env[envName];

    return envValue;
  }

  throw new Error(
    "Only string literals and env() function calls are supported for provider and url.",
  );
}

/**
 * Reads the datasource configuration (provider and url) from a Prisma schema file.
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

  const urlDeclaration =
    "members" in datasourceDeclaration
      ? datasourceDeclaration.members.find(
          (member) => "name" in member && member.name.value === "url",
        )
      : null;

  if (!providerDeclaration || !urlDeclaration) {
    throw new Error(
      "Datasource declaration must include both 'provider' and 'url' configurations.",
    );
  }

  if (!("value" in providerDeclaration) || !("value" in urlDeclaration)) {
    throw new Error("'provider' and 'url' must be config declarations with values.");
  }

  const provider = readArgumentWithEnv(providerDeclaration.value);
  const url = readArgumentWithEnv(urlDeclaration.value);

  if (!isSupportedDatasourceProvider(provider)) {
    throw new Error(`Unsupported datasource provider: ${provider}`);
  }

  return { provider, url };
}

import { readFileSync } from "fs";
import path from "path";

import { parsePrismaSchema, readStringArgument, SchemaArgument } from "@loancrate/prisma-schema-parser";
import { DataSourceConfig } from "../services/DB";
import { ConfigSchema } from "../config/config.type";


/// Reads either a string literal or an env() function call from
/// a prisma schema argument. If env() is used, the value is read
/// from process.env.
function readArgumentWithEnv(arg: SchemaArgument): string {
    if (arg.kind === "literal") {
        if (typeof arg.value !== "string") {
            throw new Error("Expected a string literal for provider or url.");
        }
        return arg.value;
    } else if (arg.kind === "functionCall" && arg.path.value.join(".") === "env") {
        if (!arg.args || arg.args.length !== 1) {
            throw new Error("env() function must have exactly one argument.");
        }

        const envName = readStringArgument(arg.args[0]);
        const envValue = process.env[envName];

        return envValue;
    }

    throw new Error("Only string literals and env() function calls are supported for provider and url.");
}

/// Converts a SQLite URL from a Prisma schema to an absolute file path.
export function prismaSqliteURLToFilePath(url: string, config: ConfigSchema): string {
  if (!url.startsWith("file:")) {
    throw new Error("Invalid SQLite URL format. Expected to start with 'file:'.");
  }
  const prismaPath = url.slice(5);

  // Relative paths are relative to the main schema file location.
  // We convert it to an absolute path, since the path relative
  // to the schema copied to the migrations folder would be different.
  if (path.isAbsolute(prismaPath)) {
    return prismaPath;
  } else {
    const schemaDirPath = path.dirname(config.mainPrismaSchema);
    const absolutePath = path.resolve(schemaDirPath, prismaPath);
    return absolutePath;
  }
}

/// Reads the datasource configuration (provider and url)
/// from a Prisma schema file.
export function readDataSourceConfig(schemaPath: string): DataSourceConfig {
    const schemaContent = readFileSync(schemaPath, "utf-8");
    const schemaAst = parsePrismaSchema(schemaContent);

    const datasourceDeclaration = schemaAst.declarations.find(decl => decl.kind === "datasource");

    const providerDeclaration = 'members' in datasourceDeclaration ?
        datasourceDeclaration.members.find(
            member => "name" in member && member.name.value === "provider"
        ) : null;

    const urlDeclaration = 'members' in datasourceDeclaration ?
        datasourceDeclaration.members.find(
            member => "name" in member && member.name.value === "url"
        ) : null;

    if (!providerDeclaration || !urlDeclaration) {
        throw new Error("Datasource declaration must include both 'provider' and 'url' configurations.");
    }

    if (!('value' in providerDeclaration) || !('value' in urlDeclaration)) {
        throw new Error("'provider' and 'url' must be config declarations with values.");
    }

    const provider = readArgumentWithEnv(providerDeclaration.value);
    let url = readArgumentWithEnv(urlDeclaration.value);

    return { provider, url };
}

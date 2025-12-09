import fs from "fs/promises";

import {
  parsePrismaSchema,
  PrismaSchema,
  SchemaDeclaration,
  Config,
  formatAst,
  CommentBlock,
  ConfigBlockMember,
} from "@loancrate/prisma-schema-parser";
import { DataSourceConfig } from "../services/DB";
import { prismaSqliteURLToFilePath } from "./prismaSqliteURLToFilePath";
import { ConfigSchema } from "../config/config.type";
import path from "path";

function isNonClientGenerator(decl: SchemaDeclaration): boolean {
  return (
    decl.kind === "generator" &&
    !decl.members?.some(
      (member) =>
        member.kind === "config" &&
        member.name?.value === "provider" &&
        member.value?.kind === "literal" &&
        (member.value?.value === "prisma-client-js" || member.value?.value === "prisma-client"),
    )
  );
}

/**
 * Updates the client generator block to set the output path
 * to the specified path. Removes any other generator blocks.
 */
function updateGenerator(ast: PrismaSchema, clientOutputPath: string): PrismaSchema {
  let astCopy = structuredClone(ast);
  astCopy.declarations = astCopy.declarations.filter((decl) => !isNonClientGenerator(decl));
  const generators = astCopy.declarations.filter((decl) => decl.kind === "generator");
  if (generators.length !== 1) {
    throw new Error("The schema must contain exactly one generator block for prisma-client-js or prisma-client.");
  }
  let generator = generators[0];

  if (!("members" in generator)) {
    throw new Error("The generator block must have a members array.");
  }

  let generatorOutputAttribute = generator.members.find(
    (attr) => attr.kind === "config" && attr.name?.value === "output",
  ) as Config | undefined;

  if (!generatorOutputAttribute) {
    const newOutputAttribute: Config = {
      kind: "config",
      name: { kind: "name", value: "output" },
      value: { kind: "literal", value: clientOutputPath },
    };

    generator.members.push(newOutputAttribute as unknown as CommentBlock);
  } else {
    generatorOutputAttribute.value = { kind: "literal", value: clientOutputPath };
  }

  return astCopy;
}

/**
 * Updates the datasource block so that in case of SQLite,
 * the file path in the URL is absolute (not relative).
 * This is needed because the schema copied to the migrations
 * folder would have a different relative path.
 */
function updateDatasource(
  ast: PrismaSchema,
  dataSource: DataSourceConfig,
  config: ConfigSchema,
): PrismaSchema {
  if (dataSource.provider === "sqlite") {
    // This ensures that the SQLite file path is absolute
    dataSource.url = `file:${prismaSqliteURLToFilePath(dataSource.url, config)}`;
  }

  return ast;
}

/**
 * Creates a temporary Prisma schema file for generating the client for a migration.
 * The schema is based on the source schema file, but with updated generator and datasource blocks.
 */
export async function createTempSchema(
  srcPrismaSchemaPath: string,
  clientOutputPath: string,
  dataSource: DataSourceConfig,
  outPrismaSchemaPath: string,
  config: ConfigSchema,
) {
  const schemaContent = await fs.readFile(srcPrismaSchemaPath, "utf-8");

  let schemaAst = parsePrismaSchema(schemaContent);
  schemaAst = updateGenerator(schemaAst, clientOutputPath);
  schemaAst = updateDatasource(schemaAst, dataSource, config);

  const formattedSchema = formatAst(schemaAst);
  await fs.mkdir(path.dirname(outPrismaSchemaPath), { recursive: true });
  await fs.writeFile(outPrismaSchemaPath, formattedSchema, "utf-8");
}

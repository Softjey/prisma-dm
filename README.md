# Prisma Data Migrations

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Usage](#usage)
  - [Commands](#commands)
  - [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Warnings and Considerations](#warnings-and-considerations)
- [Contributing](#contributing)
- [License](#license)

## Overview

Prisma Data Migrations is a library designed to address the lack of built-in support for data migrations in Prisma ORM. It allows you to execute post-migration scripts alongside schema migrations.

## Installation

Install the library via npm:

```bash
npm install prisma-data-migrations --save-dev
```

## Usage

### Commands

```bash
npx prisma-dm help
```

Output:

```
Usage: prisma-dm [options] [command]

CLI for Prisma data migrations

Options:
  -V, --version             output the version number
  -h, --help                display help for command

Commands:
  init                      Generate configuration file
  merge:schema [options]    Merge prisma schema folder to single schema file
  generate                  Generate types for data migrations by prisma schemas
  migrate [options]         Migrate to target migration with post scripts execution
  run:postscript [options]  Run a specific data migration post script manually (particularly useful when a post script fails during migration, allowing you to reapply it after fixing the issue)
  help [command]            display help for command
```

### Quick Start

1. **Initialize Configuration**:
   Run the following command to create a configuration file:

   ```bash
   npx prisma-dm init
   ```

   This generates a default configuration file (`prisma-dm.config.json`) in the root of your project.

2. **Merge Prisma Schema** (Optional):
   If you use `prismaSchemaFolder` feature, you can merge all prisma files into a single schema file for easier management within the migration folder.

   Example:

   ```bash
   npx prisma-dm merge:schema --schema prisma/schema --output prisma/schema.prisma
   ```

   This merges all schemas in the `prisma/schema` folder into a single `schema.prisma` file.

3. **Add `schema.prisma` to Migration Folders** (Optional):
   Place the `schema.prisma` file in the corresponding migration folder alongside `migration.sql`. This file must match the schema state after applying the Prisma migration.

   ⚠️ **Note**: You can skip copying the `schema.prisma` file and generating types if you do not need the Prisma Client. Instead, you can simply add the post-migration script directly to the migration folder.
   ⚠️ **Note**: You can change the default `schema.prisma` filename by using the `migrationSchemaFileName` key in the config.

4. **Generate Types**:
   Run the `generate` command to create TypeScript types for your data migrations based on your schemas:

   ```bash
   npx prisma-dm generate
   ```

5. **Create Post-Migration Script**:
   Create a post-migration script in the migration folder. The script must be named `post` and can have any file extension (e.g., `.ts`, `.js`, `.sh`). Example:

   ```typescript
   import {
     Prisma,
     PrismaClient,
   } from "prisma-data-migrations/migrations/20250108201031_add_user_name";

   async function nameUsers(prisma: Prisma.TransactionClient) {
     await prisma.user.updateMany({
       data: {
         name: "Name for users :)",
       },
     });
   }

   const prisma = new PrismaClient();
   prisma.$transaction(nameUsers, { timeout: 60_000 });
   ```

   ### ⚠️ **Important** ⚠️

   - Always wrap your logic in a transaction to ensure atomic operations.
   - If the post script fails, you must manually reapply it after resolving the issue.
   - To simplify manual reapplication you can use the `run:postscript` command.

   After completing this step, your directory structure should look like this:

   ```
   project-root/
   ├── prisma/
   │   ├── migrations/
   │       ├── 20250108201031_add_user_name/
   │           ├── migration.sql
   │           ├── schema.prisma
   │           └── post.ts
   ├── prisma-dm.config.json
   ```

6. **Run Migration**:
   Execute the migration and post-migration script using:

   ```bash
   npx prisma-dm migrate
   ```

   (by default, it migrates to `latest`)

   ⚠️ **Note**: You can use the `--to` flag to migrate to a specific migration version (not including the migration passed). Example:

   ```bash
   npx prisma-dm migrate --to 20250108201031_add_user_name
   ```

   ⚠️ **Note**: You can use the `--upto` flag to migrate to a specific migration version (including the one passed). Example:

   ```bash
   npx prisma-dm migrate --upto 20250108201031_add_user_name
   ```

7. **Reapplying Failed Post Scripts** (If migration fails):

   - If a migration fails due to an error in the post script, you need to manually fix the issue and reapply the post script.
   - To reapply a specific post script, use the `run:postscript` command with the `-m` flag, specifying the migration folder name:

   ```bash
   npx prisma-dm run:postscript -m 20250108201031_add_user_name
   ```

   This ensures that only the failed post script is executed after addressing the issue without reverting the already applied schema migration.

## Configuration

The configuration file (`prisma-dm.config.json`) allows customization of the library. Key fields include:

- **`execScriptCommand`**: Specifies the command to execute the post-migration script. Include the placeholder `${post}` for the script name. Example:

  - For `.ts` scripts: `"tsx ${post}.ts"`
  - For shell scripts: `"sh ${post}.sh"`

- **`outputDir`**: Directory for generated migration files.

  - **Default**: `../../../node_modules/prisma-data-migrations/migrations`.
  - **Note**: This path is specified **relative to** the `migrations/{some_migration}/schema.prisma` file, as it is the value of the `output` parameter in the Prisma schema settings block.

- **`migrationsDir`**: Directory containing Prisma migrations. Default: `prisma/migrations`.

- **`tempDir`**: Temporary directory for moving migration folders during execution. Default: `prisma/.temp`.

- **`migrationSchemaFileName`**: The filename for prisma schema files within migration directories. Default: `schema.prisma`.

- **`mainPrismaSchema`**: The main Prisma schema file or folder for `npx prisma migrate deploy` command. Default: `prisma/schema.prisma`.

- **`log`**: Logging level (`none`, `info`, `verbose`). Default: `info`.

## Warnings and Considerations

### ⚠️ Key Warnings ⚠️

- **Post scripts and transactions**:

  - Post scripts are not included in the same transaction as schema migrations.
  - If a post script fails, you will need to manually reapply it after resolving the issue.
  - To simplify manual reapplication you can use the `run:postscript` command.

- **Development status**:

  - This library is developed and maintained by a single developer and has not been fully tested. Issues may occur.
  - Please report problems or submit feature requests—I am always open to feedback and contributions.

- **Database support**:

  - Fully tested with PostgreSQL and for now will only work with PostgreSQL and probably other PostgreSQL-compatible databases.
  - Other databases will require additional logic; contributions are welcome.

- **Future improvements**:
  - Plans to track post scripts in a dedicated database table to improve reliability. Community contributions are highly encouraged.

## Contributing

We welcome contributions! Visit the [GitHub Repository](https://github.com/Softjey/prisma-dm) to:

- Report issues
- Provide feedback
- Submit pull requests

## License

This project is open-source under the ISC License.

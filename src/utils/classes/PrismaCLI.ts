import { execSync } from "child_process";

export abstract class PrismaCLI {
  static generate({ schema }: { schema: string }) {
    const baseCommand = "npx prisma generate";
    const schemaFlag = `--schema=${schema}`;

    execSync(`${baseCommand} ${schemaFlag}`, { stdio: "ignore" });
  }

  static migrateDeploy({ schema }: { schema: string }) {
    const baseCommand = "npx prisma migrate deploy";
    const schemaFlag = `--schema=${schema}`;

    execSync(`${baseCommand} ${schemaFlag}`, { stdio: "inherit" });
  }
}

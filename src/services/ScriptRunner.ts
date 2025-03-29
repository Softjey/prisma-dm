import { execSync } from "child_process";
import { ConfigT } from "../config/DEFAULT_CONFIG";
import path from "path";

export class ScriptRunner {
  constructor(private readonly config: ConfigT) {}

  runPostScript(migrationPath: string) {
    const execCommand = this.config.execScriptCommand.replace(
      "${post}",
      path.join(migrationPath, "post"),
    );

    execSync(execCommand, { stdio: "inherit" });
  }
}

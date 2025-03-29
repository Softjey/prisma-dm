import path from "path";
import fs from "fs-extra";
import { CONFIG_FILE_NAME } from "./CONFIG_FILE_NAME";
import schema from "../../config.schema.json";
import Ajv from "ajv";
import { ConfigT, DEFAULT_CONFIG } from "./DEFAULT_CONFIG";

export class ConfigLoader {
  readonly #config: ConfigT;

  constructor() {
    const configFilePath = path.join(process.cwd(), CONFIG_FILE_NAME);
    let parsedConfig = {};
    let file: string;
    try {
      file = fs.readFileSync(configFilePath, "utf-8");
    } catch (error) {
      console.info(`No config file found, falling back to default config.`);
    }

    if (file !== undefined) {
      try {
        parsedConfig = JSON.parse(file);
      } catch (error) {
        console.error(
          `Failed to parse config file: ${error.message}, falling back to default config.`,
        );
        throw new Error("Failed to parse config file");
      }
    }

    const config: ConfigT = {
      ...DEFAULT_CONFIG,
      ...parsedConfig,
    };

    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    if (!validate(config)) {
      console.error("Invalid configuration file:", validate.errors);
      throw new Error("Configuration validation failed.");
    }

    this.#config = {
      migrationsDir: path.join(process.cwd(), config.migrationsDir),
      tempDir: path.join(process.cwd(), config.tempDir),
      ...config,
    };
  }

  get config() {
    return this.#config;
  }
}

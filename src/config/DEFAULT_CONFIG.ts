import schema from "../../config.schema.json";
import Ajv from "ajv";
import { ConfigSchema } from "./config.type";

const ajv = new Ajv({ useDefaults: true });

const validate = ajv.compile(schema);
const defaultConfig: Record<string, any> = {};
validate(defaultConfig);

if (validate.errors) {
  throw new Error("Invalid default configuration: " + JSON.stringify(validate.errors, null, 2));
}

export type ConfigT = Required<ConfigSchema>;
export const DEFAULT_CONFIG = defaultConfig as Required<ConfigSchema>;

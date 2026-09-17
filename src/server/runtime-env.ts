import { readFileSync, statSync } from "node:fs";

/** Read explicitly mounted startup secrets before database/auth modules initialize. */
export function loadRuntimeSecrets(env: NodeJS.ProcessEnv = process.env) {
  for (const name of ["SKILLBOX_ADMIN_TOKEN", "DATABASE_URL"] as const) {
    const path = env[`${name}_FILE`];
    if (!path) continue;
    if (env[name])
      throw new Error(`Set either ${name} or ${name}_FILE, not both`);
    let value: string;
    try {
      if (statSync(path).size > 4096) throw new Error("Too large");
      value = readFileSync(path, "utf8").trim();
      if (!value) throw new Error("Empty");
    } catch {
      // File names, contents and system errors can contain private data.
      throw new Error(`Cannot read ${name}_FILE`);
    }
    env[name] = value;
  }
}

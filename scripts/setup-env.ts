import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { isIP } from "node:net";

const options: Record<string, string> = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  if (!["--origin", "--bind", "--port"].includes(args[i]) || !args[i + 1])
    throw new Error(
      "Usage: setup-env.ts [--origin URL] [--bind IPv4] [--port PORT]",
    );
  options[args[i]] = args[i + 1];
}
const port = options["--port"] ?? "4791";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("Invalid host port");
const bind = options["--bind"] ?? "127.0.0.1";
if (isIP(bind) !== 4) throw new Error("Bind address must be an IPv4 address");
let origin: URL;
try {
  origin = new URL(options["--origin"] ?? `http://127.0.0.1:${port}`);
} catch {
  throw new Error("Invalid origin URL");
}
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== "/"
)
  throw new Error(
    "Origin must be an HTTP(S) origin without credentials or a path",
  );
const values = [
  `POSTGRES_PASSWORD=${randomBytes(24).toString("hex")}`,
  `SKILLBOX_ADMIN_TOKEN=${randomBytes(32).toString("hex")}`,
  `SKILLBOX_ORIGIN=${origin.origin}`,
  `SKILLBOX_BIND_ADDRESS=${bind}`,
  `SKILLBOX_PORT=${port}`,
  "# Set the origin to your own HTTPS URL before remote deployment.",
  "# Optional comma-separated additional browser origins:",
  "SKILLBOX_ALLOWED_ORIGINS=",
  "",
].join("\n");
try {
  await writeFile(".env", values, { mode: 0o600, flag: "wx" });
  console.log(
    "Created .env with unique credentials (mode 0600). The owner login key is SKILLBOX_ADMIN_TOKEN in that file. Existing environments are never overwritten.",
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EEXIST") {
    console.error(".env already exists; left unchanged.");
    process.exitCode = 1;
  } else throw error;
}

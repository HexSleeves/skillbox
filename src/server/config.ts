export const appOrigin = () =>
  process.env.SKILLBOX_ORIGIN ?? "http://127.0.0.1:4791";

// Explicit deployment configuration only. No trusted personal hostnames ship in source.
export function allowedOrigins() {
  const origins = [
    appOrigin(),
    ...(process.env.SKILLBOX_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean),
  ];
  return new Set(
    origins.map((value) => {
      const url = new URL(value.trim());
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        throw new Error("Invalid configured origin");
      return url.origin;
    }),
  );
}
export function executorResourceAliases(): Record<string, string> {
  const value: unknown = JSON.parse(
    process.env.SKILLBOX_EXECUTOR_RESOURCE_ALIASES || "{}",
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Executor resource aliases");
  for (const [endpoint, resource] of Object.entries(value)) {
    for (const item of [endpoint, resource]) {
      if (typeof item !== "string")
        throw new Error("Invalid Executor resource alias");
      const url = new URL(item);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error("Invalid Executor resource alias");
    }
  }
  return value as Record<string, string>;
}

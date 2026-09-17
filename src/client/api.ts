export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const r = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error ?? "Request failed"), {
      status: r.status,
    });
  return data;
}
export const date = (s: string) =>
  new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export async function encodedFile(
  path: string,
  text: string,
  executable = false,
) {
  const bytes = new TextEncoder().encode(text),
    digest = await crypto.subtle.digest("SHA-256", bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return {
    path,
    content: btoa(binary),
    size: bytes.length,
    sha256: Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    executable,
  };
}
export const decoded = (content: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(content), (c) => c.charCodeAt(0)),
  );

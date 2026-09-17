import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("remote HTTP requires explicit trusted-LAN opt-in and HTTPS remains default", async () => {
  for (const [allow, expected] of [
    ["", 1],
    ["1", 0],
  ] as const) {
    const child = Bun.spawn(
      [process.execPath, resolve("cli/skillbox.mjs"), "help"],
      {
        env: {
          ...process.env,
          SKILLBOX_CONFIG: "/tmp/skillbox-nonexistent-fixture-config",
          SKILLBOX_URL: "http://umbrel.invalid:4791",
          SKILLBOX_ALLOW_INSECURE_HTTP: allow,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(await child.exited).toBe(expected);
    if (!allow)
      expect(await new Response(child.stderr).text()).toContain(
        "Use HTTPS outside localhost",
      );
  }
});

test("CLI recommend posts natural-language task and preserves server result", async () => {
  const requests: Array<{ path: string; method: string; task: string }> = [];
  const result = {
    items: [
      {
        id: "expo",
        referenceId: "fixture-uuid",
        revision: "fixture-revision",
        relevance: 4,
      },
    ],
    method: "jev",
    noMatch: false,
    hasMore: false,
    nextOffset: null,
  };
  // Finite loopback-only fixture, not an app preview or live service.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      expect(request.headers.get("Authorization")).toBe("Bearer fixture-token");
      requests.push({
        path: new URL(request.url).pathname,
        method: request.method,
        task: (await request.json()).task,
      });
      return Response.json(result);
    },
  });
  const run = (args: string[]) =>
    Bun.spawn([process.execPath, resolve("cli/skillbox.mjs"), ...args], {
      env: {
        ...process.env,
        SKILLBOX_CONFIG: "/tmp/skillbox-nonexistent-fixture-config",
        SKILLBOX_URL: `http://127.0.0.1:${server.port}`,
        SKILLBOX_TOKEN: "fixture-token",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
  try {
    const child = run(["recommend", "Fix choppy", "scrolling"]);
    const output = await new Response(child.stdout).text();
    expect(await child.exited).toBe(0);
    expect(JSON.parse(output)).toEqual(result);
    expect(requests).toEqual([
      {
        path: "/api/skill-recommendations",
        method: "POST",
        task: "Fix choppy scrolling",
      },
    ]);
    const invalid = run(["recommend"]);
    expect(await invalid.exited).not.toBe(0);
    expect(await new Response(invalid.stderr).text()).toContain(
      "Usage: skillbox recommend <task>",
    );
    expect(requests.length).toBe(1);
  } finally {
    server.stop(true);
  }
});

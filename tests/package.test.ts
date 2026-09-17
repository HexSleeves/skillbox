import { test, expect } from "bun:test";
// @ts-expect-error CLI intentionally ships as dependency-free JavaScript.
import { verifyBundle, materialize, hash } from "../cli/package.mjs";
import { makeFile } from "../src/server/library";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
function bundle() {
  const files = [
    makeFile("SKILL.md", "A workflow"),
    makeFile("scripts/helper.sh", "#!/bin/sh\nexit 0\n", true),
  ];
  return {
    format: "skillbox/v1",
    id: "test",
    revision: "r1",
    files,
    checksum: hash(
      JSON.stringify(
        [...files]
          .sort((a, b) => a.path.localeCompare(b.path, "en-US"))
          .map((f) => [f.path, f.sha256, f.executable]),
      ),
    ),
  };
}
test("bundle validation rejects tampering and unsafe paths", () => {
  const b = bundle();
  expect(verifyBundle(b).length).toBe(2);
  b.files[1].content = Buffer.from("tampered").toString("base64");
  expect(() => verifyBundle(b)).toThrow();
  b.files[1].path = "../escape";
  expect(() => verifyBundle(b)).toThrow();
});
test("fetch materializes verified bytes without trusting a previous mutable copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "skillbox-"));
  try {
    const b = bundle();
    const a = await materialize(b, root);
    const c = await materialize(b, root);
    expect(c).not.toBe(a);
    expect(isAbsolute(c)).toBe(true);
    expect(await readFile(join(c, "SKILL.md"), "utf8")).toBe("A workflow");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package weight includes references and source files but excludes managed artwork", async () => {
  const { packageMetrics, packageBand } =
    await import("../src/package-metrics");
  const { makeFile } = await import("../src/server/library");
  const files = [makeFile("SKILL.md", "Small")];
  expect(packageBand(packageMetrics(files))).toBe(0);
  for (let i = 0; i < 73; i++)
    files.push(makeFile(`references/${i}.md`, "Reference"));
  expect(packageMetrics(files).fileCount).toBe(74);
  expect(packageBand(packageMetrics(files))).toBe(4);
  files.push(makeFile("assets/skillbox-icon.webp", "icon"));
  expect(packageMetrics(files).fileCount).toBe(74);
  expect(packageMetrics(files).characters).toBe(5 + 73 * 9);
});

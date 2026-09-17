import { test, expect } from "bun:test";
import { parseSkillIcon, skillIconUrl } from "../src/skill-icons";
test("validates portable icon metadata", () => {
  expect(parseSkillIcon({ kind: "emoji", value: "🎨" })).toEqual({
    kind: "emoji",
    value: "🎨",
  });
  expect(() =>
    parseSkillIcon({ kind: "icon", name: "toString", background: "#ffffff" }),
  ).toThrow();
  expect(() =>
    parseSkillIcon({ kind: "image", src: "javascript:alert(1)" }),
  ).toThrow();
  expect(
    skillIconUrl({ kind: "icon", name: "palette", background: "#526b91" }),
  ).toStartWith("data:image/svg+xml,");
});

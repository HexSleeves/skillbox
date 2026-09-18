import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { skills, revisions } from "./schema";
import * as library from "./library";
import type { Principal } from "../shared";
import {
  inspectSkillPackage,
  parseSkillResourceUri,
  resourceContent,
} from "../skill-manifest";

const PAGE_SIZE = 25;
const unavailable = () => new library.Problem(404, "Skill resource not found");

async function activeRevision(p: Principal, id: string) {
  id = await library.resolveReferenceId(id);
  if (!(await library.canRead(p, id))) throw unavailable();
  // One statement captures lifecycle, identity and bytes from the same database
  // snapshot. An already admitted read is not retroactively retractable.
  const [snapshot] = await db
    .select({ skill: skills, revision: revisions })
    .from(skills)
    .innerJoin(
      revisions,
      and(eq(revisions.id, skills.revision), eq(revisions.skillId, skills.id)),
    )
    .where(
      and(
        eq(skills.id, id),
        eq(skills.kind, "skill"),
        eq(skills.disabled, false),
        eq(skills.archived, false),
      ),
    );
  if (!snapshot) throw unavailable();
  return snapshot;
}

export async function manifestFor(p: Principal, id: string) {
  const { skill, revision } = await activeRevision(p, id);
  const result = inspectSkillPackage(
    skill.referenceId,
    skill.id,
    revision.files,
  );
  if (!result.manifest)
    throw new library.Problem(
      422,
      "Skill is not compatible; run the compatibility audit",
    );
  return {
    skill: result.manifest,
    revision: revision.id,
    warnings: result.issues,
  };
}

// Transport-neutral projection for a future SDK Skills adapter. No new protocol
// capability is advertised until the base protocol and host gates are verified.
export async function manifestPage(p: Principal, cursor?: string) {
  if (cursor !== undefined && !/^v1:(0|[1-9][0-9]{0,8})$/.test(cursor))
    throw new library.Problem(400, "Invalid resource cursor");
  const offset = cursor === undefined ? 0 : Number(cursor.slice(3));
  const page = await library.search(p, "", PAGE_SIZE, offset);
  const entries = [];
  for (const item of page.items) {
    try {
      entries.push((await manifestFor(p, item.id)).skill);
    } catch (error) {
      // Incompatible legacy packages remain available through existing tools.
      // Concurrent revocation/removal must not turn a listing into a disclosure.
      if (
        !(error instanceof library.Problem) ||
        ![404, 422].includes(error.status)
      )
        throw error;
    }
  }
  return {
    skills: entries,
    ...(page.hasMore ? { nextCursor: `v1:${page.nextOffset}` } : {}),
  };
}

export async function readResource(p: Principal, uri: string) {
  let address;
  try {
    address = parseSkillResourceUri(uri);
  } catch {
    throw unavailable();
  }
  const { skill, revision } = await activeRevision(p, address.referenceId);
  if (skill.id !== address.name) throw unavailable();
  const result = inspectSkillPackage(
    skill.referenceId,
    skill.id,
    revision.files,
  );
  if (!result.manifest) throw unavailable();
  const file = revision.files.find((entry) => entry.path === address.path);
  if (!file) throw unavailable();
  const content = resourceContent(uri, file);
  // A resource read is not activation or execution. Reuse read_file, not load.
  await library.record(p, "read_file", skill.id, {
    revision: revision.id,
    path: file.path,
    purpose: "MCP resource read (not skill activation)",
  });
  return { contents: [content] };
}

/** Owner-only caller; bounded pages include inactive packages for remediation. */
export async function compatibilityPage(p: Principal, offset = 0) {
  if (p.role !== "admin")
    throw new library.Problem(403, "Administrator access required");
  const page = await library.search(p, "", PAGE_SIZE, offset, true, true, [
    "skill",
  ]);
  const items = [];
  for (const item of page.items) {
    const revision = await library.revisionFor(p, item.id, item.revision);
    const { compatible, issues } = inspectSkillPackage(
      item.referenceId!,
      item.id,
      revision.files,
    );
    items.push({
      id: item.id,
      referenceId: item.referenceId,
      revision: revision.id,
      archived: item.archived,
      disabled: item.disabled,
      compatible,
      issues,
    });
  }
  return { items, hasMore: page.hasMore, nextOffset: page.nextOffset };
}

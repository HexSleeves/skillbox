# MCP Skills readiness

Skillbox is preparing a native implementation of the official
[`io.modelcontextprotocol/skills` extension](https://modelcontextprotocol.io/extensions/skills/overview).
This is standards compatibility, not affiliation with or endorsement by the MCP project.

## Shipped foundation

- A pure manifest projection from existing immutable revisions. No second store or schema migration.
- Canonical resource URIs: `skill://skillbox/<referenceId>/<name>/SKILL.md`.
- Complete file manifests, byte sizes, `sha256:<hex>` digests, and original parsed frontmatter.
- Base MCP `resources/list`, `resources/read`, and an empty `resources/templates/list` response on `/mcp`.
- Paginated, authorized discovery of compatible, enabled, non-archived leaf skills.
- On-demand reads of supporting files, including binary and larger-than-inline content.
- Byte verification before serving content. Text preserves UTF-8 bytes; binary uses base64.
- A read-only compatibility audit. Legacy packages and existing tools keep working unchanged.

`resources/list` lists `SKILL.md` resources, not every supporting file. A complete
manifest is available through the authenticated preview endpoint below. This is
**not** the extension's `skills/list` response. Ordinary resource reads are not
skill activation, approval, installation, or execution.

### Compatibility audit

After upgrading the server, use an owner credential in the protected CLI config:

```sh
node cli/skillbox.mjs audit
```

The command walks all pages, prints JSON with counts and per-skill issues, and
exits 1 when incompatible packages exist. Archived and disabled skills are
included; bundles are not. It does not publish or repair anything. Warnings do
not change the exit status. The endpoint is owner-only:

```text
GET /api/skill-compatibility?offset=0
```

Treat output as private inventory, even though it contains no skill bodies.
Do not commit it to the application repository or a public issue. Concurrent
edits can make a multi-page audit a mixed-time view; run it again after edits.

Audit checks include required name/description, naming and length rules,
strict YAML/UTF-8 parsing, JSON-safe frontmatter, optional standard fields,
file integrity, path safety, and extension portability limits. Unknown
frontmatter is retained unchanged. Legacy malformed-YAML normalization is not
used. UUID-only `skill://UUID` links produce a warning because native clients do
not know Skillbox's historical reference convention.

The audit checks compatibility, **not malicious instructions or secret safety**.
A passing package is not trusted, approved, executed, or certified conformant.

### Manifest preview

```sh
node cli/skillbox.mjs manifest my-skill
```

```text
GET /api/skills/:id/manifest
```

Readers can preview only authorized, active skills. The response contains
`skill` (the standards-shaped entry), `revision` (Skillbox metadata), and
`warnings`. Incompatible packages return 422. Unauthorized/inactive/missing
skills return 404. The endpoint never normalizes or rewrites package bytes.

### Resource reads

Use base MCP `resources/read` with a URI from the manifest. Resource errors use
JSON-RPC `-32602` for missing/invalid/unauthorized URIs and `-32603` for internal
failures. The server refreshes the principal for each resource request. Reads
use existing `read_file` telemetry, not `load` or `reported_use` events.

Canonical URIs stay stable across revisions. A publish changes manifest digests;
a later read can therefore differ from an earlier manifest. A native host must
reject mismatched bytes, refresh the entry, and obtain any required approval
again. Existing revision-pinned `load_skill`, `read_skill_file`, and CLI fetch
remain the supported path when a caller needs an immutable package snapshot.
Legacy `skill://UUID` references remain supported by those existing tools.

The `skillbox` URI authority is a namespace, not a host to resolve over DNS.
Clients must key identity by their assigned **server identity plus full URI**.
The same URI on two Skillbox installations is not the same remote origin.

## Deliberately not advertised yet

The installed SDK is the legacy `@modelcontextprotocol/sdk` line. This release
advertises base Resources only, **not** `io.modelcontextprotocol/skills`.
There are no native `skills/list`, `skills/get`, `server/discover`, or
`resources/directory/read` handlers. `/api/skills/:id/manifest` is a Skillbox
preview API, not a substitute protocol method.

The released extension targets base protocol revision `2026-07-28`. Advertising
it requires verifying that base protocol's discovery, request metadata, cache
hints and result encoding, not merely adding two custom RPC method names.

As checked on 2026-09-18, the official TypeScript extension API was still in
[draft PR #2818](https://github.com/modelcontextprotocol/typescript-sdk/pull/2818).
Recheck SDK releases before integration; do not install a draft package as an
unreviewed production dependency. A released helper is convenient, not itself
a conformance guarantee.

## Native extension release gates

1. Adopt a supported SDK/base-protocol implementation with a tested legacy path.
2. Bind `manifestPage` to `skills/list`, and direct URI lookup to `skills/get`.
   Each entry stays atomic; no model context or file bytes should be fetched
   eagerly by the host. Direct lookup must not depend on prior enumeration.
3. Implement `server/discover`, capability negotiation and required per-request
   metadata. Verify wire-level `resultType`, `ttlMs`, and principal-scoped
   `cacheScope` against the released base schema. Do not copy a public cache
   example for private libraries. HTTP `Cache-Control: no-store` remains safe.
4. Remediate incompatible packages through explicit, conflict-checked new
   revisions. Do not rewrite existing revisions or silently drop unknown fields.
   Keep diagnostic visibility for packages omitted from native discovery.
5. Connect recommendations and copy-reference UI to canonical URIs while
   accepting old UUID references. Migrate stored links only through approved
   new revisions; hashes cover actual served bytes, not rewritten responses.
6. Keep bundles as server-side grants/composition, not auto-activated skills.
   Skip optional directory reads initially: complete manifests already list files.
7. Run official server conformance scenarios and Inspector verification. Test
   authorization, binary bytes, paging, changed manifests, revocation, missing
   resources and legacy clients. Record exact SDK/protocol/client versions.
8. Verify one real extension-aware host, including approvals, origin isolation
   and integrity failures. A generic resource browser is not enough.
9. Only then declare the extension and submit an accurate implementation-list
   entry. Keep the bootstrap and tool fallback until target hosts support it.

Package limits remain 400 files / 8 MB / 2 MB per file. These lower server-side
admission limits do **not** violate the extension's recommended server maxima
(512 files / 16 MiB); it is **hosts** that must accept packages up to those maxima.
If Skillbox later imports remote skills as a host, revisit upload/body/CLI limits
together. Raising them now is unnecessary.

## Host responsibilities

Skillbox authorizes delivery. A native host must separately enforce byte and
frontmatter verification, manifest-bound approvals, origin tagging, per-origin
caches, collision handling, and required consent for local execution or
cross-server reads. Resource delivery and owner-reviewed publication do not
grant any of those permissions. SHA-256 supplied by the same server detects
inconsistent bytes; it does not establish author trust.

## Sources

- [Released extension specification](https://github.com/modelcontextprotocol/ext-skills/blob/main/specification/stable/skills.mdx)
- [Agent Skills format](https://agentskills.io/specification)
- [Implementation tracker](https://github.com/modelcontextprotocol/ext-skills/blob/main/docs/implementations.md)
- [Client support matrix](https://modelcontextprotocol.io/extensions/client-matrix)

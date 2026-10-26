# Auto Pages

Rule-driven auto page creation for Obsidian. Auto Pages watches folders of notes, reads a
frontmatter property, and keeps a matching "topic page" alive in a target folder — the
tab-group equivalent for a clippings inbox.

## How it works

For each rule:

- Watches one or more folders (default: `00-inbox`, `Clippings`).
- Reads a frontmatter property (default: `topic`) from every note in those folders.
- For each non-empty value, ensures `<targetFolder>/<value>.md` exists (default:
  `10-topics/<value>.md`), created from an optional markdown template (`{{title}}` is
  replaced by the value).
- Idempotent and incremental: existing pages are never touched; only new or changed
  notes are processed (mtime polling, default every 5s).

All behavior is configurable in the plugin settings: multiple independent rules, each with
its own watch folders, property, target folder, file-name pattern (`<value>` placeholder),
and template. Optional: periodic cleanup of target pages whose value no longer appears in
any watched note, and an optional markdown log of creation events.

## Use cases

- Browser clippings / read-later inboxes: every clip carries a `topic` property; topic
  pages accumulate automatically.
- Any property-driven indexing: tags-as-topics, project codes, status buckets — point a
  rule at any folder + property combination.


## Duplicate handling

When a clip's `source` URL already exists in another watched note, Auto Pages detects the
pair and applies the selected policy (settings → "Duplicate handling", default **Mark**):

- **Mark** — adds a `duplicate-of: "<path>"` property to the *newer* clip's frontmatter, so
  duplicates stay visible and can be filtered in Bases (e.g. `file.hasProperty("duplicate-of")`).
- **Trash** — moves the newer clip to the trash (recoverable), keeping the original.
- **Ignore** — do nothing.

"Newer" is decided by the clip's `created` property (falling back to file mtime; ties are
broken by file path), so the behaviour is deterministic and idempotent.
## Privacy and security

- No network access: the plugin makes zero network requests (no `fetch`, no telemetry, no CDN).
  The entire source is a single file (`main.js`) you can inspect in full.
- File access is scoped to the folders you configure: notes are only read inside your
  watch folders, and the only writes are creating (or trashing, when enabled) pages in
  your target folder. No vault-wide enumeration.
- All processing happens locally inside your Obsidian app; no data leaves your device.

## Requirements

- Obsidian 1.14.5 or newer (uses the current settings component API).
- No external dependencies. No network access. No data leaves your vault.

## Development

`main.js` at the repository root is the production build (plain CommonJS, single file,
no build step required).
## Verifying release provenance

Release assets are attested with SLSA build provenance (via GitHub Actions). To verify that a
downloaded asset was built from this repository:

```bash
gh attestation verify main.js --repo cybertarian/obsidian-auto-pages
```

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

## Requirements

- Obsidian 1.14.5 or newer (uses the current settings component API).
- No external dependencies. No network access. No data leaves your vault.

## Development

`main.js` at the repository root is the production build (plain CommonJS, single file,
no build step required).
# Companion vault scripts (Windows PowerShell)

Optional helper tools for the *clippings-inbox + topic-pages* workflow that Auto Pages automates.
They are **not** part of the plugin — they run on the vault from PowerShell (Windows).

Note: the files are UTF-8 **with BOM** (required for Windows PowerShell 5.1 to read them as UTF-8).
Keep the BOM if you edit them.

## Scripts

### `sync-topic-pages.ps1` — backfill missing topic pages (one-time / batch)
Scans your clip folders for the `topic:` frontmatter property and creates any missing topic
pages from your template. Idempotent; the plugin does this incrementally in real time, so run
this only to fix a back-log of pre-existing clips.

```powershell
./sync-topic-pages.ps1 -Vault 'D:\doc\Obsidian Vault'
```

### `rename-topic.ps1` — rename a topic everywhere
Renames the topic page, updates every clip's `topic:` property, the base-block filters and
the page's H1 in one atomic pass. Use this instead of renaming by hand.

```powershell
./rename-topic.ps1 -Old 'ai-audio' -New 'tts' -Vault 'D:\doc\Obsidian Vault'
```

### `export-topic-bookmarks.ps1` — batch-open a topic
Collects the URLs from a topic page (its curated section + the `source` property of every clip
tagged with that topic) and emits a one-click `.bat` (opens all in the browser) and a `.html`
bookmark file (import into Chrome).

```powershell
./export-topic-bookmarks.ps1 -Note 'D:\doc\Obsidian Vault\10-topics\tts.md' -OutDir 'D:\doc\Obsidian Vault\10-topics'
```
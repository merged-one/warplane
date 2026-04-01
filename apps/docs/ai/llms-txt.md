# llms.txt Artifacts

Warplane generates `llms.txt` and `llms-full.txt` files following the [llms.txt convention](https://llmstxt.org/) for LLM-friendly documentation discovery.

## Files Generated

| File | Purpose | Size |
|------|---------|------|
| `llms.txt` | Discovery file with section headings and links | ~2 KB |
| `llms-full.txt` | Complete content of all key documentation | ~30 KB |
| `docs/ai/context-map.json` | Machine-readable file index with priorities | ~3 KB |

## Generation

```bash
pnpm docs:llms
```

This runs `scripts/generate-llms.mjs` which reads the documentation structure and produces all three files deterministically — same input docs always produce identical output.

## llms.txt Structure

The discovery file follows this format:

```
# Warplane
> Summary blockquote

## Product
- [path](path): description

## Architecture
- [path](path): description

...

## Optional — Lower Priority
- [path](path): description
```

Sections: Product, Architecture, Planning, Architecture Decisions, Governance, AI & Agents, Optional.

## llms-full.txt Structure

Contains the full content of key documentation files, concatenated with file path headers:

```
# Warplane — Full Documentation Context
> Generated deterministically from source docs.

---
## File: README.md
(full content)

---
## File: docs/product/one-pager.md
(full content)

...
```

## context-map.json

Machine-readable index of important files with roles and priority levels:

```json
{
  "version": 1,
  "files": [
    { "path": "README.md", "role": "Project overview", "priority": "high", "exists": true },
    ...
  ]
}
```

Priority levels: `high`, `medium`, `low`. Used by agents to decide which files to load first.

## Adding Pages

To add a new page to the generated artifacts, edit `scripts/generate-llms.mjs`:

1. Add to `SECTIONS` array for `llms.txt` inclusion
2. Add to `FULL_CONTENT_FILES` array for `llms-full.txt` inclusion
3. Add to `CONTEXT_MAP_ENTRIES` array for `context-map.json` inclusion
4. Run `pnpm docs:llms` to regenerate

# Lenses

A lens is a focused, recurring analysis pass over the brain (e.g. content inventory,
authority, language). The tick runs every `*.md` file in this folder (except this README),
in sorted order, once the lenses stage is due (every 7 days by default, or with `--force-lenses`
or `--only lenses`). Each lens gets one headless claude call with the same least-privilege flags as
every other stage.

- **Prompt:** `prompts/lenses/<lens-name>.md`. Say which brain files the lens reads and updates.
  Describe structure only, because this folder is in the PUBLIC app repo: no strategy content.
  Prefix a number to control order (e.g. `10-content-inventory.md`).
- **Data (optional):** `scripts/brain/lenses/<lens-name>.data.ts`. If present, the tick runs it first
  (`node --env-file=.env --import tsx`, read-only DB only) and writes its stdout (JSON)
  to a gitignored temp file in the worktree. The path is passed to claude under **Run context** as `Data file:`.
  The data script must print JSON to stdout and nothing else, and exit non-zero on failure.
- **Failure isolation:** a failing lens (data or claude) is logged, a `brain-tick` issue
  is opened, and the tick moves on to the next lens.

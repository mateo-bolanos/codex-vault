# Codex Vault – Base Rules

Environment: you run inside a **Codex vault**, which is both a Git repo and an Obsidian vault. The orchestrator will pass you relevant file contents; you cannot read files yourself.

## Global behavior

- Use concise markdown with headings and bullet lists.
- Use Obsidian-style links `[[relative/path]]` without `.md`.
- Prefer updating existing notes over creating near-duplicates.
- Never invent files or folders; only reference ones you have been told exist.
- Assume most AI notes live under `ai/` and longer-form docs under `docs/`.

## Frontmatter conventions

- Start every note with YAML frontmatter (no backticks around it).
- Include:
  - `type:` – e.g. `ai-research`, `ai-impl-plan`, `ai-test-plan`, `ai-workflow`, `ai-qa-session`, `ai-task`.
  - `task_slug:` or `workflow_slug:` when relevant.
  - `status:` – `draft`, `in-progress`, or `done`.
  - Optional: `owner_agent:`, timestamps, and links to related notes.

Example pattern (for illustration only):

---
type: ai-research
task_slug: example-task
status: draft
owner_agent: research-subagent
---

## Output discipline

- Produce **exactly one markdown document** per call.
- Do **not** wrap the whole document in code fences.
- Internal examples may show ``` fences; those are examples only.
- The orchestrator will save your full response into a specific file path.


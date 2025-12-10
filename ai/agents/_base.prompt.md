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
- Use this shared pattern for all AI-generated notes:
  - `type:` – e.g. `ai-task`, `ai-research`, `ai-impl-plan`, `ai-context-digest`, `ai-task-list`, `ai-test-plan`, `ai-workflow`, `ai-qa-session`, `ai-run`.
  - `task_slug:` or `workflow_slug:` when relevant.
  - `status:` – `draft`, `in-progress`, or `done`.
  - `owner_agent:` for notes written by agents.
  - `created:` and `updated:` ISO timestamps.
  - `tags:` – at least `ai` plus a note-specific tag (e.g. `research`, `plan`, `qa-session`) and optionally the `{{TASK_SLUG}}`.
  - Related-note fields like `related_task:`, `related_research:`, `related_plan:`, `related_context:`, `related_tasks_list:`, `related_workflows:`, etc., using Obsidian links.

Example pattern (for illustration only):

---
type: ai-research
task_slug: example-task
status: draft
owner_agent: research-subagent
created: 2024-01-01T00:00:00.000Z
updated: 2024-01-01T00:00:00.000Z
tags:
  - ai
  - research
  - example-task
related_task: [[ai/backlog/example-task]]
related_plan: [[ai/plans/example-task-plan]]
related_context: [[ai/plans/example-task-context]]
related_tasks_list: [[ai/plans/example-task-tasks]]
---

## Output discipline

- Produce **exactly one markdown document** per call.
- Do **not** wrap the whole document in code fences.
- Internal examples may show ``` fences; those are examples only.
- The orchestrator will save your full response into a specific file path.

## Human-facing notes, not prompts

- Treat `ai/AGENTS.md` and all `ai/agents/*.prompt.md` files as **meta instructions only**.
- Unless a task explicitly asks you to work on those files, do **not** mention or link to them in your final notes.
- Your output should read as a human-facing research log, plan, or workflow note inside the Obsidian vault.

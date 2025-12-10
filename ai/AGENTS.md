# AI Agents – Codex + Obsidian

This repo is both a **codebase** and an **Obsidian vault**.
All AI-related coordination lives under the `ai/` folder.

## Global rules

- Keep `AGENTS.md` **short and high-signal**.
- Long explanations belong in `docs/` or dedicated notes under `ai/research/`.
- Agents SHOULD:
  - Prefer small, safe changes over large refactors.
  - Update or create notes under `ai/` when they learn something important.
  - Use Obsidian-style links (`[[relative/path]]`) when referencing notes.

## Folder map (AI-specific)

- `ai/agents/` – Prompt templates for subagents (research, planning, tests, UX, etc.).
- `ai/backlog/` – One markdown file per task.
- `ai/research/` – Deep research documents about the codebase & domain.
- `ai/plans/` – Implementation plans, context digests, task lists, and test plans.
- `ai/workflows/` – End-to-end workflow descriptions.
- `ai/qa/` – Persona-based QA / UX sessions.
- `ai/runs/` – Optional execution logs created after large agent runs.

## Subagents

Each subagent has a dedicated prompt template in `ai/agents/`:

- Core:
  - `research.prompt.md` – Deep codebase + product research for a single task.
  - `impl-plan.prompt.md` – Implementation plans & task breakdowns.
- Optional:
  - `test-writer.prompt.md` – Test strategy & coverage design.
  - `user-qa.prompt.md` – Persona-based UX / QA sessions.
  - `workflow-designer.prompt.md` – End-to-end workflow / user-flow design (advanced / niche).

Codex or other orchestration code should:

1. Choose the appropriate subagent.
2. Provide:
   - a short task description,
   - a `task_slug` (e.g. `inspections-checklist-ui`),
   - and any relevant file paths.
3. Let the subagent read existing notes and create/update markdown files in `ai/`.

## Style conventions

- Use YAML frontmatter with a `type:` field to classify notes:
  - `ai-research`, `ai-impl-plan`, `ai-context-digest`, `ai-task-list`,
    `ai-test-plan`, `ai-workflow`, `ai-qa-session`, etc.
- Use headings (`#`, `##`, `###`) and bullet lists for clarity.
- When referencing other notes, always use `[[relative/path]]` without `.md`.

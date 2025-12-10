# AI Agents – Codex + Obsidian

This repo is both a **codebase** and an **Obsidian vault**.
All AI-related coordination lives under the `ai/` folder, and Obsidian’s graph view should show a clear flow from backlog → research → plans → workflows/tests/QA.

## Global rules

- Keep `AGENTS.md` **short and high-signal**.
- Long explanations belong in `docs/` or dedicated notes under `ai/research/`.
- Agents SHOULD:
  - Prefer small, safe changes over large refactors.
  - Update or create notes under `ai/` when they learn something important.
  - Use Obsidian-style links (`[[relative/path]]`) when referencing notes.

## Folder map (AI-specific)

- Start from `[[ai/ai-home]]` for the human-facing map of all AI notes (backlog → research → plans → workflows/tests/QA).
- Prompt templates for subagents live under `ai/agents/` – see `[[ai/agents/agents-overview]]`.

## Subagents

Each subagent has a dedicated prompt template in `ai/agents/`:

- Core:
  - [[ai/agents/research.prompt]] – Deep codebase + product research for a single task.
  - [[ai/agents/impl-plan.prompt]] – Implementation plans & task breakdowns.
- Optional:
  - [[ai/agents/test-writer.prompt]] – Test strategy & coverage design.
  - [[ai/agents/user-qa.prompt]] – Persona-based UX / QA sessions.
  - [[ai/agents/workflow-designer.prompt]] – End-to-end workflow / user-flow design (advanced / niche).

Codex or other orchestration code should:

1. Choose the appropriate subagent.
2. Provide:
   - a short task description,
   - a `task_slug` (e.g. `inspections-checklist-ui`),
   - and any relevant file paths.
3. Let the subagent read existing notes and create/update markdown files in `ai/`.

## Style conventions

- Every AI note starts with YAML frontmatter following the shared pattern in [[ai/agents/_base.prompt]]:
  - `type`, `task_slug`/`workflow_slug`, `status`, `owner_agent`, `created`, `updated`, `tags`, and related-note fields.
- Use headings (`#`, `##`, `###`) and bullet lists for clarity.
- When referencing other notes, always use `[[relative/path]]` without `.md`.

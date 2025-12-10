# Codex Vault – Obsidian + Agents Template

This repository is a minimal, opinionated starter for integrating **AI agents**
with an **Obsidian vault** that also serves as your codebase.

Core ideas:

- Your repo _is_ an Obsidian vault.
- All AI / agent-related files live under `ai/`.
- Prompt templates for subagents live in `ai/agents/`.
- Output notes are structured and linkable so both **Obsidian** and **agents** can work with them.
- A small Node CLI (`codex-vault`) helps you manage tasks and vault structure.

Open this folder directly as an Obsidian vault, or install the npm package
and use the CLI. Agent execution is handled by **Codex** – either via your IDE
or via the built-in helpers that shell out to `codex exec` using the prompts
in `ai/agents/`.

## Installation (Node / npm)

You need Node 18+.

There are two main ways to use this:

1. As a **template repo** – clone/fork this repo and build your project inside it.
2. As an **npm CLI** – install it and run `codex-vault init` inside any existing repo.

From this repo (local dev):

```bash
npm install -g .
```

Once published to npm:

```bash
# one-off in any repo
npx codex-vault init

# or install globally
npm install -g codex-vault
codex-vault init
```

## Quick start

From the vault root:

```bash
# 0) Initialize ai/ structure (if you don't already have it)
codex-vault init

# 1) Create a task
codex-vault task create inspections-checklist-ui --title "Inspections checklist UI" --description "Build the first version of the inspections checklist page."

# 2) List tasks
codex-vault task list

# 3) See basic vault info
codex-vault info

# 4) Run research + implementation plan for a task (requires Codex CLI)
codex-vault research inspections-checklist-ui
codex-vault plan inspections-checklist-ui
# or in one go:
codex-vault pipeline inspections-checklist-ui
```

This will:

- Create `ai/backlog/inspections-checklist-ui.md` with YAML frontmatter.
- Leave `ai/research/`, `ai/plans/`, etc. for your agents (e.g. Codex) to fill
  using the prompts in `ai/agents/`.

## CLI overview

All commands assume you run them from the vault root.

```bash
codex-vault init [--force]
codex-vault task create <slug> [--title TITLE] [--description DESC]
codex-vault task create-from-text "<text>" [--mode MODE] [--slug SLUG] [--title TITLE]
codex-vault task refine <slug>
codex-vault task list
codex-vault detect "<text>"
codex-vault research <slug> [--description DESC]
codex-vault plan <slug> [--description DESC]
codex-vault pipeline <slug> [--description DESC]
codex-vault task list
codex-vault info
```

- `init` – copy the `ai/` template (AGENTS + subagent prompts + folders) into the current repo.
- `task create` – create a backlog note under `ai/backlog/`.
- `task create-from-text` – derive a `task_slug` from free text and create a backlog note (mode controlled by `codexVault.taskCreationMode`).
- `task refine` – normalize an existing backlog note into the structured template (Goal / Current / DoD / Constraints).
- `task list` – list existing backlog tasks.
- `detect` – heuristic “does this text look like a new task?” helper (behavior controlled by `codexVault.autoDetectTasks`).
- `research` – run the Research subagent via `codex exec` and write `ai/research/<slug>-research.md`.
- `plan` – run the Implementation Plan subagent via `codex exec` and write `ai/plans/<slug>-plan.md`.
- `pipeline` – convenience: `research` followed by `plan` for a given `task_slug`.
- `info` – print a quick summary of the expected vault layout.

## Configuration (`codexVault` in package.json)

The CLI reads optional configuration from your project’s `package.json`:

```jsonc
{
  "codexVault": {
    "autoDetectTasks": "suggest",
    "taskCreationMode": "guided"
  }
}
```

- `autoDetectTasks`: `"off" | "suggest" | "auto"` – controls whether `codex-vault detect "<text>"` only prints a hint, prompts before creating a task, or auto-creates one.
- `taskCreationMode`: `"off" | "guided" | "refine" | "planThis"` – controls how new tasks are created from free text (interactive Q&A, simple backlog note, or a structured note with “run research/plan” TODOs).

This makes it easy to wire Codex Vault into your IDE or Codex CLI flows so that natural-language notes (e.g. commit messages, TODOs) can be turned into structured backlog tasks with minimal friction.

## Agent architecture

Agents are defined by markdown prompt templates under `ai/agents/`:

- `_base.prompt.md` – shared environment + style rules.
- `research.prompt.md` – Codebase Researcher.
- `impl-plan.prompt.md` – Implementation Planner.
- `workflow-designer.prompt.md` – Workflow Designer.
- `test-writer.prompt.md` – Test Writer.
- `user-qa.prompt.md` – User QA / UX.

The Node CLI is deliberately small and focused on making the vault structure
easy to work with from JS/Next.js and Codex.

## Subagent orchestration via `codex exec`

For convenience, this repo includes a thin orchestrator that shells out to the
local `codex` CLI (see the Codex SDK docs). It:

- Reads `_base.prompt.md` plus the relevant subagent prompt (`research.prompt.md`, `impl-plan.prompt.md`).
- Builds a single task string that includes:
  - the combined prompt,
  - the `task_slug` and description,
  - labeled snippets from `ai/backlog/` and `ai/research/`.
- Runs `codex exec --skip-git-repo-check "<task>"` in the current repo.
- Writes the final agent message to:
  - `ai/research/<slug>-research.md` for `research`,
  - `ai/plans/<slug>-plan.md` for `plan`.

This keeps the Codex integration on the Codex side (CLI + SDK) while giving you
a repeatable way to run subagents from any repo that has been initialized with
`codex-vault init`.

Your IDE or Codex SDK flows can still call the prompts directly for more
advanced usage (e.g. running `test-writer` or `user-qa`), but the built-in
commands are enough to demo the “main agent → subagent” pattern end to end.

## Repo layout

- `ai/AGENTS.md` – high-level rules for agents working in this vault.
- `ai/agents/` – prompt templates for subagents (research, planning, tests, UX, workflows).
- `ai/backlog/` – one markdown file per task.
- `ai/research/` – research notes generated by the Research agent.
- `ai/plans/` – implementation plans, context digests, task lists, and test plans.
- `ai/workflows/` – end-to-end workflow descriptions.
- `ai/qa/` – QA / UX sessions.
- `ai/runs/` – optional execution logs.
- `docs/` – product docs, PRDs, personas, etc.

## Why this is useful / pitch

This template is meant to be:

- **A reusable AI+Obsidian workflow starter** – drop it into any repo to get
  a consistent place for AI research, plans, workflows, and QA notes.
- **Token-conscious** – agents share a base prompt and use `task_slug` +
  frontmatter conventions so orchestrators can fetch minimal, targeted context.
- **Human-friendly** – everything is plain markdown you can read and edit in Obsidian.
- **Automation-ready** – the Node CLI is thin and easy to script or extend from Next.js or other JS code.

How you might describe it on a resume / project page:

- Designed and implemented an AI-assisted engineering workflow template that
  integrates OpenAI agents with an Obsidian-powered codebase.
- Built a Node CLI (`codex-vault`) that manages AI task notes and vault structure,
  ready to be wired into Codex or other agent runtimes.
- Introduced a token-efficient context strategy using `task_slug`-based indexing
  and shared base prompts, making it easy to reuse across projects.

For a short video or demo, walk through:

1. Opening the vault in Obsidian (show `ai/` folders).
2. Creating a task with `codex-vault task create <slug>`.
3. Showing how Codex (or another agent runner) uses the prompts in `ai/agents/`
   to generate research / plans / workflows into the `ai/` folders.
4. Explaining how this pattern can be dropped into any repo (especially a Next.js app)
   to give you an “AI co-pilot” that writes and maintains your engineering notes.

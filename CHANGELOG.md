# Changelog

All notable changes to this project will be documented in this file.

## 0.2.1 - 2025-12-10

- Fix `codex-vault init` resolution of the package root on file paths that contain spaces or other URL-encoded characters (uses `fileURLToPath(import.meta.url)`).
- When the packaged `ai/` template directory is missing, fall back to creating an empty `ai/` skeleton (`agents/`, `backlog/`, `research/`, `plans/`, `workflows/`, `qa/`, `runs/`) instead of erroring.

## 0.2.0 - 2025-12-10

- Add thin Codex orchestration module that shells out to `codex exec` and writes research/plan notes under `ai/research/` and `ai/plans/`.
- Extend the `codex-vault` CLI with:
  - `research`, `plan`, and `pipeline` commands for running subagents end to end.
  - `detect` to heuristically spot “this looks like a new task” text.
  - `task create-from-text` and `task refine` helpers for turning free text into structured backlog notes.
- Introduce `codexVault` configuration in `package.json`:
  - `autoDetectTasks` (`off | suggest | auto`).
  - `taskCreationMode` (`off | guided | refine | planThis`).
- Add Obsidian `ai/` overview notes and `.obsidian` config to make the vault usable directly in Obsidian.
- Update `README.md` and docs to describe the new commands and configuration.

## 0.1.0 - 2025-12-10

- Initial release of Codex Vault:
  - Obsidian-style `ai/` structure for tasks, research, plans, workflows, and QA.
  - Minimal `codex-vault` CLI with `init`, `task create`, `task list`, and `info`.

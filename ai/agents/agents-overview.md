---
type: ai-index
status: active
title: "AI Subagents"
tags:
  - ai
  - agents
---

# AI Subagents

Prompt templates for Codex subagents live under `ai/agents/`. They are not task notes themselves but define how agents write notes under `ai/`.

## Core prompts

- [[ai/agents/_base.prompt]] – shared rules and frontmatter conventions.
- [[ai/agents/research.prompt]] – research notes for a task.
- [[ai/agents/impl-plan.prompt]] – implementation plans, context digests, and task lists.

## Optional prompts

- [[ai/agents/test-writer.prompt]] – test plans per task.
- [[ai/agents/user-qa.prompt]] – persona-based QA / UX sessions.
- [[ai/agents/workflow-designer.prompt]] – end-to-end workflow designs.

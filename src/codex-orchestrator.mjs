/**
 * Codex orchestration helpers for Codex Vault.
 *
 * These helpers:
 * - read the subagent prompt templates under ai/agents/,
 * - assemble a single task string for `codex exec`,
 * - run Codex in non-interactive mode, and
 * - save the final markdown message into the appropriate ai/ folder.
 *
 * This module does NOT talk to OpenAI directly. It shells out to the
 * local `codex` CLI (see https://developers.openai.com/codex/sdk/).
 */

import fs from "node:fs";
import path from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

function readFileIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function requireFile(filePath, label) {
  const content = readFileIfExists(filePath);
  if (content == null) {
    throw new Error(`[codex-vault] Missing required ${label}: ${filePath}`);
  }
  return content;
}

async function runCodexExec({ cwd, task }) {
  try {
    const { stdout } = await execFile("codex", ["exec", "--skip-git-repo-check", task], {
      cwd,
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout.trim();
  } catch (err) {
    const hint =
      err.code === "ENOENT"
        ? "Is the `codex` CLI installed and on your PATH?"
        : `codex exec failed (code ${err.code ?? "unknown"})`;
    throw new Error(`[codex-vault] ${hint}`);
  }
}

function buildFileSnippet(root, relativePath) {
  const abs = path.join(root, relativePath);
  const content = readFileIfExists(abs);
  if (content == null) return null;
  return [`[FILE: ${relativePath}]`, "", content.trim(), ""].join("\n");
}

function extractShortDescriptionFromBacklog(backlogMarkdown) {
  if (!backlogMarkdown) return "";
  const lines = backlogMarkdown.split(/\r?\n/);

  // Skip frontmatter if present
  let i = 0;
  if (lines[i] === "---") {
    i++;
    while (i < lines.length && lines[i] !== "---") i++;
    if (i < lines.length && lines[i] === "---") i++;
  }

  // Skip headings, take the first non-heading, non-empty line as a short description.
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    return line;
  }
  return "";
}

function buildResearchTaskString({ root, taskSlug, taskDescription }) {
  const basePromptPath = path.join(root, "ai", "agents", "_base.prompt.md");
  const agentPromptPath = path.join(root, "ai", "agents", "research.prompt.md");
  const backlogPath = path.join(root, "ai", "backlog", `${taskSlug}.md`);

  const basePrompt = requireFile(basePromptPath, "base prompt");
  const agentPrompt = requireFile(agentPromptPath, "research prompt");
  const backlog = readFileIfExists(backlogPath);

  const shortDesc =
    taskDescription && taskDescription.trim()
      ? taskDescription.trim()
      : extractShortDescriptionFromBacklog(backlog) || `See backlog note ai/backlog/${taskSlug}.md.`;

  const snippets = [];
  const backlogSnippet = buildFileSnippet(root, path.join("ai", "backlog", `${taskSlug}.md`));
  if (backlogSnippet) snippets.push(backlogSnippet);

  const agentsSnippet = buildFileSnippet(root, path.join("ai", "AGENTS.md"));
  if (agentsSnippet) snippets.push(agentsSnippet);

  const snippetBlock = snippets.length ? ["SNIPPETS:", "", ...snippets].join("\n") : "SNIPPETS:\n\n(none)";

  return [
    basePrompt.trim(),
    "",
    agentPrompt.trim(),
    "",
    "---",
    "",
    `TASK_SLUG: ${taskSlug}`,
    "",
    "TASK_DESCRIPTION:",
    shortDesc,
    "",
    snippetBlock,
    "",
    "INSTRUCTIONS:",
    "- Act strictly according to the prompts above.",
    "- Do NOT modify files yourself; only produce markdown.",
    "- Produce exactly one markdown research note as your final message, matching the structure described in the prompt.",
    ""
  ].join("\n");
}

function buildImplPlanTaskString({ root, taskSlug, taskDescription }) {
  const basePromptPath = path.join(root, "ai", "agents", "_base.prompt.md");
  const agentPromptPath = path.join(root, "ai", "agents", "impl-plan.prompt.md");
  const backlogPath = path.join(root, "ai", "backlog", `${taskSlug}.md`);
  const researchPath = path.join(root, "ai", "research", `${taskSlug}-research.md`);

  const basePrompt = requireFile(basePromptPath, "base prompt");
  const agentPrompt = requireFile(agentPromptPath, "impl-plan prompt");
  const backlog = readFileIfExists(backlogPath);
  const research = readFileIfExists(researchPath);

  const shortDesc =
    taskDescription && taskDescription.trim()
      ? taskDescription.trim()
      : extractShortDescriptionFromBacklog(backlog) || `See backlog note ai/backlog/${taskSlug}.md.`;

  const snippets = [];
  const backlogSnippet = buildFileSnippet(root, path.join("ai", "backlog", `${taskSlug}.md`));
  if (backlogSnippet) snippets.push(backlogSnippet);
  const researchSnippet = buildFileSnippet(root, path.join("ai", "research", `${taskSlug}-research.md`));
  if (researchSnippet) snippets.push(researchSnippet);

  const snippetBlock = snippets.length ? ["SNIPPETS:", "", ...snippets].join("\n") : "SNIPPETS:\n\n(none)";

  return [
    basePrompt.trim(),
    "",
    agentPrompt.trim(),
    "",
    "---",
    "",
    `TASK_SLUG: ${taskSlug}`,
    "",
    "TASK_DESCRIPTION:",
    shortDesc,
    "",
    "REQUESTED_OUTPUT: plan", // focus on the main implementation plan note
    "",
    snippetBlock,
    "",
    "INSTRUCTIONS:",
    "- Act strictly according to the prompts above.",
    "- Focus on producing the implementation plan note (ai/plans/{{TASK_SLUG}}-plan.md) for this call.",
    "- Do NOT modify files yourself; only produce markdown.",
    "- Output exactly one markdown document as your final message, matching the plan structure described in the prompt.",
    ""
  ].join("\n");
}

export async function runResearchAgent({ root, taskSlug, taskDescription }) {
  const task = buildResearchTaskString({ root, taskSlug, taskDescription });
  const markdown = await runCodexExec({ cwd: root, task });

  const researchDir = path.join(root, "ai", "research");
  if (!fs.existsSync(researchDir)) fs.mkdirSync(researchDir, { recursive: true });
  const filePath = path.join(researchDir, `${taskSlug}-research.md`);
  fs.writeFileSync(filePath, markdown.endsWith("\n") ? markdown : markdown + "\n", "utf8");
  return filePath;
}

export async function runImplPlanAgent({ root, taskSlug, taskDescription }) {
  const researchPath = path.join(root, "ai", "research", `${taskSlug}-research.md`);
  if (!fs.existsSync(researchPath)) {
    throw new Error(
      `[codex-vault] Missing research note for ${taskSlug}. Run "codex-vault research ${taskSlug}" first.`
    );
  }

  const task = buildImplPlanTaskString({ root, taskSlug, taskDescription });
  const markdown = await runCodexExec({ cwd: root, task });

  const plansDir = path.join(root, "ai", "plans");
  if (!fs.existsSync(plansDir)) fs.mkdirSync(plansDir, { recursive: true });
  const filePath = path.join(plansDir, `${taskSlug}-plan.md`);
  fs.writeFileSync(filePath, markdown.endsWith("\n") ? markdown : markdown + "\n", "utf8");
  return filePath;
}


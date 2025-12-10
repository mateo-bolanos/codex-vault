#!/usr/bin/env node

/**
 * Minimal Node CLI for working with a Codex/Obsidian-style vault.
 *
 * This CLI:
 * - assumes the current working directory is a vault root,
 * - helps you create an `ai/` structure in any repo,
 * - helps you create task backlog notes under `ai/backlog/`,
 * - prints basic info about the vault layout.
 *
 * It does NOT call OpenAI directly; actual agent execution is expected to be
 * handled by Codex or another orchestrator that uses the prompts in `ai/agents/`.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runImplPlanAgent, runResearchAgent } from "../src/codex-orchestrator.mjs";

const VERSION = "0.1.0";
const DEFAULT_CODEX_VAULT_CONFIG = {
  autoDetectTasks: "off",
  taskCreationMode: "off"
};
const VALID_AUTO_DETECT = new Set(["off", "suggest", "auto"]);
const VALID_TASK_CREATION = new Set(["off", "guided", "refine", "planThis"]);
const NEW_TASK_VERBS = ["implement", "add", "create", "build", "support", "integrate", "ship", "deliver"];
const CODE_LIKE_PREFIXES = ["function", "const", "let", "var", "{", "(", "[", "class", "export", "import"];

function usage() {
  console.log(
    [
      "codex-vault " + VERSION,
      "",
      "Usage:",
      "  codex-vault init [--force]",
      "  codex-vault task create <slug> [--title TITLE] [--description DESC]",
      "  codex-vault task create-from-text \"<text>\" [--mode MODE] [--slug SLUG] [--title TITLE]",
      "  codex-vault task refine <slug>",
      "  codex-vault task list",
      "  codex-vault research <slug> [--description DESC]",
      "  codex-vault plan <slug> [--description DESC]",
      "  codex-vault pipeline <slug> [--description DESC]",
      "  codex-vault info",
      "  codex-vault detect \"<text>\"",
      "",
      "Examples:",
      "  codex-vault init",
      "  codex-vault task create inspections-checklist-ui --title \"Inspections checklist UI\"",
      "  codex-vault task create-from-text \"implement a kpi dashboard for ops\" --mode guided",
      "  codex-vault detect \"implement a new dashboard division view\"",
      "  codex-vault task list",
      ""
    ].join("\n")
  );
}

function vaultRoot() {
  return process.cwd();
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[codex-vault] Could not read JSON from ${filePath}: ${err.message}`);
    return null;
  }
}

function isCodexVaultProject(workspaceRoot) {
  const agentsFile = path.join(workspaceRoot, "ai", "AGENTS.md");
  const basePrompt = path.join(workspaceRoot, "ai", "agents", "_base.prompt.md");
  if (!fs.existsSync(agentsFile) || !fs.existsSync(basePrompt)) {
    return false;
  }

  const pkgPath = path.join(workspaceRoot, "package.json");
  let hasDependency = false;
  if (fs.existsSync(pkgPath)) {
    const pkg = readJsonSafe(pkgPath);
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
    hasDependency = Boolean(deps["codex-vault"]);
  }

  const aiDirExists = fs.existsSync(path.join(workspaceRoot, "ai"));
  return hasDependency || aiDirExists;
}

function getCodexVaultConfig(workspaceRoot) {
  const pkgPath = path.join(workspaceRoot, "package.json");
  const defaults = { ...DEFAULT_CODEX_VAULT_CONFIG };
  if (!fs.existsSync(pkgPath)) {
    return defaults;
  }

  const pkg = readJsonSafe(pkgPath);
  const cfg = pkg?.codexVault || {};
  const autoDetect = VALID_AUTO_DETECT.has(cfg.autoDetectTasks) ? cfg.autoDetectTasks : defaults.autoDetectTasks;
  const taskMode = VALID_TASK_CREATION.has(cfg.taskCreationMode) ? cfg.taskCreationMode : defaults.taskCreationMode;
  return { autoDetectTasks: autoDetect, taskCreationMode: taskMode };
}

// Heuristic: long, non-code sentences that mention verbs like "implement" or "add".
function looksLikeNewTask(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (CODE_LIKE_PREFIXES.some(prefix => lower.startsWith(prefix))) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 10) return false;

  return NEW_TASK_VERBS.some(verb => lower.includes(verb));
}

function deriveTaskSlugAndTitle(text) {
  const cleaned = (text || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
  const slug = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "task";

  const title = slug
    .split("-")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { slug, title: title || "Task" };
}

function createBacklogNote({ root, slug, title, description }) {
  const backlogDir = path.join(root, "ai", "backlog");
  ensureDir(backlogDir);

  const filePath = path.join(backlogDir, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    return { ok: false, error: `[codex-vault] Task already exists: ${filePath}` };
  }

  const noteTitle = title || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const desc = description || "";
  const now = new Date().toISOString();

  const content =
    [
      "---",
      "type: ai-task",
      `task_slug: ${slug}`,
      "status: todo",
      `title: ${noteTitle}`,
      `created: ${now}`,
      `updated: ${now}`,
      "tags:",
      "  - ai",
      "  - backlog",
      "---",
      "",
      "# Task",
      "",
      desc,
      "",
      "## Related Notes",
      "",
      `- [[ai/research/${slug}-research]]`,
      `- [[ai/plans/${slug}-plan]]`,
      `- [[ai/plans/${slug}-context]]`,
      `- [[ai/plans/${slug}-tasks]]`,
      `- [[ai/workflows/${slug}-workflow]]`,
      `- [[ai/qa/${slug}-qa]]`
    ].join("\n") + "\n";

  fs.writeFileSync(filePath, content, "utf8");
  return { ok: true, filePath };
}

function readFrontmatterAndBody(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: content };
  return { frontmatter: `---\n${match[1]}\n---`, body: match[2] };
}

function touchUpdated(frontmatter) {
  if (!frontmatter) return frontmatter;
  const now = new Date().toISOString();
  if (frontmatter.includes("updated:")) {
    return frontmatter.replace(/updated:\s*[^\n]*/i, `updated: ${now}`);
  }
  return frontmatter.replace(/---\s*$/, `updated: ${now}\n---`);
}

async function promptYesNo(question) {
  if (!process.stdin.isTTY) {
    return false;
  }
  const rl = readline.createInterface({ input, output });
  const answer = (await rl.question(`${question} (y/N): `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

async function promptForGuidedFields() {
  if (!process.stdin.isTTY) {
    console.warn("[codex-vault] Guided mode requires interactive input; proceeding with empty fields.");
    return { goal: "", current: "", done: "", constraints: "" };
  }
  const rl = readline.createInterface({ input, output });
  const ask = prompt => rl.question(prompt);
  const goal = await ask("Goal: ");
  const current = await ask("Current behavior: ");
  const done = await ask("Definition of done: ");
  const constraints = await ask("Constraints / Risks: ");
  rl.close();
  return { goal: goal.trim(), current: current.trim(), done: done.trim(), constraints: constraints.trim() };
}

function buildGuidedDescription(fields) {
  return (
    [
      "## Goal",
      "",
      fields.goal || "TBD",
      "",
      "## Current Behavior",
      "",
      fields.current || "TBD",
      "",
      "## Definition of Done",
      "",
      fields.done || "TBD",
      "",
      "## Constraints / Risks",
      "",
      fields.constraints || "TBD"
    ].join("\n") + "\n"
  );
}

function buildStructuredTaskBody({ slug, goalText, currentText, doneText, constraintsText, includePlanTodos }) {
  const relatedNotes = [
    `- [[ai/research/${slug}-research]]`,
    `- [[ai/plans/${slug}-plan]]`,
    `- [[ai/plans/${slug}-context]]`,
    `- [[ai/plans/${slug}-tasks]]`,
    `- [[ai/workflows/${slug}-workflow]]`,
    `- [[ai/qa/${slug}-qa]]`
  ];

  const bodyParts = [
    "# Task",
    "",
    "## Goal",
    goalText || "TBD",
    "",
    "## Current Behavior",
    currentText || "TBD",
    "",
    "## Definition of Done",
    doneText || "TBD",
    "",
    "## Constraints / Risks",
    constraintsText || "TBD",
    ""
  ];

  if (includePlanTodos) {
    bodyParts.push(
      "<!-- TODO: Run research and implementation plan subagents for this task -->",
      "<!-- Agent prompts: ai/agents/research.prompt.md, ai/agents/impl-plan.prompt.md -->",
      ""
    );
  }

  bodyParts.push("## Related Notes", "", ...relatedNotes);
  return bodyParts.join("\n") + "\n";
}

function refineBacklogNote({ root, slug, baseText, includePlanTodos }) {
  const filePath = path.join(root, "ai", "backlog", `${slug}.md`);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `[codex-vault] Task backlog not found: ${filePath}` };
  }

  const { frontmatter, body } = readFrontmatterAndBody(filePath);
  const fm = frontmatter ? `${touchUpdated(frontmatter)}\n` : "";
  const base = (baseText || body || "").trim() || "TBD";

  const structured = buildStructuredTaskBody({
    slug,
    goalText: base,
    currentText: "TBD",
    doneText: "TBD",
    constraintsText: "TBD",
    includePlanTodos
  });

  fs.writeFileSync(filePath, fm + structured, "utf8");
  return { ok: true, filePath };
}

async function runTaskCreationFlow({ root, inputText, mode, slugOverride, titleOverride }) {
  const derived = deriveTaskSlugAndTitle(inputText);
  const slug = slugOverride || derived.slug;
  const title = titleOverride || derived.title;

  if (mode === "off") {
    return { ok: false, slug, reason: "taskCreationMode is off" };
  }

  if (mode === "guided") {
    const fields = await promptForGuidedFields();
    const description = buildGuidedDescription(fields);
    const creation = createBacklogNote({ root, slug, title, description });
    return { ...creation, slug, mode };
  }

  if (mode === "refine" || mode === "planThis") {
    const creation = createBacklogNote({ root, slug, title, description: inputText });
    if (!creation.ok) {
      return { ...creation, slug, mode };
    }
    const refine = refineBacklogNote({ root, slug, baseText: inputText, includePlanTodos: mode === "planThis" });
    return { ...refine, slug, mode };
  }

  console.warn(`[codex-vault] Unknown taskCreationMode "${mode}", skipping.`);
  return { ok: false, slug, reason: "unknown taskCreationMode" };
}

async function handleDetectCommand({ inputText }) {
  const root = vaultRoot();
  if (!isCodexVaultProject(root)) {
    console.log("[codex-vault] Not a Codex Vault project. Skipping auto-detect.");
    return;
  }

  const cfg = getCodexVaultConfig(root);
  if (cfg.autoDetectTasks === "off") {
    console.log("[codex-vault] autoDetectTasks is off. No task created.");
    return;
  }

  if (!looksLikeNewTask(inputText || "")) {
    console.log("[codex-vault] Text does not look like a new task. No action taken.");
    return;
  }

  let shouldCreate = cfg.autoDetectTasks === "auto";
  if (cfg.autoDetectTasks === "suggest") {
    shouldCreate = await promptYesNo("This looks like a new Codex Vault task. Create a task from it?");
  }

  if (!shouldCreate) {
    console.log("[codex-vault] User declined task creation.");
    return;
  }

  const creation = await runTaskCreationFlow({ root, inputText, mode: cfg.taskCreationMode });
  if (!creation.ok) {
    console.error(creation.error || `[codex-vault] Failed to create task (${creation.reason || "unknown reason"}).`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `[codex-vault] Created task "${creation.slug}" via mode "${cfg.taskCreationMode}".\nFile: ${creation.filePath}`
  );
}

async function handleCreateFromTextCommand({ inputText, mode, slugOverride, title }) {
  const root = vaultRoot();
  if (!inputText) {
    console.error("[codex-vault] Missing text input for create-from-text.");
    process.exitCode = 1;
    return;
  }

  if (!isCodexVaultProject(root)) {
    console.error("[codex-vault] Not a Codex Vault project (missing ai/ scaffolding).");
    process.exitCode = 1;
    return;
  }

  const cfg = getCodexVaultConfig(root);
  const modeToUse = mode && VALID_TASK_CREATION.has(mode) ? mode : cfg.taskCreationMode;
  const creation = await runTaskCreationFlow({ root, inputText, mode: modeToUse, slugOverride, titleOverride: title });

  if (!creation.ok) {
    console.error(creation.error || `[codex-vault] Failed to create task (${creation.reason || "unknown reason"}).`);
    process.exitCode = 1;
    return;
  }

  console.log(`[codex-vault] Created task "${creation.slug}" using mode "${modeToUse}".`);
  if (creation.filePath) {
    console.log(`File: ${creation.filePath}`);
  }
}

function handleRefineCommand({ slug }) {
  const root = vaultRoot();
  if (!slug) {
    console.error("[codex-vault] Missing <slug> for task refine.");
    process.exitCode = 1;
    return;
  }
  if (!isCodexVaultProject(root)) {
    console.error("[codex-vault] Not a Codex Vault project (missing ai/ scaffolding).");
    process.exitCode = 1;
    return;
  }

  const refine = refineBacklogNote({ root, slug, baseText: undefined, includePlanTodos: false });
  if (!refine.ok) {
    console.error(refine.error || "[codex-vault] Failed to refine task.");
    process.exitCode = 1;
    return;
  }

  console.log(`[codex-vault] Refined task "${slug}".`);
  console.log(`File: ${refine.filePath}`);
}

function parseResearchOrPlanArgs(argv) {
  const args = [...argv];
  const result = { slug: null, description: null };
  result.slug = args.shift() || null;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--description" || flag === "-d") {
      result.description = args.shift() || "";
    }
  }
  return result;
}

async function handleResearchCommand({ slug, description }) {
  const root = vaultRoot();
  if (!slug) {
    console.error("[codex-vault] Missing <slug> for research.");
    usage();
    process.exitCode = 1;
    return;
  }
  if (!isCodexVaultProject(root)) {
    console.error("[codex-vault] Not a Codex Vault project (missing ai/ scaffolding).");
    process.exitCode = 1;
    return;
  }

  try {
    const filePath = await runResearchAgent({ root, taskSlug: slug, taskDescription: description || "" });
    console.log(`[codex-vault] Wrote research note to ${filePath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  }
}

async function handlePlanCommand({ slug, description }) {
  const root = vaultRoot();
  if (!slug) {
    console.error("[codex-vault] Missing <slug> for plan.");
    usage();
    process.exitCode = 1;
    return;
  }
  if (!isCodexVaultProject(root)) {
    console.error("[codex-vault] Not a Codex Vault project (missing ai/ scaffolding).");
    process.exitCode = 1;
    return;
  }

  try {
    const filePath = await runImplPlanAgent({ root, taskSlug: slug, taskDescription: description || "" });
    console.log(`[codex-vault] Wrote implementation plan to ${filePath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  }
}

async function handlePipelineCommand({ slug, description }) {
  const root = vaultRoot();
  if (!slug) {
    console.error("[codex-vault] Missing <slug> for pipeline.");
    usage();
    process.exitCode = 1;
    return;
  }
  if (!isCodexVaultProject(root)) {
    console.error("[codex-vault] Not a Codex Vault project (missing ai/ scaffolding).");
    process.exitCode = 1;
    return;
  }

  try {
    const researchPath = await runResearchAgent({ root, taskSlug: slug, taskDescription: description || "" });
    console.log(`[codex-vault] Wrote research note to ${researchPath}`);
    const planPath = await runImplPlanAgent({ root, taskSlug: slug, taskDescription: description || "" });
    console.log(`[codex-vault] Wrote implementation plan to ${planPath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const result = {
    command: null,
    subcommand: null,
    slug: null,
    title: null,
    description: null,
    mode: null,
    inputText: null,
    slugOverride: null
  };

  result.command = args.shift() || null;

  if (result.command === "detect") {
    result.inputText = args.join(" ").trim();
    return result;
  }

  if (result.command === "research" || result.command === "plan" || result.command === "pipeline") {
    const parsed = parseResearchOrPlanArgs(args);
    result.slug = parsed.slug;
    result.description = parsed.description;
    return result;
  }

  if (result.command === "task") {
    result.subcommand = args.shift() || null;
    if (result.subcommand === "create") {
      result.slug = args.shift() || null;
      while (args.length) {
        const flag = args.shift();
        if (flag === "--title" || flag === "-t") {
          result.title = args.shift() || "";
        } else if (flag === "--description" || flag === "-d") {
          result.description = args.shift() || "";
        }
      }
    } else if (result.subcommand === "create-from-text") {
      result.inputText = args.shift() || "";
      while (args.length) {
        const flag = args.shift();
        if (flag === "--mode" || flag === "-m") {
          result.mode = args.shift() || null;
        } else if (flag === "--slug") {
          result.slugOverride = args.shift() || null;
        } else if (flag === "--title" || flag === "-t") {
          result.title = args.shift() || null;
        }
      }
    } else if (result.subcommand === "refine") {
      result.slug = args.shift() || null;
    }
  }

  return result;
}

function packageRootDir() {
  const here = new URL(import.meta.url).pathname;
  return path.resolve(path.dirname(here), "..");
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
    }
  }
}

function cmdInit({ force }) {
  const root = vaultRoot();
  const targetAi = path.join(root, "ai");

  if (fs.existsSync(targetAi) && !force) {
    console.error(
      "[codex-vault] ai/ already exists here. Use --force if you want to copy template files into it."
    );
    process.exitCode = 1;
    return;
  }

  const pkgRoot = packageRootDir();
  const templateAi = path.join(pkgRoot, "ai");

  if (!fs.existsSync(templateAi)) {
    console.error("[codex-vault] Template ai/ directory not found in package.");
    process.exitCode = 1;
    return;
  }

  copyDirRecursive(templateAi, targetAi);
  console.log("[codex-vault] Initialized ai/ structure in", root);
}

function cmdInfo() {
  const root = vaultRoot();
  const aiDir = path.join(root, "ai");
  console.log("Codex Vault info:");
  console.log("  root:", root);
  console.log("  ai dir:", aiDir);
  console.log("");
  console.log("Expected layout:");
  console.log("  ai/AGENTS.md");
  console.log("  ai/agents/*.prompt.md");
  console.log("  ai/backlog/");
  console.log("  ai/research/");
  console.log("  ai/plans/");
  console.log("  ai/workflows/");
  console.log("  ai/qa/");
  console.log("  ai/runs/");
}

function cmdTaskCreate({ slug, title, description }) {
  if (!slug) {
    console.error("[codex-vault] Missing <slug> for task create.");
    usage();
    process.exitCode = 1;
    return;
  }
  const root = vaultRoot();
  const result = createBacklogNote({ root, slug, title, description });
  if (!result.ok) {
    console.error(result.error);
    process.exitCode = 1;
    return;
  }

  console.log(`[codex-vault] Created task backlog note at ${result.filePath}`);
}

function cmdTaskList() {
  const root = vaultRoot();
  const backlogDir = path.join(root, "ai", "backlog");
  if (!fs.existsSync(backlogDir)) {
    console.log("[codex-vault] No ai/backlog directory found.");
    return;
  }
  const files = fs.readdirSync(backlogDir).filter(f => f.endsWith(".md"));
  if (!files.length) {
    console.log("[codex-vault] No tasks in ai/backlog/ yet.");
    return;
  }
  console.log("Tasks in ai/backlog/:");
  for (const f of files) {
    console.log("  -", f.replace(/\.md$/, ""));
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    usage();
    return;
  }
  if (argv[0] === "-v" || argv[0] === "--version") {
    console.log(VERSION);
    return;
  }

  const parsed = parseArgs(argv);

  if (parsed.command === "init") {
    const force = argv.includes("--force");
    cmdInit({ force });
    return;
  }

  if (parsed.command === "info") {
    cmdInfo();
    return;
  }

  if (parsed.command === "research") {
    await handleResearchCommand({ slug: parsed.slug, description: parsed.description });
    return;
  }

  if (parsed.command === "plan") {
    await handlePlanCommand({ slug: parsed.slug, description: parsed.description });
    return;
  }

  if (parsed.command === "pipeline") {
    await handlePipelineCommand({ slug: parsed.slug, description: parsed.description });
    return;
  }

  if (parsed.command === "detect") {
    await handleDetectCommand(parsed);
    return;
  }

  if (parsed.command === "task") {
    if (parsed.subcommand === "create") {
      cmdTaskCreate(parsed);
    } else if (parsed.subcommand === "create-from-text") {
      await handleCreateFromTextCommand(parsed);
    } else if (parsed.subcommand === "refine") {
      handleRefineCommand(parsed);
    } else if (parsed.subcommand === "list" || parsed.subcommand === "ls") {
      cmdTaskList();
    } else {
      console.error("[codex-vault] Unknown task subcommand.");
      usage();
      process.exitCode = 1;
    }
    return;
  }

  console.error("[codex-vault] Unknown command.");
  usage();
  process.exitCode = 1;
}

await main();

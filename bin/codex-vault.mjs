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

const VERSION = "0.1.0";

function usage() {
  console.log(
    [
      "codex-vault " + VERSION,
      "",
      "Usage:",
      "  codex-vault init [--force]",
      "  codex-vault task create <slug> [--title TITLE] [--description DESC]",
      "  codex-vault task list",
      "  codex-vault info",
      "",
      "Examples:",
      "  codex-vault init",
      "  codex-vault task create inspections-checklist-ui --title \"Inspections checklist UI\"",
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

function parseArgs(argv) {
  const args = [...argv];
  const result = {
    command: null,
    subcommand: null,
    slug: null,
    title: null,
    description: null
  };

  result.command = args.shift() || null;

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
  const backlogDir = path.join(root, "ai", "backlog");
  ensureDir(backlogDir);

  const filePath = path.join(backlogDir, `${slug}.md`);
  const noteTitle = title || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const desc = description || "";

  if (fs.existsSync(filePath)) {
    console.error(`[codex-vault] Task already exists: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const content =
    [
      "---",
      "type: ai-task",
      `task_slug: ${slug}`,
      "status: todo",
      `title: ${noteTitle}`,
      "---",
      "",
      "# Task",
      "",
      desc
    ].join("\n") + "\n";

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`[codex-vault] Created task backlog note at ${filePath}`);
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

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
    usage();
    return;
  }
  if (argv[0] === "-v" || argv[0] === "--version") {
    console.log(VERSION);
    return;
  }

  if (argv[0] === "init") {
    const force = argv.includes("--force");
    cmdInit({ force });
    return;
  }

  if (argv[0] === "info") {
    cmdInfo();
    return;
  }

  if (argv[0] === "task") {
    const parsed = parseArgs(argv);
    if (parsed.subcommand === "create") {
      cmdTaskCreate(parsed);
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

main();

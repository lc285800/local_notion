# AGENTS.md

This repository prefers predictable, low-friction workflows for local development and GitHub publishing.

## Project Context

- Project type: local-first Markdown notebook web app
- Frontend: Vite + React
- Backend: Node.js + Express
- Local notes data lives in `docs/` and should stay local by default

## Working Rules

- Prefer making code changes directly instead of stopping at analysis.
- Preserve local-first behavior: `.md` files and image assets remain on local disk.
- Do not commit local notebook content from `docs/` unless the user explicitly asks.
- Keep `README.md` accurate when major product behavior changes.

## GitHub Workflow Preference

When the task involves GitHub, use this order of operations:

1. Prefer the GitHub plugin / connector for repository, PR, issue, and metadata operations.
2. Use local `git` for normal source control actions inside the repo:
   - `git status`
   - `git add`
   - `git commit`
   - `git push`
3. Use `gh` CLI only as a fallback when the GitHub plugin cannot complete the task or when the task is explicitly about local GitHub CLI behavior.

## Publishing Defaults

- Default branch: `main`
- Preferred remote naming: `origin`
- If a remote repo already exists, push there instead of creating a new repo.
- Before first push, verify that `.gitignore` excludes:
  - `node_modules/`
  - `dist/`
  - `docs/`
  - `config.json`

## GitHub Authentication Notes

- A broken `gh auth status` does not necessarily mean Git access is broken.
- If GitHub plugin access works, prefer it over spending extra steps on `gh auth login`.
- If `git push` already works, do not interrupt the workflow just to repair `gh`.
- Only ask the user to re-authenticate `gh` when a required GitHub action cannot be completed by plugin or normal `git` remote access.

## UI / Product Direction

- Favor a clear workbench layout over decorative landing-page styling.
- The expected interaction model is:
  - left sidebar for search, notes list, and export
  - right main area for current note metadata, note creation, and direct editing
- Markdown source should stay secondary; the default editing experience should feel like rendered content.

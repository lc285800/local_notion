# Local Notion

Local Notion is a local-first Markdown notebook that runs in the browser and stores notes as real files on your machine.

It is designed for long-form writing, local knowledge management, screenshot-heavy notes, and publishing Markdown to platforms such as CSDN without damaging the original local files.

## Current Version

`v0.1`

This version focuses on the core notebook workflow:

- Local Markdown editing
- Real `.md` files on disk
- Pasted image saving
- Relative image paths
- Note search, creation, rename, and delete
- Notion-like two-pane writing UI
- CSDN Markdown export placeholder workflow

## Features

- Notes are saved as standard `.md` files under `docs/`.
- The editor uses a rendered Markdown editing experience while keeping Markdown as the source of truth.
- Pasted screenshots and images are saved locally next to the current note.
- Images use stable relative Markdown paths such as `![image](./article.assets/20260425-153012.png)`.
- The left pane supports search, note switching, note creation, right-click rename, and right-click delete.
- New notes are created as `未命名.md`, then `未命名-1.md`, `未命名-2.md`, and so on when names conflict.
- The right pane keeps the editor prominent with autosave, `Cmd/Ctrl + S`, toolbar editing, word count, and a collapsible note list.
- The Share menu contains copy content, export PDF through the browser print dialog, export Markdown + images, and a disabled read-only page placeholder.

## Local Storage

The default local workspace looks like this:

```text
notion_local/
├── docs/
│   ├── article.md
│   ├── article.assets/
│   │   └── 20260425-153012.png
│   └── 未命名.md
├── server/
├── src/
├── config.json
└── package.json
```

`docs/` and `config.json` are local runtime data and are ignored by git by default.

## Image Rules

When an image is pasted into a note:

1. The frontend sends the image to the local server.
2. The server saves it in the current note's sibling assets directory.
3. The editor inserts a relative Markdown image path.

Example:

```md
![image](./article.assets/20260425-153012.png)
```

Supported image formats:

- `png`
- `jpg`
- `jpeg`
- `webp`

Screenshots are saved as PNG by default.

## Development

Install dependencies:

```bash
npm install
```

Start the local app:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

The development server starts:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Build and run production mode:

```bash
npm run build
npm start
```

## Git Policy

This repository stores app source code, not personal notebook data.

Ignored by default:

- `node_modules/`
- `dist/`
- `docs/`
- `config.json`

## Project Docs

- [DESIGN.md](./DESIGN.md) explains the product design, architecture, storage model, and current implementation decisions.
- [AGENTS.md](./AGENTS.md) records collaboration and GitHub workflow preferences for coding agents.

## Roadmap

- Real CSDN image upload adapter
- Better PDF export pipeline
- Read-only page generation
- Tags and metadata search
- Desktop packaging for macOS and Windows
- Bundle splitting for the editor dependency

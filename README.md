# Notion Local

A local-first Markdown notebook app with a Notion-like workflow.

The app runs in the browser, stores every note as a real local `.md` file, saves pasted images next to the current document, and keeps the export path open for CSDN publishing.

## Features

- Local Markdown notes stored as plain `.md` files
- WYSIWYG-style editing with Markdown as the source of truth
- Paste screenshots or images directly into a note
- Images saved to a sibling `<note-name>.assets/` directory
- Relative image paths inserted automatically
- Search, rename, delete, and note switching
- Manual save with `Cmd/Ctrl + S`
- Export Markdown for CSDN without mutating the original local file

## Local Storage Layout

```text
notion_local/
├── docs/
│   ├── article-1.md
│   ├── article-1.assets/
│   │   └── 20260425-153012.png
│   └── article-2.md
├── server/
├── src/
└── package.json
```

Example image path:

```md
![image](./article-1.assets/20260425-153012.png)
```

## Development

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Production build:

```bash
npm run build
npm start
```

## Notes About Git

This repository is intended to store the app source code.

Local notebook data is ignored by git:

- `docs/`
- `config.json`
- `dist/`
- `node_modules/`

## Roadmap

- CSDN image upload adapter
- Optional autosave
- Better large-bundle code splitting
- Desktop packaging for macOS / Windows

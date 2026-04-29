# Local Notion Design Document

## Overview

Local Notion is a browser-based local notebook app for editing Markdown files with a Notion-like writing experience.

The main product principle is local ownership: notes remain standard Markdown files on disk, images remain normal local image files, and exports never mutate the original local note.

## Goals

- Provide a clean two-pane notebook interface for daily writing.
- Keep every note as a standard `.md` file.
- Save pasted images beside the current note in a predictable assets directory.
- Insert portable relative Markdown image paths.
- Preserve local data and avoid browser-only storage such as IndexedDB as the source of truth.
- Support a publishing workflow where local image paths can be converted to hosted image URLs during export.

## Non-Goals

- The app does not store images as base64 inside Markdown.
- The app does not rely on absolute local image paths.
- The app does not treat browser cache, IndexedDB, or localStorage as the canonical note database.
- The current version does not implement real CSDN image upload, read-only page hosting, or a dedicated PDF rendering backend.

## User Experience

The app is intentionally focused on a single writing surface.

- Left pane: search, new note, and note list.
- Right pane: save state, share menu, more menu, editable note title, metadata, toolbar, and editor content.
- The note list can be collapsed to give the editor more space.
- The browser page itself does not scroll; the note list and editor content are the local scroll regions.

Primary workflows:

- Create a note with `+`.
- Select a note from the left list.
- Edit title and content directly in the right pane.
- Paste screenshots or images into the editor.
- Save automatically or with `Cmd/Ctrl + S`.
- Export Markdown + images from the Share menu.

## UI Layout

The app uses a two-column layout:

```text
App
├── NoteListPane
│   ├── Search
│   ├── NewNoteButton
│   ├── GroupTitle
│   └── ScrollableNoteList
└── EditorPane
    ├── Topbar
    │   ├── SidebarToggle
    │   ├── SaveState
    │   ├── ShareMenu
    │   └── MoreMenu
    ├── EditorHeader
    │   ├── EditableTitle
    │   ├── FileName
    │   ├── CreatedAt
    │   ├── UpdatedAt
    │   └── TagPlaceholder
    └── EditorCard
        ├── Toolbar
        ├── ScrollableEditorContent
        └── WordCount
```

Layout rules:

- `html`, `body`, `#root`, and the app root are fixed to the viewport height.
- The browser-level page does not scroll.
- The note list scrolls independently.
- The editor content scrolls independently.
- The topbar, title area, and toolbar remain fixed while writing.

## Frontend Architecture

Frontend stack:

- React
- Vite
- MDXEditor

Core responsibilities:

- Load and display notes from the local backend.
- Maintain the active note draft.
- Transform local relative image paths into browser-loadable `/files/...` URLs for editing.
- Transform browser image URLs back into relative Markdown paths before saving.
- Track dirty/saving/saved state.
- Autosave with a short debounce.
- Support `Cmd/Ctrl + S` immediate save.
- Render the Share and More menus.

Important UI state:

- `notes`: note list returned by the backend.
- `activePath`: current note path.
- `draft`: current note data and content.
- `savedContent`: last saved Markdown content.
- `isSaving`: save request in progress.
- `searchQuery`: current note search query.
- `activeMenu`: open menu state.
- `isSidebarCollapsed`: left pane collapsed state.

## Backend Architecture

Backend stack:

- Node.js
- Express
- Multer

Core responsibilities:

- Manage the local `docs/` workspace.
- List notes and return metadata.
- Read and write Markdown files.
- Create unique note filenames.
- Rename notes and move matching assets directories.
- Delete notes and matching assets directories.
- Receive pasted images and save them beside the active note.
- Generate export Markdown without mutating local source files.

Important routes:

```text
GET    /api/notes?query=
GET    /api/note?path=&scope=notes
POST   /api/notes
PUT    /api/note?path=&scope=notes
PATCH  /api/note/rename?path=
DELETE /api/note?path=&scope=notes
POST   /api/images/paste
POST   /api/export/csdn?path=
```

Trash-related backend functions still exist from earlier versions, but the current UI uses direct delete with confirmation.

## Storage Model

Runtime data lives under the project root:

```text
docs/
├── note.md
├── note.assets/
│   └── 20260425-153012.png
└── another-note.md
```

Each note is a real Markdown file.

For a note named:

```text
article.md
```

its image directory is:

```text
article.assets/
```

Markdown image references remain relative:

```md
![image](./article.assets/20260425-153012.png)
```

## Note Naming

New notes default to:

```text
未命名.md
```

If a file already exists, the backend generates:

```text
未命名-1.md
未命名-2.md
未命名-3.md
```

File names allow letters, numbers, Chinese characters, underscores, and hyphens. Spaces and unsupported symbols are normalized.

## Title Model

The note title is not stored in a separate database.

The title is derived from the first Markdown H1:

```md
# My Note Title
```

When the title input changes:

- If the note already has an H1, the app updates it.
- If the note has no H1, the app inserts one at the top.
- The left note list title updates immediately.

This keeps the local `.md` file portable and self-describing.

## Image Paste Flow

```text
Paste image
→ Frontend upload handler
→ POST /api/images/paste
→ Server writes image into <note>.assets/
→ Server returns relative Markdown path
→ Editor inserts image reference
→ Save stores standard Markdown
```

The editor temporarily uses `/files/...` URLs so the browser can preview local images. Before saving, those URLs are converted back to `./...` relative paths.

## Save Flow

Save states:

- `未保存`
- `保存中`
- `✓ 已保存`

Save triggers:

- Autosave after a short debounce when content changes.
- Immediate save with `Cmd/Ctrl + S`.

On save:

1. The frontend reads the editor Markdown.
2. Browser image URLs are converted back to relative Markdown paths.
3. `PUT /api/note` writes the Markdown file.
4. The backend returns updated file metadata.
5. The frontend refreshes the current note and note list metadata.

## Export Flow

The Share menu contains `导出 Markdown + 图片`.

The current implementation calls:

```text
POST /api/export/csdn?path=
```

The export service currently preserves the extension point for uploading local images to a hosted image provider or CSDN image endpoint. Export output is displayed separately and does not overwrite the original local Markdown file.

## Current Limitations

- CSDN image upload is not fully implemented.
- PDF export uses the browser print dialog instead of a dedicated rendering pipeline.
- Read-only page generation is shown as a disabled future feature.
- Tags are visible as an entry point but are not stored yet.
- MDXEditor increases the frontend bundle size; code splitting is a future optimization.

## Future Work

- Add real image upload providers for CSDN export.
- Store tags in frontmatter or a sidecar metadata file.
- Add full-text search snippets and match highlighting.
- Add optional app-level settings.
- Add desktop packaging for macOS and Windows.
- Add import/export of complete notebooks.
- Add a safer archive or trash model if direct delete becomes too risky for daily use.

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

### macOS Login Autostart

For a stable macOS login startup, run the app from a runtime copy outside
`~/Documents`. macOS privacy controls can block background `launchd` jobs from
starting correctly when the working directory is under `~/Documents`.

The current recommended runtime location is:

```text
~/Applications/notion_local_runtime
```

One-time setup:

```bash
mkdir -p ~/Applications/notion_local_runtime
rsync -a --delete --exclude '.git/' --exclude 'logs/' ~/Documents/notion_local/ ~/Applications/notion_local_runtime/
mkdir -p ~/Applications/notion_local_runtime/logs
```

Create `~/Library/LaunchAgents/com.evanliu.notion-local.plist` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.evanliu.notion-local</string>

  <key>ProgramArguments</key>
  <array>
    <string>/Users/evanliu/.local/bin/node</string>
    <string>server/index.js</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>3001</string>
    <key>PATH</key>
    <string>/Users/evanliu/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>

  <key>WorkingDirectory</key>
  <string>/Users/evanliu/Applications/notion_local_runtime</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>/Users/evanliu/Applications/notion_local_runtime/logs/launchd.out.log</string>

  <key>StandardErrorPath</key>
  <string>/Users/evanliu/Applications/notion_local_runtime/logs/launchd.err.log</string>
</dict>
</plist>
```

Load or restart the service:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.evanliu.notion-local.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.evanliu.notion-local.plist
launchctl enable gui/$(id -u)/com.evanliu.notion-local
launchctl kickstart -k gui/$(id -u)/com.evanliu.notion-local
```

Verify:

```bash
launchctl print gui/$(id -u)/com.evanliu.notion-local
lsof -nP -iTCP:3001 -sTCP:LISTEN
curl -I http://localhost:3001
```

Open:

```text
http://localhost:3001
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

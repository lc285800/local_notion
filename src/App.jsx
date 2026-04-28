import { useEffect, useMemo, useRef, useState } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  headingsPlugin,
  imagePlugin,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  Separator,
  StrikeThroughSupSubToggles,
  tablePlugin,
  toolbarPlugin,
  UndoRedo
} from "@mdxeditor/editor";

const emptyNote = {
  path: "",
  title: "",
  content: "",
  scope: "notes",
  originalPath: ""
};

function App() {
  const editorRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const [notes, setNotes] = useState([]);
  const [activePath, setActivePath] = useState("");
  const [draft, setDraft] = useState(emptyNote);
  const [savedContent, setSavedContent] = useState("");
  const [status, setStatus] = useState("Loading notes...");
  const [isSaving, setIsSaving] = useState(false);
  const [newNoteName, setNewNoteName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [exportedMarkdown, setExportedMarkdown] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [renameState, setRenameState] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      return;
    }

    loadNotes();
  }, [searchQuery]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    function handleClose() {
      setContextMenu(null);
    }

    window.addEventListener("click", handleClose);
    window.addEventListener("resize", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("resize", handleClose);
    };
  }, [contextMenu]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      if (!draft.path) {
        return;
      }

      event.preventDefault();
      saveNote();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draft.path, draft.content]);

  const assetBasePath = useMemo(() => {
    if (!draft.path) {
      return "/files/";
    }

    const segments = draft.path.split("/");
    segments.pop();
    const noteDir = segments.length ? `${segments.join("/")}/` : "";
    return `/files/${noteDir}`;
  }, [draft.path]);

  const editorMarkdown = useMemo(() => {
    if (!draft.path) {
      return draft.content;
    }

    return transformMarkdownForEditor(draft.content, assetBasePath);
  }, [assetBasePath, draft.content, draft.path]);

  const derivedTitle = useMemo(() => {
    return extractTitleFromContent(draft.path, draft.content);
  }, [draft.content, draft.path]);

  const isDirty = !!draft.path && draft.content !== savedContent;

  useEffect(() => {
    if (!editorRef.current || !draft.path) {
      return;
    }

    const currentMarkdown = editorRef.current.getMarkdown();
    if (currentMarkdown !== editorMarkdown) {
      editorRef.current.setMarkdown(editorMarkdown);
    }
  }, [draft.path, editorMarkdown]);

  async function initializeApp() {
    const nextNotes = await loadNotes();
    hasInitializedRef.current = true;

    if (nextNotes[0]) {
      await openNote(nextNotes[0].path);
      return;
    }

    setEmptyState("Create your first note to get started.");
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  async function loadNotes() {
    const query = encodeURIComponent(searchQuery);
    const notesData = await fetchJson(`/api/notes?query=${query}`);
    setNotes(notesData.notes);
    return notesData.notes;
  }

  async function openNote(notePath) {
    const data = await fetchJson(`/api/note?path=${encodeURIComponent(notePath)}&scope=notes`);
    setActivePath(data.path);
    setDraft(data);
    setSavedContent(data.content);
    setStatus(`Opened ${data.path}`);
    setExportedMarkdown("");
    setContextMenu(null);
  }

  function setEmptyState(message) {
    setActivePath("");
    setDraft(emptyNote);
    setSavedContent("");
    setExportedMarkdown("");
    setStatus(message);
  }

  async function createNote() {
    try {
      const requestedName = newNoteName.trim() || createTimestampNoteName();
      const data = await fetchJson("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: requestedName })
      });

      setNewNoteName("");
      await loadNotes();
      await openNote(data.path);
      setStatus(`Created ${data.path}`);

      requestAnimationFrame(() => {
        editorRef.current?.focus();
      });
    } catch (error) {
      setStatus(error.message);
    }
  }

  function createTimestampNoteName() {
    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      "-",
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
      "-",
      String(now.getMilliseconds()).padStart(3, "0")
    ].join("");

    return `note-${stamp}.md`;
  }

  function syncDraftFromEditor() {
    if (!editorRef.current || !draft.path) {
      return draft.content;
    }

    const nextMarkdown = transformMarkdownForStorage(
      editorRef.current.getMarkdown(),
      assetBasePath
    );

    if (nextMarkdown !== draft.content) {
      const nextTitle = extractTitleFromContent(draft.path, nextMarkdown);
      setDraft((current) => ({
        ...current,
        content: nextMarkdown,
        title: nextTitle
      }));
      setNotes((current) =>
        current.map((note) =>
          note.path === draft.path ? { ...note, title: nextTitle } : note
        )
      );
    }

    return nextMarkdown;
  }

  async function saveNote() {
    if (!draft.path) {
      return;
    }

    try {
      setIsSaving(true);
      const content = syncDraftFromEditor();
      const data = await fetchJson(
        `/api/note?path=${encodeURIComponent(draft.path)}&scope=notes`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        }
      );
      setSavedContent(content);
      setStatus(data.message || "Saved");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function exportCsdnMarkdown() {
    if (!draft.path) {
      return;
    }

    try {
      syncDraftFromEditor();
      const data = await fetchJson(
        `/api/export/csdn?path=${encodeURIComponent(draft.path)}`,
        { method: "POST" }
      );
      setExportedMarkdown(data.markdown);
      setStatus(data.message);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function uploadImage(imageFile) {
    if (!draft.path) {
      throw new Error("Open a note before uploading images");
    }

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("notePath", draft.path);
    formData.append("originalType", imageFile.type);

    const response = await fetch("/api/images/paste", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Image upload failed");
    }

    setStatus(`Image saved to ${data.markdownPath}`);
    return `${assetBasePath}${data.markdownPath.replace("./", "")}`;
  }

  function openRenameDialog(note) {
    setContextMenu(null);
    setRenameState({
      path: note.path,
      name: getFileNameWithoutExtension(note.path)
    });
  }

  async function submitRename(event) {
    event.preventDefault();
    if (!renameState?.path) {
      return;
    }

    try {
      const data = await fetchJson(
        `/api/note/rename?path=${encodeURIComponent(renameState.path)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameState.name })
        }
      );

      setRenameState(null);
      await loadNotes();

      if (activePath === renameState.path) {
        await openNote(data.note.path);
      }

      setStatus(data.message);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteNote(note) {
    try {
      const data = await fetchJson(
        `/api/note?path=${encodeURIComponent(note.path)}&scope=notes`,
        { method: "DELETE" }
      );
      setContextMenu(null);
      const nextNotes = await loadNotes();

      if (activePath === note.path) {
        if (nextNotes[0]) {
          await openNote(nextNotes[0].path);
        } else {
          setEmptyState("No notes left. Create one to start writing.");
        }
      }

      setStatus(data.message);
    } catch (error) {
      setStatus(error.message);
    }
  }

  const showEmptyWorkspace = !draft.path;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-search">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="search"
          />
        </div>

        <div className="sidebar-notes">
          <div className="sidebar-label">notes</div>
          <div className="note-list">
            {notes.map((note) => (
              <button
                key={note.path}
                className={`note-item ${note.path === activePath ? "active" : ""}`}
                onClick={() => openNote(note.path)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    note
                  });
                }}
              >
                <span>{note.title}</span>
                <small>{note.path}</small>
              </button>
            ))}

            {!notes.length && <div className="empty-list">No notes</div>}
          </div>
        </div>

        <button
          className="sidebar-export"
          onClick={exportCsdnMarkdown}
          disabled={!draft.path}
        >
          Export Markdown + Images
        </button>
      </aside>

      <main className="workspace">
        <section className="doc-strip">
          <div className="doc-strip-main">
            <div className="doc-file">{draft.path || "article-1.md"}</div>
            <div className="doc-title-wrap">
              <span className={`save-dot ${isDirty ? "dirty" : "saved"}`} />
              <span className="doc-title">{derivedTitle || "笔记的标题"}</span>
            </div>
          </div>
          <button onClick={saveNote} disabled={!draft.path || isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </section>

        <section className="new-note-strip">
          <button onClick={createNote}>new note</button>
          <input
            value={newNoteName}
            onChange={(event) => setNewNoteName(event.target.value)}
            placeholder="新建一个笔记"
          />
        </section>

        {showEmptyWorkspace ? (
          <section className="empty-workspace">
            <h2>No note selected</h2>
            <p>Create a note or pick one from the left list.</p>
          </section>
        ) : (
          <section className="editor-card">
            <MDXEditor
              ref={editorRef}
              markdown={editorMarkdown || "# "}
              className="rich-editor-shell"
              contentEditableClassName="rich-editor-content"
              placeholder="直接写内容，支持粘贴图片。按 Ctrl / Cmd + S 保存。"
              plugins={[
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                linkPlugin(),
                tablePlugin(),
                markdownShortcutPlugin(),
                imagePlugin({
                  imageUploadHandler: uploadImage
                }),
                toolbarPlugin({
                  toolbarClassName: "editor-toolbar",
                  toolbarContents: () => (
                    <>
                      <UndoRedo />
                      <Separator />
                      <BlockTypeSelect />
                      <Separator />
                      <BoldItalicUnderlineToggles />
                      <StrikeThroughSupSubToggles />
                      <Separator />
                      <ListsToggle />
                      <CreateLink />
                      <InsertImage />
                      <InsertTable />
                      <InsertThematicBreak />
                    </>
                  )
                })
              ]}
              onChange={(markdown) => {
                const nextContent = transformMarkdownForStorage(markdown, assetBasePath);
                const nextTitle = extractTitleFromContent(draft.path, nextContent);
                setDraft((current) => ({
                  ...current,
                  content: nextContent,
                  title: nextTitle
                }));
                setNotes((current) =>
                  current.map((note) =>
                    note.path === activePath ? { ...note, title: nextTitle } : note
                  )
                );
              }}
            />
          </section>
        )}

        <footer className="status-bar">
          <span>{status}</span>
          {draft.path && <span>Ctrl / Cmd + S 保存</span>}
        </footer>

        {exportedMarkdown && (
          <section className="export-panel">
            <div className="pane-title">Exported Markdown</div>
            <textarea readOnly value={exportedMarkdown} />
          </section>
        )}
      </main>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => openRenameDialog(contextMenu.note)}>Rename</button>
          <button onClick={() => deleteNote(contextMenu.note)}>Delete</button>
        </div>
      )}

      {renameState && (
        <div className="modal-backdrop" onClick={() => setRenameState(null)}>
          <form className="modal-card" onClick={(event) => event.stopPropagation()} onSubmit={submitRename}>
            <h2>Rename Note</h2>
            <input
              autoFocus
              value={renameState.name}
              onChange={(event) =>
                setRenameState((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="new-file-name"
            />
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setRenameState(null)}>
                Cancel
              </button>
              <button type="submit">Save Name</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function extractTitleFromContent(notePath, content) {
  const heading = content
    .split("\n")
    .find((line) => line.trim().startsWith("# "))
    ?.replace(/^# /, "")
    .trim();

  if (heading) {
    return heading;
  }

  return notePath ? notePath.split("/").pop()?.replace(/\.md$/i, "") || "Untitled" : "";
}

function getFileNameWithoutExtension(notePath) {
  return notePath.split("/").pop()?.replace(/\.md$/i, "") || "";
}

function transformMarkdownForEditor(content, assetBasePath) {
  return content.replace(/(!?\[[^\]]*\]\()(\.\/[^)]+)(\))/g, (_match, prefix, relativePath, suffix) => {
    return `${prefix}${assetBasePath}${relativePath.replace("./", "")}${suffix}`;
  });
}

function transformMarkdownForStorage(markdown, assetBasePath) {
  const normalizedBase = assetBasePath.endsWith("/") ? assetBasePath : `${assetBasePath}/`;
  const escapedBase = normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(escapedBase, "g"), "./");
}

export default App;

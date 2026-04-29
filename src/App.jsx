import { useEffect, useMemo, useRef, useState } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  CreateLink,
  headingsPlugin,
  imagePlugin,
  InsertCodeBlock,
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
  originalPath: "",
  createdAt: "",
  updatedAt: ""
};

function App() {
  const editorRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const [notes, setNotes] = useState([]);
  const [activePath, setActivePath] = useState("");
  const [draft, setDraft] = useState(emptyNote);
  const [savedContent, setSavedContent] = useState("");
  const [status, setStatus] = useState("正在加载笔记...");
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportedMarkdown, setExportedMarkdown] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [renameState, setRenameState] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
    return extractTitleFromContent(draft.path, draft.content) || "未命名";
  }, [draft.content, draft.path]);

  const isDirty = !!draft.path && draft.content !== savedContent;
  const wordCount = useMemo(() => countWords(draft.content), [draft.content]);
  const saveLabel = isSaving ? "保存中" : isDirty ? "未保存" : "✓ 已保存";

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
    if (!activeMenu) {
      return;
    }

    function handlePointerDown() {
      setActiveMenu(null);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setActiveMenu(null);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenu]);

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
  }, [draft.path, draft.content, assetBasePath]);

  useEffect(() => {
    if (!draft.path || !isDirty || isSaving) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      saveNote();
    }, 1200);

    return () => window.clearTimeout(saveTimer);
  }, [draft.path, draft.content, savedContent, isSaving]);

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

    setEmptyState("点击 + 创建第一篇笔记");
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
    setStatus(`已打开 ${data.path}`);
    setExportedMarkdown("");
    setContextMenu(null);
    setActiveMenu(null);
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
      const data = await fetchJson("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "未命名.md" })
      });

      setNotes((current) => [toNoteListItem(data), ...current.filter((note) => note.path !== data.path)]);
      await openNote(data.path);
      setStatus(`已创建 ${data.path}`);

      requestAnimationFrame(() => {
        document.querySelector(".title-input")?.focus();
      });
    } catch (error) {
      setStatus(error.message);
    }
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
      if (data.note) {
        setDraft((current) => ({ ...current, ...data.note, content }));
        setNotes((current) =>
          [toNoteListItem({ ...data.note, content }), ...current.filter((note) => note.path !== data.note.path)]
        );
      }
      setStatus(data.message || "已保存");
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
      await saveNote();
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

    setStatus(`图片已保存到 ${data.markdownPath}`);
    return `${assetBasePath}${data.markdownPath.replace("./", "")}`;
  }

  function updateTitle(nextTitle) {
    if (!draft.path) {
      return;
    }

    const cleanTitle = nextTitle || "未命名";
    const nextContent = setMarkdownTitle(draft.content, cleanTitle);
    setDraft((current) => ({
      ...current,
      title: cleanTitle,
      content: nextContent
    }));
    setNotes((current) =>
      current.map((note) =>
        note.path === draft.path ? { ...note, title: cleanTitle } : note
      )
    );

    const nextEditorMarkdown = transformMarkdownForEditor(nextContent, assetBasePath);
    if (editorRef.current?.getMarkdown() !== nextEditorMarkdown) {
      editorRef.current?.setMarkdown(nextEditorMarkdown);
    }
  }

  async function copyContent() {
    if (!draft.path) {
      return;
    }

    await navigator.clipboard.writeText(syncDraftFromEditor());
    setActiveMenu(null);
    setStatus("已复制当前笔记内容");
  }

  function exportPdf() {
    setActiveMenu(null);
    window.print();
  }

  function openRenameDialog(note = draft) {
    if (!note?.path) {
      return;
    }

    setContextMenu(null);
    setActiveMenu(null);
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

  async function deleteNote(note = draft) {
    if (!note?.path) {
      return;
    }

    const confirmed = window.confirm(`确认删除「${note.title || note.path}」吗？这个操作会删除本地 md 和图片资源。`);
    if (!confirmed) {
      return;
    }

    try {
      const data = await fetchJson(
        `/api/note?path=${encodeURIComponent(note.path)}&scope=notes`,
        { method: "DELETE" }
      );
      setContextMenu(null);
      setActiveMenu(null);
      const nextNotes = await loadNotes();

      if (activePath === note.path) {
        if (nextNotes[0]) {
          await openNote(nextNotes[0].path);
        } else {
          setEmptyState("没有笔记了，点击 + 创建一篇");
        }
      }

      setStatus(data.message);
    } catch (error) {
      setStatus(error.message);
    }
  }

  const showEmptyWorkspace = !draft.path;

  return (
    <div className={`app ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="note-list-pane">
        <div className="note-list-header">
          <div className="search-row">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索笔记..."
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button new-note-button" onClick={createNote} title="新建笔记">
              +
            </button>
          </div>
        </div>

        <div className="note-group-title">笔记</div>

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
              <span className="note-item-title">{note.title || "未命名"}</span>
              <span className="note-item-file">{note.path}</span>
              <span className="note-item-time">{formatListDate(note.updatedAt)}</span>
            </button>
          ))}

          {!notes.length && <div className="empty-list">没有匹配的笔记</div>}
        </div>
      </aside>

      <main className="editor-pane">
        <div className="editor-topbar">
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            title={isSidebarCollapsed ? "展开笔记列表" : "折叠笔记列表"}
          >
            {isSidebarCollapsed ? "☰" : "‹"}
          </button>
          <div className="topbar-actions">
            <span className={`save-state ${isSaving ? "saving" : isDirty ? "dirty" : "saved"}`}>
              {saveLabel}
            </span>
            <div className="menu-anchor" onMouseDown={(event) => event.stopPropagation()}>
              <button className="secondary-command" onClick={() => setActiveMenu(activeMenu === "share" ? null : "share")}>
                <span aria-hidden="true">↥</span>
                分享
              </button>
              {activeMenu === "share" && (
                <div className="dropdown-menu share-menu" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="dropdown-title">分享</div>
                  <button onClick={copyContent} disabled={!draft.path}>
                    <span>⧉</span>
                    复制内容
                  </button>
                  <button onClick={exportPdf} disabled={!draft.path}>
                    <span>⇩</span>
                    导出为 PDF
                  </button>
                  <button
                    onClick={async () => {
                      setActiveMenu(null);
                      await exportCsdnMarkdown();
                    }}
                    disabled={!draft.path}
                  >
                    <span>↥</span>
                    导出 Markdown + 图片
                  </button>
                  <button disabled>
                    <span>◎</span>
                    生成只读页面（即将推出）
                  </button>
                </div>
              )}
            </div>
            <div className="menu-anchor" onMouseDown={(event) => event.stopPropagation()}>
              <button className="icon-button more-button" onClick={() => setActiveMenu(activeMenu === "more" ? null : "more")}>
                ...
              </button>
              {activeMenu === "more" && (
                <div className="dropdown-menu more-menu" onMouseDown={(event) => event.stopPropagation()}>
                  <button onClick={() => openRenameDialog()}>
                    <span>✎</span>
                    重命名
                  </button>
                  <button className="danger" onClick={() => deleteNote()}>
                    <span>⌫</span>
                    删除笔记
                  </button>
                  <button disabled>
                    <span>▣</span>
                    在文件夹中显示
                  </button>
                  <button disabled>
                    <span>⚙</span>
                    设置
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {showEmptyWorkspace ? (
          <section className="empty-workspace">
            <h2>没有选中笔记</h2>
            <p>从左侧选择一篇笔记，或点击 + 新建。</p>
          </section>
        ) : (
          <>
            <section className="editor-header">
              <input
                className="title-input"
                value={derivedTitle}
                onChange={(event) => updateTitle(event.target.value)}
                aria-label="笔记标题"
              />
              <div className="note-meta">
                <span>▧ {draft.path}</span>
                <span>创建于 {formatMetaDate(draft.createdAt)}</span>
                <span>更新于 {formatMetaDate(draft.updatedAt)}</span>
              </div>
              <button className="tag-entry" type="button">添加标签...</button>
            </section>

            <section className="editor-card">
              <MDXEditor
                ref={editorRef}
                markdown={editorMarkdown || "# 未命名\n\n"}
                className="rich-editor-shell"
                contentEditableClassName="rich-editor-content"
                placeholder="开始记录..."
                plugins={[
                  headingsPlugin(),
                  listsPlugin(),
                  quotePlugin(),
                  codeBlockPlugin({ defaultCodeBlockLanguage: "txt" }),
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
                        <Separator />
                        <CreateLink />
                        <InsertCodeBlock />
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
              <div className="word-count">{wordCount} 个字</div>
            </section>

            {exportedMarkdown && (
              <section className="export-panel">
                <div className="pane-title">导出的 Markdown</div>
                <textarea readOnly value={exportedMarkdown} />
              </section>
            )}
          </>
        )}

        <div className="sr-status" aria-live="polite">{status}</div>
      </main>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => openRenameDialog(contextMenu.note)}>重命名</button>
          <button className="danger" onClick={() => deleteNote(contextMenu.note)}>删除</button>
        </div>
      )}

      {renameState && (
        <div className="modal-backdrop" onClick={() => setRenameState(null)}>
          <form className="modal-card" onClick={(event) => event.stopPropagation()} onSubmit={submitRename}>
            <h2>重命名笔记</h2>
            <input
              autoFocus
              value={renameState.name}
              onChange={(event) =>
                setRenameState((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="新文件名"
            />
            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={() => setRenameState(null)}>
                取消
              </button>
              <button type="submit">保存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function toNoteListItem(note) {
  return {
    path: note.path,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt
  };
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

  return notePath ? notePath.split("/").pop()?.replace(/\.md$/i, "") || "未命名" : "";
}

function setMarkdownTitle(content, title) {
  const normalizedTitle = title.trim() || "未命名";
  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim().startsWith("# "));

  if (headingIndex >= 0) {
    lines[headingIndex] = `# ${normalizedTitle}`;
    return lines.join("\n");
  }

  return `# ${normalizedTitle}\n\n${content}`;
}

function countWords(content) {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[#>*_`~\-[\]()+.!|]/g, " ")
    .trim();

  if (!text) {
    return 0;
  }

  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const latinWords = text
    .replace(/[\u4e00-\u9fff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return chineseChars + latinWords;
}

function getFileNameWithoutExtension(notePath) {
  return notePath.split("/").pop()?.replace(/\.md$/i, "") || "";
}

function formatListDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `今天 ${date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })}`;
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatMetaDate(value) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return `今天 ${date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })}`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
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

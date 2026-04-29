import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { ensureWorkspace } from "./config.js";
import {
  createNote,
  deleteNotePermanently,
  deleteTrashNotePermanently,
  listNotes,
  listTrashNotes,
  moveNoteToTrash,
  readNote,
  renameNote,
  restoreTrashNote,
  saveNote
} from "./noteService.js";
import { savePastedImage } from "./imageService.js";
import { exportNoteToCsdn } from "./csdnExporter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer();
const port = process.env.PORT || 3001;

await ensureWorkspace();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/files", express.static(path.join(process.cwd(), "docs")));

app.get("/api/notes", async (request, response) => {
  const notes = await listNotes(request.query.query || "");
  response.json({ notes });
});

app.get("/api/trash", async (request, response) => {
  const notes = await listTrashNotes(request.query.query || "");
  response.json({ notes });
});

app.get("/api/note", async (request, response) => {
  try {
    const note = await readNote(request.query.path, request.query.scope || "notes");
    response.json(note);
  } catch (error) {
    response.status(404).json({ error: error.message });
  }
});

app.post("/api/notes", async (request, response) => {
  try {
    const note = await createNote(request.body.name);
    response.status(201).json(note);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.put("/api/note", async (request, response) => {
  try {
    const note = await saveNote(
      request.query.path,
      request.body.content || "",
      request.query.scope || "notes"
    );
    response.json({ note, message: "Note saved locally." });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.patch("/api/note/rename", async (request, response) => {
  try {
    const note = await renameNote(request.query.path, request.body.name);
    response.json({
      note,
      message: `Renamed to ${note.path}`
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/note/trash", async (request, response) => {
  try {
    const note = await moveNoteToTrash(request.query.path);
    response.json({
      note,
      message: `Moved ${note.originalPath} to Trash`
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/note/restore", async (request, response) => {
  try {
    const note = await restoreTrashNote(request.query.path);
    response.json({
      note,
      message: `Restored ${note.path}`
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.delete("/api/note", async (request, response) => {
  try {
    if (request.query.scope === "trash") {
      await deleteTrashNotePermanently(request.query.path);
      response.json({ message: `Deleted ${request.query.path} permanently` });
      return;
    }

    await deleteNotePermanently(request.query.path, "notes");
    response.json({ message: `Deleted ${request.query.path}` });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/images/paste", upload.single("image"), async (request, response) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "No image received" });
      return;
    }

    const result = await savePastedImage({
      notePath: request.body.notePath,
      file: request.file,
      originalType: request.body.originalType || request.file.mimetype
    });

    response.status(201).json(result);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/export/csdn", async (request, response) => {
  try {
    const note = await readNote(request.query.path);
    const result = await exportNoteToCsdn(note);
    response.json({
      markdown: result.markdown,
      message: `Generated CSDN Markdown. Replaced ${result.imageCount} local image(s).`
    });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(process.cwd(), "dist")));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(process.cwd(), "dist", "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Notion Local server running at http://localhost:${port}`);
  console.log(`Frontend source root: ${path.join(__dirname, "..", "src")}`);
});

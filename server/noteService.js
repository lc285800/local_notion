import path from "path";
import { promises as fs } from "fs";
import { docsDir } from "./config.js";

const trashFolderName = ".trash";
const trashDir = path.join(docsDir, trashFolderName);
const scopeRoots = {
  notes: docsDir,
  trash: trashDir
};

function sanitizeSegment(segment) {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

function normalizeNoteName(name) {
  const trimmed = String(name || "").trim().replaceAll("\\", "/");
  if (!trimmed) {
    throw new Error("Note name is required");
  }

  const withExt = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
  return withExt.replace(/^\/+/, "");
}

function sanitizeNotePath(notePath) {
  const normalized = normalizeNoteName(notePath);
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments.pop()?.replace(/\.md$/i, "");

  if (!fileName) {
    throw new Error("Note name is required");
  }

  const safeSegments = segments.map(sanitizeSegment);
  safeSegments.push(`${sanitizeSegment(fileName)}.md`);
  return safeSegments.join("/");
}

function sanitizeFileNameOnly(fileName) {
  const normalized = String(fileName || "").trim();
  if (!normalized) {
    throw new Error("File name is required");
  }

  if (normalized.includes("/") || normalized.includes("\\")) {
    throw new Error("Rename only supports a file name, not folders");
  }

  const stem = normalized.replace(/\.md$/i, "");
  return `${sanitizeSegment(stem)}.md`;
}

function normalizeNotePathForScope(notePath) {
  return normalizeNoteName(notePath).replaceAll("\\", "/");
}

function getScopeRoot(scope) {
  return scopeRoots[scope] || docsDir;
}

function toAbsoluteNotePath(notePath, scope = "notes") {
  return path.join(getScopeRoot(scope), normalizeNotePathForScope(notePath));
}

function relativePathFromScope(scope, fullPath) {
  return path.relative(getScopeRoot(scope), fullPath).replaceAll(path.sep, "/");
}

function notePathMatchesQuery(title, content, query) {
  if (!query) {
    return true;
  }

  const haystack = `${title}\n${content}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function timestampSuffix(label = "deleted") {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return `--${label}-${date}-${time}`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureScope(scope) {
  await fs.mkdir(getScopeRoot(scope), { recursive: true });
}

async function removeIfExists(targetPath) {
  if (await pathExists(targetPath)) {
    await fs.rm(targetPath, { recursive: true, force: true });
  }
}

async function resolveUniqueNotePath(scope, requestedPath, label = "copy") {
  const root = getScopeRoot(scope);
  const normalized = normalizeNotePathForScope(requestedPath);
  const directory = path.dirname(normalized);
  const stem = path.basename(normalized, ".md");
  let candidate = normalized;
  let counter = 0;

  while (await pathExists(path.join(root, candidate))) {
    counter += 1;
    const suffix = counter === 1 ? timestampSuffix(label) : `${timestampSuffix(label)}-${counter}`;
    const fileName = `${stem}${suffix}.md`;
    candidate = directory === "." ? fileName : path.join(directory, fileName);
  }

  return candidate.replaceAll(path.sep, "/");
}

async function readTrashMeta(notePath) {
  const metaPath = getTrashMetaPath(notePath);
  if (!(await pathExists(metaPath))) {
    return null;
  }

  const raw = await fs.readFile(metaPath, "utf8");
  return JSON.parse(raw);
}

async function writeTrashMeta(notePath, meta) {
  const metaPath = getTrashMetaPath(notePath);
  await fs.mkdir(path.dirname(metaPath), { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
}

function getTrashMetaPath(notePath) {
  return `${toAbsoluteNotePath(notePath, "trash")}.meta.json`;
}

export function getTitleFromContent(notePath, content) {
  const heading = content
    .split("\n")
    .find((line) => line.trim().startsWith("# "))
    ?.replace(/^# /, "")
    .trim();

  return heading || path.basename(notePath, ".md");
}

export function getAssetsDirForNote(notePath) {
  const stem = path.basename(notePath, ".md");
  const assetsName = getAssetsDirNameForNote(notePath);
  const directory = path.dirname(notePath);
  return directory === "." ? assetsName : path.join(directory, assetsName).replaceAll(path.sep, "/");
}

export function getAssetsDirNameForNote(notePath) {
  const stem = path.basename(notePath, ".md");
  return `${stem}.assets`;
}

export function getAbsoluteAssetsDir(notePath, scope = "notes") {
  return path.join(getScopeRoot(scope), getAssetsDirForNote(notePath));
}

async function walkNotes(currentDir, scope, notes, query) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (scope === "notes" && entry.name === trashFolderName) {
      continue;
    }

    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkNotes(fullPath, scope, notes, query);
      continue;
    }

    if (!entry.name.endsWith(".md") || entry.name.endsWith(".md.meta.json")) {
      continue;
    }

    const relativePath = relativePathFromScope(scope, fullPath);
    const content = await fs.readFile(fullPath, "utf8");
    const title = getTitleFromContent(relativePath, content);

    if (!notePathMatchesQuery(title, content, query)) {
      continue;
    }

    const note = {
      path: relativePath,
      title
    };

    if (scope === "trash") {
      const meta = await readTrashMeta(relativePath);
      note.originalPath = meta?.originalPath || relativePath;
    }

    notes.push(note);
  }
}

export async function listNotes(query = "") {
  await ensureScope("notes");
  const notes = [];
  await walkNotes(docsDir, "notes", notes, query);
  return notes.sort((a, b) => a.path.localeCompare(b.path));
}

export async function listTrashNotes(query = "") {
  await ensureScope("trash");
  const notes = [];
  await walkNotes(trashDir, "trash", notes, query);
  return notes.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readNote(notePath, scope = "notes") {
  const normalizedPath = normalizeNotePathForScope(notePath);
  const fullPath = toAbsoluteNotePath(normalizedPath, scope);
  const content = await fs.readFile(fullPath, "utf8");
  const note = {
    path: normalizedPath,
    title: getTitleFromContent(normalizedPath, content),
    content,
    scope
  };

  if (scope === "trash") {
    const meta = await readTrashMeta(normalizedPath);
    note.originalPath = meta?.originalPath || normalizedPath;
  }

  return note;
}

export async function createNote(name) {
  const normalized = sanitizeNotePath(name);
  const fullPath = toAbsoluteNotePath(normalized, "notes");
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  if (await pathExists(fullPath)) {
    throw new Error("Note already exists");
  }

  const title = path.basename(normalized, ".md");
  const initialContent = `# ${title}\n\n`;
  await fs.writeFile(fullPath, initialContent, "utf8");

  return {
    path: normalized,
    title,
    content: initialContent,
    scope: "notes"
  };
}

export async function saveNote(notePath, content, scope = "notes") {
  const fullPath = toAbsoluteNotePath(notePath, scope);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
}

export async function renameNote(notePath, nextFileName) {
  const currentPath = normalizeNotePathForScope(notePath);
  const newFileName = sanitizeFileNameOnly(nextFileName);
  const directory = path.dirname(currentPath);
  const nextPath = directory === "." ? newFileName : path.join(directory, newFileName).replaceAll(path.sep, "/");

  if (currentPath === nextPath) {
    return readNote(currentPath, "notes");
  }

  const currentAbsolutePath = toAbsoluteNotePath(currentPath, "notes");
  const nextAbsolutePath = toAbsoluteNotePath(nextPath, "notes");
  if (await pathExists(nextAbsolutePath)) {
    throw new Error("A note with that file name already exists");
  }

  await fs.mkdir(path.dirname(nextAbsolutePath), { recursive: true });
  await fs.rename(currentAbsolutePath, nextAbsolutePath);

  const currentAssetsPath = getAbsoluteAssetsDir(currentPath, "notes");
  const nextAssetsPath = getAbsoluteAssetsDir(nextPath, "notes");
  if (await pathExists(currentAssetsPath)) {
    await fs.rename(currentAssetsPath, nextAssetsPath);
  }

  return readNote(nextPath, "notes");
}

export async function moveNoteToTrash(notePath) {
  const currentPath = normalizeNotePathForScope(notePath);
  const currentAbsolutePath = toAbsoluteNotePath(currentPath, "notes");
  if (!(await pathExists(currentAbsolutePath))) {
    throw new Error("Note not found");
  }

  const trashPath = await resolveUniqueNotePath("trash", currentPath, "deleted");
  const trashAbsolutePath = toAbsoluteNotePath(trashPath, "trash");
  await fs.mkdir(path.dirname(trashAbsolutePath), { recursive: true });
  await fs.rename(currentAbsolutePath, trashAbsolutePath);

  const currentAssetsPath = getAbsoluteAssetsDir(currentPath, "notes");
  const trashAssetsPath = getAbsoluteAssetsDir(trashPath, "trash");
  if (await pathExists(currentAssetsPath)) {
    await fs.mkdir(path.dirname(trashAssetsPath), { recursive: true });
    await fs.rename(currentAssetsPath, trashAssetsPath);
  }

  await writeTrashMeta(trashPath, {
    originalPath: currentPath,
    deletedAt: new Date().toISOString()
  });

  return readNote(trashPath, "trash");
}

export async function restoreTrashNote(notePath) {
  const trashPath = normalizeNotePathForScope(notePath);
  const meta = await readTrashMeta(trashPath);
  const requestedPath = meta?.originalPath || trashPath;
  const restoredPath = await resolveUniqueNotePath("notes", requestedPath, "restored");

  const trashAbsolutePath = toAbsoluteNotePath(trashPath, "trash");
  const restoredAbsolutePath = toAbsoluteNotePath(restoredPath, "notes");
  await fs.mkdir(path.dirname(restoredAbsolutePath), { recursive: true });
  await fs.rename(trashAbsolutePath, restoredAbsolutePath);

  const trashAssetsPath = getAbsoluteAssetsDir(trashPath, "trash");
  const restoredAssetsPath = getAbsoluteAssetsDir(restoredPath, "notes");
  if (await pathExists(trashAssetsPath)) {
    await fs.mkdir(path.dirname(restoredAssetsPath), { recursive: true });
    await fs.rename(trashAssetsPath, restoredAssetsPath);
  }

  await removeIfExists(getTrashMetaPath(trashPath));
  return readNote(restoredPath, "notes");
}

export async function deleteTrashNotePermanently(notePath) {
  const trashPath = normalizeNotePathForScope(notePath);
  await removeIfExists(toAbsoluteNotePath(trashPath, "trash"));
  await removeIfExists(getAbsoluteAssetsDir(trashPath, "trash"));
  await removeIfExists(getTrashMetaPath(trashPath));
}

export async function deleteNotePermanently(notePath, scope = "notes") {
  const normalizedPath = normalizeNotePathForScope(notePath);
  await removeIfExists(toAbsoluteNotePath(normalizedPath, scope));
  await removeIfExists(getAbsoluteAssetsDir(normalizedPath, scope));

  if (scope === "trash") {
    await removeIfExists(getTrashMetaPath(normalizedPath));
  }
}

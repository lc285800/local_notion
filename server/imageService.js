import path from "path";
import { promises as fs } from "fs";
import {
  getAbsoluteAssetsDir,
  getAssetsDirNameForNote
} from "./noteService.js";

const allowedMimeTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp"
};

function timestampName(extension) {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ];
  return `${parts.join("")}.${extension}`;
}

export async function savePastedImage({ notePath, file, originalType }) {
  const extension = allowedMimeTypes[originalType] || "png";
  const assetsDir = getAbsoluteAssetsDir(notePath);
  const fileName = timestampName(extension);
  const absoluteFilePath = path.join(assetsDir, fileName);

  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(absoluteFilePath, file.buffer);

  return {
    fileName,
    absoluteFilePath,
    markdownPath: `./${getAssetsDirNameForNote(notePath)}/${fileName}`
  };
}

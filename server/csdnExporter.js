import path from "path";
import { promises as fs } from "fs";
import { docsDir } from "./config.js";
import { getAbsoluteAssetsDir } from "./noteService.js";

const localImagePattern = /!\[([^\]]*)\]\((\.\/[^)]+)\)/g;

async function uploadImagePlaceholder(notePath, relativePath) {
  const assetPath = relativePath.replace(/^\.\//, "");
  const absolutePath = path.join(docsDir, path.dirname(notePath), assetPath);

  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Missing local image: ${relativePath}`);
  }

  return `https://img-blog.csdnimg.cn/mock/${path.basename(relativePath)}`;
}

export async function exportNoteToCsdn(note) {
  const assetsDir = getAbsoluteAssetsDir(note.path);
  await fs.mkdir(assetsDir, { recursive: true });

  const lines = note.content.split("\n");
  const output = [];
  let inCodeFence = false;
  let imageCount = 0;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }

    if (inCodeFence) {
      output.push(line);
      continue;
    }

    let transformedLine = line;
    let match;

    while ((match = localImagePattern.exec(line)) !== null) {
      const [fullMatch, altText, relativePath] = match;
      const remoteUrl = await uploadImagePlaceholder(note.path, relativePath);
      transformedLine = transformedLine.replace(
        fullMatch,
        `![${altText}](${remoteUrl})`
      );
      imageCount += 1;
    }

    localImagePattern.lastIndex = 0;
    output.push(transformedLine);
  }

  return {
    markdown: output.join("\n"),
    imageCount
  };
}

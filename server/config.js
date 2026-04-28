import path from "path";
import { promises as fs } from "fs";

export const rootDir = process.cwd();
export const docsDir = path.join(rootDir, "docs");
export const configPath = path.join(rootDir, "config.json");

const defaultConfig = {
  notesDir: "docs",
  imageDirMode: "stem-assets",
  imageExtensions: ["png", "jpg", "jpeg", "webp"],
  export: {
    csdn: {
      enabled: false,
      provider: "mock"
    }
  }
};

export async function ensureWorkspace() {
  await fs.mkdir(docsDir, { recursive: true });

  try {
    await fs.access(configPath);
  } catch {
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");
  }
}

export async function loadConfig() {
  await ensureWorkspace();
  const raw = await fs.readFile(configPath, "utf8");
  return { ...defaultConfig, ...JSON.parse(raw) };
}
